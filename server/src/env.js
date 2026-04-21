import "dotenv/config";

export const env = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV ?? "development",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.1-pro-preview",
  geminiFastModel: process.env.GEMINI_FAST_MODEL ?? "gemini-2.0-flash",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? "",
  googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "",
  // Comma-separated allowed origins for CORS; defaults to permissive in dev
  allowedOrigins: process.env.ALLOWED_ORIGINS ?? "",
};
