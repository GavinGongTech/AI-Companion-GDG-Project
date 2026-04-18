import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../lib/api";
import { MathRenderer } from "../components/MathRenderer";
import "katex/dist/katex.min.css";
import styles from "./Pages.module.css";

const optionVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.2 },
  }),
};

export function Quiz() {
  const [topic, setTopic] = useState("");
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [sessionId, setSessionId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function resetQuiz() {
    setQuestions([]);
    setCurrentIdx(0);
    setSelected(null);
    setResult(null);
    setScore({ correct: 0, total: 0 });
    setSessionId(null);
  }

  async function startQuiz() {
    setLoading(true);
    setError(null);
    resetQuiz();
    try {
      const data = await apiFetch("/api/v1/quiz", {
        method: "POST",
        body: JSON.stringify({
          topic: topic.trim() || undefined,
          count: 3,
        }),
      });
      setSessionId(data.sessionId || null);
      setQuestions(data.questions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer() {
    if (selected === null || submitting) return;
    const q = questions[currentIdx];
    setSubmitting(true);
    try {
      const data = await apiFetch("/api/v1/quiz/answer", {
        method: "POST",
        body: JSON.stringify({
          conceptNode: q.conceptNode,
          selectedAnswer: selected,
          sessionId,
          questionIndex: currentIdx,
        }),
      });
      const isCorrect = data.isCorrect;
      setResult({ isCorrect, correctAnswer: data.correctAnswer, explanation: q.explanation });
      setScore((prev) => ({
        correct: prev.correct + (isCorrect ? 1 : 0),
        total: prev.total + 1,
      }));
    } catch (err) {
      setError(err.message || "Failed to submit answer.");
    } finally {
      setSubmitting(false);
    }
  }

  function nextQuestion() {
    setSelected(null);
    setResult(null);
    setCurrentIdx((i) => i + 1);
  }

  const q = questions[currentIdx];
  const quizDone = questions.length > 0 && currentIdx >= questions.length;

  function getOptionStyle(i) {
    if (!result) {
      return {
        cursor: "pointer",
        border: selected === i
          ? "2px solid var(--accent)"
          : "2px solid transparent",
      };
    }
    if (i === result.correctAnswer) {
      return {
        cursor: "default",
        border: "2px solid var(--green)",
        background: "rgba(34,197,94,0.12)",
      };
    }
    if (i === selected && !result.isCorrect) {
      return {
        cursor: "default",
        border: "2px solid var(--red)",
        background: "rgba(239,68,68,0.12)",
      };
    }
    return { cursor: "default", border: "2px solid transparent" };
  }

  return (
    <div className={styles.stack}>
      <motion.div
        className={styles.section}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <p className={styles.eyebrow}>Quiz mode</p>
        <h2 className={styles.h1}>Test your understanding</h2>
      </motion.div>

      {questions.length === 0 && !loading && (
        <motion.div
          className={styles.card}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.2 }}
        >
          <label className={styles.cardTitle}>
            Topic (optional — leave blank to target weak areas)
          </label>
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
        </motion.div>
      )}

      {loading && (
        <div className={styles.center} style={{ minHeight: "30vh" }}>
          <div className={styles.spinner} aria-hidden />
          <p className={styles.muted}>Generating questions...</p>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <AnimatePresence mode="wait">
        {q && !quizDone && (
          <motion.div
            key={currentIdx}
            className={styles.card}
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -30, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
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
                <motion.button
                  key={i}
                  type="button"
                  className={styles.topicItem}
                  style={getOptionStyle(i)}
                  onClick={() => !result && setSelected(i)}
                  disabled={!!result}
                  custom={i}
                  variants={optionVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <MathRenderer text={opt} />
                </motion.button>
              ))}
            </div>

            {!result ? (
              <button
                className={styles.primaryButton}
                type="button"
                onClick={submitAnswer}
                disabled={selected === null || submitting || !!result}
              >
                Submit Answer
              </button>
            ) : (
              <>
                <AnimatePresence>
                  <motion.div
                    key="result"
                    className={styles.calloutBox}
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      borderColor: result.isCorrect
                        ? "rgba(34,197,94,0.3)"
                        : "rgba(239,68,68,0.3)",
                    }}
                  >
                    <p
                      className={styles.calloutTitle}
                      style={{ color: result.isCorrect ? "var(--green)" : "var(--red)" }}
                    >
                      {result.isCorrect ? "Correct!" : "Incorrect"}
                    </p>
                    <div className={styles.text}>
                      <MathRenderer text={result.explanation} />
                    </div>
                  </motion.div>
                </AnimatePresence>
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
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {quizDone && (
          <motion.div
            className={styles.card}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className={styles.cardTitle}>Quiz Complete</p>
            <p className={styles.text}>
              You got {score.correct} out of {score.total} correct (
              {Math.round((score.correct / score.total) * 100)}%).
            </p>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={resetQuiz}
            >
              Try Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
