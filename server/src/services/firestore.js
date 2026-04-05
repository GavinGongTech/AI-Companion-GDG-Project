import { db } from "../db/firebase.js";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Save an analyze interaction to Firestore.
 * Creates a document in users/{uid}/events/{auto-id}.
 *
 * @param {string} uid        - Firebase Auth UID
 * @param {object} params
 * @param {string} params.courseId
 * @param {string} params.content      - The original text/question
 * @param {string} params.eventType    - "explain" | "quiz"
 * @param {object} params.response     - The Gemini structured response
 * @param {object} params.classifierTag - { conceptNode, errorType, confidence }
 * @returns {Promise<string>} The created event document ID
 */
export async function saveInteraction(uid, { courseId, content, eventType, response, classifierTag }) {
  const eventRef = db.collection("users").doc(uid).collection("events").doc();

  await eventRef.set({
    courseId: courseId || null,
    eventType,
    content,
    response,
    classifierTag,
    createdAt: FieldValue.serverTimestamp(),
  });

  return eventRef.id;
}

/**
 * Update the Student Misconception Graph (SMG) for a concept node.
 * Creates or updates users/{uid}/smg/{conceptNode}.
 *
 * @param {string} uid
 * @param {object} params
 * @param {string} params.conceptNode
 * @param {string} params.errorType
 * @param {number} params.confidence
 * @param {string} params.courseId
 * @param {boolean} [params.isCorrect] - For quiz interactions
 */
export async function updateSMG(uid, { conceptNode, errorType, confidence: _confidence, courseId, isCorrect }) {
  const smgRef = db.collection("users").doc(uid).collection("smg").doc(conceptNode);
  const doc = await smgRef.get();

  if (doc.exists) {
    const data = doc.data();
    const count = (data.interactionCount || 0) + 1;
    const oldAccuracy = data.accuracyRate || 0;

    // Update accuracy rate as running average
    const newAccuracy = isCorrect !== undefined
      ? oldAccuracy + (((isCorrect ? 1 : 0) - oldAccuracy) / count)
      : oldAccuracy;

    // Update error type frequency map
    const errorTypeMap = data.errorTypeMap || {};
    if (errorType) {
      errorTypeMap[errorType] = (errorTypeMap[errorType] || 0) + 1;
    }

    // SM-2 style: next review pushed out on correct, pulled in on incorrect
    const daysUntilReview = isCorrect === false ? 1 : Math.min((data.reviewIntervalDays || 1) * 2, 30);
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + daysUntilReview);

    await smgRef.update({
      accuracyRate: newAccuracy,
      errorTypeMap,
      interactionCount: count,
      lastErrorAt: isCorrect === false ? FieldValue.serverTimestamp() : data.lastErrorAt,
      nextReviewDate,
      reviewIntervalDays: daysUntilReview,
      courseId: courseId || data.courseId,
    });
  } else {
    // First interaction with this concept
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + 1);

    await smgRef.set({
      courseId: courseId || null,
      accuracyRate: isCorrect !== undefined ? (isCorrect ? 1 : 0) : 0,
      errorTypeMap: errorType ? { [errorType]: 1 } : {},
      interactionCount: 1,
      lastErrorAt: isCorrect === false ? FieldValue.serverTimestamp() : null,
      nextReviewDate,
      reviewIntervalDays: 1,
    });
  }
}

/**
 * Ensure a user document exists in Firestore.
 * Called on first authenticated request.
 *
 * @param {string} uid
 * @param {string} email
 * @param {string} displayName
 */
export async function ensureUserDoc(uid, email, displayName) {
  const userRef = db.collection("users").doc(uid);
  const doc = await userRef.get();

  if (!doc.exists) {
    await userRef.set({
      email,
      displayName: displayName || null,
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}
