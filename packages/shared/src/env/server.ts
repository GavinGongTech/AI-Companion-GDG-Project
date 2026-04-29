import { z } from "zod";

export const serverEnvironmentSchema = z.object({
  PORT: z.coerce.number().int().positive().optional().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).optional().default("development"),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().optional().default("gemini-3.1-pro-preview"),
  GEMINI_FAST_MODEL: z.string().optional().default("gemini-2.0-flash"),
  FIREBASE_PROJECT_ID: z.string().optional().default(""),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional().default(""),
  ALLOWED_ORIGINS: z.string().optional().default(""),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

export function parseServerEnvironment(
  environment: Record<string, unknown>,
): ServerEnvironment {
  return serverEnvironmentSchema.parse(environment);
}
