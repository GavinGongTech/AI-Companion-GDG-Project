import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import { MathRenderer } from "../components/MathRenderer";
import "katex/dist/katex.min.css";
import styles from "./Pages.module.css";

const TITLE_USE_SELECTION = "Ask about text you've highlighted or the entire page text.";
const TITLE_SCREENSHOT = "Capture the visible part of the current tab and use it to set a quiz topic.";
const TITLE_UPLOAD = "Upload a PDF, image, or text file (ingest) or an image to derive a topic.";

export function Quiz() {
  const [topic, setTopic] = useState("");
  const [courseId, setCourseId] = useState("");
  const [courses, setCourses] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [sessionId, setSessionId] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [grabbingText, setGrabbingText] = useState(false);
  const [capturingShot, setCapturingShot] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const fileInputRef = useRef(null);

  /** Prefer structured fields from /analyze; fall back to OCR question text. */
  function topicFromAnalyzeResponse(res) {
    const main = String(res?.mainConcept || "").trim();
    if (main) return main.slice(0, 220);
    const node = String(res?.classifierTag?.conceptNode || "")
      .replace(/_/g, " ")
      .trim();
    if (node) return node.slice(0, 220);
    const q = String(res?.question || "").trim();
    if (q) return q.slice(0, 220);
    return "";
  }

  useEffect(() => {
    apiFetch("/api/v1/courses")
      .then((data) => setCourses(data.courses || []))
      .catch(() => {});

    chrome.storage.local.get(["activeCourseId"], (data) => {
      if (data.activeCourseId) setCourseId(data.activeCourseId);
    });
  }, []);

  // If the content-script widget asked us to open Quiz with a screenshot, consume it here.
  useEffect(() => {
    let cancelled = false;

    async function consumePrefillScreenshot() {
      const data = await chrome.storage.session.get(["prefillQuizImageBase64"]);
      const base64 = data.prefillQuizImageBase64;
      if (!base64 || cancelled) return;
      await chrome.storage.session.remove(["prefillQuizImageBase64"]);

      setCapturingShot(true);
      setError(null);
      setFeedback("Analyzing screenshot…");
      try {
        const res = await apiFetch("/api/v1/analyze", {
          method: "POST",
          body: JSON.stringify({ imageBase64: base64, courseId: courseId || undefined }),
        });
        const nextTopic = topicFromAnalyzeResponse(res);
        if (!cancelled && nextTopic) {
          setTopic(nextTopic);
          setFeedback(`Topic set from screenshot: ${nextTopic}`);
          // Must pass topic explicitly — state from setTopic is not updated until next render.
          await runQuizGeneration(nextTopic);
        } else if (!cancelled) {
          setFeedback("Could not infer a topic from that screenshot. Try selecting text or start a blank quiz.");
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setCapturingShot(false);
      }
    }

    consumePrefillScreenshot().catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function useSelectedTextAsTopic() {
    setGrabbingText(true);
    setError(null);
    setFeedback(null);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || tab.url?.startsWith("chrome://") || tab.url?.startsWith("edge://")) {
        throw new Error("Cannot read from this page.");
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const sel = window.getSelection().toString().trim();
          return sel;
        },
      });

      const text = results?.[0]?.result;
      const trimmed = String(text || "").trim();
      if (trimmed) {
        setTopic(trimmed.slice(0, 220));
        setFeedback("Topic set from selection.");
      } else {
        setFeedback("Highlight text on the page first, then click Read Page Text.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGrabbingText(false);
    }
  }

  async function attachVisibleTabScreenshotAsTopic() {
    setCapturingShot(true);
    setError(null);
    setFeedback(null);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 80 }, (url) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(url);
        });
      });

      const base64Image = String(dataUrl).split(",")[1];
      const res = await apiFetch("/api/v1/analyze", {
        method: "POST",
        body: JSON.stringify({ imageBase64: base64Image, courseId: courseId || undefined }),
      });
      const nextTopic = topicFromAnalyzeResponse(res);
      if (nextTopic) {
        setTopic(nextTopic);
        setFeedback(`Topic set from screenshot: ${nextTopic}`);
      } else {
        setFeedback("Could not infer a topic from that screenshot. Try selecting text instead.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setCapturingShot(false);
    }
  }

  async function handlePickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setFeedback("Reading file…");
    try {
      const lower = file.name.toLowerCase();
      const isImage =
        file.type.startsWith("image/") ||
        /\.(png|jpe?g|gif|webp)$/i.test(lower);

      if (!isImage) {
        setLoading(true);
        try {
          const formData = new FormData();
          formData.append("file", file);
          if (courseId) formData.append("courseId", courseId);
          await apiFetch("/api/v1/ingest", {
            method: "POST",
            body: formData,
          });
          setFeedback(
            `Ingested ${file.name}. Start the quiz with a blank topic to focus weak areas, or type a topic above.`,
          );
        } finally {
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      const base64Image = String(dataUrl).includes(",") ? String(dataUrl).split(",")[1] : "";
      if (!base64Image) throw new Error("Unsupported image format.");

      const res = await apiFetch("/api/v1/analyze", {
        method: "POST",
        body: JSON.stringify({ imageBase64: base64Image, courseId: courseId || undefined }),
      });
      const nextTopic = topicFromAnalyzeResponse(res);
      if (nextTopic) {
        setTopic(nextTopic);
        setFeedback(`Topic set from upload: ${nextTopic}`);
      } else {
        setFeedback("Could not infer a topic from that image.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  /** Pass topicOverride when you just called setTopic — React state is async. */
  async function runQuizGeneration(topicOverride) {
    const effectiveTopic = String(topicOverride ?? topic).trim();
    setLoading(true);
    setError(null);
    setFeedback(null);
    setQuestions([]);
    setSessionId("");
    setCurrentIdx(0);
    setSelected(null);
    setResult(null);
    setScore({ correct: 0, total: 0 });
    try {
      const data = await apiFetch("/api/v1/quiz", {
        method: "POST",
        body: JSON.stringify({
          topic: effectiveTopic || undefined,
          courseId: courseId || undefined,
          count: 3,
        }),
      });
      setSessionId(data.sessionId || "");
      setQuestions(data.questions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function startQuiz() {
    await runQuizGeneration();
  }

  async function submitAnswer() {
    if (selected === null) return;
    const q = questions[currentIdx];

    // Grade + record answer server-side (client does not receive the answer key).
    try {
      const data = await apiFetch("/api/v1/quiz/answer", {
        method: "POST",
        body: JSON.stringify({
          conceptNode: q.conceptNode,
          selectedAnswer: selected,
          sessionId,
          questionIndex: currentIdx,
          courseId: courseId || undefined,
        }),
      });

      const isCorrect = Boolean(data.isCorrect);
      const correctAnswer = typeof data.correctAnswer === "number" ? data.correctAnswer : null;

      setResult({ isCorrect, correctAnswer });
      setScore((prev) => ({
        correct: prev.correct + (isCorrect ? 1 : 0),
        total: prev.total + 1,
      }));
    } catch (err) {
      setError(err.message || "Could not grade answer. Try starting a new quiz.");
    }
  }

  function nextQuestion() {
    setSelected(null);
    setResult(null);
    setCurrentIdx((i) => i + 1);
  }

  const q = questions[currentIdx];
  const quizDone = questions.length > 0 && currentIdx >= questions.length;

  return (
    <div className={styles.stack}>
      <div className={styles.section}>
        <p className={styles.eyebrow}>Quiz mode</p>
        <h2 className={styles.h1}>Test your understanding</h2>
      </div>

      {/* Topic input + start */}
      {questions.length === 0 && !loading && (
        <div className={styles.card}>
          <label className={styles.cardTitle}>
            Topic (optional — leave blank to target weak areas)
          </label>
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

          <div className={styles.row} style={{ marginBottom: 10 }}>
            <button
              className={styles.secondaryButton}
              type="button"
              title={TITLE_USE_SELECTION}
              onClick={useSelectedTextAsTopic}
              disabled={grabbingText || capturingShot || loading}
            >
              {grabbingText ? "Reading…" : "Read Page Text"}
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              title={TITLE_SCREENSHOT}
              onClick={attachVisibleTabScreenshotAsTopic}
              disabled={capturingShot || grabbingText || loading}
            >
              {capturingShot ? "Capturing…" : "Screenshot"}
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              title={TITLE_UPLOAD}
              onClick={() => fileInputRef.current?.click?.()}
              disabled={loading}
            >
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md"
              style={{ display: "none" }}
              onChange={handlePickFile}
            />
          </div>

          {feedback && (
            <p className={styles.feedbackSuccess} role="status" aria-live="polite">
              {feedback}
            </p>
          )}

          <input
            className={styles.textarea}
            style={{ minHeight: "auto" }}
            placeholder="e.g. integration by parts"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <button
            className={styles.primaryButton}
            type="button"
            onClick={startQuiz}
          >
            Start Quiz
          </button>
        </div>
      )}

      {loading && (
        <div className={styles.center} style={{ minHeight: "30vh" }}>
          <div className={styles.spinner} aria-hidden />
          <p className={styles.muted}>Generating questions...</p>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {/* Active question */}
      {q && !quizDone && (
        <div className={styles.card}>
          <div className={styles.rowBetween}>
            <p className={styles.cardTitle}>
              Question {currentIdx + 1} of {questions.length}
            </p>
            <span className={styles.muted}>{q.difficulty}</span>
          </div>

          <div className={styles.text}>
            <MathRenderer text={q.question} />
          </div>

          <div className={styles.topicList}>
            {q.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                className={styles.topicItem}
                style={{
                  cursor: result ? "default" : "pointer",
                  border:
                    selected === i
                      ? "2px solid #111827"
                      : "2px solid transparent",
                  background:
                    result && result.correctAnswer === i
                      ? "#d1fae5"
                      : result && i === selected && !result.isCorrect
                        ? "#fee2e2"
                        : undefined,
                }}
                onClick={() => !result && setSelected(i)}
                disabled={!!result}
              >
                <MathRenderer text={opt} />
              </button>
            ))}
          </div>

          {!result ? (
            <button
              className={styles.primaryButton}
              type="button"
              onClick={submitAnswer}
              disabled={selected === null}
            >
              Submit Answer
            </button>
          ) : (
            <>
              <div className={styles.calloutBox}>
                <p className={styles.calloutTitle}>
                  {result.isCorrect ? "Correct!" : "Incorrect"}
                </p>
                <div className={styles.text}>
                  <MathRenderer text={q.explanation} />
                </div>
              </div>
              {currentIdx < questions.length - 1 ? (
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={nextQuestion}
                >
                  Next Question
                </button>
              ) : (
                <button
                  className={styles.primaryButton}
                  type="button"
                  onClick={() => {
                    setCurrentIdx(questions.length);
                  }}
                >
                  See Results
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Results */}
      {quizDone && (
        <div className={styles.card}>
          <p className={styles.cardTitle}>Quiz Complete</p>
          <p className={styles.text}>
            You got {score.correct} out of {score.total} correct (
            {Math.round((score.correct / score.total) * 100)}%).
          </p>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => {
              setQuestions([]);
              setCurrentIdx(0);
              setSelected(null);
              setResult(null);
              setScore({ correct: 0, total: 0 });
            }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
