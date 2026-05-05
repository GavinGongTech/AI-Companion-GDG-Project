import { useState, useEffect, useRef } from "react";
import { apiFetch } from "../lib/api";
import { MathRenderer } from "../components/MathRenderer";
import styles from "./Pages.module.css";

const TITLE_USE_SELECTION = "Ask about text you've highlighted or the entire page text.";
const TITLE_SCREENSHOT = "Capture the visible part of the current tab and ask about it.";
const TITLE_UPLOAD = "Upload a PDF, image, or text file to analyze.";

export function Ask() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [courseId, setCourseId] = useState("");
  const [courses, setCourses] = useState([]);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [grabbingText, setGrabbingText] = useState(false);
  const [ingestingPdf, setIngestingPdf] = useState(false);
  const [capturingShot, setCapturingShot] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [lastIngested, setLastIngested] = useState(null);
  const [attachedImageBase64, setAttachedImageBase64] = useState(null);
  const [attachedImagePreview, setAttachedImagePreview] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    apiFetch("/api/v1/courses")
      .then((data) => setCourses(data.courses || []))
      .catch(() => {});

    chrome.storage.local.get(["activeCourseId"], (data) => {
      if (data.activeCourseId) setCourseId(data.activeCourseId);
    });

    chrome.storage.session.get(["lastIngestedContent"], (data) => {
      if (data.lastIngestedContent) setLastIngested(data.lastIngestedContent);
    });
  }, []);

  // If the content-script widget asked us to open Ask with a screenshot, consume it here.
  useEffect(() => {
    let cancelled = false;

    async function consumePrefillScreenshot() {
      const data = await chrome.storage.session.get(["prefillAsk", "prefillAskImageBase64"]);
      const base64 = data.prefillAskImageBase64;
      const prefillText = data.prefillAsk;
      if (!base64 || cancelled) return;

      await chrome.storage.session.remove(["prefillAskImageBase64", "prefillAsk"]);
      if (prefillText && !question) {
        setQuestion(prefillText);
      }
      // Attach the screenshot — user can add/adjust question, then submit once with the image.
      const dataUrl = `data:image/jpeg;base64,${base64}`;
      setAttachedImageBase64(base64);
      setAttachedImagePreview(dataUrl);
      setFeedback("Screenshot attached. Add a question and press Explain.");
    }

    consumePrefillScreenshot().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [courseId, question]);

  async function handleAsk(e) {
    if (e) e.preventDefault();
    if (!question.trim() && !attachedImageBase64) return;

    setLoading(true);
    setError(null);
    setResponse(null);
    setStreamingText("");
    setIsStreaming(true);

    try {
      if (attachedImageBase64) {
        const data = await apiFetch("/api/v1/analyze", {
          method: "POST",
          body: JSON.stringify({
            content: question.trim() || undefined,
            imageBase64: attachedImageBase64,
            courseId: courseId || undefined,
          }),
        });
        setResponse(data);
        setAttachedImageBase64(null);
        setAttachedImagePreview(null);
      } else {
        const data = await apiFetch("/api/v1/explain", {
          method: "POST",
          body: JSON.stringify({ question, courseId: courseId || undefined }),
        });
        setResponse(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setIsStreaming(false);
    }
  }

  async function handleUseSelectedText() {
    setGrabbingText(true);
    setError(null);
    setFeedback(null);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || tab.url?.startsWith("chrome://") || tab.url?.startsWith("edge://")) {
        throw new Error("Cannot read from this page.");
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: () => {
          const sel = window.getSelection().toString().trim();
          return sel;
        },
      });

      const text = (results || [])
        .map((r) => String(r?.result || "").trim())
        .find(Boolean) || "";
      if (!text) {
        setFeedback("Highlight text on the page first, then click Read Page Text.");
        return;
      }
      setQuestion(text.substring(0, 15000));
    } catch (err) {
      setError(err.message);
    } finally {
      setGrabbingText(false);
    }
  }

  async function attachVisibleTabScreenshot() {
    setCapturingShot(true);
    setError(null);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 80 }, (url) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(url);
        });
      });

      const base64Image = String(dataUrl).split(",")[1] || null;
      if (!base64Image) throw new Error("Screenshot capture returned empty image data.");
      setAttachedImageBase64(base64Image);
      setAttachedImagePreview(String(dataUrl));
      setFeedback("Screenshot attached. Add a question and press Explain.");
    } catch (err) {
      setError(err.message);
    } finally {
      setCapturingShot(false);
    }
  }

  async function handleIngestPdf() {
    if (!lastIngested?.pdfUrl) return;
    setIngestingPdf(true);
    setError(null);
    setFeedback(null);

    try {
      // 1. Fetch the PDF
      const res = await fetch(lastIngested.pdfUrl);
      if (!res.ok) throw new Error("Failed to download PDF from Brightspace.");
      const blob = await res.blob();

      // 2. Upload to backend
      const formData = new FormData();
      formData.append("file", blob, lastIngested.filename || "brightspace.pdf");
      if (courseId) formData.append("courseId", courseId);
      formData.append("sourcePlatform", lastIngested.sourcePlatform);

      const uploadRes = await apiFetch("/api/v1/ingest/upload", {
        method: "POST",
        body: formData,
      });

      setResponse(uploadRes);
      setFeedback("PDF ingested! Check the Graph tab or your Dashboard to see the newly discovered concepts.");
    } catch (err) {
      setError(err.message);
    } finally {
      setIngestingPdf(false);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (courseId) formData.append("courseId", courseId);

      const res = await apiFetch("/api/v1/ingest/upload", {
        method: "POST",
        body: formData,
      });
      setResponse(res);
      setFeedback(`Uploaded ${file.name} successfully.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const showResponse = Boolean(response || streamingText);

  return (
    <div className={styles.stack}>
      <form className={styles.inputGroup} onSubmit={handleAsk}>
        {courses.length > 0 && (
          <select
            className={styles.textarea}
            style={{ minHeight: "auto", marginBottom: "8px" }}
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            <option value="">All courses (Auto-detect context)</option>
            {courses.map((c) => (
              <option key={c.courseId} value={c.courseId}>
                {c.courseName || c.courseId}
              </option>
            ))}
          </select>
        )}
        <textarea
          className={styles.textarea}
          placeholder="Ask a question or use tools below..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={loading || isStreaming}
        />
        {attachedImagePreview && (
          <div className={styles.attachedImageRow}>
            <img src={attachedImagePreview} alt="" className={styles.attachedThumb} />
            <div className={styles.attachedMeta}>
              <p className={styles.attachedLabel}>Screenshot attached</p>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => {
                  setAttachedImageBase64(null);
                  setAttachedImagePreview(null);
                  setFeedback(null);
                }}
              >
                Remove
              </button>
            </div>
          </div>
        )}
        <div className={styles.buttonRow}>
          <button
            className={styles.secondaryButton}
            type="button"
            title={TITLE_USE_SELECTION}
            onClick={handleUseSelectedText}
            disabled={grabbingText || loading || isStreaming}
          >
            {grabbingText ? "Reading…" : "Read Page Text"}
          </button>
          {lastIngested?.pdfUrl && (
            <button
              className={styles.secondaryButton}
              type="button"
              title="Ingest the full PDF from this page."
              onClick={handleIngestPdf}
              disabled={ingestingPdf || loading || isStreaming}
              style={{ borderColor: "#3ee0d0", color: "#3ee0d0" }}
            >
              {ingestingPdf ? "Ingesting…" : "Ingest PDF"}
            </button>
          )}
          <button
            className={styles.secondaryButton}
            type="button"
            title={TITLE_SCREENSHOT}
            onClick={attachVisibleTabScreenshot}
            disabled={capturingShot || loading || isStreaming}
          >
            {capturingShot ? "Capturing…" : "Screenshot"}
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            title={TITLE_UPLOAD}
            onClick={() => {
              setError(null);
              setFeedback(null);
              if (fileInputRef.current) fileInputRef.current.click();
            }}
            disabled={loading || isStreaming}
          >
            Upload
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileUpload}
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md"
          />
        </div>
        <button
          className={styles.primaryButton}
          type="submit"
          disabled={loading || isStreaming || (!question.trim() && !attachedImageBase64)}
        >
          {loading ? "Thinking..." : "Explain"}
        </button>
      </form>

      {error && <div className={styles.error}>{error}</div>}
      {feedback && <div className={styles.feedback}>{feedback}</div>}

      {showResponse && (
        <div className={styles.response}>
          <MathRenderer text={streamingText || response?.solution || response?.explanation || ""} />
        </div>
      )}
    </div>
  );
}
