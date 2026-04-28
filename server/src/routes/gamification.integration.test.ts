import { describe, it, expect, vi } from "vitest";

// Mock foundational layers FIRST
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => ({
    collection: vi.fn().mockReturnThis(),
    doc: vi.fn().mockReturnThis(),
  })),
  FieldValue: { serverTimestamp: vi.fn(() => "ts"), increment: vi.fn((n) => n) },
}));
vi.mock("firebase-admin/auth", () => ({ getAuth: vi.fn(() => ({ verifyIdToken: vi.fn() })) }));
vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn(), cert: vi.fn(), getApps: vi.fn(() => [{ name: "m" }]) }));

vi.mock("../ai/index", () => ({
  getAiProvider: vi.fn(() => ({ generateJson: vi.fn(), streamText: vi.fn(), embedContent: vi.fn(), uploadFile: vi.fn() })),
}));

// Mock services
vi.mock("../services/gamification", () => ({
  getGamificationData: vi.fn().mockResolvedValue({ xp: 100 }),
  updateStreak: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../middleware/rateLimit", () => ({ apiLimiter: (req: any, res: any, next: any) => next() }));
vi.mock("../middleware/auth", () => ({
  requireFirebaseAuth: (req: any, res: any, next: any) => {
    req.user = { uid: "user123", email: "u@e.com", name: "User" };
    next();
  },
}));

import request from "supertest";
const { app } = await import("../app");
const { getGamificationData, updateStreak } = await import("../services/gamification");

describe("Gamification API Integration", () => {
  it("GET /api/v1/gamification returns stats", async () => {
    const res = await request(app)
      .get("/api/v1/gamification")
      .set("Authorization", "Bearer valid");

    expect(res.status).toBe(200);
    expect(res.body.xp).toBe(100);
    expect(updateStreak).toHaveBeenCalledWith("user123");
  });

  it("handles errors gracefully", async () => {
    vi.mocked(getGamificationData).mockRejectedValueOnce(new Error("fail"));
    const res = await request(app)
      .get("/api/v1/gamification")
      .set("Authorization", "Bearer valid");

    expect(res.status).toBe(500);
  });

  it("handles streak update failure silently", async () => {
    vi.mocked(updateStreak).mockRejectedValueOnce(new Error("streak fail"));
    const res = await request(app)
      .get("/api/v1/gamification")
      .set("Authorization", "Bearer valid");

    expect(res.status).toBe(200);
  });
});
