import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./api";

describe("createApiClient", () => {
  it("injects auth headers from the shared token getter", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    const client = createApiClient({
      apiUrl: "http://localhost:3000/",
      fetchImpl,
      getAuthToken: async () => "token-123",
    });

    const result = await client.apiFetch<{ ok: boolean }>("/api/v1/graph");

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/graph",
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );

    const headers = fetchImpl.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token-123");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("allows form data uploads without forcing JSON content-type", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    const client = createApiClient({
      apiUrl: "http://localhost:3000",
      fetchImpl,
    });

    const formData = new FormData();
    formData.append("file", new Blob(["study notes"]), "notes.txt");

    await client.apiFetch("/api/v1/ingest/upload", {
      method: "POST",
      body: formData,
    });

    const headers = fetchImpl.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.has("Content-Type")).toBe(false);
  });

  it("rejects unsafe production API URLs", () => {
    expect(() =>
      createApiClient({
        apiUrl: "http://studyflow.app",
        mode: "production",
      }),
    ).toThrow(/https/i);
  });
});
