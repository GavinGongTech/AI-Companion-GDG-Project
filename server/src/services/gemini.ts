import { getAiProvider } from "../ai/index";

interface SmgData {
  errorTypeMap?: Record<string, number>;
  recentInteractions?: Array<{ q: string; a: string }>;
}

interface SmgSectionOptions {
  label?: string;
  includeInteractions?: boolean;
  includeDifficulty?: number | null;
}

function buildSmgSection(smg: SmgData | null | undefined, { label, includeInteractions = false, includeDifficulty = null }: SmgSectionOptions = {}) {
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
export async function identifyConcept(question: string): Promise<any> {
  const prompt = `Identify the single most specific academic concept or topic in the following student question.
Question: ${question}

Respond with ONLY a JSON object:
{
  "concept": "string",
  "confidence": <number between 0 and 1>
}`;

  return getAiProvider().generateJson({
    model: "fast",
    prompt,
    temperature: 0.0,
  });
}

/**
 * Explain a concept using provided context and student history.
 */
export async function explainConcept(question: string, context: string, smg: SmgData | null = null): Promise<any> {
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

  return getAiProvider().generateJson({
    model: "primary",
    prompt,
    temperature: 0.4,
  });
}

/**
 * Generate a quiz based on the context.
 */
export async function generateQuiz(context: string, count: number = 3): Promise<any> {
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

  return getAiProvider().generateJson({
    model: "primary",
    prompt,
    temperature: 0.7,
  });
}

/**
 * Explain a question with streaming.
 */
export async function explainConceptStream(question: string, context: string = ""): Promise<any> {
  const compactContext = context.slice(0, 5000);
  const compactQuestion = question.slice(0, 500);

  const prompt = `You are an AI study companion. Explain this concept clearly using the context provided.
CONTEXT: ${compactContext}
STUDENT QUESTION: ${compactQuestion}

Give a clear, step-by-step explanation. Highlight key formulas. Be concise but thorough.`;

  return getAiProvider().streamText({
    model: "primary",
    prompt,
    temperature: 0.4,
  });
}

/**
 * Classify a student interaction for misconception mapping.
 */
export async function classifyConcept(question: string, answer: string): Promise<any> {
  const prompt = `Analyze this student question and the AI's answer to categorize the student's current understanding.
Question: ${question}
AI Answer: ${answer}

Identify the specific concept node and the type of error the student might be making.
Error types: conceptual_misunderstanding, procedural_error, knowledge_gap, reasoning_error, none.

Respond with ONLY a JSON object:
{
  "conceptNode": "string (lowercase_with_underscores)",
  "errorType": "string",
  "confidence": <number between 0 and 1>
}`;

  return getAiProvider().generateJson({
    model: "fast",
    prompt,
    temperature: 0.0,
  });
}

/**
 * Discover the top 5 core academic concepts in a text for initial graph population.
 */
export async function discoverConcepts(text: string): Promise<{ concepts: string[] }> {
  const prompt = `Analyze the following academic material and identify the top 5 most important core concepts, topics, or formulas.
Respond with ONLY a JSON object:
{
  "concepts": ["concept_one", "concept_two", "concept_three", "concept_four", "concept_five"]
}

Rules:
- Concepts must be lowercase_snake_case.
- Concepts should be specific academic terms (e.g., "tangent_planes", "partial_derivatives", not "math").
- If the text is very short, you can return fewer than 5 concepts.

TEXT:
${text.slice(0, 10000)}`;

  try {
    const res = await getAiProvider().generateJson({
      model: "fast",
      prompt,
      temperature: 0.0,
    });
    return { concepts: res.concepts || [] };
  } catch {
    return { concepts: [] };
  }
}
