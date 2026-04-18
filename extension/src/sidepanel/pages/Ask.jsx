import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, apiStream } from "../lib/api";
import { MathRenderer } from "../components/MathRenderer";
import "katex/dist/katex.min.css";
import styles from "./Pages.module.css";

export function Ask() {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [screenshotBase64, setScreenshotBase64] = useState(null);
  const readerRef = useRef(null);

  async function useSelectedText() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString().trim(),
    });
    const selected = results?.[0]?.result;
    if (selected) setQuestion(selected);
  }

  async function captureScreenshot() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.windowId) return;
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    // Strip the data: prefix — backend expects raw base64
    setScreenshotBase64(dataUrl.replace(/^data:image\/\w+;base64,/, ""));
    setQuestion("(screenshot attached — describe the math or concept shown)");
  }

  // Pre-fill from content script's "Explain this" button
  useEffect(() => {
    chrome.storage.session.get(["prefillAsk"], (data) => {
      if (data.prefillAsk) {
        setQuestion(data.prefillAsk);
        chrome.storage.session.remove("prefillAsk");
      }
    });
    // Cancel any in-flight SSE reader when the panel navigates away.
    return () => { readerRef.current?.cancel(); };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!question.trim()) return;

    // Cancel any previous in-flight stream before starting a new one.
    readerRef.current?.cancel();
    readerRef.current = null;

    setError(null);
    setResponse(null);
    setStreamingText("");

    const trimmed = question.trim();

    // If a screenshot is attached, send it directly to the batch analyze endpoint (no streaming)
    if (screenshotBase64) {
      setLoading(true);
      try {
        const data = await apiFetch("/api/v1/analyze", {
          method: "POST",
          body: JSON.stringify({ imageBase64: screenshotBase64 }),
        });
        setResponse(data);
        setScreenshotBase64(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Try SSE streaming first; fall back to batch analyze
    try {
      const probe = await apiStream("/api/v1/stream/explain", { question: trimmed });
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
                // skip malformed SSE event
              }
            }
          }
        }
        readerRef.current = null;
        setIsStreaming(false);
        return;
      }
    } catch {
      // streaming endpoint unavailable — fall through to batch
    }

    // Batch fallback
    setLoading(true);
    try {
      const data = await apiFetch("/api/v1/analyze", {
        method: "POST",
        body: JSON.stringify({ content: trimmed }),
      });
      setResponse(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const showResponse = response || streamingText;

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
            style={screenshotBase64 ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}
          >
            {screenshotBase64 ? "Screenshot ready" : "Screenshot"}
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <textarea
            className={styles.textarea}
            rows={6}
            placeholder="Type your question here..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />

          <div className={styles.rowBetween}>
            <button className={styles.iconButton} type="button">
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
        <motion.p
          className={styles.error}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {error}
        </motion.p>
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
