import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../env.js";

const genai = new GoogleGenerativeAI(env.geminiApiKey);
const model = genai.getGenerativeModel({ model: "text-embedding-004" });

/**
 * Generate a 768-dimension embedding vector for the given text.
 *
 * @param {string} text
 * @returns {Promise<number[]>} 768-dimension float array
 */
export async function embed(text) {
  const result = await model.embedContent(text);
  return result.embedding.values;
}

/**
 * Generate embeddings for multiple texts in a single batch.
 *
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function embedBatch(texts) {
  const requests = texts.map((text) => ({ content: { parts: [{ text }] } }));
  const result = await model.batchEmbedContents({ requests });
  return result.embeddings.map((e) => e.values);
}
