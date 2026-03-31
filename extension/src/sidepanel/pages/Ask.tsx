import { useState } from "react";
import type { FormEvent } from "react";
import { explain } from "../../api/client";
import type { ExplainResponse } from "../../api/types";
import styles from "./Pages.module.css";

export function Ask() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExplainResponse | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const data = await explain({ question: question.trim() || "(empty)" });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
      setResult(staticFallback(question));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.stack}>
      <p className={styles.eyebrow}>ask …</p>
      <h1 className={styles.h1}>Capture &amp; explain</h1>
      <p className={styles.lede}>
        Ask a question about the math problem you&apos;re looking at. Uses the
        API when the server is running; otherwise shows static preview text.
      </p>

      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.label}>
          Your question
          <textarea
            className={styles.textarea}
            rows={4}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Why does this limit equal e?"
          />
        </label>
        <button className={styles.primary} type="submit" disabled={loading}>
          {loading ? "Working…" : "Submit"}
        </button>
      </form>

      {error && (
        <p className={styles.error} role="alert">
          {error} — showing offline preview.
        </p>
      )}

      {result && (
        <div className={styles.cards}>
          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Question</h2>
            <p className={styles.cardBody}>{result.question}</p>
          </article>
          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Solution</h2>
            <p className={styles.cardBody}>{result.solution}</p>
          </article>
          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Main concept</h2>
            <p className={styles.cardBody}>{result.mainConcept}</p>
          </article>
          <article className={styles.card}>
            <h2 className={styles.cardTitle}>Relevant lecture</h2>
            <p className={styles.cardBody}>{result.relevantLecture}</p>
          </article>
        </div>
      )}
    </div>
  );
}

function staticFallback(q: string): ExplainResponse {
  return {
    question: q || "—",
    solution:
      "Offline preview: connect the API at http://localhost:3000 for live RAG.",
    mainConcept:
      "Misconception graph will tag this once the classifier is wired.",
    relevantLecture: "Lecture 4 — Transcendental functions (preview)",
  };
}
