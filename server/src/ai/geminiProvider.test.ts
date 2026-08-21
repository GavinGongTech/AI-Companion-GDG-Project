import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockGenerateContent, mockGenerateContentStream, mockEmbedContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
  mockGenerateContentStream: vi.fn(),
  mockEmbedContent: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: mockGenerateContent,
      generateContentStream: mockGenerateContentStream,
      embedContent: mockEmbedContent,
    };
  },
}));

vi.mock("../env", () => ({
  env: { geminiApiKey: "test-key", geminiModel: "primary-model", geminiFastModel: "fast-model" },
}));

vi.mock("../logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { createGeminiProvider, parseJsonResponse } from "./geminiProvider";

const provider = createGeminiProvider();

/** A 429 shaped the way the SDK reports one. */
function rateLimited() {
  return Object.assign(new Error("429 Too Many Requests"), { status: 429 });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("parseJsonResponse", () => {
  it("parses bare JSON", () => {
    expect(parseJsonResponse('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips the markdown fence Gemini wraps JSON in", () => {
    expect(parseJsonResponse('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("reports the response length when the text is not JSON at all", () => {
    // The length matters more than the text: the usual failure is a truncated
    // response, and the number is what tells you that from the error alone.
    expect(() => parseJsonResponse("not json")).toThrow(/responseLength: 8/);
  });
});

describe("resolveModelName", () => {
  it("maps the aliases onto the configured models", () => {
    expect(provider.resolveModelName("primary")).toBe("primary-model");
    expect(provider.resolveModelName("fast")).toBe("fast-model");
    expect(provider.resolveModelName("embedding")).toBe("text-embedding-004");
  });

  it("passes an unrecognised name straight through", () => {
    expect(provider.resolveModelName("gemini-3-pro")).toBe("gemini-3-pro");
  });

  it("falls back to the primary model when handed nothing", () => {
    expect(provider.resolveModelName(undefined as any)).toBe("primary-model");
  });
});

describe("generateJson", () => {
  it("sends a bare string prompt as a single user turn", async () => {
    mockGenerateContent.mockResolvedValue({ text: '{"ok":true}' });
    await expect(provider.generateJson({ prompt: "hello" })).resolves.toEqual({ ok: true });
    expect(mockGenerateContent).toHaveBeenCalledWith({
      model: "primary-model",
      contents: [{ role: "user", parts: [{ text: "hello" }] }],
      config: { temperature: 0.4, responseMimeType: "application/json" },
    });
  });

  it("passes an array prompt through untouched", async () => {
    mockGenerateContent.mockResolvedValue({ text: "{}" });
    const turns = [{ role: "user", parts: [{ text: "hi" }] }];
    await provider.generateJson({ model: "fast", prompt: turns, temperature: 0 });
    expect(mockGenerateContent).toHaveBeenCalledWith({
      model: "fast-model",
      contents: turns,
      config: { temperature: 0, responseMimeType: "application/json" },
    });
  });

  it("treats a missing text field as an empty response", async () => {
    mockGenerateContent.mockResolvedValue({});
    await expect(provider.generateJson({ prompt: "x" })).rejects.toThrow(/responseLength: 0/);
  });

  it("gives up immediately on an error that retrying cannot fix", async () => {
    mockGenerateContent.mockRejectedValue(new Error("400 Bad Request"));
    await expect(provider.generateJson({ prompt: "x" })).rejects.toThrow("400 Bad Request");
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });
});

describe("generateJson backoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries a rate limit and returns the attempt that lands", async () => {
    mockGenerateContent
      .mockRejectedValueOnce(rateLimited())
      .mockResolvedValueOnce({ text: '{"ok":true}' });
    const pending = provider.generateJson({ prompt: "x" });
    await vi.advanceTimersByTimeAsync(2000);
    await expect(pending).resolves.toEqual({ ok: true });
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });

  it("stops after three attempts and rethrows the last failure", async () => {
    mockGenerateContent.mockRejectedValue(rateLimited());
    // The assertion is attached before the clock moves. Advancing timers lets
    // the retry loop run to its end, and a rejection with no handler yet
    // attached surfaces as an unhandled rejection rather than a test failure.
    const settled = expect(provider.generateJson({ prompt: "x" })).rejects.toThrow(
      "429 Too Many Requests",
    );
    // 2s then 4s; the third attempt is not followed by a sleep.
    await vi.advanceTimersByTimeAsync(6000);
    await settled;
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["a string status", { status: "RESOURCE_EXHAUSTED" }],
    ["a numeric code", { code: 429 }],
    ["the word quota in the message", { message: "quota exceeded" }],
    ["RESOURCE_EXHAUSTED in the message", { message: "RESOURCE_EXHAUSTED" }],
  ])("counts %s as retryable", async (_label, shape: any) => {
    mockGenerateContent
      .mockRejectedValueOnce(Object.assign(new Error(shape.message ?? "err"), shape))
      .mockResolvedValueOnce({ text: "{}" });
    const pending = provider.generateJson({ prompt: "x" });
    await vi.advanceTimersByTimeAsync(2000);
    await expect(pending).resolves.toEqual({});
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });
});

describe("streamText", () => {
  it("hands back the SDK stream for a string prompt", async () => {
    const stream = { marker: "stream" };
    mockGenerateContentStream.mockResolvedValue(stream);
    await expect(provider.streamText({ prompt: "hello" })).resolves.toBe(stream);
    expect(mockGenerateContentStream).toHaveBeenCalledWith({
      model: "primary-model",
      contents: [{ role: "user", parts: [{ text: "hello" }] }],
      config: { temperature: 0.4 },
    });
  });

  it("passes an array prompt through untouched", async () => {
    mockGenerateContentStream.mockResolvedValue("stream");
    const turns = [{ role: "model", parts: [{ text: "prior" }] }];
    await provider.streamText({ model: "fast", prompt: turns, temperature: 0.1 });
    expect(mockGenerateContentStream).toHaveBeenCalledWith({
      model: "fast-model",
      contents: turns,
      config: { temperature: 0.1 },
    });
  });

  it("gives up immediately on a non-retryable error", async () => {
    mockGenerateContentStream.mockRejectedValue(new Error("401 Unauthorized"));
    await expect(provider.streamText({ prompt: "x" })).rejects.toThrow("401 Unauthorized");
    expect(mockGenerateContentStream).toHaveBeenCalledTimes(1);
  });

  it("retries a rate limit, then exhausts", async () => {
    vi.useFakeTimers();
    try {
      mockGenerateContentStream.mockRejectedValue(rateLimited());
      const settled = expect(provider.streamText({ prompt: "x" })).rejects.toThrow(
        "429 Too Many Requests",
      );
      await vi.advanceTimersByTimeAsync(6000);
      await settled;
      expect(mockGenerateContentStream).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("embedContent", () => {
  it("wraps a single string as one part", async () => {
    mockEmbedContent.mockResolvedValue({ embeddings: [{ values: [0.1, 0.2] }] });
    await expect(provider.embedContent({ contents: "hello" })).resolves.toEqual([[0.1, 0.2]]);
    expect(mockEmbedContent).toHaveBeenCalledWith({
      model: "text-embedding-004",
      contents: [{ parts: [{ text: "hello" }] }],
      config: { outputDimensionality: 768 },
    });
  });

  it("wraps each element of an array separately", async () => {
    mockEmbedContent.mockResolvedValue({ embeddings: [{ values: [1] }, { values: [2] }] });
    await provider.embedContent({ contents: ["a", "b"], outputDimensionality: 256, model: "fast" });
    expect(mockEmbedContent).toHaveBeenCalledWith({
      model: "fast-model",
      contents: [{ parts: [{ text: "a" }] }, { parts: [{ text: "b" }] }],
      config: { outputDimensionality: 256 },
    });
  });

  it("returns an empty list when the SDK sends back no embeddings", async () => {
    mockEmbedContent.mockResolvedValue({});
    await expect(provider.embedContent({ contents: "x" })).resolves.toEqual([]);
  });
});

describe("uploadFile", () => {
  it("says plainly that it is not implemented rather than failing later", async () => {
    await expect(provider.uploadFile({ filePath: "/tmp/a.pdf" })).rejects.toThrow(
      /uploadFile not fully implemented/,
    );
  });
});
