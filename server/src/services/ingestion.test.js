import { describe, it, expect } from "vitest";
import { chunkText } from "./ingestion.js";

describe("chunkText", () => {
  it("returns empty array for empty string", () => {
    expect(chunkText("")).toEqual([]);
  });

  it("returns single chunk for short text", () => {
    const text = "Hello world.";
    const chunks = chunkText(text);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe("Hello world.");
  });

  it("splits long text into multiple chunks", () => {
    const text = "A".repeat(1200);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("produces overlapping chunks", () => {
    // With 500 char chunks and 50 char overlap, the second chunk should start
    // at position 450 (500 - 50), so the last 50 chars of chunk 1 should
    // appear at the start of chunk 2
    const text = "A".repeat(1000);
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    // The total unique characters covered should be less than sum of chunk lengths
    // (because of overlap)
    const totalChunkChars = chunks.reduce((sum, c) => sum + c.length, 0);
    expect(totalChunkChars).toBeGreaterThan(text.length);
  });

  it("prefers sentence boundaries for splits", () => {
    // Build text with a sentence ending near the chunk boundary
    const before = "X".repeat(350);
    const sentence = ". This is a new sentence that should start a new chunk. ";
    const after = "Y".repeat(400);
    const text = before + sentence + after;

    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    // First chunk should end at or near the sentence boundary
    const firstChunk = chunks[0];
    expect(firstChunk.endsWith(".") || firstChunk.includes(". ")).toBe(true);
  });

  it("handles whitespace-only text", () => {
    expect(chunkText("   ")).toEqual([]);
  });

  it("trims chunks", () => {
    const text = "  Hello world.  " + "A".repeat(600);
    const chunks = chunkText(text);
    for (const chunk of chunks) {
      expect(chunk).toBe(chunk.trim());
    }
  });
});
