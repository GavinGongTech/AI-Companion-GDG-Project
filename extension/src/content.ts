import {
  detectSupportedPlatform,
  extractText,
  createContentHash,
  createIngestPayload,
  detectPdfUrl,
} from "./lib/content-runtime";
import type { ExtensionRuntimeMessage } from "./lib/messages";

(function () {
  // Guard against double-injection
  const ATTR = "data-study-flow-content";
  if (document.documentElement.getAttribute(ATTR)) return;
  document.documentElement.setAttribute(ATTR, "1");

  const sourcePlatform = detectSupportedPlatform(window.location.hostname);
  if (!sourcePlatform) return;

  const extractedText = extractText(document, sourcePlatform);
  const pdfInfo = detectPdfUrl(document, sourcePlatform);

  if (!extractedText && !pdfInfo) return;

  const hash = createContentHash(extractedText || (pdfInfo?.pdfUrl ?? ""));
  const STORAGE_KEY = "studyflow_last_hash";
  const isDuplicate = localStorage.getItem(STORAGE_KEY) === hash;
  localStorage.setItem(STORAGE_KEY, hash);

  let ingested = false;
  if (!isDuplicate) {
    const message: ExtensionRuntimeMessage = {
      type: "INGEST_PAGE",
      payload: createIngestPayload(
        extractedText || "PDF Content Detected",
        document.title,
        sourcePlatform,
        pdfInfo?.pdfUrl,
        pdfInfo?.filename,
      ),
    };
    chrome.runtime.sendMessage(message);
    ingested = true;
  }

  // --- Shadow DOM floating widget ---
  const host = document.createElement("div");
  host.id = "studyflow-fab-host";
  document.body.appendChild(host);

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

  const btnQuiz = document.createElement("button");
  btnQuiz.textContent = "Quiz me";
  panel.appendChild(btnQuiz);

  fab.addEventListener("click", () => {
    panel.classList.toggle("open");
  });

  btnExplain.addEventListener("click", () => {
    const selectedText = window.getSelection()?.toString();
    const message: ExtensionRuntimeMessage = {
      type: "OPEN_ASK",
      payload: {
        selectedText: selectedText || (extractedText ? extractedText.slice(0, 500) : ""),
      },
    };
    chrome.runtime.sendMessage(message);
    panel.classList.remove("open");
  });

  btnQuiz.addEventListener("click", () => {
    const message: ExtensionRuntimeMessage = { type: "OPEN_QUIZ" };
    chrome.runtime.sendMessage(message);
    panel.classList.remove("open");
  });

  console.info("[Study Flow] Content script loaded on", sourcePlatform, window.location.href);
})();
