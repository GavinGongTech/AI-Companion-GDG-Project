import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { MathRenderer } from "../components/MathRenderer";
import "katex/dist/katex.min.css";
import styles from "./Pages.module.css";

export function Quiz() {
  const [state, setState] = useState("idle"); // idle | loading | question | answered
  const [quiz, setQuiz] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [topic, setTopic] = useState("");
  const [weakConcepts, setWeakConcepts] = useState([]);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  // Load weak concepts on mount
  useEffect(() => {
    apiFetch("/api/v1/quiz/queue")
      .then((data) => setWeakConcepts(data.queue?.slice(0, 5) || []))
      .catch(() => {}); // Silently fail if no data yet
  }, []);

  async function generate(overrideTopic) {
    setState("loading");
    setError(null);
    setQuiz(null);
    setSelected(null);
    setResult(null);
    try {
      const data = await apiFetch("/api/v1/quiz", {
        method: "POST",
        body: JSON.stringify({ topic: overrideTopic || topic || undefined }),
      });
      setQuiz(data);
      setState("question");
    } catch (err) {
      setError(err.message);
      setState("idle");
    }
  }

  async function submitAnswer(index) {
    setSelected(index);
    setState("answered");
    const isCorrect = index === quiz.answer;
    setResult({ isCorrect, explanation: quiz.explanation });
    setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));

    // Record answer in backend
    try {
      await apiFetch("/api/v1/quiz/answer", {
        method: "POST",
        body: JSON.stringify({
          conceptNode: quiz.conceptNode || quiz.topic,
          selectedAnswer: index,
          correctAnswer: quiz.answer,
        }),
      });
    } catch {
      // Non-critical -- don't block UI
    }
  }

  return (
    <div className={styles.stack}>
      <p className={styles.eyebrow}>test yourself ...</p>
      <h1 className={styles.h1}>Quiz</h1>
      <p className={styles.lede}>
        Generate questions from your course materials and track what you know.
      </p>

      {weakConcepts.length > 0 && state === "idle" && (
        <div className={styles.card}>
          <p className={styles.cardTitle}>Weak Areas</p>
          <div className={styles.row} style={{ flexWrap: "wrap", gap: "0.35rem" }}>
            {weakConcepts.map((c) => (
              <button
                key={c.conceptNode}
                className={styles.secondary}
                style={{ fontSize: "0.72rem", padding: "0.3rem 0.6rem" }}
                onClick={() => generate(c.conceptNode)}
              >
                {c.conceptNode.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>
      )}

      {state === "idle" && (
        <div className={styles.form}>
          <label className={styles.label} htmlFor="topic">
            Topic (optional -- leave blank for weak-area focus)
          </label>
          <input
            id="topic"
            className={styles.textarea}
            style={{ minHeight: "auto", padding: "0.45rem 0.65rem" }}
            placeholder="e.g. integration by parts"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <button className={styles.primary} onClick={() => generate()}>
            Generate question
          </button>
        </div>
      )}

      {state === "loading" && (
        <div className={styles.center} style={{ minHeight: "20vh" }}>
          <div className={styles.spinner} aria-hidden />
          <p className={styles.muted}>Generating question...</p>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {(state === "question" || state === "answered") && quiz && (
        <div className={styles.card}>
          <p className={styles.cardTitle}>
            {quiz.difficulty || "Question"} {quiz.conceptNode ? `— ${quiz.conceptNode.replace(/_/g, " ")}` : ""}
          </p>
          <div className={styles.cardBody}><MathRenderer text={quiz.question} /></div>
          <div className={styles.options} style={{ marginTop: "0.5rem" }}>
            {quiz.options.map((opt, i) => {
              let optStyle = {};
              if (state === "answered") {
                if (i === quiz.answer) optStyle = { color: "#3ee0d0", fontWeight: 600 };
                else if (i === selected && i !== quiz.answer) optStyle = { color: "#f07178" };
              }
              return (
                <button
                  key={i}
                  className={styles.secondary}
                  style={{ justifyContent: "flex-start", textAlign: "left", ...optStyle }}
                  onClick={() => state === "question" && submitAnswer(i)}
                  disabled={state === "answered"}
                >
                  {String.fromCharCode(65 + i)}. <MathRenderer text={opt} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {state === "answered" && result && (
        <>
          <div className={styles.card} style={{ borderColor: result.isCorrect ? "#3ee0d0" : "#f07178" }}>
            <p className={styles.cardTitle}>{result.isCorrect ? "Correct!" : "Incorrect"}</p>
            <div className={styles.cardBody}><MathRenderer text={result.explanation} /></div>
          </div>
          <button className={styles.primary} onClick={() => { setState("idle"); }}>
            Next question
          </button>
        </>
      )}

      {score.total > 0 && (
        <div className={styles.results}>
          <span className={styles.score}>
            Score: <strong>{score.correct} / {score.total}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
