export type SupportedContentPlatform = "brightspace" | "gradescope";

export interface IngestPagePayload {
  rawContent: string;
  courseName: string;
  sourcePlatform: SupportedContentPlatform;
}

export interface OpenAskPayload {
  selectedText?: string;
}

export type ExtensionRuntimeMessage =
  | { type: "INGEST_PAGE"; payload: IngestPagePayload }
  | { type: "OPEN_ASK"; payload?: OpenAskPayload }
  | { type: "OPEN_QUIZ" };

export interface ExtensionRuntimeResponse {
  ok: boolean;
  error?: string;
}

export const STORAGE_KEYS = {
  apiUrl: "apiUrl",
  firebaseIdToken: "firebaseIdToken",
  lastIngestedContent: "lastIngestedContent",
  navigateTo: "navigateTo",
  prefillAsk: "prefillAsk",
} as const;

export function isExtensionRuntimeMessage(message: unknown): message is ExtensionRuntimeMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as { type?: string };
  return (
    candidate.type === "INGEST_PAGE" ||
    candidate.type === "OPEN_ASK" ||
    candidate.type === "OPEN_QUIZ"
  );
}
