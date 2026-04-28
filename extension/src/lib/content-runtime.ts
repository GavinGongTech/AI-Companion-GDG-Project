import type { IngestPagePayload, SupportedContentPlatform } from "./messages";

const PLATFORM_SELECTORS: Record<SupportedContentPlatform, string[]> = {
  brightspace: [".d2l-page-main", ".d2l-content-container", "#ContentView"],
  gradescope: [".submissionContent", ".rubricContent", ".questionContent"],
};

export function detectSupportedPlatform(hostname: string): SupportedContentPlatform | null {
  const normalized = hostname.toLowerCase();
  if (normalized.includes("brightspace")) {
    return "brightspace";
  }

  if (normalized.includes("gradescope.com")) {
    return "gradescope";
  }

  return null;
}

export function extractText(documentRef: Document, sourcePlatform: SupportedContentPlatform): string {
  for (const selector of PLATFORM_SELECTORS[sourcePlatform]) {
    const element = documentRef.querySelector<HTMLElement>(selector);
    const content = element?.innerText.trim();
    if (content) {
      return content;
    }
  }

  return (documentRef.body.innerText || "").trim();
}

export function createContentHash(text: string): string {
  return `${text.slice(0, 100)}|${text.length}`;
}

export function createIngestPayload(
  rawContent: string,
  courseName: string,
  sourcePlatform: SupportedContentPlatform,
): IngestPagePayload {
  return {
    rawContent,
    courseName,
    sourcePlatform,
  };
}
