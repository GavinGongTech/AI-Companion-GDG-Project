import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, apiStream } from "../lib/api";
import { MathRenderer } from "../components/MathRenderer";
import "katex/dist/katex.min.css";
import styles from "./Pages.module.css";

const TITLE_USE_SELECTION =
  "Copies highlighted text from the active tab behind this panel (includes many PDF iframes). Select text on the page, then click.";

const TITLE_SCREENSHOT =
  "Captures the visible tab as an image and attaches it to your question. Click the tab you want first, then click here.";

const TITLE_UPLOAD = "Attach a photo or image file from your computer.";

const TITLE_SUBMIT = "Send your question (and image, if any) to Study Flow.";

/** Pages where Chrome blocks screenshots and script injection. */
function isRestrictedBrowserPage(url) {
  if (!url || typeof url !== "string") return false;
  const u = url.trim().toLowerCase();
  return (
    u.startsWith("chrome://") ||
    u.startsWith("edge://") ||
    u.startsWith("about:") ||
    u.startsWith("devtools://") ||
    u.startsWith("chrome-extension://") ||
    u.startsWith("https://chromewebstore.google.com/") ||
    u.startsWith("https://chrome.google.com/webstore")
  );
}

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
  const [feedback, setFeedback] = useState(null);
  const [grabbingText, setGrabbingText] = useState(false);
  const [capturingShot, setCapturingShot] = useState(false);

  const readerRef = useRef(null);
  const streamAbortRef = useRef(null);
  const fileInputRef = useRef(null);
  const feedbackTimerRef = useRef(null);

  const showFeedback = useCallback((message) => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
    setFeedback(message);
    setError(null);
    feedbackTimerRef.current = setTimeout(() => {
      setFeedback(null);
      feedbackTimerRef.current = null;
    }, 4500);
  }, []);

  useEffect(
    () => () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    },
    [],
  );

  function tabsQuery(queryInfo) {
    return new Promise((resolve, reject) => {
      chrome.tabs.query(queryInfo, (tabs) => {
        const err = chrome?.runtime?.lastError;
        if (err) reject(new Error(err.message));
        else resolve(tabs);
      });
    });
  }

  function captureVisibleTab(windowId, options) {
    return new Promise((resolve, reject) => {
      chrome.tabs.captureVisibleTab(windowId, options, (dataUrl) => {
        const err = chrome?.runtime?.lastError;
        if (err) reject(new Error(err.message));
        else resolve(dataUrl);
      });
    });
  }

  /**
   * Reads the user's text selection from the active tab, including iframes.
   * Course sites (Brightspace, etc.) often put the PDF in a child frame — without
   * `allFrames: true`, the main page sees an empty selection even when text looks highlighted.
   */
  function execSelectedTextAllFrames(tabId) {
    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript(
        {
          target: { tabId, allFrames: true },
          func: () => {
            try {
              return window.getSelection()?.toString?.()?.trim?.() ?? "";
            } catch {
              return "";
            }
          },
        },
        (results) => {
          const err = chrome?.runtime?.lastError;
          if (err) reject(new Error(err.message));
          else {
            const parts = (results || [])
              .map((r) => (typeof r?.result === "string" ? r.result.trim() : ""))
              .filter(Boolean);
            const longest = parts.reduce((best, cur) => (cur.length > best.length ? cur : best), "");
            resolve(longest);
          }
        },
      );
    });
  }

  async function useSelectedText() {
    setError(null);
    setFeedback(null);
    setGrabbingText(true);
    try {
      const tabs = await tabsQuery({ active: true, currentWindow: true });
      const tab = tabs?.[0];
      if (!tab?.id) {
        setError(
          "No active tab found. Click the website tab you want (the page behind this side panel), then try again.",
        );
        return;
      }
      if (isRestrictedBrowserPage(tab.url)) {
        setError(
          "Cannot read text on this kind of page (new tab, settings, or Web Store). Open your course or notes site, then try again.",
        );
        return;
      }
      const selected = await execSelectedTextAllFrames(tab.id);
      if (selected) {
        setQuestion(selected);
        showFeedback(`Text inserted (${selected.length} chars).`);
        return;
      }
      const data = await new Promise((resolve) => {
        chrome.storage.session.get(["lastIngestedContent"], (d) => resolve(d));
      });
      if (data?.lastIngestedContent?.rawContent) {
        const t = data.lastIngestedContent.rawContent.slice(0, 500);
        setQuestion(t);
        showFeedback(`Inserted saved page text (${t.length} chars).`);
        return;
      }
      const url = tab.url || "";
      const likelyEmbeddedPdf =
        /brightspace|d2l|le\/lessons|content|viewer|pdf/i.test(url) || url.includes("d2l");
      setError(
        likelyEmbeddedPdf
          ? "No selection from this PDF viewer. Try Ctrl+C / paste here, or use Screenshot to send the page as a picture."
          : "No text is selected. Highlight text on the webpage first, then click “Use selected text” again.",
      );
    } catch (err) {
      const msg =
        chrome?.runtime?.lastError?.message ||
        err?.message ||
        "Could not read selected text. Open a normal webpage (not chrome://), then try again.";
      setError(msg);
    } finally {
      setGrabbingText(false);
    }
  }

  /** Captures the active tab in the current window (the page behind the side panel). */
  async function attachVisibleTabScreenshot() {
    setError(null);
    setCapturingShot(true);
    try {
      const tabs = await tabsQuery({ active: true, currentWindow: true });
      const tab = tabs?.[0];
      if (!tab?.id || !tab?.windowId) {
        setError(
          "No active tab to capture. Click the tab you want (your notes or course page), then try again.",
        );
        return;
      }
      if (isRestrictedBrowserPage(tab.url)) {
        setError(
          "Cannot capture this page (browser internal or Web Store). Switch to your homework site or a PDF/notes tab.",
        );
        return;
      }

      const dataUrl = await captureVisibleTab(tab.windowId, { format: "png" });
      if (!dataUrl || typeof dataUrl !== "string") {
        throw new Error("No screenshot data returned.");
      }
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
      if (!base64) {
        throw new Error("Screenshot was empty.");
      }
      setScreenshotBase64(base64);
      setLastImagePreview(dataUrl);
      setQuestion((q) => {
        const trimmed = String(q ?? "").trim();
        if (trimmed) return trimmed;
        return "Describe what is shown in this screenshot.";
      });
      showFeedback("Screenshot attached.");
    } catch (err) {
      const msg =
        chrome?.runtime?.lastError?.message ||
        err?.message ||
        "Screenshot failed. Make sure you clicked a normal website tab first, then use Capture again.";
      setError(msg);
    } finally {
      setCapturingShot(false);
    }
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
      showFeedback(`Image attached (${file.name}).`);
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
      streamAbortRef.current?.abort();
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
    streamAbortRef.current?.abort();

    setError(null);
    setFeedback(null);
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
        setLastImagePreview(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Text path: try SSE first with cancellation; only fall back to batch when stream is "missing" (404/405), not on 4xx/5xx quota or server errors.
    streamAbortRef.current?.abort();
    const ac = new AbortController();
    streamAbortRef.current = ac;

    setLoading(true);
    let fallBackToBatch = false;
    try {
      const res = await apiStream(
        "/api/v1/stream/explain",
        { question: trimmed, courseId: courseId || undefined },
        { signal: ac.signal },
      );

      if (res.ok && res.body) {
        setLoading(false);
        setIsStreaming(true);
        setStreamingText("");

        const reader = res.body.getReader();
        readerRef.current = reader;
        const decoder = new TextDecoder();
        let sseBuffer = "";
        try {
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
        } finally {
          readerRef.current = null;
          setIsStreaming(false);
        }
        return;
      }

      const errText = await res.text().catch(() => "");
      if (res.status === 404 || res.status === 405) {
        fallBackToBatch = true;
      } else {
        setError(errText || `Stream failed (${res.status})`);
        return;
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        return;
      }
      setError(err?.message || "Stream request failed");
      return;
    } finally {
      if (!fallBackToBatch) {
        setLoading(false);
      }
    }

    if (!fallBackToBatch) {
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch("/api/v1/analyze", {
        method: "POST",
        body: JSON.stringify({ content: trimmed, courseId: courseId || undefined }),
      });
      setResponse(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const showResponse = Boolean(response || streamingText);

  return (
    <div className={styles.stack}>
      <div className={styles.section}>
        <p className={styles.eyebrow}>Ask mode</p>
        <h2 className={styles.h1}>What are you confused about?</h2>
        <p className={styles.text}>Any specific question you are confused on?</p>
        <p className={styles.text}>Or is there anything you wanna prioritize?</p>
      </div>

      <div className={styles.card}>
        <p className={styles.modalHelp} style={{ margin: 0 }}>
          Use the <strong>tab behind this panel</strong> first (course page / PDF), then the buttons below.
        </p>

        <div className={styles.row}>
          <button
            className={styles.secondaryButton}
            type="button"
            title={TITLE_USE_SELECTION}
            onClick={useSelectedText}
            disabled={grabbingText || loading || isStreaming}
          >
            {grabbingText ? "Reading…" : "Use selected text"}
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
              try {
                if (!fileInputRef.current) throw new Error("Upload is not ready.");
                fileInputRef.current.click();
              } catch (err) {
                setError(err?.message || "Could not open file picker.");
              }
            }}
            disabled={loading || isStreaming}
          >
            Upload
          </button>
        </div>

        {grabbingText && (
          <p className={styles.feedbackBusy} aria-live="polite">
            <span className={styles.feedbackBusyDot} aria-hidden />
            Reading selection…
          </p>
        )}

        {capturingShot && (
          <p className={styles.feedbackBusy} aria-live="polite">
            <span className={styles.feedbackBusyDot} aria-hidden />
            Capturing tab…
          </p>
        )}

        {feedback && (
          <p className={styles.feedbackSuccess} role="status" aria-live="polite">
            {feedback}
          </p>
        )}

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
              title="Optional: narrow context to one ingested course."
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

          {lastImagePreview && (
            <div className={styles.attachedImageRow}>
              <img src={lastImagePreview} alt="" className={styles.attachedThumb} />
              <div className={styles.attachedMeta}>
                <p className={styles.attachedLabel}>Image attached</p>
                <button
                  type="button"
                  className={styles.linkButton}
                  title="Remove the image from this question."
                  onClick={() => {
                    setScreenshotBase64(null);
                    setLastImagePreview(null);
                    setError(null);
                    setFeedback(null);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          <textarea
            className={styles.textarea}
            rows={6}
            title="Your question. Screenshot / Upload fill a starter line you can edit."
            placeholder="Type your question here..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />

          <div className={styles.rowBetween} style={{ justifyContent: "flex-end" }}>
            <button
              className={styles.iconButton}
              type="submit"
              title={TITLE_SUBMIT}
              disabled={loading || isStreaming || !question.trim()}
            >
              {loading || isStreaming ? "·" : "→"}
            </button>
          </div>
        </form>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {showResponse && (
        <div className={styles.card} style={{ overflow: "hidden" }}>
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
        </div>
      )}
    </div>
  );
}
