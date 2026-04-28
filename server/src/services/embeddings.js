import { getAiProvider } from "../ai/index.js";

/**
 * Generate a 768-dimension embedding vector for the given text.
 *
 * @param {string} text
 * @returns {Promise<number[]>} 768-dimension float array
 */
export async function embed(text) {
  const [vector] = await getAiProvider().embedContent({
    contents: text,
    outputDimensionality: 768,
  });
  return vector;
}

/**
 * Generate embeddings for multiple texts in a single batch.
 *
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function embedBatch(texts) {
  return getAiProvider().embedContent({
    contents: texts,
    outputDimensionality: 768,
  });
}
