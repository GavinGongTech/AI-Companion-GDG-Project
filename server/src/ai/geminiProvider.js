import { GoogleGenAI } from "@google/genai";
import { env } from "../env.js";

const MODEL_ALIASES = {
  primary: env.geminiModel,
  fast: env.geminiFastModel,
  embedding: "gemini-embedding-001",
};

function resolveModelName(model) {
  return MODEL_ALIASES[model] ?? model ?? MODEL_ALIASES.primary;
}

function readText(result) {
  return typeof result?.text === "function" ? result.text() : result?.text ?? "";
}

/**
 * Gemini sometimes wraps JSON in markdown fences, so strip them before parsing.
 */
export function parseJsonResponse(text) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    throw new Error(
      `Gemini returned invalid JSON: ${error.message} | responseLength: ${cleaned.length}`,
      { cause: error },
    );
  }
}

export function createGeminiProvider(client = new GoogleGenAI({ apiKey: env.geminiApiKey })) {
  return {
    name: "gemini",
    client,
    resolveModelName,
    async generateJson({ model = "primary", prompt, temperature = 0.4 }) {
      const resolvedModel = resolveModelName(model);
      // We always try a sequence of fallbacks to ensure availability
      const fallbacks = [
        "models/gemini-3-flash-preview",
        "models/gemini-3.1-flash-lite-preview",
      ];
      const modelsToTry = [resolvedModel, ...fallbacks.filter((m) => m !== resolvedModel)];

      let lastError;
      for (const currentModel of modelsToTry) {
        try {
          const result = await client.models.generateContent({
            model: currentModel,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              temperature,
            },
          });
          return parseJsonResponse(readText(result));
        } catch (error) {
          lastError = error;
          const isQuotaError =
            error.status === 429 ||
            error.status === "RESOURCE_EXHAUSTED" ||
            error.code === 429 ||
            error.message?.includes("429") ||
            error.message?.includes("quota") ||
            error.message?.includes("RESOURCE_EXHAUSTED");

          if (isQuotaError && currentModel !== modelsToTry[modelsToTry.length - 1]) {
            console.warn(`[Gemini] Model ${currentModel} exhausted/limited. Trying fallback ${modelsToTry[modelsToTry.indexOf(currentModel) + 1]}...`);
            continue;
          }
          throw error;
        }
      }
      throw lastError;
    },
    async streamText({ model = "primary", prompt, temperature = 0.4 }) {
      const resolvedModel = resolveModelName(model);
      const fallbacks = [
        "models/gemini-3-flash-preview",
        "models/gemini-3.1-flash-lite-preview",
      ];
      const modelsToTry = [resolvedModel, ...fallbacks.filter((m) => m !== resolvedModel)];

      let lastError;
      for (const currentModel of modelsToTry) {
        try {
          return await client.models.generateContentStream({
            model: currentModel,
            contents: prompt,
            config: { temperature },
          });
        } catch (error) {
          lastError = error;
          const isQuotaError =
            error.status === 429 ||
            error.status === "RESOURCE_EXHAUSTED" ||
            error.code === 429 ||
            error.message?.includes("429") ||
            error.message?.includes("quota") ||
            error.message?.includes("RESOURCE_EXHAUSTED");

          if (isQuotaError && currentModel !== modelsToTry[modelsToTry.length - 1]) {
            console.warn(`[Gemini] Model ${currentModel} exhausted/limited for streaming. Trying fallback ${modelsToTry[modelsToTry.indexOf(currentModel) + 1]}...`);
            continue;
          }
          throw error;
        }
      }
      throw lastError;
    },
    async embedContent({ contents, outputDimensionality = 768, model = "embedding" }) {
      const result = await client.models.embedContent({
        model: resolveModelName(model),
        contents,
        config: { outputDimensionality },
      });

      return result.embeddings.map((embedding) => embedding.values);
    },
    async uploadFile({ filePath, displayName, mimeType }) {
      return client.files.upload({
        file: filePath,
        config: {
          displayName,
          mimeType,
        },
      });
    },
  };
}

export const geminiProvider = createGeminiProvider();
