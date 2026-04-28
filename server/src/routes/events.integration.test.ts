import { describe, it, expect, vi } from "vitest";
import request from "supertest";

// Mock necessary deps
vi.mock("../middleware/rateLimit", () => ({ apiLimiter: (req: any, res: any, next: any) => next() }));
vi.mock("firebase-admin/app", () => ({ initializeApp: vi.fn(), cert: vi.fn(), getApps: vi.fn(() => [{ name: "mock" }]) }));

const mockSnap = {
  empty: false,
  docs: [{ id: "event-1", data: () => ({ eventType: "login", createdAt: new Date() }) }]
};

const mockGet = vi.fn().mockResolvedValue(mockSnap);
const mockOrderBy = vi.fn(() => ({ limit: vi.fn(() => ({ get: mockGet })), startAfter: vi.fn(() => ({ limit: vi.fn(() => ({ get: mockGet })) })) }));
const mockLimit = vi.fn(() => ({ get: mockGet }));

const mockCollection = vi.fn(() => ({
  doc: vi.fn(() => ({ collection: vi.fn(() => ({ orderBy: mockOrderBy, limit: mockLimit })) })),
  where: vi.fn()
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: vi.fn(() => ({ collection: mockCollection })),
  FieldValue: { serverTimestamp: vi.fn(() => "MOCK_TS") }
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({
    verifyIdToken: vi.fn().mockResolvedValue({ uid: "test-user-123", email: "test@example.com" })
  }))
}));

vi.mock("../services/firestore", () => ({
  saveClientEvent: vi.fn().mockResolvedValue("new-event-id")
}));

const { app } = await import("../app");

describe("Events API Integration", () => {
  it("GET /api/v1/events returns events list", async () => {
    const res = await request(app)
      .get("/api/v1/events")
      .set("Authorization", "Bearer token")
      .query({ limit: 10, offset: 0 });
    
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.count).toBe(1);
  });

  it("GET /api/v1/events handles offset", async () => {
    const res = await request(app)
      .get("/api/v1/events")
      .set("Authorization", "Bearer token")
      .query({ limit: 10, offset: 5 });
    
    expect(res.status).toBe(200);
    expect(mockOrderBy).toHaveBeenCalled();
  });

  it("POST /api/v1/events/track saves an event", async () => {
    const res = await request(app)
      .post("/api/v1/events/track")
      .set("Authorization", "Bearer token")
      .send({ eventType: "page_view", content: "home", meta: { some: "data" } });
    
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.eventId).toBe("new-event-id");
  });

  it("POST /api/v1/events/track returns 400 for invalid body", async () => {
    const res = await request(app)
      .post("/api/v1/events/track")
      .set("Authorization", "Bearer token")
      .send({ content: "home" }); // missing eventType
    
    expect(res.status).toBe(400);
  });
});
