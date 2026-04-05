import "dotenv/config";

export const env = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV ?? "development",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? "",
  googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "",
};
