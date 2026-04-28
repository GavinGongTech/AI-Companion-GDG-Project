/// <reference types="bun-types" />
import { describe, expect, it, mock } from "bun:test";
import {
  buildIngestRequest,
  handleExtensionMessage,
  ingestToBackend,
  readConfiguredApiUrl,
} from "./background-runtime";
import { persistFirebaseIdToken } from "./auth-session";
import { STORAGE_KEYS, type IngestPagePayload } from "./messages";
import type { StorageAreaLike } from "./chrome-storage";

function createStorage(initialState: Record<string, unknown> = {}): StorageAreaLike & { state: Record<string, unknown> } {
  const state = { ...initialState };

  return {
    state,
    get(keys) {
      const requestedKeys = Array.isArray(keys)
        ? keys
        : typeof keys === "string"
          ? [keys]
          : Object.keys(keys);

      return requestedKeys.reduce<Record<string, unknown>>((result, key) => {
        if (key in state) {
          result[key] = state[key];
        }
        return result;
      }, {});
    },
    set(items) {
      Object.assign(state, items);
    },
    remove(keys) {
      const keysToRemove = Array.isArray(keys) ? keys : [keys];
      for (const key of keysToRemove) {
        delete state[key];
      }
    },
  };
}

const samplePayload: IngestPagePayload = {
  rawContent: "Integral practice set",
  courseName: "calc-101",
  sourcePlatform: "brightspace",
};

describe("background runtime", () => {
  it("builds the ingest payload expected by the backend", () => {
    expect(buildIngestRequest(samplePayload)).toEqual({
      courseId: "calc-101",
      rawContent: "Integral practice set",
      sourcePlatform: "brightspace",
    });
  });

  it("normalizes a stored API URL and rejects unsafe hosts", async () => {
    const safeStorage = createStorage({ [STORAGE_KEYS.apiUrl]: "http://localhost:3000/" });
    await expect(readConfiguredApiUrl(safeStorage)).resolves.toBe("http://localhost:3000");

    const unsafeStorage = createStorage({ [STORAGE_KEYS.apiUrl]: "http://example.com" });
    await expect(readConfiguredApiUrl(unsafeStorage)).rejects.toThrow("VITE_API_URL");
  });

  it("stores last ingested content and posts it when a token exists", async () => {
    const localStorage = createStorage({ [STORAGE_KEYS.apiUrl]: "http://localhost:3000/" });
    const sessionStorage = createStorage({ [STORAGE_KEYS.firebaseIdToken]: "token-123" });
    const fetchImpl = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      handleExtensionMessage(
        { type: "INGEST_PAGE", payload: samplePayload },
        {},
        {
          localStorage,
          sessionStorage,
          sidePanel: { open: mock(() => Promise.resolve()) },
          fetchImpl: fetchImpl as unknown as typeof fetch,
        },
      ),
    ).resolves.toEqual({ ok: true });

    expect(sessionStorage.state[STORAGE_KEYS.lastIngestedContent]).toEqual(samplePayload);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/ingest/text",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
          "Content-Type": "application/json",
        }),
      }),
    );

    const requestInit = (fetchImpl.mock.calls as unknown as any)[0]?.[1] as RequestInit;
    expect(JSON.parse(String(requestInit.body))).toEqual({
      courseId: "calc-101",
      rawContent: "Integral practice set",
      sourcePlatform: "brightspace",
    });
  });

  it("skips ingestion silently when there is no stored Firebase token", async () => {
    const fetchImpl = mock(() => Promise.resolve(new Response(null, { status: 204 })));

    await ingestToBackend(samplePayload, {
      localStorage: createStorage(),
      sessionStorage: createStorage(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
      mode: "development",
    });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("persists Ask prefill text and opens the side panel", async () => {
    const sessionStorage = createStorage();
    const open = mock(() => Promise.resolve());

    await expect(
      handleExtensionMessage(
        { type: "OPEN_ASK", payload: { selectedText: "Explain Green's theorem" } },
        { tab: { windowId: 42 } },
        {
          localStorage: createStorage(),
          sessionStorage,
          sidePanel: { open },
        },
      ),
    ).resolves.toEqual({ ok: true });

    expect(sessionStorage.state[STORAGE_KEYS.prefillAsk]).toBe("Explain Green's theorem");
    expect(open).toHaveBeenCalledWith({ windowId: 42 });
  });
});

describe("auth session persistence", () => {
  it("stores and clears the Firebase ID token in session storage", async () => {
    const sessionStorage = createStorage();

    await persistFirebaseIdToken(sessionStorage, "fresh-token");
    expect(sessionStorage.state[STORAGE_KEYS.firebaseIdToken]).toBe("fresh-token");

    await persistFirebaseIdToken(sessionStorage, null);
    expect(sessionStorage.state[STORAGE_KEYS.firebaseIdToken]).toBeUndefined();
  });
});
