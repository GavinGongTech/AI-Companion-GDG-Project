import { GoogleGenAI } from "@google/genai";
import { env } from "../env.js";

/**
 * Parse JSON from Gemini response text with retry.
 * Gemini sometimes wraps JSON in markdown fences — strip them before parsing.
 */
function parseJsonResponse(text) {
  let cleaned = text.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  return JSON.parse(cleaned);
}

export const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });

/**
 * Classify a student interaction to identify the misconception concept node and error type.
 *
 * @param {string} question - The student's original question or content
 * @param {string} answer   - The Gemini-generated response
 * @returns {Promise<{ conceptNode: string, errorType: string, confidence: number }>}
 */
export async function classifyConcept(question, answer) {
  const prompt = `You are a misconception classifier for a student study tool.
Given a student's question and the AI-generated answer, classify the interaction.

STUDENT QUESTION:
${question}

AI ANSWER:
${answer}

Classify this interaction. The conceptNode should be a snake_case identifier that is specific enough to track over time (e.g. "derivatives_chain_rule", not just "math").

Respond with ONLY a JSON object:
{
  "conceptNode": "<specific snake_case concept identifier>",
  "errorType": "<one of: conceptual_misunderstanding, procedural_error, knowledge_gap, reasoning_error, none>",
  "confidence": <number between 0 and 1>
}`;

  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.4,
    },
  });
  return parseJsonResponse(result.text);
}

/**
 * Generate a structured explanation for a student question using RAG context.
 * Optionally includes SMG history for personalized callouts.
 *
 * @param {string} question
 * @param {string} context       - Concatenated chunk content from vector retrieval
 * @param {object} [smgHistory]  - Previous SMG data for this concept { accuracyRate, errorTypeMap, interactionCount }
 * @returns {Promise<{ solution: string, mainConcept: string, relevantLecture: string, keyFormulas: string[], personalizedCallout: string }>}
 */
export async function explainConcept(question, context, smgHistory = null) {
  let smgSection = "";
  if (smgHistory) {
    const topErrors = Object.entries(smgHistory.errorTypeMap || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => `${type} (${count}x)`)
      .join(", ");
    smgSection = `
STUDENT HISTORY FOR THIS CONCEPT:
- Accuracy rate: ${(smgHistory.accuracyRate * 100).toFixed(0)}%
- Interactions: ${smgHistory.interactionCount}
- Common error types: ${topErrors || "none yet"}
Use this history to add a personalized callout addressing their specific weaknesses.`;
  }

  const prompt = `You are an AI study companion. A student asked the following question.
Use the course material context below to give a clear, detailed explanation.

COURSE MATERIAL CONTEXT:
${context || "No course materials available — use your general knowledge."}
${smgSection}

STUDENT QUESTION:
${question}

Respond with ONLY a JSON object:
{
  "solution": "<clear, step-by-step explanation>",
  "mainConcept": "<the primary concept or topic>",
  "relevantLecture": "<which course material section is most relevant, or 'General knowledge'>",
  "keyFormulas": ["<any key formulas or definitions used, as strings>"],
  "personalizedCallout": "<a personalized note based on the student's history, or empty string if no history>"
}`;

  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.4,
    },
  });
  return parseJsonResponse(result.text);
}

/**
 * Generate multiple-choice quiz questions weighted by the student's weak concepts.
 * Uses SM-2 data to focus on areas where the student struggles most.
 *
 * @param {string} topic
 * @param {string[]} chunks          - Course material chunks for context
 * @param {object} [smgData]         - { accuracyRate, errorTypeMap, interactionCount } for this topic
 * @param {number} [count=1]         - Number of questions to generate
 * @returns {Promise<{ questions: Array<{ question: string, options: string[], answer: number, explanation: string, difficulty: string, conceptNode: string }> }>}
 */
export async function generateQuiz(topic, chunks, smgData = null, count = 1) {
  const material = chunks.length > 0
    ? chunks.join("\n---\n")
    : "No specific course material provided.";

  let difficultyHint = "medium";
  if (smgData) {
    if (smgData.accuracyRate < 0.3) difficultyHint = "easy";
    else if (smgData.accuracyRate < 0.6) difficultyHint = "medium";
    else difficultyHint = "hard";
  }

  let smgSection = "";
  if (smgData) {
    const topErrors = Object.entries(smgData.errorTypeMap || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, count]) => `${type} (${count}x)`)
      .join(", ");
    smgSection = `
STUDENT PERFORMANCE ON THIS TOPIC:
- Accuracy: ${(smgData.accuracyRate * 100).toFixed(0)}%
- Common errors: ${topErrors || "none"}
- Target difficulty: ${difficultyHint}
Design questions that specifically target the student's weak areas.`;
  }

  const prompt = `You are an AI study companion generating quiz questions styled like a professor's exam.

TOPIC: ${topic}

COURSE MATERIAL:
${material}
${smgSection}

Generate exactly ${count} multiple-choice question(s) (4 options each, exactly one correct) that test understanding of the topic.

Respond with ONLY a JSON object:
{
  "questions": [
    {
      "question": "<the quiz question>",
      "options": ["<A>", "<B>", "<C>", "<D>"],
      "answer": <zero-based index of correct option>,
      "explanation": "<why the correct answer is right and common misconceptions>",
      "difficulty": "<easy|medium|hard>",
      "conceptNode": "<snake_case concept identifier>"
    }
  ]
}`;

  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.7,
    },
  });
  const parsed = parseJsonResponse(result.text);

  // Backward compat: if caller expects a single question shape
  if (count === 1 && parsed.questions?.length > 0) {
    return parsed.questions[0];
  }
  return parsed;
}
