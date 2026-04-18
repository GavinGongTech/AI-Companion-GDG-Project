import { db } from "../db/firebase.js";
import { FieldValue } from "firebase-admin/firestore";
import { logger } from "../logger.js";

/**
 * SM-2 algorithm parameters.
 * - easeFactor starts at 2.5, minimum 1.3
 * - interval starts at 1 day, grows by easeFactor on correct answers
 * - quality: 0-2 = incorrect (reset), 3 = hard correct, 4 = correct, 5 = easy
 */
export function sm2(prevInterval, prevEaseFactor, quality) {
  let easeFactor = prevEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Math.max(1.3, easeFactor);

  let interval;
  if (quality < 3) {
    // Failed: reset interval
    interval = 1;
  } else if (prevInterval === 0) {
    interval = 1;
  } else if (prevInterval === 1) {
    interval = 6;
  } else {
    interval = Math.round(prevInterval * easeFactor);
  }

  return { interval: Math.min(interval, 365), easeFactor };
}

/**
 * Map classifier confidence + correctness to SM-2 quality score (0-5).
 *
 * @param {boolean|undefined} isCorrect
 * @param {string} errorType
 * @param {number} confidence
 * @returns {number}
 */
export function toQuality(isCorrect, errorType, confidence) {
  if (isCorrect === false) {
    // Incorrect: quality 0-2 based on how confident the classifier is
    return confidence > 0.8 ? 0 : confidence > 0.5 ? 1 : 2;
  }
  if (isCorrect === true) {
    // Correct: quality 3-5
    if (errorType === "none") return 5;
    return confidence > 0.7 ? 3 : 4;
  }
  // Explain mode (no correct/incorrect): treat as quality 3 (exposure)
  return 3;
}

/**
 * Record a student interaction and update the SMG using SM-2 scheduling.
 * Updates users/{uid}/smg/{conceptNode} in-place.
 *
 * @param {string}  uid
 * @param {string}  conceptNode
 * @param {object}  params
 * @param {string}  params.errorType
 * @param {number}  params.confidence
 * @param {string}  [params.courseId]
 * @param {boolean} [params.isCorrect]
 */
export async function recordInteraction(uid, conceptNode, { errorType, confidence, courseId, isCorrect }) {
  const smgRef = db.collection("users").doc(uid).collection("smg").doc(conceptNode);
  const doc = await smgRef.get();

  const quality = toQuality(isCorrect, errorType, confidence);

  if (doc.exists) {
    const data = doc.data();
    const count = (data.interactionCount || 0) + 1;

    // SM-2 update
    const prevInterval = data.reviewIntervalDays ?? 1;
    const prevEase = data.easeFactor || 2.5;
    const { interval, easeFactor } = sm2(prevInterval, prevEase, quality);

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);

    // Running accuracy rate
    const correctCount = (data.correctCount || 0) + (isCorrect === true ? 1 : 0);
    const incorrectCount = (data.incorrectCount || 0) + (isCorrect === false ? 1 : 0);
    const totalAnswered = correctCount + incorrectCount;
    const accuracyRate = totalAnswered > 0 ? correctCount / totalAnswered : 0;

    // Error type frequency map
    const errorTypeMap = data.errorTypeMap || {};
    if (errorType && errorType !== "none") {
      errorTypeMap[errorType] = (errorTypeMap[errorType] || 0) + 1;
    }

    await smgRef.update({
      accuracyRate,
      correctCount,
      incorrectCount,
      errorTypeMap,
      interactionCount: count,
      easeFactor,
      reviewIntervalDays: interval,
      nextReviewDate,
      lastInteractionAt: FieldValue.serverTimestamp(),
      lastErrorAt: isCorrect === false ? FieldValue.serverTimestamp() : (data.lastErrorAt || null),
      courseId: courseId ?? data.courseId ?? null,
    });
    if (accuracyRate >= 0.9) {
      db.collection("users").doc(uid).collection("gamification").doc("stats")
        .set({ maxAccuracy: accuracyRate }, { merge: true })
        .catch((err) => logger.warn({ err, uid, conceptNode }, 'gamification stat sync failed'));
    }
  } else {
    // First interaction with this concept
    const { interval, easeFactor } = sm2(0, 2.5, quality);
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);

    const firstAccuracy = isCorrect !== undefined ? (isCorrect ? 1 : 0) : 0;
    await smgRef.set({
      courseId: courseId || null,
      accuracyRate: firstAccuracy,
      correctCount: isCorrect === true ? 1 : 0,
      incorrectCount: isCorrect === false ? 1 : 0,
      errorTypeMap: errorType && errorType !== "none" ? { [errorType]: 1 } : {},
      interactionCount: 1,
      easeFactor,
      reviewIntervalDays: interval,
      nextReviewDate,
      lastInteractionAt: FieldValue.serverTimestamp(),
      lastErrorAt: isCorrect === false ? FieldValue.serverTimestamp() : null,
    });
    const newConceptUpdates = { conceptCount: FieldValue.increment(1) };
    if (firstAccuracy >= 0.9) newConceptUpdates.maxAccuracy = firstAccuracy;
    db.collection("users").doc(uid).collection("gamification").doc("stats")
      .set(newConceptUpdates, { merge: true })
      .catch((err) => logger.warn({ err, uid, conceptNode }, 'gamification stat sync failed'));
  }
}

/**
 * Get the student's weakest concepts, ordered by lowest accuracy and nearest review date.
 * Used to weight quiz generation toward areas of weakness.
 *
 * @param {string} uid
 * @param {number} limit
 * @returns {Promise<Array<{ conceptNode: string, accuracyRate: number, errorTypeMap: object, nextReviewDate: Date, interactionCount: number }>>}
 */
export async function getWeakestConcepts(uid, limit = 10) {
  const smgRef = db.collection("users").doc(uid).collection("smg");

  // Get concepts due for review (nextReviewDate <= now)
  const now = new Date();
  const snap = await smgRef
    .where("nextReviewDate", "<=", now)
    .orderBy("nextReviewDate", "asc")
    .limit(limit)
    .get();

  if (snap.empty) {
    // Fall back to lowest accuracy concepts
    const fallback = await smgRef
      .orderBy("accuracyRate", "asc")
      .limit(limit)
      .get();
    return fallback.docs.map((doc) => ({ conceptNode: doc.id, ...doc.data() }));
  }

  return snap.docs.map((doc) => ({ conceptNode: doc.id, ...doc.data() }));
}

/**
 * Get the full SMG graph for a user (all concept nodes).
 *
 * @param {string} uid
 * @returns {Promise<Array<{ conceptNode: string, accuracyRate: number, errorTypeMap: object, nextReviewDate: Date, interactionCount: number }>>}
 */
export async function getGraph(uid) {
  const snap = await db.collection("users").doc(uid).collection("smg").get();
  return snap.docs.map((doc) => ({ conceptNode: doc.id, ...doc.data() }));
}

/**
 * Get the spaced repetition drill queue — concepts due for review,
 * weighted by accuracy rate and urgency.
 *
 * @param {string} uid
 * @param {number} limit
 * @returns {Promise<Array<{ conceptNode: string, accuracyRate: number, nextReviewDate: Date, urgency: number }>>}
 */
export async function getDrillQueue(uid, limit = 20) {
  const smgRef = db.collection("users").doc(uid).collection("smg");
  const now = new Date();
  const lookahead = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const snap = await smgRef
    .where("nextReviewDate", "<=", lookahead)
    .orderBy("nextReviewDate", "asc")
    .limit(limit * 5)
    .get();

  const items = snap.docs.map((doc) => {
    const data = doc.data();
    const reviewDate = data.nextReviewDate?.toDate?.() || data.nextReviewDate || now;
    const overdueDays = Math.max(0, (now - reviewDate) / (1000 * 60 * 60 * 24));
    // Urgency: higher = more urgent. Overdue items + low accuracy = most urgent
    const urgency = overdueDays * 2 + (1 - (data.accuracyRate || 0)) * 5;

    return {
      conceptNode: doc.id,
      accuracyRate: data.accuracyRate || 0,
      nextReviewDate: reviewDate,
      interactionCount: data.interactionCount || 0,
      urgency,
    };
  });

  items.sort((a, b) => b.urgency - a.urgency);
  return items.slice(0, limit);
}
