import { describe, it, expect, vi } from "vitest";

const mockEmbedContent = vi.fn();
vi.mock("../ai/index", () => ({
  getAiProvider: vi.fn(() => ({
    embedContent: mockEmbedContent
  }))
}));

import { embed, embedBatch } from "./embeddings";

describe("Embeddings Service", () => {
  it("embeds a single text", async () => {
    mockEmbedContent.mockResolvedValue([[0.1, 0.2]]);
    const result = await embed("test");
    expect(result).toEqual([0.1, 0.2]);
    expect(mockEmbedContent).toHaveBeenCalledWith({
      contents: "test",
      outputDimensionality: 768
    });
  });

  it("embeds a batch of texts", async () => {
    mockEmbedContent.mockResolvedValue([[0.1], [0.2]]);
    const result = await embedBatch(["a", "b"]);
    expect(result).toEqual([[0.1], [0.2]]);
    expect(mockEmbedContent).toHaveBeenCalledWith({
      contents: ["a", "b"],
      outputDimensionality: 768
    });
  });
});
