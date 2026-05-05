export type SupportedContentPlatform = "brightspace" | "gradescope";

export interface IngestPagePayload {
  rawContent: string;
  courseName: string;
  sourcePlatform: SupportedContentPlatform;
  pdfUrl?: string;
  filename?: string;
}

export interface IngestPdfPayload {
  pdfUrl: string;
  filename: string;
  courseName: string;
  sourcePlatform: SupportedContentPlatform;
}

export interface OpenAskPayload {
  selectedText?: string;
}

export type ExtensionRuntimeMessage =
  | { type: "INGEST_PAGE"; payload: IngestPagePayload }
  | { type: "INGEST_PDF"; payload: IngestPdfPayload }
  | { type: "OPEN_ASK"; payload?: OpenAskPayload }
  | { type: "OPEN_ASK_SCREENSHOT"; payload?: OpenAskPayload }
  | { type: "OPEN_QUIZ" }
  | { type: "OPEN_QUIZ_SCREENSHOT" };

export interface ExtensionRuntimeResponse {
  ok: boolean;
  error?: string;
}

export const STORAGE_KEYS = {
  apiUrl: "apiUrl",
  firebaseIdToken: "firebaseIdToken",
  authUser: "authUser",
  lastIngestedContent: "lastIngestedContent",
  navigateTo: "navigateTo",
  prefillAsk: "prefillAsk",
  prefillAskImageBase64: "prefillAskImageBase64",
  prefillQuizImageBase64: "prefillQuizImageBase64",
} as const;

export function isExtensionRuntimeMessage(message: unknown): message is ExtensionRuntimeMessage {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as { type?: string };
  return (
    candidate.type === "INGEST_PAGE" ||
    candidate.type === "INGEST_PDF" ||
    candidate.type === "OPEN_ASK" ||
    candidate.type === "OPEN_ASK_SCREENSHOT" ||
    candidate.type === "OPEN_QUIZ" ||
    candidate.type === "OPEN_QUIZ_SCREENSHOT"
  );
}
