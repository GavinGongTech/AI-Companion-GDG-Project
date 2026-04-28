import { embed } from "./embeddings";
import { db } from "../db/firebase";

const TOP_K = 5;

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denominator = Math.sqrt(magA) * Math.sqrt(magB);
  return denominator === 0 ? 0 : dot / denominator;
}

interface ChunkData {
  content: string;
  embedding?: number[] | { toArray(): number[] };
}

/**
 * Retrieve the top-K most relevant course chunks for a query using Firestore vector search.
 */
export async function retrieveChunks(uid: string, courseId: string | undefined, question: string): Promise<string[]> {
  const queryVector = await embed(question);
  if (!queryVector) return [];

  // Try Firestore native vector search (findNearest) first
  if (courseId) {
    const chunksRef = db.collection("users").doc(uid)
      .collection("courses").doc(courseId)
      .collection("chunks");

    const snap = await (chunksRef as any)
      .findNearest("embedding", queryVector, { limit: TOP_K, distanceMeasure: "COSINE" })
      .get();

    return snap.docs.map((doc: any) => doc.data().content as string);
  } else {
    // Search across all courses
    const coursesSnap = await db.collection("users").doc(uid)
      .collection("courses").get();

    const courseSnaps = await Promise.all(
      coursesSnap.docs.map((courseDoc) => courseDoc.ref.collection("chunks").get())
    );

    const allChunks: { content: string; similarity: number }[] = [];
    for (const snap of courseSnaps) {
      for (const chunkDoc of snap.docs) {
        const data = chunkDoc.data() as ChunkData;
        if (data.embedding && data.content) {
          const vec = typeof (data.embedding as any).toArray === "function" 
            ? (data.embedding as any).toArray() 
            : (data.embedding as number[]);
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
}

/**
 * Retrieve Gemini File API URIs for a course, so they can be attached as context.
 */
export async function getCourseFileURIs(uid: string, courseId: string): Promise<string[]> {
  const filesRef = db.collection("users").doc(uid)
    .collection("courses").doc(courseId)
    .collection("files");

  const snap = await filesRef.get();
  return snap.docs
    .map((doc) => doc.data().geminiFileUri as string)
    .filter((uri) => uri && !uri.startsWith("local://"));
}
