import {
  ingestTextRequestSchema,
  normalizeApiUrl,
  type IngestTextRequest,
} from "@study-flow/shared";
import { getErrorMessage } from "./error";
import { storageGet, storageSet, type StorageAreaLike } from "./chrome-storage";
import {
  STORAGE_KEYS,
  type ExtensionRuntimeMessage,
  type ExtensionRuntimeResponse,
  type IngestPagePayload,
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
  const requestBody = ingestTextRequestSchema.parse(buildIngestRequest(payload));
  const response = await (deps.fetchImpl ?? fetch)(`${apiUrl}/api/v1/ingest/text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || response.statusText);
  }
}

async function openSidePanelIfPossible(
  sender: RuntimeMessageSender,
  sidePanel: BackgroundRuntimeDeps["sidePanel"],
): Promise<void> {
  const windowId = sender.tab?.windowId;
  if (typeof windowId === "number") {
    await Promise.resolve(sidePanel.open({ windowId }));
  }
}

export async function handleExtensionMessage(
  message: ExtensionRuntimeMessage,
  sender: RuntimeMessageSender,
  deps: BackgroundRuntimeDeps,
): Promise<ExtensionRuntimeResponse> {
  if (message.type === "INGEST_PAGE") {
    await storageSet(deps.sessionStorage, {
      [STORAGE_KEYS.lastIngestedContent]: message.payload,
    });
    await ingestToBackend(message.payload, deps);
    return { ok: true };
  }

  if (message.type === "OPEN_ASK") {
    await storageSet(deps.sessionStorage, {
      [STORAGE_KEYS.prefillAsk]: message.payload?.selectedText || "",
    });
    await openSidePanelIfPossible(sender, deps.sidePanel);
    return { ok: true };
  }

  await storageSet(deps.sessionStorage, {
    [STORAGE_KEYS.navigateTo]: "quiz",
  });
  await openSidePanelIfPossible(sender, deps.sidePanel);
  return { ok: true };
}

export function createMessageErrorResponse(error: unknown): ExtensionRuntimeResponse {
  return {
    ok: false,
    error: getErrorMessage(error),
  };
}
