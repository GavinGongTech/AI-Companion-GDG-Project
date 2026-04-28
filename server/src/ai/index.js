import { geminiProvider } from "./geminiProvider.js";

let activeProvider = geminiProvider;

export function getAiProvider() {
  return activeProvider;
}

export function setAiProviderForTests(provider) {
  activeProvider = provider ?? geminiProvider;
}
