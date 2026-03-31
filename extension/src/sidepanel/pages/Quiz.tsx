import { useState } from "react";
import type { FormEvent } from "react";
import { startQuiz, submitQuiz } from "../../api/client";
import type { QuizQuestion, QuizStartResponse, QuizSubmitResponse } from "../../api/types";
import styles from "./Pages.module.css";

const lectures = [
  { id: "lec1", label: "Lecture 1 — Sequences" },
  { id: "lec2", label: "Lecture 2 — Series" },
  { id: "lec3", label: "Lecture 3 — Taylor polynomials" },
];

type Step = "select" | "question" | "results";

export function Quiz() {
  const [step, setStep] = useState<Step>("select");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<QuizStartResponse | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [results, setResults] = useState<QuizSubmitResponse | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onStart(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const ids = [...selected];
    if (ids.length === 0) {
      ids.push("lec1");
    }
    try {
      const data = await startQuiz({ lectureIds: ids });
      setSession(data);
      setStep("question");
      setChoice(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Quiz start failed");
      setSession(staticQuizStart(ids));
      setStep("question");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitAnswer(e: FormEvent) {
    e.preventDefault();
    if (!session || !choice) return;
    setLoading(true);
    setError(null);
    try {
      const data = await submitQuiz({
        quizId: session.quizId,
        answers: [{ questionId: session.questions[0].id, selectedOptionId: choice }],
      });
      setResults(data);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
      setResults(staticQuizResults());
      setStep("results");
    } finally {
      setLoading(false);
    }
  }

  const q: QuizQuestion | undefined = session?.questions[0];

  return (
    <div className={styles.stack}>
      <p className={styles.eyebrow}>quiz …</p>
      <h1 className={styles.h1}>Quiz</h1>
      <p className={styles.lede}>
        Select lectures, answer MCQs, then review performance (API or static
        preview).
      </p>

      {step === "select" && (
        <form className={styles.form} onSubmit={onStart}>
          <h2 className={styles.h2}>Select lectures</h2>
          <ul className={styles.checkList}>
            {lectures.map((l) => (
              <li key={l.id}>
                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={selected.has(l.id)}
                    onChange={() => toggle(l.id)}
                  />
                  <span>{l.label}</span>
                </label>
              </li>
            ))}
          </ul>
          <button className={styles.primary} type="submit" disabled={loading}>
            {loading ? "Starting…" : "Start quiz"}
          </button>
        </form>
      )}

      {step === "question" && q && (
        <form className={styles.form} onSubmit={onSubmitAnswer}>
          <h2 className={styles.h2}>{q.prompt}</h2>
          <div className={styles.options}>
            {q.options.map((o) => (
              <label key={o.id} className={styles.option}>
                <input
                  type="radio"
                  name="opt"
                  value={o.id}
                  checked={choice === o.id}
                  onChange={() => setChoice(o.id)}
                />
                <span>
                  {o.label}. {o.text}
                </span>
              </label>
            ))}
          </div>
          <button
            className={styles.primary}
            type="submit"
            disabled={loading || !choice}
          >
            {loading ? "Grading…" : "Submit answer"}
          </button>
        </form>
      )}

      {step === "results" && results && (
        <div className={styles.results}>
          <h2 className={styles.h2}>Results</h2>
          <p className={styles.score}>
            Your performance{" "}
            <strong>{results.scorePercent}</strong>
            /100
          </p>
          <p className={styles.score}>
            Your past performance{" "}
            <strong>{results.pastPerformancePercent}</strong>
            /100
          </p>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              setStep("select");
              setSession(null);
              setResults(null);
              setChoice(null);
            }}
          >
            New quiz
          </button>
          <p className={styles.muted}>Share stats — wire-up later.</p>
        </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function staticQuizStart(lectureIds: string[]): QuizStartResponse {
  return {
    quizId: "preview-quiz",
    lectureIds,
    questions: [
      {
        id: "q1",
        prompt: "Q1 — Which series converges? (preview)",
        options: [
          { id: "a", label: "A", text: "Σ 1/n" },
          { id: "b", label: "B", text: "Σ 1/n²" },
          { id: "c", label: "C", text: "Σ 1" },
          { id: "d", label: "D", text: "Σ n" },
        ],
      },
    ],
  };
}

function staticQuizResults(): QuizSubmitResponse {
  return {
    scorePercent: 72,
    pastPerformancePercent: 65,
  };
}
