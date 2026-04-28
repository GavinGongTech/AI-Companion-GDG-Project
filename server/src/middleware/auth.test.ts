import { describe, it, expect, vi } from "vitest";

// Use hoisted mocks to avoid initialization errors
const { mockVerifyIdToken } = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn()
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: vi.fn(() => ({ verifyIdToken: mockVerifyIdToken }))
}));

// Mock the firebase module as well since it exports auth
vi.mock("../db/firebase", () => ({
  auth: { verifyIdToken: mockVerifyIdToken }
}));

import { requireFirebaseAuth } from "./auth";

describe("requireFirebaseAuth middleware", () => {
  it("returns 401 if no auth header", async () => {
    const req = { headers: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    await requireFirebaseAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 401 if token is invalid", async () => {
    const req = { headers: { authorization: "Bearer invalid" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    const error = new Error("Invalid token") as any;
    error.code = "auth/id-token-expired";
    mockVerifyIdToken.mockRejectedValue(error);

    await requireFirebaseAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 403 if user is disabled", async () => {
    const req = { headers: { authorization: "Bearer disabled" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    const error = new Error("Disabled") as any;
    error.code = "auth/user-disabled";
    mockVerifyIdToken.mockRejectedValue(error);

    await requireFirebaseAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 400 if token is malformed", async () => {
    const req = { headers: { authorization: "Bearer malformed" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    const error = new Error("Malformed") as any;
    error.code = "auth/argument-error";
    mockVerifyIdToken.mockRejectedValue(error);

    await requireFirebaseAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 503 for non-auth errors", async () => {
    const req = { headers: { authorization: "Bearer error" } } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    mockVerifyIdToken.mockRejectedValue(new Error("Database down"));

    await requireFirebaseAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
  });

  it("calls next() if token is valid", async () => {
    const req = { headers: { authorization: "Bearer valid" } } as any;
    const res = {} as any;
    const next = vi.fn();
    mockVerifyIdToken.mockResolvedValue({ uid: "user123" });

    await requireFirebaseAuth(req, res, next);

    expect(req.user.uid).toBe("user123");
    expect(next).toHaveBeenCalled();
  });
});
