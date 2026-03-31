// TODO: install @google/generative-ai — npm install @google/generative-ai
// import { GoogleGenerativeAI } from "@google/generative-ai";
// import { env } from "../env.js";

// const genai = new GoogleGenerativeAI(env.geminiApiKey);
// const model = genai.getGenerativeModel({ model: "text-embedding-004" });

/**
 * Generate a 768-dimension embedding vector for the given text.
 * Used for both indexing chunks and querying the vector store.
 *
 * @param {string} text
 * @returns {Promise<number[]>} 768-dimension float array
 */
export async function embed(text) {
  // TODO:
  // const result = await model.embedContent(text);
  // return result.embedding.values;
  throw new Error("embed: not implemented");
}
