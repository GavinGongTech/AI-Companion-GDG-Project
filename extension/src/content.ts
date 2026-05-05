import {
  detectSupportedPlatform,
  extractText,
  createContentHash,
  createIngestPayload,
  detectPdfUrl,
  deriveCourseId,
} from "./lib/content-runtime";
import type { ExtensionRuntimeMessage } from "./lib/messages";

(function () {
  // Guard against double-injection
  const ATTR = "data-study-flow-content";
  if (document.documentElement.getAttribute(ATTR)) return;
  document.documentElement.setAttribute(ATTR, "1");

  // Only inject the floating widget in the top frame (avoid duplicate FABs in iframes / PDF viewers).
  if (window !== window.top) {
    return;
  }

  const sourcePlatform = detectSupportedPlatform(window.location.hostname);
  if (!sourcePlatform) return;

  const courseId = deriveCourseId(
    window.location.hostname,
    window.location.pathname,
    document.title,
  );

  const STORAGE_KEY = "studyflow_last_hash";
  let ingested = false;

  function tryIngest(): boolean {
    const extractedText = extractText(document, sourcePlatform);
    const pdfInfo = detectPdfUrl(document, sourcePlatform);

    if (!extractedText && !pdfInfo) return false;

    const hash = createContentHash(extractedText || (pdfInfo?.pdfUrl ?? ""));
    const isDuplicate = localStorage.getItem(STORAGE_KEY) === hash;
    localStorage.setItem(STORAGE_KEY, hash);

    if (!isDuplicate) {
      if (pdfInfo) {
        // PDF path: background fetches the bytes with session cookies and POSTs to /ingest/upload
        const message: ExtensionRuntimeMessage = {
          type: "INGEST_PDF",
          payload: {
            pdfUrl: pdfInfo.pdfUrl,
            filename: pdfInfo.filename,
            courseName: courseId,
            sourcePlatform,
          },
        };
        chrome.runtime.sendMessage(message);
      } else if (extractedText) {
        // Text-only path: send extracted DOM text to /ingest/text
        const message: ExtensionRuntimeMessage = {
          type: "INGEST_PAGE",
          payload: createIngestPayload(extractedText, courseId, sourcePlatform),
        };
        chrome.runtime.sendMessage(message);
      }
      ingested = true;
    }

    return true;
  }

  const contentFound = tryIngest();

  if (!contentFound) {
    // SPA content not yet in DOM — watch for mutations and retry.
    // Note: `document.body` can be null at document_start; wait for DOM ready first.
    const startObserver = () => {
      if (!document.body) return;
      const observer = new MutationObserver(() => {
        if (tryIngest()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 30_000);
    };
    if (!document.body) window.addEventListener("DOMContentLoaded", startObserver, { once: true });
    else startObserver();
  }

  // --- Shadow DOM floating widget ---
  const host = document.createElement("div");
  host.id = "studyflow-fab-host";
  // body can still be null at document_start; defer if needed
  const mountHost = () => document.body?.appendChild(host);
  if (!document.body) window.addEventListener("DOMContentLoaded", mountHost, { once: true });
  else mountHost();

  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .fab {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999999;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #3ee0d0;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      font-size: 20px;
      color: #101620;
      transition: transform 0.15s ease;
    }
    .fab:hover { transform: scale(1.08); }
    .fab .badge {
      position: absolute;
      top: -4px;
      right: -4px;
      font-size: 9px;
      font-weight: 700;
      background: #101620;
      color: #3ee0d0;
      padding: 2px 5px;
      border-radius: 8px;
      pointer-events: none;
    }
    .panel {
      position: fixed;
      bottom: 76px;
      right: 20px;
      z-index: 999999;
      background: #101620;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 12px;
      display: none;
      flex-direction: column;
      gap: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      min-width: 150px;
    }
    .panel.open { display: flex; }
    .panel button {
      background: rgba(62,224,208,0.12);
      color: #3ee0d0;
      border: 1px solid rgba(62,224,208,0.25);
      border-radius: 8px;
      padding: 8px 14px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: background 0.15s ease;
    }
    .panel button:hover {
      background: rgba(62,224,208,0.22);
    }
  `;
  shadow.appendChild(style);

  const fab = document.createElement("button");
  fab.className = "fab";
  fab.innerHTML = "&#9733;";
  fab.title = "Study Flow";
  shadow.appendChild(fab);

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = "Ingested";
  badge.style.display = ingested ? "block" : "none";
  fab.appendChild(badge);

  const panel = document.createElement("div");
  panel.className = "panel";
  shadow.appendChild(panel);

  const btnExplain = document.createElement("button");
  btnExplain.textContent = "Explain this";
  panel.appendChild(btnExplain);

  const btnAsk = document.createElement("button");
  btnAsk.textContent = "Ask me";
  panel.appendChild(btnAsk);

  const btnQuiz = document.createElement("button");
  btnQuiz.textContent = "Quiz me";
  panel.appendChild(btnQuiz);

  fab.addEventListener("click", () => {
    panel.classList.toggle("open");
  });

    btnExplain.addEventListener("click", () => {
    const selectedText = window.getSelection()?.toString() ?? "";
    const message: ExtensionRuntimeMessage = {
      type: "OPEN_ASK_SCREENSHOT",
      payload: {
        selectedText: selectedText || "",
      },
    };
    chrome.runtime.sendMessage(message);
    panel.classList.remove("open");
  });

  btnAsk.addEventListener("click", () => {
    const selectedText = window.getSelection()?.toString() ?? "";
    const message: ExtensionRuntimeMessage = {
      type: "OPEN_ASK_SCREENSHOT",
      payload: { selectedText },
    };
    chrome.runtime.sendMessage(message);
    panel.classList.remove("open");
  });

  btnQuiz.addEventListener("click", () => {
    const message: ExtensionRuntimeMessage = { type: "OPEN_QUIZ_SCREENSHOT" };
    chrome.runtime.sendMessage(message);
    panel.classList.remove("open");
  });

  console.info("[Study Flow] Content script loaded on", sourcePlatform, "courseId:", courseId);
})();
