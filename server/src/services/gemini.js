// TODO: install @google/generative-ai — npm install @google/generative-ai
// import { GoogleGenerativeAI } from "@google/generative-ai";
// import { env } from "../env.js";

// const genai = new GoogleGenerativeAI(env.geminiApiKey);
// const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" });

/**
 * Generate a structured explanation for a student question using RAG context.
 *
 * @param {string} question - The student's question
 * @param {string} context  - Concatenated chunk content from pgvector retrieval
 * @returns {Promise<{ solution: string, mainConcept: string, relevantLecture: string }>}
 */
export async function explainConcept(question, context) {
  // TODO: build prompt with context + question, call Gemini, parse structured response
  throw new Error("explainConcept: not implemented");
}

/**
 * Generate a multiple-choice quiz question for the given topic.
 *
 * @param {string} topic   - Concept or topic label
 * @param {string[]} chunks - Raw text from relevant course chunks
 * @returns {Promise<{ question: string, options: string[], answer: number, explanation: string }>}
 */
export async function generateQuiz(topic, chunks) {
  // TODO: build prompt from chunks, call Gemini, parse JSON response
  throw new Error("generateQuiz: not implemented");
}
