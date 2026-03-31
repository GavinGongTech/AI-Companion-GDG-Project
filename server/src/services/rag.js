import { embed } from "./embeddings.js";
import { explainConcept } from "./gemini.js";
// import { pool } from "../db/client.js";

const TOP_K = 5; // number of chunks to retrieve

/**
 * Full RAG pipeline: embed query → pgvector similarity search → Gemini generation.
 *
 * @param {string} question - The student's question
 * @param {string} userId   - Used to scope retrieval to the user's courses
 * @returns {Promise<{ question, solution, mainConcept, relevantLecture }>}
 */
export async function query(question, userId) {
  // Step 1: embed the query
  const queryEmbedding = await embed(question);

  // Step 2: pgvector similarity search
  // TODO:
  // const { rows } = await pool.query(
  //   `SELECT c.content, c.metadata
  //    FROM chunks c
  //    JOIN courses co ON c.course_id = co.id
  //    WHERE co.user_id = $1
  //    ORDER BY c.embedding <=> $2
  //    LIMIT $3`,
  //   [userId, JSON.stringify(queryEmbedding), TOP_K]
  // );
  const rows = []; // stub

  // Step 3: assemble context string
  const context = rows.map((r) => r.content).join("\n\n");

  // Step 4: Gemini generation
  const result = await explainConcept(question, context);

  return result;
}
