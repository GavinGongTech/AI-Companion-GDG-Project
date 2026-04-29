import {
  normalizeApiUrl,
  parseExtensionEnvironment,
  type ExtensionEnvironment,
} from "@study-flow/shared";

const extensionEnv = parseExtensionEnvironment(import.meta.env);

export function getExtensionEnv(): ExtensionEnvironment {
  return extensionEnv;
}

export function getRuntimeMode(): "development" | "production" | "test" {
  if (import.meta.env.MODE === "test") {
    return "test";
  }

  return import.meta.env.PROD ? "production" : "development";
}

export function getDefaultApiUrl(): string {
  return normalizeApiUrl(extensionEnv.VITE_API_URL, getRuntimeMode());
}
