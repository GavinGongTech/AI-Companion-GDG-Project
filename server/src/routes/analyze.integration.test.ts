import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const { 
  mockExplain, 
  mockClassify, 
  mockRetrieveChunks, 
  mockRecordInteraction, 
  mockSaveInteraction, 
  mockEnsureUserDoc,
  mockExtractOCR,
  mockAddXP,
  mockUpdateStreak
} = vi.hoisted(() => ({
  mockExplain: vi.fn(),
  mockClassify: vi.fn(),
  mockRetrieveChunks: vi.fn(),
  mockRecordInteraction: vi.fn().mockResolvedValue(undefined),
  mockSaveInteraction: vi.fn().mockResolvedValue("event-id"),
  mockEnsureUserDoc: vi.fn().mockResolvedValue(undefined),
  mockExtractOCR: vi.fn(),
  mockAddXP: vi.fn().mockResolvedValue(undefined),
  mockUpdateStreak: vi.fn().mockResolvedValue(undefined),
}));

// Mock services
vi.mock("../services/gemini", () => ({
  explainConcept: mockExplain,
  classifyConcept: mockClassify,
}));
vi.mock("../services/rag", () => ({ retrieveChunks: mockRetrieveChunks }));
vi.mock("../services/misconception", () => ({ recordInteraction: mockRecordInteraction }));
vi.mock("../services/firestore", () => ({
  saveInteraction: mockSaveInteraction,
  ensureUserDoc: mockEnsureUserDoc,
}));
vi.mock("../services/ocr", () => ({ extractTextFromBase64: mockExtractOCR }));
vi.mock("../services/gamification", () => ({ addXP: mockAddXP, updateStreak: mockUpdateStreak }));
vi.mock("../services/cache", () => ({ cacheInvalidate: vi.fn() }));

// Mock foundational layers
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => ({ collection: vi.fn().mockReturnThis(), doc: vi.fn().mockReturnThis() })),
  FieldValue: { serverTimestamp: vi.fn(() => "ts"), increment: vi.fn((n) => n) },
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: vi.fn(() => ({ verifyIdToken: vi.fn() })) }));
vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn(), cert: vi.fn(), getApps: vi.fn(() => [{ name: "m" }]) }));

vi.mock("../middleware/rateLimit", () => ({ apiLimiter: (req: any, res: any, next: any) => next() }));
vi.mock("../middleware/auth", () => ({
  requireFirebaseAuth: (req: any, res: any, next: any) => {
    req.user = { uid: "user123", email: "u@e.com", name: "User" };
    next();
  },
}));

import { app } from "../app";

describe("Analyze API Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/v1/analyze processes text and returns explanation", async () => {
    mockExplain.mockResolvedValue({
      solution: "explanation",
      mainConcept: "X",
      relevantLecture: "L1",
      keyFormulas: ["f1"],
      personalizedCallout: "well done",
    });
    mockClassify.mockResolvedValue({ conceptNode: "node1", errorType: "none", confidence: 0.9 });
    mockRetrieveChunks.mockResolvedValue(["chunk1"]);

    const res = await request(app)
      .post("/api/v1/analyze")
      .set("Authorization", "Bearer valid")
      .send({ question: "How does X work?", courseId: "c1", content: "text" });

    expect(res.status).toBe(200);
    expect(res.body.solution).toBe("explanation");
    expect(mockSaveInteraction).toHaveBeenCalled();
    expect(mockRecordInteraction).toHaveBeenCalled();
  });

  it("POST /api/v1/analyze processes imageBase64", async () => {
    mockExtractOCR.mockResolvedValue("ocr text");
    mockExplain.mockResolvedValue({ solution: "sol" });
    mockClassify.mockResolvedValue({});

    const res = await request(app)
      .post("/api/v1/analyze")
      .send({ imageBase64: "base64data" });

    expect(res.status).toBe(200);
    expect(res.body.question).toBe("ocr text");
    expect(mockExtractOCR).toHaveBeenCalledWith("base64data");
  });

  it("returns 400 if no content or imageBase64", async () => {
    const res = await request(app)
      .post("/api/v1/analyze")
      .send({});

    expect(res.status).toBe(400);
  });

  it("handles normalization of classifier tag", async () => {
    mockExplain.mockResolvedValue({ mainConcept: "fallback" });
    mockClassify.mockResolvedValue({ conceptNode: "Node 1", errorType: "invalid", confidence: "0.8" });

    const res = await request(app)
      .post("/api/v1/analyze")
      .send({ content: "text" });

    expect(res.status).toBe(200);
    expect(res.body.classifierTag.conceptNode).toBe("node_1");
    expect(res.body.classifierTag.errorType).toBe("knowledge_gap"); // fallback
    expect(res.body.classifierTag.confidence).toBe(0.8);
  });

  it("handles errors", async () => {
    mockExplain.mockRejectedValue(new Error("Gemini down"));
    const res = await request(app)
      .post("/api/v1/analyze")
      .send({ content: "text" });

    expect(res.status).toBe(500);
  });
});
