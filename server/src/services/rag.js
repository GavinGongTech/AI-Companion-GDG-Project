import { embed } from "./embeddings.js";
import { db } from "../db/firebase.js";

const TOP_K = 5;

/**
 * Compute cosine similarity between two vectors.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denominator = Math.sqrt(magA) * Math.sqrt(magB);
  return denominator === 0 ? 0 : dot / denominator;
}

/**
 * Retrieve the top-K most relevant course chunks for a query using Firestore vector search.
 *
 * @param {string} uid
 * @param {string} [courseId] - Scope to a specific course, or null for all courses
 * @param {string} question
 * @returns {Promise<string[]>} Array of chunk content strings
 */
export async function retrieveChunks(uid, courseId, question) {
  const queryVector = await embed(question);

  // Try Firestore native vector search (findNearest) first
  let chunksRef;
  if (courseId) {
    chunksRef = db.collection("users").doc(uid)
      .collection("courses").doc(courseId)
      .collection("chunks");
  } else {
    // Search across all courses — need to query each course's chunks
    const coursesSnap = await db.collection("users").doc(uid)
      .collection("courses").get();

    const courseSnaps = await Promise.all(
      coursesSnap.docs.map((courseDoc) => courseDoc.ref.collection("chunks").get())
    );

    const allChunks = [];
    for (const snap of courseSnaps) {
      for (const chunkDoc of snap.docs) {
        const data = chunkDoc.data();
        if (data.embedding && data.content) {
          const vec = data.embedding.toArray ? data.embedding.toArray() : data.embedding;
          allChunks.push({
            content: data.content,
            similarity: cosineSimilarity(queryVector, vec),
          });
        }
      }
    }

    allChunks.sort((a, b) => b.similarity - a.similarity);
    return allChunks.slice(0, TOP_K).map((c) => c.content);
  }

  // Single course: Firestore native vector search
  const snap = await chunksRef
    .findNearest("embedding", queryVector, { limit: TOP_K, distanceMeasure: "COSINE" })
    .get();

  return snap.docs.map((doc) => doc.data().content);
}

/**
 * Retrieve Gemini File API URIs for a course, so they can be attached as context.
 *
 * @param {string} uid
 * @param {string} courseId
 * @returns {Promise<string[]>} Array of Gemini File API URIs
 */
export async function getCourseFileURIs(uid, courseId) {
  const filesRef = db.collection("users").doc(uid)
    .collection("courses").doc(courseId)
    .collection("files");

  const snap = await filesRef.get();
  return snap.docs
    .map((doc) => doc.data().geminiFileUri)
    .filter((uri) => uri && !uri.startsWith("local://"));
}

