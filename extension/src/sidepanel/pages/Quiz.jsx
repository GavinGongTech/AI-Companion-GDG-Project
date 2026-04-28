import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { MathRenderer } from "../components/MathRenderer";
import "katex/dist/katex.min.css";
import styles from "./Pages.module.css";

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

  useEffect(() => {
    apiFetch("/api/v1/courses")
      .then((data) => setCourses(data.courses || []))
      .catch(() => {});
  }, []);

  async function startQuiz() {
    setLoading(true);
    setError(null);
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
          topic: topic.trim() || undefined,
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
