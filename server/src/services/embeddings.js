import { ai } from "./gemini.js";

/**
 * Generate a 768-dimension embedding vector for the given text.
 *
 * @param {string} text
 * @returns {Promise<number[]>} 768-dimension float array
 */
export async function embed(text) {
  const result = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 768 }
  });
  return result.embeddings[0].values;
}

/**
 * Generate embeddings for multiple texts in a single batch.
 *
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function embedBatch(texts) {
  const result = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: texts,
    config: { outputDimensionality: 768 }
  });
  return result.embeddings.map((e) => e.values);
}
