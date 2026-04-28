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
  };
  mock.collection.mockReturnValue(mock);
  mock.doc.mockReturnValue(mock);
  mock.where.mockReturnValue(mock);
  mock.limit.mockReturnValue(mock);
  return { mockDb: mock };
});

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => mockDb),
  FieldValue: { serverTimestamp: vi.fn(() => "ts"), increment: vi.fn((n) => n) },
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: vi.fn(() => ({ verifyIdToken: vi.fn() })) }));
vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn(), cert: vi.fn(), getApps: vi.fn(() => [{ name: "m" }]) }));

// Mock services
const { mockGetGraph, mockGetDrillQueue, mockCacheGet } = vi.hoisted(() => ({
  mockGetGraph: vi.fn().mockResolvedValue([{ conceptNode: "n1" }]),
  mockGetDrillQueue: vi.fn().mockResolvedValue([{ conceptNode: "d1" }]),
  mockCacheGet: vi.fn().mockReturnValue(null),
}));
vi.mock("../services/misconception", () => ({
  getGraph: mockGetGraph,
  getDrillQueue: mockGetDrillQueue,
}));
vi.mock("../services/cache", () => ({
  cacheGet: mockCacheGet,
  cacheSet: vi.fn(),
}));

// ... rest of the file ...

  it("GET /api/v1/graph returns cached nodes", async () => {
    mockCacheGet.mockReturnValueOnce({ nodes: [{ conceptNode: "cached" }] });
    const res = await request(app)
      .get("/api/v1/graph")
      .set("Authorization", "Bearer valid");

    expect(res.status).toBe(200);
    expect(res.body.nodes[0].conceptNode).toBe("cached");
    expect(mockGetGraph).not.toHaveBeenCalled();
  });

  it("GET /api/v1/graph/drill returns cached queue", async () => {
    mockCacheGet.mockReturnValueOnce({ queue: [{ conceptNode: "cached_d" }] });
    const res = await request(app)
      .get("/api/v1/graph/drill")
      .set("Authorization", "Bearer valid");

    expect(res.status).toBe(200);
    expect(res.body.queue[0].conceptNode).toBe("cached_d");
    expect(mockGetDrillQueue).not.toHaveBeenCalled();
  });

vi.mock("../middleware/rateLimit", () => ({ apiLimiter: (req: any, res: any, next: any) => next() }));
vi.mock("../middleware/auth", () => ({
  requireFirebaseAuth: (req: any, res: any, next: any) => {
    req.user = { uid: "user123" };
    next();
  },
}));

import { app } from "../app";

describe("Graph API Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.collection.mockReturnValue(mockDb);
    mockDb.doc.mockReturnValue(mockDb);
    mockDb.where.mockReturnValue(mockDb);
    mockDb.limit.mockReturnValue(mockDb);
  });

  it("GET /api/v1/graph returns all nodes", async () => {
    const res = await request(app)
      .get("/api/v1/graph")
      .set("Authorization", "Bearer valid");

    expect(res.status).toBe(200);
    expect(res.body.nodes).toHaveLength(1);
    expect(mockGetGraph).toHaveBeenCalledWith("user123");
  });

  it("GET /api/v1/graph returns empty array if no nodes", async () => {
    mockGetGraph.mockResolvedValueOnce([]);
    const res = await request(app)
      .get("/api/v1/graph")
      .set("Authorization", "Bearer valid");

    expect(res.status).toBe(200);
    expect(res.body.nodes).toEqual([]);
  });

  it("GET /api/v1/graph/drill returns drill queue", async () => {
    const res = await request(app)
      .get("/api/v1/graph/drill")
      .set("Authorization", "Bearer valid");

    expect(res.status).toBe(200);
    expect(res.body.queue).toHaveLength(1);
    expect(mockGetDrillQueue).toHaveBeenCalledWith("user123");
  });

  it("GET /api/v1/graph/course/:courseId returns filtered nodes", async () => {
    mockDb.get.mockResolvedValueOnce({
      docs: [{ id: "n1", data: () => ({ name: "N1" }) }]
    });

    const res = await request(app)
      .get("/api/v1/graph/course/c1")
      .set("Authorization", "Bearer valid");

    expect(res.status).toBe(200);
    expect(res.body.nodes).toHaveLength(1);
  });

  it("GET /api/v1/graph/course/:courseId returns 400 for invalid courseId", async () => {
    const res = await request(app)
      .get("/api/v1/graph/course/%20")
      .set("Authorization", "Bearer valid");

    expect(res.status).toBe(400);
  });

  it("handles errors in graph", async () => {
    mockGetGraph.mockRejectedValueOnce(new Error("fail"));
    const res = await request(app).get("/api/v1/graph");
    expect(res.status).toBe(500);
  });

  it("handles errors in drill", async () => {
    mockGetDrillQueue.mockRejectedValueOnce(new Error("fail"));
    const res = await request(app).get("/api/v1/graph/drill");
    expect(res.status).toBe(500);
  });

  it("handles errors in course filtered graph", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("fail"));
    const res = await request(app).get("/api/v1/graph/course/c1");
    expect(res.status).toBe(500);
  });
});
