import { describe, it, expect, vi } from "vitest";

const { mockIngestFile, mockIngestText } = vi.hoisted(() => ({
  mockIngestFile: vi.fn().mockResolvedValue(undefined),
  mockIngestText: vi.fn().mockResolvedValue(undefined),
}));

// Mock ALL external and internal dependencies BEFORE app
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn().mockReturnThis(),
    doc: vi.fn().mockReturnThis(),
    batch: vi.fn(() => ({ set: vi.fn(), commit: vi.fn().mockResolvedValue(true) })),
  })),
  FieldValue: { serverTimestamp: vi.fn(() => "ts"), increment: vi.fn((n) => n) },
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: vi.fn(() => ({ verifyIdToken: vi.fn() })) }));
vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn(), cert: vi.fn(), getApps: vi.fn(() => [{ name: "m" }]) }));

vi.mock("../ai/index", () => ({
  getAiProvider: vi.fn(() => ({ generateJson: vi.fn(), streamText: vi.fn(), embedContent: vi.fn(), uploadFile: vi.fn() })),
}));

vi.mock("../services/ingestion", () => ({
  ingestFile: mockIngestFile,
  ingestText: mockIngestText,
}));
vi.mock("../services/firestore", () => ({ ensureUserDoc: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../services/cache", () => ({ cacheInvalidate: vi.fn() }));

vi.mock("../middleware/rateLimit", () => ({ apiLimiter: (req: any, res: any, next: any) => next() }));
vi.mock("../middleware/auth", () => ({
  requireFirebaseAuth: (req: any, res: any, next: any) => {
    req.user = { uid: "user123", email: "u@e.com", name: "User" };
    next();
  },
}));

import request from "supertest";
const { app } = await import("../app");

describe("Ingest API Integration", () => {
  it("POST /api/v1/ingest/text ingests raw text", async () => {
    const res = await request(app)
      .post("/api/v1/ingest/text")
      .set("Authorization", "Bearer valid")
      .send({ courseId: "c1", rawContent: "some text", sourcePlatform: "brightspace" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("POST /api/v1/ingest/upload ingests uploaded file", async () => {
    const res = await request(app)
      .post("/api/v1/ingest/upload")
      .set("Authorization", "Bearer valid")
      .field("courseId", "c1")
      .attach("file", Buffer.from("content"), "test.txt");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("POST /api/v1/ingest/upload returns 400 if no file", async () => {
    const res = await request(app)
      .post("/api/v1/ingest/upload")
      .set("Authorization", "Bearer valid")
      .field("courseId", "c1");

    expect(res.status).toBe(400);
  });

  it("POST /api/v1/ingest/upload returns 400 if no courseId", async () => {
    const res = await request(app)
      .post("/api/v1/ingest/upload")
      .set("Authorization", "Bearer valid")
      .attach("file", Buffer.from("content"), "test.txt");

    expect(res.status).toBe(400);
  });

  it("POST /api/v1/ingest/upload handles failures and cleans up", async () => {
    mockIngestFile.mockRejectedValueOnce(new Error("fail"));
    const res = await request(app)
      .post("/api/v1/ingest/upload")
      .set("Authorization", "Bearer valid")
      .field("courseId", "c1")
      .attach("file", Buffer.from("content"), "test.txt");

    expect(res.status).toBe(500);
  });

  it("POST /api/v1/ingest/text handles errors", async () => {
    mockIngestText.mockRejectedValueOnce(new Error("fail"));
    const res = await request(app)
      .post("/api/v1/ingest/text")
      .set("Authorization", "Bearer valid")
      .send({ courseId: "c1", rawContent: "text" });

    expect(res.status).toBe(500);
  });
});
