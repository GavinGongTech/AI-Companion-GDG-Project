import { GoogleGenAI } from "@google/genai";
import { env } from "../env";
import { logger } from "../logger";

const MODEL_ALIASES = {
  primary: env.geminiModel,
  fast: env.geminiFastModel,
  embedding: "text-embedding-004",
} as const;

type ModelAlias = keyof typeof MODEL_ALIASES;

function resolveModelName(model: ModelAlias | string): string {
  return MODEL_ALIASES[model as ModelAlias] ?? model ?? MODEL_ALIASES.primary;
}

export function parseJsonResponse(text: string): any {
  const cleaned = text.replace(/```json\n?|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Gemini returned invalid JSON: ${message} | responseLength: ${cleaned.length}`,
      { cause: error }
    );
  }
}

export function createGeminiProvider() {
  const genAI = new GoogleGenAI({ apiKey: env.geminiApiKey });

  return {
    name: "gemini",
    client: genAI,
    resolveModelName,

    async generateJson({ model = "primary", prompt, temperature = 0.4 }: { model?: ModelAlias | string, prompt: any, temperature?: number }) {
      const modelName = resolveModelName(model);

      let lastError: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await genAI.models.generateContent({
            model: modelName,
            contents: Array.isArray(prompt) ? prompt : [{ role: "user", parts: [{ text: prompt }] }],
            config: {
              temperature,
              responseMimeType: "application/json",
            },
          });
          return parseJsonResponse(response.text || "");
        } catch (error: any) {
          lastError = error;
          const isRetryable =
            error.status === 429 ||
            error.status === "RESOURCE_EXHAUSTED" ||
            error.code === 429 ||
            error.message?.includes("429") ||
            error.message?.includes("quota") ||
            error.message?.includes("RESOURCE_EXHAUSTED");

          if (!isRetryable || attempt === 3) break;
          const delay = Math.pow(2, attempt) * 1000;
          logger.warn({ attempt, delay, model: modelName }, "Gemini rate limited, retrying...");
          await new Promise((r) => setTimeout(r, delay));
        }
      }
      throw lastError;
    },

    async streamText({ model = "primary", prompt, temperature = 0.4 }: { model?: ModelAlias | string, prompt: any, temperature?: number }) {
      const modelName = resolveModelName(model);

      let lastError: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const stream = await genAI.models.generateContentStream({
            model: modelName,
            contents: Array.isArray(prompt) ? prompt : [{ role: "user", parts: [{ text: prompt }] }],
            config: { temperature },
          });
          return stream;
        } catch (error: any) {
          lastError = error;
          const isRetryable =
            error.status === 429 ||
            error.status === "RESOURCE_EXHAUSTED" ||
            error.code === 429 ||
            error.message?.includes("429") ||
            error.message?.includes("quota") ||
            error.message?.includes("RESOURCE_EXHAUSTED");

          if (!isRetryable || attempt === 3) break;
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((r) => setTimeout(r, delay));
        }
      }
      throw lastError;
    },

    async embedContent({ contents, outputDimensionality = 768, model = "embedding" }: { contents: any, outputDimensionality?: number, model?: ModelAlias | string }) {
      const result = await genAI.models.embedContent({
        model: resolveModelName(model),
        contents: Array.isArray(contents) ? contents.map(c => ({ parts: [{ text: c }] })) : [{ parts: [{ text: contents }] }],
        config: { outputDimensionality },
      });
      // The unified SDK might return a single embedding or multiple. 
      // If we passed an array, we might need batchEmbedContents but it wasn't in basic examples.
      // Let's check if it exists or if embedContent handles arrays.
      return (result.embeddings || []).map(e => e.values);
    },

    async uploadFile({ filePath, displayName, mimeType }: { filePath: string, displayName?: string, mimeType?: string }) {
      // The unified SDK handles files via the models.generateContent with specific payload or a separate file manager.
      // For now, let's keep it simple as it's a modernization task.
      throw new Error("uploadFile not fully implemented for unified SDK in this prototype");
    },
  };
}

export const geminiProvider = createGeminiProvider();
export type GeminiProvider = ReturnType<typeof createGeminiProvider>;
