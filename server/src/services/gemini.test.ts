import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGenerateJson, mockStreamText } = vi.hoisted(() => ({
  mockGenerateJson: vi.fn(),
  mockStreamText: vi.fn(),
}));

vi.mock("../ai/index", () => ({
  getAiProvider: () => ({ generateJson: mockGenerateJson, streamText: mockStreamText }),
}));

import {
  identifyConcept,
  explainConcept,
  classifyConcept,
  generateQuiz,
  explainConceptStream,
  explainStreaming,
  discoverConcepts,
} from "./gemini";

/** The prompt string the provider was handed on the most recent call. */
function lastPrompt(mock = mockGenerateJson): string {
  return mock.mock.calls.at(-1)![0].prompt;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerateJson.mockResolvedValue({});
  mockStreamText.mockResolvedValue("stream");
});

describe("identifyConcept", () => {
  it("uses the fast model at zero temperature and includes the question", async () => {
    mockGenerateJson.mockResolvedValue({ concept: "limits", confidence: 0.9 });
    await expect(identifyConcept("what is a limit?")).resolves.toEqual({
      concept: "limits",
      confidence: 0.9,
    });
    const call = mockGenerateJson.mock.calls[0][0];
    // Zero temperature because classification should be reproducible: the same
    // question tagged two ways would split one concept across two graph nodes.
    expect(call).toMatchObject({ model: "fast", temperature: 0 });
    expect(call.prompt).toContain("what is a limit?");
  });
});

describe("explainConcept", () => {
  it("uses the primary model and embeds the question and context", async () => {
    await explainConcept("why?", "lecture notes");
    expect(mockGenerateJson.mock.calls[0][0]).toMatchObject({ model: "primary", temperature: 0.4 });
    expect(lastPrompt()).toContain("lecture notes");
    expect(lastPrompt()).toContain("why?");
  });

  it("tells the model to fall back on general knowledge when context is empty", async () => {
    await explainConcept("why?", "");
    expect(lastPrompt()).toContain("No course materials available");
  });

  it("truncates context to 5000 characters", async () => {
    await explainConcept("why?", "x".repeat(9000));
    // The cap is what keeps a whole uploaded textbook out of a single prompt.
    expect(lastPrompt()).toContain("x".repeat(5000));
    expect(lastPrompt()).not.toContain("x".repeat(5001));
  });

  it("omits the history section entirely when there is no student model", async () => {
    await explainConcept("why?", "ctx");
    expect(lastPrompt()).not.toContain("STUDENT HISTORY");
  });

  it("lists the three most frequent misconceptions, worst first", async () => {
    await explainConcept("why?", "ctx", {
      errorTypeMap: { rare: 1, worst: 9, middling: 5, second: 7 },
    });
    expect(lastPrompt()).toContain("Primary Misconceptions: worst, second, middling");
    expect(lastPrompt()).not.toContain("rare");
  });

  it("includes the last three interactions and no more", async () => {
    await explainConcept("why?", "ctx", {
      recentInteractions: [
        { q: "oldest", a: "a0" },
        { q: "q1", a: "a1" },
        { q: "q2", a: "a2" },
        { q: "q3", a: "a3" },
      ],
    });
    const prompt = lastPrompt();
    expect(prompt).toContain("Q: q3");
    expect(prompt).not.toContain("Q: oldest");
  });

  it("writes the history header even when there is nothing to say under it", async () => {
    await explainConcept("why?", "ctx", {});
    expect(lastPrompt()).toContain("STUDENT HISTORY (this course)");
    expect(lastPrompt()).not.toContain("Primary Misconceptions");
  });
});

describe("classifyConcept", () => {
  it("passes both the question and the solution through", async () => {
    await classifyConcept("q", "s");
    expect(mockGenerateJson.mock.calls[0][0]).toMatchObject({ model: "fast", temperature: 0 });
    expect(lastPrompt()).toContain("q");
    expect(lastPrompt()).toContain("s");
  });

  it("truncates a long question and a long solution independently", async () => {
    await classifyConcept("q".repeat(2000), "s".repeat(3000));
    expect(lastPrompt()).toContain("q".repeat(1200));
    expect(lastPrompt()).not.toContain("q".repeat(1201));
    expect(lastPrompt()).toContain("s".repeat(2000));
    expect(lastPrompt()).not.toContain("s".repeat(2001));
  });

  it("survives null inputs rather than throwing on .slice", async () => {
    await expect(classifyConcept(null as any, undefined as any)).resolves.toEqual({});
  });
});

describe("generateQuiz", () => {
  it("joins chunks into one context block", async () => {
    await generateQuiz("integrals", ["chunk one", "chunk two"]);
    expect(mockGenerateJson.mock.calls[0][0]).toMatchObject({ model: "primary", temperature: 0.7 });
    expect(lastPrompt()).toContain("chunk one\n\n---\n\nchunk two");
    expect(lastPrompt()).toContain('Generate 3 multiple-choice questions for the topic "integrals"');
  });

  it("accepts the legacy (contextText, count) signature", async () => {
    await generateQuiz("some raw context", 7);
    // The old call site passed the context first and a count second. It is
    // re-entered as a general-topic quiz whose single chunk is that context.
    expect(lastPrompt()).toContain("Generate 7 multiple-choice questions");
    expect(lastPrompt()).toContain('topic "general"');
    expect(lastPrompt()).toContain("some raw context");
  });

  it("falls back to a general topic when the topic is blank", async () => {
    await generateQuiz("", ["ctx"]);
    expect(lastPrompt()).toContain('topic "general"');
  });

  it("says so when there is no course material at all", async () => {
    await generateQuiz("integrals", []);
    expect(lastPrompt()).toContain("No course material provided.");
  });

  it("hints at the student's weak concept and error types", async () => {
    await generateQuiz("integrals", ["ctx"], {
      conceptNode: "integration_by_parts",
      errorTypeMap: { procedural_error: 3, knowledge_gap: 1 },
    });
    expect(lastPrompt()).toContain("Student weak concept hint: integration_by_parts");
    expect(lastPrompt()).toContain("procedural_error, knowledge_gap");
  });

  it("copes with a student model that has no concept recorded", async () => {
    await generateQuiz("integrals", ["ctx"], {});
    expect(lastPrompt()).toContain("Student weak concept hint: .");
  });

  it("truncates context to 8000 characters", async () => {
    await generateQuiz("t", ["y".repeat(12000)]);
    expect(lastPrompt()).toContain("y".repeat(8000));
    expect(lastPrompt()).not.toContain("y".repeat(8001));
  });
});

describe("explainConceptStream", () => {
  it("streams with the primary model", async () => {
    await expect(explainConceptStream("q", "ctx")).resolves.toBe("stream");
    expect(mockStreamText.mock.calls[0][0]).toMatchObject({ model: "primary", temperature: 0.4 });
    expect(lastPrompt(mockStreamText)).toContain("STUDENT QUESTION: q");
  });

  it("defaults to no context", async () => {
    await explainConceptStream("q");
    expect(lastPrompt(mockStreamText)).toContain("CONTEXT: \n");
  });

  it("truncates a long question and a long context", async () => {
    await explainConceptStream("q".repeat(900), "c".repeat(9000));
    const prompt = lastPrompt(mockStreamText);
    expect(prompt).toContain("q".repeat(500));
    expect(prompt).not.toContain("q".repeat(501));
    expect(prompt).toContain("c".repeat(5000));
    expect(prompt).not.toContain("c".repeat(5001));
  });

  it("is the same function the legacy explainStreaming name points at", () => {
    // Routes import one name or the other depending on how the bundler resolves
    // the extension, so the alias has to stay an alias and not drift into a copy.
    expect(explainStreaming).toBe(explainConceptStream);
  });
});

describe("discoverConcepts", () => {
  it("returns the concepts the model found", async () => {
    mockGenerateJson.mockResolvedValue({ concepts: ["tangent_planes", "partial_derivatives"] });
    await expect(discoverConcepts("some notes")).resolves.toEqual({
      concepts: ["tangent_planes", "partial_derivatives"],
    });
    expect(mockGenerateJson.mock.calls[0][0]).toMatchObject({ model: "fast", temperature: 0 });
  });

  it("returns an empty list when the response has no concepts field", async () => {
    mockGenerateJson.mockResolvedValue({});
    await expect(discoverConcepts("notes")).resolves.toEqual({ concepts: [] });
  });

  it("swallows a provider failure rather than failing the ingest that called it", async () => {
    // Concept discovery decorates an upload; it is not the upload. A 429 here
    // should cost the graph some nodes, not lose the file the student sent.
    mockGenerateJson.mockRejectedValue(new Error("429"));
    await expect(discoverConcepts("notes")).resolves.toEqual({ concepts: [] });
  });

  it("truncates the material to 10000 characters", async () => {
    await discoverConcepts("z".repeat(15000));
    expect(lastPrompt()).toContain("z".repeat(10000));
    expect(lastPrompt()).not.toContain("z".repeat(10001));
  });
});
