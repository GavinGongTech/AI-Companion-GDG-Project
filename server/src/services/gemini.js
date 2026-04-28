import { env } from "../env.js";
import { graphifyPromptPart } from "./graphify.js";
import { getAiProvider } from "../ai/index.js";
import { geminiProvider } from "../ai/geminiProvider.js";

export const ai = geminiProvider.client;

const PRIMARY_MODEL = env.geminiModel || "gemini-1.5-pro";
const FAST_MODEL = env.geminiFastModel || "gemini-1.5-flash";

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

/**
 * Wrapper to handle model fallbacks (e.g. 429 quota errors).
 */
async function withFallback(fn, modelType = "primary") {
  try {
    return await fn(modelType === "primary" ? "primary" : "fast");
  } catch (err) {
    if (modelType === "primary" && isQuotaError(err)) {
      console.warn("Gemini Primary Model quota exceeded, falling back to Fast Model...");
      return await fn("fast");
    }
    throw err;
  }
}

function graphify(text, options) {
  if (!env.graphifyEnabled) return String(text ?? "");
  return graphifyPromptPart(text, options);
}

function buildSmgSection(smg, { label, includeInteractions = false, includeDifficulty = null } = {}) {
  if (!smg) return "";
  const topErrors = Object.entries(smg.errorTypeMap || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  let section = `--- STUDENT HISTORY (${label || "Overall"}) ---\n`;
  if (topErrors.length) section += `Primary Misconceptions: ${topErrors.join(", ")}\n`;
  if (includeDifficulty) section += `Recent Difficulty: ${includeDifficulty}/10\n`;
  if (includeInteractions && smg.recentInteractions) {
    section += `Recent Interactions:\n${smg.recentInteractions.slice(-3).map(i => `- Q: ${i.q}\n  A: ${i.a}`).join("\n")}\n`;
  }
  return section + "\n";
}

/**
 * Identify the core concept being asked in a question.
 */
export async function identifyConcept(question) {
  const prompt = `Identify the single most specific academic concept or topic in the following student question.
Question: ${question}

Respond with ONLY a JSON object:
{
  "concept": "string",
  "confidence": <number between 0 and 1>
}`;

  return withFallback((model) => getAiProvider().generateJson({
    model,
    prompt,
    temperature: 0.0,
  }));
}

/**
 * Explain a concept using provided context and student history.
 */
export async function explainConcept(question, context, smg = null) {
  const smgSection = smg ? buildSmgSection(smg, { label: "this course", includeInteractions: true }) : "";
  const compactContext = context ? context.slice(0, 5000) : "";

  const prompt = `You are an AI study companion. A student asked the following question.
Use the course material context below to help when it is relevant.

Rules:
- If the question is not actually an academic/study question (e.g. greetings like "hi", small talk, random chat), answer it briefly and normally. Do NOT force-fit unrelated course material.
- If the question is academic, prioritize answering the question directly.
- Only lean heavily on course material context when it clearly matches the question. If context is unrelated, ignore it.

COURSE MATERIAL CONTEXT:
${compactContext || "No course materials available — use your general knowledge."}
${smgSection}

STUDENT QUESTION:
${question}

Respond with ONLY a JSON object:
{
  "explanation": "string (markdown allowed, use $...$ for inline math, $$...$$ for block math)",
  "concept": "string",
  "personalizedCallout": "<a personalized note based on the student's history, or empty string if no history>"
}`;

  return withFallback((model) => getAiProvider().generateJson({
    model: model === "primary" ? "primary" : "fast",
    prompt,
    temperature: 0.4,
  }));
}

/**
 * Generate a quiz based on the context.
 */
export async function generateQuiz(context, count = 3) {
  const prompt = `Generate ${count} multiple-choice questions based on the following text.
TEXT:
${context.slice(0, 8000)}

Respond with ONLY a JSON object:
{
  "questions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "answerIndex": number,
      "explanation": "string"
    }
  ]
}`;

  return withFallback((model) => getAiProvider().generateJson({
    model,
    prompt,
    temperature: 0.7,
  }));
}

/**
 * Explain a question with streaming.
 */
export async function explainStreaming(question, context = "") {
  const compactContext = context.slice(0, 5000);
  const compactQuestion = question.slice(0, 500);

  const prompt = `You are an AI study companion. Explain this concept clearly using the context provided.
CONTEXT: ${compactContext}
STUDENT QUESTION: ${compactQuestion}

Give a clear, step-by-step explanation. Highlight key formulas. Be concise but thorough.`;

  return withFallback((model) => getAiProvider().streamText({
    model,
    prompt,
    temperature: 0.4,
  }), "primary");
}
