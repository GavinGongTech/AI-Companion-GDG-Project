import { GoogleGenAI } from "@google/genai";
import { env } from "../env.js";

const PRIMARY_MODEL = env.geminiModel;
const FAST_MODEL = env.geminiFastModel;

function isQuotaError(err) {
  const msg = String(err?.message || "");
  const code = err?.status || err?.code;
  return (
    code === 429 ||
    code === "RESOURCE_EXHAUSTED" ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("Quota exceeded") ||
    msg.includes("exceeded your current quota")
  );
}

async function generateContentWithFallback({ model, ...rest }) {
  try {
    return await ai.models.generateContent({ model, ...rest });
  } catch (err) {
    if (model !== FAST_MODEL && isQuotaError(err)) {
      return await ai.models.generateContent({ model: FAST_MODEL, ...rest });
    }
    throw err;
  }
}

async function generateContentStreamWithFallback({ model, ...rest }) {
  try {
    return await ai.models.generateContentStream({ model, ...rest });
  } catch (err) {
    if (model !== FAST_MODEL && isQuotaError(err)) {
      return await ai.models.generateContentStream({ model: FAST_MODEL, ...rest });
    }
    throw err;
  }
}

/**
 * Parse JSON from Gemini response text with retry.
 * Gemini sometimes wraps JSON in markdown fences — strip them before parsing.
 */
function parseJsonResponse(text) {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error(`Gemini returned invalid JSON: ${e.message} | responseLength: ${cleaned.length}`, { cause: e });
  }
}

export const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });

function buildSmgSection(smg, { label, includeInteractions = false, includeDifficulty = null } = {}) {
  if (!smg) return "";
  const topErrors = Object.entries(smg.errorTypeMap || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type, count]) => `${type} (${count}x)`)
    .join(", ");
  let section = `\n${label}:\n- Accuracy: ${(Number(smg.accuracyRate ?? 0) * 100).toFixed(0)}%`;
  if (includeInteractions) section += `\n- Interactions: ${smg.interactionCount}`;
  section += `\n- Common errors: ${topErrors || "none yet"}`;
  if (includeDifficulty) section += `\n- Target difficulty: ${includeDifficulty}`;
  return section;
}

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

  const result = await generateContentWithFallback({
    model: FAST_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.0,
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
  const smgSection = smgHistory
    ? buildSmgSection(smgHistory, { label: "STUDENT HISTORY FOR THIS CONCEPT", includeInteractions: true }) +
      "\nUse this history to add a personalized callout addressing their specific weaknesses."
    : "";

  const prompt = `You are an AI study companion. A student asked the following question.
Use the course material context below to help when it is relevant.

Rules:
- If the question is not actually an academic/study question (e.g. greetings like "hi", small talk, random chat), answer it briefly and normally. Do NOT force-fit unrelated course material.
- If the question is academic, prioritize answering the question directly.
- Only lean heavily on course material context when it clearly matches the question. If context is unrelated, ignore it.

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

  const result = await generateContentWithFallback({
    model: PRIMARY_MODEL,
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

  const smgSection = smgData
    ? buildSmgSection(smgData, { label: "STUDENT PERFORMANCE ON THIS TOPIC", includeDifficulty: difficultyHint }) +
      "\nDesign questions that specifically target the student's weak areas."
    : "";

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

  const result = await generateContentWithFallback({
    model: PRIMARY_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.7,
    },
  });
  return parseJsonResponse(result.text);
}

/**
 * Stream a plain-text explanation for a student question using RAG context.
 * Same inputs as explainConcept but returns a streaming async iterable.
 *
 * @param {string} question
 * @param {string} context       - Concatenated chunk content from vector retrieval
 * @param {object} [smgHistory]  - Previous SMG data { accuracyRate, errorTypeMap, interactionCount }
 * @returns {Promise<AsyncIterable>} Pino-compatible stream from generateContentStream
 */
export async function explainConceptStream(question, context, smgHistory = null) {
  const smgSection = smgHistory
    ? buildSmgSection(smgHistory, { label: "STUDENT HISTORY", includeInteractions: true }) +
      "\nUse this to personalize your response."
    : "";

  const prompt = `You are an AI study companion. Explain the following in a clear, structured way.

COURSE MATERIAL CONTEXT:
${context || 'No course materials — use general knowledge.'}
${smgSection}

STUDENT QUESTION: ${question}

Give a clear, step-by-step explanation. Highlight key formulas. Be concise but thorough.`

  const stream = await generateContentStreamWithFallback({
    model: PRIMARY_MODEL,
    contents: prompt,
    config: { temperature: 0.4 },
  })
  return stream
}
