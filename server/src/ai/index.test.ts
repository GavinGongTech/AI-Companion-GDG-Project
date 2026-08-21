import { describe, it, expect, vi, afterEach } from "vitest";

// The real module builds a GoogleGenAI client at import time, which needs an
// API key and a network stack. The registry under test only cares that it hands
// back whatever it was given, so a stand-in is enough.
vi.mock("./geminiProvider", () => ({
  geminiProvider: { name: "gemini-default" },
}));

import { getAiProvider, setAiProviderForTests } from "./index";

const original = getAiProvider();

afterEach(() => {
  setAiProviderForTests(original as any);
});

describe("AI provider registry", () => {
  it("defaults to the Gemini provider", () => {
    expect(getAiProvider()).toEqual({ name: "gemini-default" });
  });

  it("swaps in a test double and keeps returning it", () => {
    const fake = { name: "fake" } as any;
    setAiProviderForTests(fake);
    expect(getAiProvider()).toBe(fake);
    // Read twice: the swap is a module-level binding, so a second read proves
    // it stuck rather than being a one-shot return value.
    expect(getAiProvider()).toBe(fake);
  });
});
