import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const { mockExplain, mockRetrieveChunks } = vi.hoisted(() => ({
  mockExplain: vi.fn(),
  mockRetrieveChunks: vi.fn().mockResolvedValue([]),
}));

// Mock services
vi.mock("../services/gemini", () => ({ explainConcept: mockExplain }));
vi.mock("../services/rag", () => ({ retrieveChunks: mockRetrieveChunks }));

// Mock foundations
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => ({ collection: vi.fn().mockReturnThis(), doc: vi.fn().mockReturnThis() })),
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

describe("Explain API Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /api/v1/explain returns explanation", async () => {
    mockExplain.mockResolvedValue({
      solution: "sol",
      mainConcept: "C",
      relevantLecture: "L",
      keyFormulas: [],
      personalizedCallout: "P",
    });

    const res = await request(app)
      .post("/api/v1/explain")
      .send({ question: "test", courseId: "c1" });

    expect(res.status).toBe(200);
    expect(res.body.solution).toBe("sol");
  });

  it("handles errors", async () => {
    mockExplain.mockRejectedValueOnce(new Error("fail"));
    const res = await request(app)
      .post("/api/v1/explain")
      .send({ question: "test" });

    expect(res.status).toBe(500);
  });
});
