import { env } from "../env.js";
import { graphifyPromptPart } from "./graphify.js";
import { getAiProvider } from "../ai/index.js";
import { geminiProvider } from "../ai/geminiProvider.js";

export const ai = geminiProvider.client;

function graphify(text, options) {
  if (!env.graphifyEnabled) return String(text ?? "");
  return graphifyPromptPart(text, options);
}

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
  const compactQuestion = graphify(question, {
    anchorText: question,
    maxTokens: env.graphifyQuestionTokens,
  });
  const compactAnswer = graphify(answer, {
    anchorText: question,
    maxTokens: env.graphifyAnswerTokens,
  });

  const prompt = `You are a misconception classifier for a student study tool.
Given a student's question and the AI-generated answer, classify the interaction.

STUDENT QUESTION:
${compactQuestion}

AI ANSWER:
${compactAnswer}

Classify this interaction. The conceptNode should be a snake_case identifier that is specific enough to track over time (e.g. "derivatives_chain_rule", not just "math").

Respond with ONLY a JSON object:
{
  "conceptNode": "<specific snake_case concept identifier>",
  "errorType": "<one of: conceptual_misunderstanding, procedural_error, knowledge_gap, reasoning_error, none>",
  "confidence": <number between 0 and 1>
}`;

  return getAiProvider().generateJson({
    model: "fast",
    prompt,
    temperature: 0.0,
  });
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
  const compactQuestion = graphify(question, {
    anchorText: question,
    maxTokens: env.graphifyQuestionTokens,
  });
  const compactContext = graphify(context, {
    anchorText: question,
    maxTokens: env.graphifyContextTokens,
  });

  const smgSection = smgHistory
    ? buildSmgSection(smgHistory, { label: "STUDENT HISTORY FOR THIS CONCEPT", includeInteractions: true }) +
      "\nUse this history to add a personalized callout addressing their specific weaknesses."
    : "";

  const prompt = `You are an AI study companion. A student asked the following question.
Use the course material context below to give a clear, detailed explanation.

COURSE MATERIAL CONTEXT:
${compactContext || "No course materials available — use your general knowledge."}
${smgSection}

STUDENT QUESTION:
${compactQuestion}

Respond with ONLY a JSON object:
{
  "solution": "<clear, step-by-step explanation formatted in markdown. ALWAYS wrap all math in $ for inline and $$ for display>",
  "mainConcept": "<the primary concept or topic>",
  "relevantLecture": "<which course material section is most relevant, or 'General knowledge'>",
  "keyFormulas": ["<any key formulas or definitions used, formatted in markdown with $ or $$>"],
  "personalizedCallout": "<a personalized note based on the student's history, or empty string if no history>"
}`;

  return getAiProvider().generateJson({
    model: "primary",
    prompt,
    temperature: 0.4,
  });
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
  const compactTopic = graphify(topic, {
    anchorText: topic,
    maxTokens: env.graphifyQuestionTokens,
  });
  const rawMaterial = chunks.length > 0
    ? chunks.join("\n---\n")
    : "No specific course material provided.";
  const material = chunks.length > 0
    ? graphify(rawMaterial, { anchorText: topic, maxTokens: env.graphifyMaterialTokens })
    : rawMaterial;

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

TOPIC: ${compactTopic}

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

  return getAiProvider().generateJson({
    model: "primary",
    prompt,
    temperature: 0.7,
  });
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
  const compactQuestion = graphify(question, {
    anchorText: question,
    maxTokens: env.graphifyQuestionTokens,
  });
  const compactContext = graphify(context, {
    anchorText: question,
    maxTokens: env.graphifyContextTokens,
  });

  const smgSection = smgHistory
    ? buildSmgSection(smgHistory, { label: "STUDENT HISTORY", includeInteractions: true }) +
      "\nUse this to personalize your response."
    : "";

  const prompt = `You are an AI study companion. Explain the following in a clear, structured way.

COURSE MATERIAL CONTEXT:
${compactContext || "No course materials — use general knowledge."}
${smgSection}

STUDENT QUESTION: ${compactQuestion}

Give a clear, step-by-step explanation. Highlight key formulas. Be concise but thorough.`

  return getAiProvider().streamText({
    model: "primary",
    prompt,
    temperature: 0.4,
  });
}
