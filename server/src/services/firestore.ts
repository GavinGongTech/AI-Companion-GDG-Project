import { db } from "../db/firebase";
import { FieldValue } from "firebase-admin/firestore";

interface RequestMeta {
  path?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
}

interface InteractionParams {
  courseId: string | null;
  content: string;
  eventType: "explain" | "quiz" | string;
  response: any;
  classifierTag: any;
  requestMeta?: RequestMeta;
}

/**
 * Save an analyze interaction to Firestore.
 * Creates a document in users/{uid}/events/{auto-id}.
 * Also mirrors a copy into interactions/{auto-id} for a global
 *
 * @param {string} uid        - Firebase Auth UID
 * @param {object} params
 * @param {string} params.courseId
 * @param {string} params.content      - The original text/question
 * @param {string} params.eventType    - "explain" | "quiz"
 * @param {object} params.response     - The Gemini structured response
 * @param {object} params.classifierTag - { conceptNode, errorType, confidence }
 * @param {object} [params.requestMeta]
 * @returns {Promise<string>} The created event document ID
 */
export async function saveInteraction(
  uid: string,
  { courseId, content, eventType, response, classifierTag, requestMeta }: InteractionParams,
): Promise<string> {
  const eventRef = db.collection("users").doc(uid).collection("events").doc();

  const payload = {
    uid,
    courseId: courseId || null,
    eventType,
    content,
    response,
    classifierTag,
    request: requestMeta || null,
    createdAt: FieldValue.serverTimestamp(),
  };

  // Write per-user history + global feed in a single batch.
  const batch = db.batch();
  batch.set(eventRef, payload);
  batch.set(db.collection("interactions").doc(eventRef.id), payload);
  await batch.commit();

  return eventRef.id;
}

interface ClientEventParams {
  eventType: string;
  content?: string | null;
  meta?: any;
  requestMeta?: RequestMeta;
}

/**
 * Save a lightweight client event (e.g. auth/login, page_view).
 * Mirrors to both users/{uid}/events and interactions for console visibility.
 *
 * @param {string} uid
 * @param {object} params
 * @param {string} params.eventType
 * @param {string} [params.content]
 * @param {object} [params.meta]
 * @param {object} [params.requestMeta]
 * @returns {Promise<string>}
 */
export async function saveClientEvent(uid: string, { eventType, content, meta, requestMeta }: ClientEventParams): Promise<string> {
  const eventRef = db.collection("users").doc(uid).collection("events").doc();
  const payload = {
    uid,
    courseId: null,
    eventType,
    content: content || null,
    meta: meta || null,
    response: null,
    classifierTag: null,
    request: requestMeta || null,
    createdAt: FieldValue.serverTimestamp(),
  };

  const batch = db.batch();
  batch.set(eventRef, payload);
  batch.set(db.collection("interactions").doc(eventRef.id), payload);
  await batch.commit();

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
export async function ensureUserDoc(uid: string, email: string, displayName: string | null): Promise<void> {
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
