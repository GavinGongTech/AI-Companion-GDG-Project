import { getAiProvider } from "../ai/index";

/**
 * Generate a 768-dimension embedding vector for the given text.
 *
 * @param {string} text
 * @returns {Promise<number[]>} 768-dimension float array
 */
export async function embed(text: string): Promise<number[]> {
  const vectors = await getAiProvider().embedContent({
    contents: text,
    outputDimensionality: 768,
  });
  return vectors[0] || new Array(768).fill(0);
}

/**
 * Generate embeddings for multiple texts in a single batch.
 *
 * @param {string[]} texts
 * @returns {Promise<number[][]>}
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const vectors = await getAiProvider().embedContent({
    contents: texts,
    outputDimensionality: 768,
  });
  return vectors.filter((v): v is number[] => !!v);
}
