import { describe, it, expect, vi } from "vitest";
import { errorHandler } from "./errorHandler";
import { logger } from "../logger";

vi.mock("../logger", () => ({
  logger: { error: vi.fn() }
}));

describe("errorHandler middleware", () => {
  it("logs the error and sends a 500 response", () => {
    const err = new Error("Test error");
    const req = { path: "/test", method: "GET" } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(logger.error).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    // Fixed case sensitivity: "Internal server error"
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Internal server error" }));
  });

  it("handles errors with status codes", () => {
    const err = new Error("Not found") as any;
    err.status = 404;
    const req = { path: "/test", method: "GET" } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Not found" }));
  });
});
