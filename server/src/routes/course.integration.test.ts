import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// Mock foundational layers FIRST
const { mockDb } = vi.hoisted(() => {
  const mock = {
    collection: vi.fn(),
    doc: vi.fn(),
    get: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    count: vi.fn(),
  };
  mock.collection.mockReturnValue(mock);
  mock.doc.mockReturnValue(mock);
  mock.where.mockReturnValue(mock);
  mock.limit.mockReturnValue(mock);
  mock.count.mockReturnValue({ get: vi.fn().mockResolvedValue({ data: () => ({ count: 5 }) }) });
  return { mockDb: mock };
});

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => mockDb),
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

vi.mock("../services/cache", () => ({
  cacheGet: vi.fn(() => null),
  cacheSet: vi.fn(),
  cacheInvalidate: vi.fn(),
}));

import { app } from "../app";

describe("Course API Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.collection.mockReturnValue(mockDb);
    mockDb.doc.mockReturnValue(mockDb);
  });

  it("GET /api/v1/courses returns courses list", async () => {
    mockDb.get.mockResolvedValueOnce({
      docs: [{ id: "c1", data: () => ({ courseName: "Math" }) }]
    });

    const res = await request(app)
      .get("/api/v1/courses")
      .set("Authorization", "Bearer valid");

    expect(res.status).toBe(200);
    expect(res.body.courses).toHaveLength(1);
  });

  it("GET /api/v1/courses/:courseId returns details", async () => {
    mockDb.get.mockResolvedValueOnce({
      exists: true,
      data: () => ({ courseName: "Math" })
    });
    // For ingestedDocs
    mockDb.get.mockResolvedValueOnce({
      docs: [{ id: "d1", data: () => ({ filename: "f1.pdf" }) }]
    });

    const res = await request(app)
      .get("/api/v1/courses/c1")
      .set("Authorization", "Bearer valid");

    expect(res.status).toBe(200);
    expect(res.body.courseId).toBe("c1");
    expect(res.body.chunkCount).toBe(5);
  });

  it("returns 404 for missing course", async () => {
    mockDb.get.mockResolvedValueOnce({ exists: false });
    const res = await request(app).get("/api/v1/courses/missing");
    expect(res.status).toBe(404);
  });

  it("handles errors", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("fail"));
    const res = await request(app).get("/api/v1/courses");
    expect(res.status).toBe(500);
  });

  it("handles errors in details", async () => {
    mockDb.get.mockResolvedValueOnce({ exists: true, data: () => ({}) });
    mockDb.get.mockRejectedValueOnce(new Error("fail"));
    const res = await request(app).get("/api/v1/courses/c1");
    expect(res.status).toBe(500);
  });
});
