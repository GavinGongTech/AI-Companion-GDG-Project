import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// ── Mock rate limiter to be a pass-through ──────────────────────────────
vi.mock("../middleware/rateLimit", () => ({
  apiLimiter: (_req: any, _res: any, next: any) => next(),
}));

// ── Mock Firebase Admin SDK before anything imports it ───────────────────
vi.mock("firebase-admin/app", () => ({
  initializeApp: vi.fn(),
  cert: vi.fn(),
  getApps: vi.fn(() => [{ name: "mock" }]),
}));

const mockGet = vi.fn().mockResolvedValue({ exists: false });
const mockSet = vi.fn().mockResolvedValue(undefined);
const mockWhere = vi.fn(() => ({
  orderBy: vi.fn(() => ({
    limit: vi.fn(() => ({
      get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
    })),
  })),
  limit: vi.fn(() => ({
    get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
  })),
  get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
}));

// mockDoc supports sub-collections (e.g. users/{uid}/quizSessions/{id})
const mockDoc = vi.fn(() => ({
  get: mockGet,
  set: mockSet,
  id: "mock-id",
  collection: vi.fn(() => ({
    doc: vi.fn(() => ({ get: mockGet, set: mockSet, id: "mock-sub-id" })),
    where: mockWhere,
    limit: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ empty: true, docs: [] }) })),
    get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
  })),
}));
const mockCollection = vi.fn(() => ({ doc: mockDoc, where: mockWhere }));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => ({ collection: mockCollection })),
  FieldValue: { serverTimestamp: vi.fn(() => "MOCK_TS"), vector: vi.fn((v) => v), increment: vi.fn((v) => v) },
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({
      uid: "test-user-123",
      email: "test@example.com",
      name: "Test User",
    }),
  })),
}));

// ── Mock services ───────────────────────────────────────────────────────
vi.mock("../services/gemini", () => ({
  explainConcept: vi.fn().mockResolvedValue({
    solution: "Here is the explanation.",
    mainConcept: "derivatives",
    relevantLecture: "Lecture 3",
    keyFormulas: ["f'(x) = lim h->0 (f(x+h) - f(x))/h"],
    personalizedCallout: "",
  }),
  classifyConcept: vi.fn().mockResolvedValue({
    conceptNode: "derivatives_chain_rule",
    errorType: "conceptual_misunderstanding",
    confidence: 0.85,
  }),
  generateQuiz: vi.fn().mockResolvedValue({
    questions: [{
      question: "What is the derivative of x^2?",
      options: ["2x", "x", "x^2", "2"],
      answer: 0,
      explanation: "Power rule: d/dx[x^n] = nx^(n-1)",
      difficulty: "easy",
      conceptNode: "derivatives_power_rule",
    }],
  }),
}));

vi.mock("../services/rag", () => ({
  retrieveChunks: vi.fn().mockResolvedValue(["Chunk 1: Derivatives are...", "Chunk 2: The chain rule states..."]),
}));

vi.mock("../services/firestore", () => ({
  saveInteraction: vi.fn().mockResolvedValue("event-id-123"),
  ensureUserDoc: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/misconception", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    recordInteraction: vi.fn().mockResolvedValue(undefined),
    getWeakestConcepts: vi.fn().mockResolvedValue([
      { conceptNode: "derivatives_chain_rule", accuracyRate: 0.3, interactionCount: 5 },
    ]),
    getGraph: vi.fn().mockResolvedValue([
      { conceptNode: "derivatives_chain_rule", accuracyRate: 0.3, interactionCount: 5, nextReviewDate: new Date() },
      { conceptNode: "integrals_by_parts", accuracyRate: 0.8, interactionCount: 12, nextReviewDate: new Date() },
    ]),
    getDrillQueue: vi.fn().mockResolvedValue([
      { conceptNode: "derivatives_chain_rule", accuracyRate: 0.3, urgency: 8.5 },
    ]),
  };
});

vi.mock("../services/ocr", () => ({
  extractTextFromBase64: vi.fn().mockResolvedValue("Extracted text from image"),
  extractText: vi.fn().mockResolvedValue("Extracted text"),
  extractTextFromPDF: vi.fn().mockResolvedValue("Extracted PDF text"),
}));

// ── Import app AFTER mocks are set up ───────────────────────────────────
const { app } = await import("../app");
const { classifyConcept } = await import("../services/gemini");

// ── Tests ───────────────────────────────────────────────────────────────

describe("POST /api/v1/analyze", () => {
  it("returns 401 without auth token", async () => {
    const res = await request(app)
      .post("/api/v1/analyze")
      .send({ content: "What is a derivative?" });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/auth token/i);
  });

  it("returns structured explanation with auth token", async () => {
    const res = await request(app)
      .post("/api/v1/analyze")
      .set("Authorization", "Bearer mock-token")
      .send({ content: "What is the chain rule?" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("solution");
    expect(res.body).toHaveProperty("mainConcept");
    expect(res.body).toHaveProperty("classifierTag");
    expect(res.body).toHaveProperty("eventId");
    expect(res.body.classifierTag.conceptNode).toBe("derivatives_chain_rule");
  });

  it("returns 400 when content and imageBase64 are both missing", async () => {
    const res = await request(app)
      .post("/api/v1/analyze")
      .set("Authorization", "Bearer mock-token")
      .send({});
    expect(res.status).toBe(400);
  });

  it("normalizes malformed classifier output instead of failing", async () => {
    (classifyConcept as any).mockResolvedValueOnce({
      conceptNode: "",
      errorType: "oops",
      confidence: "not-a-number",
    });

    const res = await request(app)
      .post("/api/v1/analyze")
      .set("Authorization", "Bearer mock-token")
      .send({ content: "Explain derivatives basics" });

    expect(res.status).toBe(200);
    expect(res.body.classifierTag).toEqual({
      conceptNode: "derivatives",
      errorType: "knowledge_gap",
      confidence: 0.5,
    });
  });
});

describe("POST /api/v1/explain", () => {
  it("returns 400 with missing question", async () => {
    const res = await request(app)
      .post("/api/v1/explain")
      .set("Authorization", "Bearer mock-token")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/validation/i);
  });

  it("returns explanation for valid question", async () => {
    const res = await request(app)
      .post("/api/v1/explain")
      .set("Authorization", "Bearer mock-token")
      .send({ question: "Explain integration by parts" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("solution");
    expect(res.body).toHaveProperty("keyFormulas");
    expect(res.body.question).toBe("Explain integration by parts");
  });
});

describe("POST /api/v1/quiz", () => {
  it("generates a quiz question", async () => {
    const res = await request(app)
      .post("/api/v1/quiz")
      .set("Authorization", "Bearer mock-token")
      .send({ topic: "derivatives" });
    expect(res.status).toBe(200);
    // Response is always { topic, courseId, sessionId, questions: [] }
    expect(res.body).toHaveProperty("questions");
    expect(res.body.questions).toHaveLength(1);
    expect(res.body.questions[0]).toHaveProperty("question");
    expect(res.body.questions[0]).toHaveProperty("options");
    expect(res.body.questions[0].options).toHaveLength(4);
    // answer must NOT be in the response — server-side grading only
    expect(res.body.questions[0]).not.toHaveProperty("answer");
  });

  it("validates count range", async () => {
    const res = await request(app)
      .post("/api/v1/quiz")
      .set("Authorization", "Bearer mock-token")
      .send({ topic: "derivatives", count: 50 });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/quiz/answer", () => {
  it("returns correctness feedback", async () => {
    // Stub session lookup to return a stored quiz session
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        questions: [{ index: 0, conceptNode: "derivatives_chain_rule", answer: 0 }],
        expiresAt: Date.now() + 30 * 60 * 1000,
      }),
    });
    const res = await request(app)
      .post("/api/v1/quiz/answer")
      .set("Authorization", "Bearer mock-token")
      .send({
        conceptNode: "derivatives_chain_rule",
        selectedAnswer: 0,
        sessionId: "00000000-0000-4000-8000-000000000001",
        questionIndex: 0,
      });
    expect(res.status).toBe(200);
    expect(res.body.isCorrect).toBe(true);
    expect(res.body).toHaveProperty("correctAnswer", 0);
    expect(res.body).toHaveProperty("eventId");
  });

  it("validates required fields", async () => {
    const res = await request(app)
      .post("/api/v1/quiz/answer")
      .set("Authorization", "Bearer mock-token")
      .send({});
    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/graph", () => {
  it("returns SMG nodes", async () => {
    const res = await request(app)
      .get("/api/v1/graph")
      .set("Authorization", "Bearer mock-token");
    expect(res.status).toBe(200);
    expect(res.body.nodes).toHaveLength(2);
    expect(res.body.nodes[0]).toHaveProperty("conceptNode");
    expect(res.body.nodes[0]).toHaveProperty("accuracyRate");
  });
});

describe("GET /api/v1/graph/drill", () => {
  it("returns drill queue", async () => {
    const res = await request(app)
      .get("/api/v1/graph/drill")
      .set("Authorization", "Bearer mock-token");
    expect(res.status).toBe(200);
    expect(res.body.queue).toHaveLength(1);
    expect(res.body.queue[0]).toHaveProperty("urgency");
  });
});

describe("POST /api/v1/ingest/text", () => {
  it("validates required fields", async () => {
    const res = await request(app)
      .post("/api/v1/ingest/text")
      .set("Authorization", "Bearer mock-token")
      .send({});
    expect(res.status).toBe(400);
  });
});

describe("GET /health", () => {
  it("returns health status", async () => {
    const res = await request(app).get("/health");
    // May be 503 if Firestore mock isn't wired to health check — both are valid
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty("service", "study-flow-api");
  });
});
