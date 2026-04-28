import { describe, expect, it } from "vitest";
import { estimateTokens, graphifyPromptPart } from "./graphify.js";

describe("graphifyPromptPart", () => {
  it("returns source text unchanged when under budget", () => {
    const text = "Chain rule helps differentiate composed functions.";
    const result = graphifyPromptPart(text, {
      anchorText: "chain rule",
      maxTokens: 100,
    });
    expect(result).toBe(text);
  });

  it("stays within token budget", () => {
    const text = [
      "Derivative basics with polynomial rules and worked examples.",
      "Detailed chain rule walkthrough with substitutions and nested functions.",
      "Art history notes about impressionism and painting techniques.",
      "More chain rule examples for implicit differentiation and gradients.",
      "A random cooking paragraph with unrelated vocabulary and recipes.",
    ].join("\n\n---\n\n");

    const result = graphifyPromptPart(text, {
      anchorText: "How do I apply chain rule derivatives?",
      maxTokens: 65,
    });

    expect(estimateTokens(result)).toBeLessThanOrEqual(65);
  });

  it("prioritizes anchor-relevant chunks over unrelated chunks", () => {
    const text = [
      "In art history, impressionism focuses on light and brushwork.",
      "For derivatives, chain rule handles nested functions like sin(x^2).",
      "Use the chain rule: if y = f(g(x)), then y' = f'(g(x))*g'(x).",
      "Cooking advice: season with salt and taste often.",
    ].join("\n\n---\n\n");

    const result = graphifyPromptPart(text, {
      anchorText: "Need help with chain rule derivative",
      maxTokens: 24,
    }).toLowerCase();

    expect(result.includes("chain rule")).toBe(true);
    expect(result.includes("cooking advice")).toBe(false);
  });
});
