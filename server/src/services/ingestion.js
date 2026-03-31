import { embed } from "./embeddings.js";
// import { pool } from "../db/client.js";

const CHUNK_SIZE = 500;     // characters per chunk
const CHUNK_OVERLAP = 50;   // overlap between adjacent chunks

/**
 * Split text into overlapping chunks of roughly CHUNK_SIZE characters.
 *
 * @param {string} text
 * @returns {string[]}
 */
function chunkText(text) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, start + CHUNK_SIZE));
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

/**
 * Ingest a plain-text string into the chunks table for the given course.
 * Splits into chunks, generates embeddings, and bulk-inserts into pgvector.
 *
 * @param {string} text
 * @param {string} courseId - UUID of the course in the DB
 * @param {object} metadata - Optional metadata ({ source, page, week })
 */
export async function ingestText(text, courseId, metadata = {}) {
  const chunks = chunkText(text);

  // TODO: embed all chunks and bulk insert
  // const rows = await Promise.all(
  //   chunks.map(async (content) => ({
  //     content,
  //     embedding: await embed(content),
  //     metadata,
  //   }))
  // );
  // await pool.query(
  //   `INSERT INTO chunks (course_id, content, embedding, metadata)
  //    SELECT $1, unnest($2::text[]), unnest($3::vector[]), $4::jsonb`,
  //   [courseId, rows.map(r => r.content), rows.map(r => r.embedding), JSON.stringify(metadata)]
  // );

  throw new Error("ingestText: not implemented");
}

/**
 * Read a file from disk, extract text (plain text or via OCR), then call ingestText.
 *
 * @param {string} filePath - Absolute path to the uploaded file
 * @param {string} courseId
 */
export async function ingestFile(filePath, courseId) {
  // TODO: detect file type, extract text (PDF → pdfparse, image → OCR), call ingestText
  throw new Error("ingestFile: not implemented");
}
