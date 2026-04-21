import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { apiFetch, apiStream } from "../lib/api";
import { MathRenderer } from "../components/MathRenderer";
import "katex/dist/katex.min.css";
import styles from "./Pages.module.css";

export function Ask() {
  const [question, setQuestion] = useState("");
  const [courseId, setCourseId] = useState("");
  const [courses, setCourses] = useState([]);

  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [screenshotBase64, setScreenshotBase64] = useState(null);
  const [lastImagePreview, setLastImagePreview] = useState(null);

  const [apiStatus, setApiStatus] = useState({ ok: null, detail: "" });
  const [debugInfo, setDebugInfo] = useState(null);

  const readerRef = useRef(null);
  const fileInputRef = useRef(null);

  async function useSelectedText() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString().trim(),
    });
    const selected = results?.[0]?.result;
    if (selected) {
      setQuestion(selected);
      return;
    }
    chrome.storage.session.get(["lastIngestedContent"], (data) => {
      if (data.lastIngestedContent?.rawContent) {
        setQuestion(data.lastIngestedContent.rawContent.slice(0, 500));
      }
    });
  }

  async function captureScreenshot() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.windowId) return;

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    setScreenshotBase64(base64);
    setLastImagePreview(dataUrl);

    // Keep the user's question if they already typed one; otherwise set a helpful default.
    setQuestion((q) => {
      const trimmed = String(q ?? "").trim();
      if (trimmed) return trimmed;
      return "Describe what is shown in this screenshot.";
    });
  }

  function handlePickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setResponse(null);
    setStreamingText("");
    setScreenshotBase64(null);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setLastImagePreview(dataUrl);
      const base64 = dataUrl.split(",")[1] || "";
      if (!base64) {
        setError("Could not read image");
        e.target.value = "";
        return;
      }
      setScreenshotBase64(base64);
      setQuestion((q) => {
        const trimmed = String(q ?? "").trim();
        if (trimmed) return trimmed;
        return "Describe what is shown in this image.";
      });
      e.target.value = "";
    };
    reader.onerror = () => {
      setError("Could not read image file");
      e.target.value = "";
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    chrome.storage.session.get(["prefillAsk"], (data) => {
      if (data.prefillAsk) {
        setQuestion(data.prefillAsk);
        chrome.storage.session.remove("prefillAsk");
      }
    });

    return () => {
      readerRef.current?.cancel?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");
    setDebugInfo((d) => ({ ...d, apiUrl: API_URL }));

    fetch(`${API_URL}/health`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Health check failed (${r.status})`))))
      .then((data) => {
        if (cancelled) return;
        setApiStatus({ ok: true, detail: data?.firestore ? "ok" : "firestore unavailable" });
      })
      .catch((e) => {
        if (cancelled) return;
        setApiStatus({ ok: false, detail: e?.message || "unreachable" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    apiFetch("/api/v1/courses")
      .then((data) => setCourses(data.courses || []))
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!question.trim()) return;

    readerRef.current?.cancel?.();
    readerRef.current = null;

    setError(null);
    setResponse(null);
    setStreamingText("");

    const trimmed = question.trim();

    // Image path: always use batch analyze (structured JSON), not SSE.
    if (screenshotBase64) {
      setLoading(true);
      try {
        const data = await apiFetch("/api/v1/analyze", {
          method: "POST",
          body: JSON.stringify({
            content: trimmed,
            imageBase64: screenshotBase64,
            courseId: courseId || undefined,
          }),
        });
        setResponse(data);
        setScreenshotBase64(null);
        setDebugInfo((d) => ({
          ...d,
          lastEventId: data?.eventId,
          lastServerQuestion: data?.question,
          lastClientQuestion: trimmed,
          lastAt: new Date().toISOString(),
        }));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Text path: try SSE streaming first, then fall back to batch analyze.
    try {
      const probe = await apiStream("/api/v1/stream/explain", {
        question: trimmed,
        courseId: courseId || undefined,
      });

      if (probe.ok && probe.body) {
        setIsStreaming(true);
        setStreamingText("");

        const reader = probe.body.getReader();
        readerRef.current = reader;
        const decoder = new TextDecoder();
        let sseBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });
          const events = sseBuffer.split("\n\n");
          sseBuffer = events.pop() ?? "";
          for (const event of events) {
            const line = event.trim();
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.text) setStreamingText((t) => t + parsed.text);
              } catch {
                // ignore malformed chunk
              }
            }
          }
        }

        readerRef.current = null;
        setIsStreaming(false);
        return;
      }
    } catch {
      // fall through
    }

    setLoading(true);
    try {
      const data = await apiFetch("/api/v1/analyze", {
        method: "POST",
        body: JSON.stringify({ content: trimmed, courseId: courseId || undefined }),
      });
      setResponse(data);
      setDebugInfo((d) => ({
        ...d,
        lastEventId: data?.eventId,
        lastServerQuestion: data?.question,
        lastClientQuestion: trimmed,
        lastAt: new Date().toISOString(),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const showResponse = Boolean(response || streamingText);

  return (
    <div className={styles.stack}>
      <motion.div
        className={styles.section}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <p className={styles.eyebrow}>Ask mode</p>
        <h2 className={styles.h1}>What are you confused about?</h2>
        <p className={styles.text}>Any specific question you are confused on?</p>
        <p className={styles.text}>Or is there anything you wanna prioritize?</p>

        <p className={styles.text} style={{ opacity: 0.8 }}>
          API:{" "}
          {apiStatus.ok === null
            ? "checking…"
            : apiStatus.ok
              ? `connected (${apiStatus.detail})`
              : `not reachable (${apiStatus.detail})`}
        </p>
        {debugInfo?.apiUrl && (
          <p className={styles.text} style={{ opacity: 0.75 }}>
            API base: {debugInfo.apiUrl}
          </p>
        )}
        {debugInfo?.lastEventId && (
          <p className={styles.text} style={{ opacity: 0.75 }}>
            last eventId: {debugInfo.lastEventId} @ {debugInfo.lastAt}
          </p>
        )}
        {debugInfo?.lastServerQuestion && (
          <p className={styles.text} style={{ opacity: 0.75 }}>
            server echoed question: {String(debugInfo.lastServerQuestion).slice(0, 200)}
            {String(debugInfo.lastServerQuestion).length > 200 ? "…" : ""}
          </p>
        )}
      </motion.div>

      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.2 }}
      >
        <div className={styles.row}>
          <button className={styles.secondaryButton} type="button" onClick={useSelectedText}>
            Use Selected Text
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={captureScreenshot}
            disabled={loading || isStreaming}
            style={screenshotBase64 ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
          >
            {screenshotBase64 ? "Screenshot ready" : "Screenshot"}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handlePickImage}
        />

        <form className={styles.form} onSubmit={handleSubmit}>
          {courses.length > 0 && (
            <select
              className={styles.textarea}
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.courseId} value={c.courseId}>
                  {c.courseName || c.courseId}
                </option>
              ))}
            </select>
          )}

          <textarea
            className={styles.textarea}
            rows={6}
            placeholder="Type your question here..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />

          <div className={styles.rowBetween}>
            <button
              className={styles.iconButton}
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || isStreaming}
            >
              +
            </button>
            <button
              className={styles.iconButton}
              type="submit"
              disabled={loading || isStreaming || !question.trim()}
            >
              {loading || isStreaming ? "·" : "→"}
            </button>
          </div>
        </form>
      </motion.div>

      {error && (
        <motion.p className={styles.error} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {error}
        </motion.p>
      )}

      {lastImagePreview && (
        <div className={styles.card}>
          <p className={styles.cardTitle}>Last image</p>
          <img src={lastImagePreview} alt="Selected preview" style={{ width: "100%", borderRadius: 12 }} />
        </div>
      )}

      <AnimatePresence>
        {showResponse && (
          <motion.div
            className={styles.card}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: "hidden" }}
          >
            {streamingText ? (
              <>
                <p className={styles.cardTitle}>Question</p>
                <p className={styles.text}>{question}</p>
                <p className={styles.cardTitle}>Explanation</p>
                <div className={styles.responseBox}>
                  <div className={styles.text}>
                    <MathRenderer text={streamingText} />
                    {isStreaming && <span className={styles.streamCursor} aria-hidden />}
                  </div>
                </div>
              </>
            ) : response ? (
              <>
                <p className={styles.cardTitle}>Question</p>
                <p className={styles.text}>{question}</p>

                <p className={styles.cardTitle}>Step-by-step Solution</p>
                <div className={styles.text}>
                  <MathRenderer text={response.solution} />
                </div>

                {response.mainConcept && (
                  <>
                    <p className={styles.cardTitle}>Main Concept</p>
                    <p className={styles.text}>{response.mainConcept}</p>
                  </>
                )}

                {response.keyFormulas?.length > 0 && (
                  <>
                    <p className={styles.cardTitle}>Key Formulas</p>
                    <ul className={styles.simpleList}>
                      {response.keyFormulas.map((f, i) => (
                        <li key={i}>
                          <MathRenderer text={f} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {response.relevantLecture && (
                  <>
                    <p className={styles.cardTitle}>Relevant Lecture</p>
                    <p className={styles.text}>{response.relevantLecture}</p>
                  </>
                )}

                {response.personalizedCallout && (
                  <div className={styles.calloutBox}>
                    <p className={styles.calloutTitle}>Personalized Callout</p>
                    <div className={styles.text}>
                      <MathRenderer text={response.personalizedCallout} />
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
