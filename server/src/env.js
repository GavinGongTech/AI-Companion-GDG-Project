import "dotenv/config";
import { parseServerEnvironment } from "./contracts/shared.js";

function parseBoolean(input, fallback) {
  if (input == null) return fallback;
  const normalized = String(input).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parsePositiveInt(input, fallback) {
  const parsed = Number.parseInt(String(input ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const sharedEnv = parseServerEnvironment(process.env);

export const env = {
  port: sharedEnv.PORT,
  nodeEnv: sharedEnv.NODE_ENV,
  geminiApiKey: sharedEnv.GEMINI_API_KEY,
  geminiModel: sharedEnv.GEMINI_MODEL,
  geminiFastModel: sharedEnv.GEMINI_FAST_MODEL,
  graphifyEnabled: parseBoolean(process.env.GRAPHIFY_ENABLED, true),
  graphifyQuestionTokens: parsePositiveInt(process.env.GRAPHIFY_QUESTION_MAX_TOKENS, 220),
  graphifyContextTokens: parsePositiveInt(process.env.GRAPHIFY_CONTEXT_MAX_TOKENS, 1200),
  graphifyAnswerTokens: parsePositiveInt(process.env.GRAPHIFY_ANSWER_MAX_TOKENS, 450),
  graphifyMaterialTokens: parsePositiveInt(process.env.GRAPHIFY_MATERIAL_MAX_TOKENS, 1400),
  firebaseProjectId: sharedEnv.FIREBASE_PROJECT_ID,
  googleApplicationCredentials: sharedEnv.GOOGLE_APPLICATION_CREDENTIALS,
  // Comma-separated allowed origins for CORS; defaults to permissive in dev
  allowedOrigins: sharedEnv.ALLOWED_ORIGINS,
};
