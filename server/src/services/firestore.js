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
