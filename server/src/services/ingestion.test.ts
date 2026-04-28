import { describe, it, expect, vi, beforeEach } from "vitest";
import { chunkText, ingestText, uploadToGeminiFileAPI, ingestFile } from "./ingestion";

const { mockDb, mockBatch, mockFieldValue } = vi.hoisted(() => {
  const mock = {
    collection: vi.fn(),
    doc: vi.fn(),
    where: vi.fn(),
    get: vi.fn(),
    add: vi.fn(),
    set: vi.fn(),
    count: vi.fn(),
    batch: vi.fn(),
  };

  mock.collection.mockReturnValue(mock);
  mock.doc.mockReturnValue(mock);
  mock.where.mockReturnValue(mock);
  mock.count.mockReturnValue(mock);

  const mockBatch = {
    set: vi.fn(),
    commit: vi.fn().mockResolvedValue(true),
  };
  mock.batch.mockReturnValue(mockBatch);

  return {
    mockDb: mock,
    mockBatch,
    mockFieldValue: {
      serverTimestamp: vi.fn(() => "mock-ts"),
      vector: vi.fn((v) => v),
    },
  };
});

vi.mock("../db/firebase.ts", () => ({ db: mockDb }));
vi.mock("firebase-admin/firestore", () => ({ FieldValue: mockFieldValue }));

const { mockEmbedBatch } = vi.hoisted(() => ({ mockEmbedBatch: vi.fn() }));
vi.mock("./embeddings.ts", () => ({ embedBatch: mockEmbedBatch }));

const { mockExtractText, mockExtractTextFromPDF } = vi.hoisted(() => ({
  mockExtractText: vi.fn(),
  mockExtractTextFromPDF: vi.fn(),
}));
vi.mock("./ocr.ts", () => ({
  extractText: mockExtractText,
  extractTextFromPDF: mockExtractTextFromPDF,
}));

const { mockUploadFile } = vi.hoisted(() => ({ mockUploadFile: vi.fn() }));
vi.mock("../ai/index.ts", () => ({
  getAiProvider: vi.fn(() => ({ uploadFile: mockUploadFile })),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue("mock file content"),
}));

describe("ingestion service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-initialize recursive mocks
    mockDb.collection.mockReturnValue(mockDb);
    mockDb.doc.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.count.mockReturnValue(mockDb);
  });

  describe("chunkText", () => {
    it("returns empty array for empty string", () => {
      expect(chunkText("")).toEqual([]);
    });

    it("splits long text into chunks", () => {
      const chunks = chunkText("A".repeat(1200));
      expect(chunks.length).toBeGreaterThan(1);
    });

    it("breaks at sentence boundaries", () => {
      // CHUNK_SIZE is 500. 0.6 * 500 = 300.
      // Need a sentence boundary after 300 chars but before 500.
      const text = "A".repeat(350) + ". " + "B".repeat(1000);
      const chunks = chunkText(text);
      expect(chunks[0]).toBe("A".repeat(350) + ".");
    });
  });

  describe("ingestText", () => {
    it("chunks, embeds and stores text", async () => {
      mockEmbedBatch.mockResolvedValue([[0.1], [0.2], [0.3]]);
      await ingestText("uid1", "course1", "A".repeat(1100));

      expect(mockEmbedBatch).toHaveBeenCalled();
      expect(mockBatch.set).toHaveBeenCalledTimes(3); // 3 chunks
      expect(mockDb.set).toHaveBeenCalledTimes(1); // 1 course doc
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it("commits early if batch is large", async () => {
      mockEmbedBatch.mockResolvedValue(new Array(500).fill([0.1]));
      // Each chunk is roughly CHUNK_SIZE (500). 10000 / 500 = 20 chunks.
      // Wait, 400 is the limit in ingest.js. I'll make it 401 chunks.
      mockEmbedBatch.mockResolvedValue(new Array(401).fill([0.1]));
      await ingestText("uid1", "course1", "A".repeat(401 * 500));
      expect(mockBatch.commit).toHaveBeenCalledTimes(2);
    });

    it("returns early if no chunks", async () => {
      await ingestText("uid1", "course1", "");
      expect(mockEmbedBatch).not.toHaveBeenCalled();
    });
  });

  describe("uploadToGeminiFileAPI", () => {
    it("uploads and stores new file", async () => {
      mockDb.get.mockResolvedValue({ empty: true });
      mockUploadFile.mockResolvedValue({ uri: "gemini://file1" });

      const result = await uploadToGeminiFileAPI("uid1", "course1", "/path/to/file.pdf", "test.pdf", "upload");

      expect(result.fileUri).toBe("gemini://file1");
      expect(mockUploadFile).toHaveBeenCalledWith(expect.objectContaining({ mimeType: "application/pdf" }));
    });

    it("returns existing file if duplicate", async () => {
      const mockSnap = {
        empty: false,
        docs: [{ data: () => ({ geminiFileUri: "existing-uri", uploadedAt: new Date() }) }],
      };
      mockDb.get.mockResolvedValue(mockSnap);

      const result = await uploadToGeminiFileAPI("uid1", "course1", "/path/to/file.txt", "test.txt", "upload");
      expect(result.fileUri).toBe("existing-uri");
      expect(mockUploadFile).not.toHaveBeenCalled();
    });
  });

  describe("ingestFile", () => {
    it("handles PDF files", async () => {
      mockExtractTextFromPDF.mockResolvedValue("pdf text");
      mockEmbedBatch.mockResolvedValue([[0.1]]);
      mockUploadFile.mockResolvedValue({ uri: "uri" });
      mockDb.get.mockResolvedValue({ empty: true });

      await ingestFile("uid1", "course1", "/test.pdf", "test.pdf");
      expect(mockExtractTextFromPDF).toHaveBeenCalled();
    });

    it("handles image files", async () => {
      mockExtractText.mockResolvedValue("image text");
      mockEmbedBatch.mockResolvedValue([[0.1]]);
      mockUploadFile.mockResolvedValue({ uri: "uri" });
      mockDb.get.mockResolvedValue({ empty: true });

      await ingestFile("uid1", "course1", "/test.png", "test.png");
      expect(mockExtractText).toHaveBeenCalled();
    });

    it("handles other files via readFile", async () => {
      mockEmbedBatch.mockResolvedValue([[0.1]]);
      mockUploadFile.mockResolvedValue({ uri: "uri" });
      mockDb.get.mockResolvedValue({ empty: true });

      await ingestFile("uid1", "course1", "/test.txt", "test.txt");
      expect(mockEmbedBatch).toHaveBeenCalled();
    });
  });
});
