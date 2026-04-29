import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const { 
  mockExplainStream, 
  mockClassify, 
  mockRetrieveChunks, 
  mockRecordInteraction, 
  mockSaveInteraction, 
  mockAddXP, 
  mockUpdateStreak,
  mockShouldUseRag
} = vi.hoisted(() => {
  const promiseWithCatch = () => {
    const p = Promise.resolve();
    (p as any).catch = vi.fn().mockReturnValue(p);
    return p;
  };
  
  return {
    mockExplainStream: vi.fn(),
    mockClassify: vi.fn().mockResolvedValue({}),
    mockRetrieveChunks: vi.fn().mockResolvedValue([]),
    mockRecordInteraction: vi.fn().mockImplementation(promiseWithCatch),
    mockSaveInteraction: vi.fn().mockImplementation(promiseWithCatch),
    mockAddXP: vi.fn().mockImplementation(promiseWithCatch),
    mockUpdateStreak: vi.fn().mockImplementation(promiseWithCatch),
    mockShouldUseRag: vi.fn().mockReturnValue(true),
  };
});

// Mock services BEFORE anything else
vi.mock("../services/gemini", () => ({
  explainConceptStream: mockExplainStream,
  classifyConcept: mockClassify,
}));
vi.mock("../services/rag", () => ({ retrieveChunks: mockRetrieveChunks }));
vi.mock("../services/misconception", () => ({ recordInteraction: mockRecordInteraction }));
vi.mock("../services/firestore", () => ({ saveInteraction: mockSaveInteraction }));
vi.mock("../services/gamification", () => ({ addXP: mockAddXP, updateStreak: mockUpdateStreak }));
vi.mock("../services/ragPolicy", () => ({ shouldUseCourseRag: mockShouldUseRag }));
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
    req.user = { uid: "user123" };
    next();
  },
}));

import { app } from "../app";

describe("Stream API Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/v1/stream/explain streams text content", async () => {
    const mockStream = {
      async *[Symbol.asyncIterator]() {
        yield { text: () => "First chunk" };
        yield { text: "Second chunk" };
      },
    };
    mockExplainStream.mockResolvedValue(mockStream);
    mockRetrieveChunks.mockResolvedValue(["chunk1"]);
    mockClassify.mockResolvedValue({ conceptNode: "node1", errorType: "none", confidence: 0.9 });

    const res = await request(app)
      .post("/api/v1/stream/explain")
      .set("Authorization", "Bearer valid")
      .send({ question: "How does X work?", courseId: "c1" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("[DONE]");

    await vi.waitFor(() => expect(mockUpdateStreak).toHaveBeenCalled());
  });

  it("handles failures and side-effect errors", async () => {
    mockExplainStream.mockRejectedValue(new Error("Gemini down"));
    
    const res = await request(app)
      .post("/api/v1/stream/explain")
      .send({ question: "test" });

    expect(res.status).toBe(200);
    expect(res.text).toContain("Stream interrupted");
  });

  it("handles side-effect failures", async () => {
    const mockStream = { async *[Symbol.asyncIterator]() { yield { text: "ok" }; } };
    mockExplainStream.mockResolvedValue(mockStream);
    mockClassify.mockResolvedValue({ conceptNode: "node1" }); // Succeed here
    
    // But make internal ones fail
    mockRecordInteraction.mockRejectedValue(new Error("side fail"));
    mockSaveInteraction.mockRejectedValue(new Error("side fail"));
    mockAddXP.mockRejectedValue(new Error("side fail"));
    mockUpdateStreak.mockRejectedValue(new Error("side fail"));

    const res = await request(app)
      .post("/api/v1/stream/explain")
      .send({ question: "test" });

    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(mockUpdateStreak).toHaveBeenCalled());
  });
});
