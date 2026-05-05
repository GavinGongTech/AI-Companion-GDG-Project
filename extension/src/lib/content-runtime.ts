import type { IngestPagePayload, SupportedContentPlatform } from "./messages";

const PLATFORM_SELECTORS: Record<SupportedContentPlatform, string[]> = {
  brightspace: [".d2l-page-main", ".d2l-content-container", "#ContentView"],
  gradescope: [".submissionContent", ".rubricContent", ".questionContent"],
};

export function deriveCourseId(hostname: string, pathname: string, fallback: string): string {
  // Brightspace: /d2l/le/content/{ouId}/... or /d2l/le/{ouId}/...
  const brightspaceMatch = pathname.match(/\/d2l\/le\/(?:content\/)?(\d+)/);
  if (brightspaceMatch) return `brightspace-${brightspaceMatch[1]}`;

  // Gradescope: /courses/{courseId}/...
  const gradescopeMatch = pathname.match(/\/courses\/(\d+)/);
  if (gradescopeMatch) return `gradescope-${gradescopeMatch[1]}`;

  return fallback;
}

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

export function detectPdfUrl(
  documentRef: Document,
  sourcePlatform: SupportedContentPlatform,
): { pdfUrl: string; filename: string } | null {
  if (sourcePlatform === "brightspace") {
    // 1. Try to find the Download button link
    const downloadBtn = documentRef.querySelector<HTMLAnchorElement>('a[href*="/DirectFile"]');
    if (downloadBtn?.href) {
      const filename = downloadBtn.getAttribute("title")?.replace("Download ", "") || "brightspace-file.pdf";
      return { pdfUrl: downloadBtn.href, filename };
    }

    // 2. Try to construct from URL if we are in the lessons view
    const match = window.location.href.match(/\/le\/(?:lessons|content)\/(\d+)\/(?:topics|viewContent)\/(\d+)/);
    if (match) {
      const [_, ou, topicId] = match;
      const pdfUrl = `${window.location.origin}/d2l/le/content/${ou}/topics/files/download/${topicId}/DirectFile`;
      // We don't have the filename here, but the backend handles it.
      return { pdfUrl, filename: "brightspace-captured.pdf" };
    }

    // 3. Check for PDF.js viewer iframe
    const viewerIframe = documentRef.querySelector<HTMLIFrameElement>('iframe[src*="pdfjs"]');
    if (viewerIframe?.src) {
      const urlParams = new URLSearchParams(new URL(viewerIframe.src).search);
      const file = urlParams.get("file");
      if (file) return { pdfUrl: file, filename: "embedded-pdf.pdf" };
    }
  }

  if (sourcePlatform === "gradescope") {
    // 1. S3-style signed upload iframe (most common for submission PDFs)
    const s3Iframe = documentRef.querySelector<HTMLIFrameElement>('iframe[src*="gradescope-uploads"]');
    if (s3Iframe?.src) return { pdfUrl: s3Iframe.src, filename: "gradescope-submission.pdf" };

    // 2. Any iframe with .pdf in src
    const pdfIframe = documentRef.querySelector<HTMLIFrameElement>('iframe[src*=".pdf"]');
    if (pdfIframe?.src) return { pdfUrl: pdfIframe.src, filename: "gradescope-submission.pdf" };

    // 3. PDF.js viewer (same pattern as brightspace)
    const viewerIframe = documentRef.querySelector<HTMLIFrameElement>('iframe[src*="pdfjs"]');
    if (viewerIframe?.src) {
      const urlParams = new URLSearchParams(new URL(viewerIframe.src).search);
      const file = urlParams.get("file");
      if (file) return { pdfUrl: file, filename: "gradescope-submission.pdf" };
    }

    // 4. Direct download link
    const pdfLink = documentRef.querySelector<HTMLAnchorElement>('a[href$=".pdf"]');
    if (pdfLink?.href) {
      const filename = pdfLink.getAttribute("download") || pdfLink.textContent?.trim() || "gradescope.pdf";
      return { pdfUrl: pdfLink.href, filename };
    }
  }

  return null;
}

export function createIngestPayload(
  rawContent: string,
  courseName: string,
  sourcePlatform: SupportedContentPlatform,
  pdfUrl?: string,
  filename?: string,
): IngestPagePayload {
  return {
    rawContent,
    courseName,
    sourcePlatform,
    pdfUrl,
    filename,
  };
}
