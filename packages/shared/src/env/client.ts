import { z } from "zod";

export const firebaseClientEnvironmentSchema = z.object({
  VITE_FIREBASE_API_KEY: z.string().optional().default(""),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().optional().default(""),
  VITE_FIREBASE_PROJECT_ID: z.string().optional().default(""),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().optional().default(""),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().optional().default(""),
  VITE_FIREBASE_APP_ID: z.string().optional().default(""),
  VITE_FIREBASE_MEASUREMENT_ID: z.string().optional().default(""),
});

export const clientEnvironmentSchema = firebaseClientEnvironmentSchema.extend({
  VITE_API_URL: z.string().optional().default("http://localhost:3000"),
});

export const extensionEnvironmentSchema = clientEnvironmentSchema.extend({
  VITE_FIREBASE_WEB_CLIENT_ID: z.string().optional().default(""),
});

export type ClientEnvironment = z.infer<typeof clientEnvironmentSchema>;
export type ExtensionEnvironment = z.infer<typeof extensionEnvironmentSchema>;
export type FirebaseClientEnvironment = z.infer<typeof firebaseClientEnvironmentSchema>;

export function parseClientEnvironment(
  environment: Record<string, unknown>,
): ClientEnvironment {
  return clientEnvironmentSchema.parse(environment);
}

export function parseExtensionEnvironment(
  environment: Record<string, unknown>,
): ExtensionEnvironment {
  return extensionEnvironmentSchema.parse(environment);
}
