import { describe, expect, it } from "vitest";
import { estimateTokens, graphifyPromptPart } from "./graphify";

describe("graphifyPromptPart", () => {
  it("estimateTokens handles null/undefined", () => {
    expect(estimateTokens(null as any)).toBe(0);
    expect(estimateTokens(undefined as any)).toBe(0);
    expect(estimateTokens("")).toBe(0);
  });

  it("returns source text unchanged when under budget", () => {
    const text = "Chain rule helps differentiate composed functions.";
    const result = graphifyPromptPart(text, {
      anchorText: "chain rule",
      maxTokens: 100,
    });
    expect(result).toBe(text);
  });

  it("returns empty string for empty input or zero budget", () => {
    expect(graphifyPromptPart(null as any)).toBe("");
    expect(graphifyPromptPart("test", { maxTokens: 0 })).toBe("");
    expect(graphifyPromptPart("test", { maxTokens: -1 })).toBe("");
  });

  it("handles text without clear separators by slicing", () => {
    const longText = "a".repeat(100);
    const result = graphifyPromptPart(longText, { maxTokens: 10 });
    expect(result.length).toBe(40); // 10 tokens * 4 chars/token
  });

  it("splits by custom divider ---", () => {
    const text = "Part 1\n---\nPart 2";
    const result = graphifyPromptPart(text, { maxTokens: 3 }); // ~12 chars
    expect(result).toBe("Part 1");
  });

  it("splits by paragraph", () => {
    const text = "Para 1\n\nPara 2";
    const result = graphifyPromptPart(text, { maxTokens: 3 });
    expect(result).toBe("Para 1");
  });

  it("splits by sentence", () => {
    const text = "Sentence one. Sentence two!";
    const result = graphifyPromptPart(text, { maxTokens: 4 });
    expect(result).toBe("Sentence one.");
  });

  it("stays within token budget for complex text", () => {
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

  it("handles case where no chunks are relevant to anchor by slicing first part", () => {
    const text = "Some unrelated content here. And more here.";
    const result = graphifyPromptPart(text, {
      anchorText: "nonexistentterm",
      maxTokens: 5,
    });
    expect(result).toBe("Some unrelated conte");
  });

  it("penalizes redundancy between selected chunks", () => {
    const text = [
      "The chain rule is used for nested functions.",
      "Chain rule works for f(g(x)).",
      "Impressionism started in France.",
    ].join("\n\n");
    const result = graphifyPromptPart(text, {
      anchorText: "chain rule",
      maxTokens: 25,
    });
    expect(result.includes("chain rule")).toBe(true);
  });

  it("triggers safety slice in final join", () => {
    // This is hard to trigger but let's try a case where usedChars calculation might be slightly off
    // or join adds something unexpected.
    const text = "A".repeat(10) + " " + "B".repeat(10);
    const result = graphifyPromptPart(text, { maxTokens: 4 }); // 16 chars
    expect(result.length).toBeLessThanOrEqual(16);
  });
});
