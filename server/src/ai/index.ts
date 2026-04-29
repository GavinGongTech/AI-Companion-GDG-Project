import { geminiProvider, type GeminiProvider } from "./geminiProvider";

let activeProvider: GeminiProvider = geminiProvider;

export function getAiProvider(): GeminiProvider {
  return activeProvider;
}

export function setAiProviderForTests(provider: GeminiProvider) {
  activeProvider = provider;
}
