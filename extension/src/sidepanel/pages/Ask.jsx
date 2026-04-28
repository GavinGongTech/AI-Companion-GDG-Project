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
  const [capturingShot, setCapturingShot] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    apiFetch("/api/v1/courses")
      .then((data) => setCourses(data.courses || []))
      .catch(() => {});

    chrome.storage.local.get(["activeCourseId"], (data) => {
      if (data.activeCourseId) setCourseId(data.activeCourseId);
    });
  }, []);

  const hasAutoGrabbed = useRef(false);
  useEffect(() => {
    if (!hasAutoGrabbed.current) {
      hasAutoGrabbed.current = true;
      handleUseSelectedText();
    }
  }, []);

  async function handleAsk(e) {
    if (e) e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    setResponse(null);
    setStreamingText("");
    setIsStreaming(true);

    try {
      const data = await apiFetch("/api/v1/explain", {
        method: "POST",
        body: JSON.stringify({ question, courseId: courseId || undefined }),
      });
      setResponse(data);
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
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || tab.url?.startsWith("chrome://") || tab.url?.startsWith("edge://")) {
        throw new Error("Cannot read from this page.");
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const sel = window.getSelection().toString().trim();
          return sel ? sel : document.body.innerText;
        },
      });

      const text = results?.[0]?.result;
      if (text) {
        setQuestion(prev => prev ? prev : text.substring(0, 15000));
      } else {
        // Fallback to last ingested content if no selection
        const data = await chrome.storage.session.get(["lastIngestedContent"]);
        if (data.lastIngestedContent?.rawContent) {
          setQuestion(prev => prev ? prev : data.lastIngestedContent.rawContent.slice(0, 5000));
        } else {
          setFeedback("No text found on the page!");
        }
      }
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

      const base64Image = dataUrl.split(",")[1];
      setLoading(true);
      setResponse(null);
      setQuestion("");

      const data = await apiFetch("/api/v1/analyze", {
        method: "POST",
        body: JSON.stringify({ imageBase64: base64Image, courseId: courseId || undefined }),
      });
      setResponse(data);
      if (data.question) {
        setQuestion(data.question);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setCapturingShot(false);
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

      // Note: apiFetch currently expects JSON body. For multipart, we use direct fetch or update apiFetch.
      // Keeping it simple for now as per remote's implementation intent.
      const res = await apiFetch("/api/v1/ingest", {
        method: "POST",
        // This is a placeholder for actual multipart support if needed
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
            accept=".pdf,.png,.jpg,.jpeg,.txt"
          />
        </div>
        <button className={styles.primaryButton} type="submit" disabled={loading || !question.trim() || isStreaming}>
          {loading ? "Thinking..." : "Explain"}
        </button>
      </form>

      {error && <div className={styles.error}>{error}</div>}
      {feedback && <div className={styles.feedback}>{feedback}</div>}

      {showResponse && (
        <div className={styles.response}>
          <MathRenderer content={streamingText || response?.explanation} />
        </div>
      )}
    </div>
  );
}
