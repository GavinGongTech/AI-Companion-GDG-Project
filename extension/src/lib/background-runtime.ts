import { createApiClient, ingestTextContent, uploadIngestFile } from "@study-flow/client";
import { type IngestTextRequest, normalizeApiUrl } from "@study-flow/shared";
import { getErrorMessage } from "./error";
import { storageGet, storageSet, type StorageAreaLike } from "./chrome-storage";
import {
  STORAGE_KEYS,
  type ExtensionRuntimeMessage,
  type ExtensionRuntimeResponse,
  type IngestPagePayload,
  type IngestPdfPayload,
} from "./messages";

const DEFAULT_API_URL = "http://localhost:3000";

export interface RuntimeMessageSender {
  tab?: {
    windowId?: number;
  } | null;
}

export interface BackgroundRuntimeDeps {
  localStorage: StorageAreaLike;
  sessionStorage: StorageAreaLike;
  sidePanel: {
    open(options: { windowId: number }): Promise<void> | void;
  };
  fetchImpl?: typeof fetch;
  mode?: "development" | "production" | "test";
}

export function buildIngestRequest(payload: IngestPagePayload): IngestTextRequest {
  return {
    courseId: payload.courseName || "general",
    rawContent: payload.rawContent,
    sourcePlatform: payload.sourcePlatform,
  };
}

export async function readConfiguredApiUrl(
  localStorage: StorageAreaLike,
  fallbackApiUrl = DEFAULT_API_URL,
  mode: "development" | "production" | "test" = "development",
): Promise<string> {
  const data = await storageGet<{ apiUrl?: string }>(localStorage, [STORAGE_KEYS.apiUrl]);
  return normalizeApiUrl(data.apiUrl || fallbackApiUrl, mode);
}

export async function ingestPdfToBackend(
  payload: IngestPdfPayload,
  deps: Pick<BackgroundRuntimeDeps, "localStorage" | "sessionStorage" | "fetchImpl" | "mode">,
): Promise<void> {
  const session = await storageGet<{ firebaseIdToken?: string }>(deps.sessionStorage, [
    STORAGE_KEYS.firebaseIdToken,
  ]);
  const token = session.firebaseIdToken;
  if (!token) return;

  const apiUrl = await readConfiguredApiUrl(deps.localStorage, DEFAULT_API_URL, deps.mode);
  const fetchImpl = deps.fetchImpl || fetch;

  // Fetch PDF with session cookies so Brightspace/Gradescope auth is preserved
  const response = await fetchImpl(payload.pdfUrl, { credentials: "include" });
  if (!response.ok) return;

  const arrayBuffer = await response.arrayBuffer();
  const file = new File([arrayBuffer], payload.filename, { type: "application/pdf" });

  const client = createApiClient({
    apiUrl,
    getAuthToken: () => token,
    fetchImpl: deps.fetchImpl,
    mode: deps.mode,
  });

  await uploadIngestFile(client, file, payload.courseName);
}

export async function ingestToBackend(
  payload: IngestPagePayload,
  deps: Pick<BackgroundRuntimeDeps, "localStorage" | "sessionStorage" | "fetchImpl" | "mode">,
): Promise<void> {
  const session = await storageGet<{ firebaseIdToken?: string }>(deps.sessionStorage, [
    STORAGE_KEYS.firebaseIdToken,
  ]);
  const token = session.firebaseIdToken;
  if (!token) {
    return;
  }

  const apiUrl = await readConfiguredApiUrl(deps.localStorage, DEFAULT_API_URL, deps.mode);

  const client = createApiClient({
    apiUrl,
    getAuthToken: () => token,
    fetchImpl: deps.fetchImpl,
    mode: deps.mode,
  });

  await ingestTextContent(client, buildIngestRequest(payload));
}

async function openSidePanelIfPossible(
  sender: RuntimeMessageSender,
  sidePanel: BackgroundRuntimeDeps["sidePanel"],
): Promise<void> {
  const windowId = sender.tab?.windowId;
  if (typeof windowId === "number") {
    try {
      await Promise.resolve(sidePanel.open({ windowId }));
    } catch (error) {
      const message = getErrorMessage(error);
      if (message.includes("may only be called in response to a user gesture")) {
        return;
      }

      throw error;
    }
  }
}

async function captureSenderTabScreenshot(sender: RuntimeMessageSender): Promise<string> {
  const windowId = sender.tab?.windowId;
  if (typeof windowId !== "number") {
    throw new Error("No active window to capture.");
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    chrome.tabs.captureVisibleTab(windowId, { format: "jpeg", quality: 80 }, (url) => {
      const le = chrome.runtime.lastError;
      if (le) reject(new Error(le.message));
      else resolve(url || "");
    });
  });
  const base64 = dataUrl.includes(",") ? dataUrl.split(",", 2)[1]! : "";
  if (!base64) {
    throw new Error("Screenshot capture returned empty image data.");
  }
  return base64;
}

export async function handleExtensionMessage(
  message: ExtensionRuntimeMessage,
  sender: RuntimeMessageSender,
  deps: BackgroundRuntimeDeps,
): Promise<ExtensionRuntimeResponse> {
  switch (message.type) {
    case "INGEST_PAGE": {
      await storageSet(deps.sessionStorage, {
        [STORAGE_KEYS.lastIngestedContent]: message.payload,
      });
      await ingestToBackend(message.payload, deps);
      return { ok: true };
    }
    case "INGEST_PDF": {
      await ingestPdfToBackend(message.payload, deps);
      return { ok: true };
    }
    case "OPEN_ASK":
      await storageSet(deps.sessionStorage, {
        [STORAGE_KEYS.prefillAsk]: message.payload?.selectedText || "",
        [STORAGE_KEYS.navigateTo]: "ask",
      });
      await openSidePanelIfPossible(sender, deps.sidePanel);
      return { ok: true };
    case "OPEN_ASK_SCREENSHOT": {
      const base64 = await captureSenderTabScreenshot(sender);
      await storageSet(deps.sessionStorage, {
        [STORAGE_KEYS.navigateTo]: "ask",
        [STORAGE_KEYS.prefillAsk]: message.payload?.selectedText || "",
        [STORAGE_KEYS.prefillAskImageBase64]: base64,
      });
      await openSidePanelIfPossible(sender, deps.sidePanel);
      return { ok: true };
    }
    case "OPEN_QUIZ":
      await storageSet(deps.sessionStorage, {
        [STORAGE_KEYS.navigateTo]: "quiz",
      });
      await openSidePanelIfPossible(sender, deps.sidePanel);
      return { ok: true };
    case "OPEN_QUIZ_SCREENSHOT": {
      const base64 = await captureSenderTabScreenshot(sender);
      await storageSet(deps.sessionStorage, {
        [STORAGE_KEYS.navigateTo]: "quiz",
        [STORAGE_KEYS.prefillQuizImageBase64]: base64,
      });
      await openSidePanelIfPossible(sender, deps.sidePanel);
      return { ok: true };
    }
    default: {
      const _exhaustive: never = message;
      return { ok: false, error: `Unknown message type: ${String((_exhaustive as ExtensionRuntimeMessage).type)}` };
    }
  }
}

export function createMessageErrorResponse(error: unknown): ExtensionRuntimeResponse {
  return {
    ok: false,
    error: getErrorMessage(error),
  };
}
