import { useState } from "react";
import { apiFetch } from "../lib/api";
import { MathRenderer } from "../components/MathRenderer";
import "katex/dist/katex.min.css";
import styles from "./Pages.module.css";

export function Ask() {
  const [question, setQuestion] = useState("");
  const [courseId, setCourseId] = useState("");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const data = await apiFetch("/api/v1/analyze", {
        method: "POST",
        body: JSON.stringify({ content: question.trim(), courseId: courseId || undefined }),
      });
      setResponse(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.stack}>
      <p className={styles.eyebrow}>capture ...</p>
      <h1 className={styles.h1}>Ask</h1>
      <p className={styles.lede}>
        Type or paste a problem. Study Flow will explain it using your course materials.
      </p>

      <form className={styles.form} onSubmit={onSubmit}>
        <label className={styles.label} htmlFor="question">
          Your question
        </label>
        <textarea
          id="question"
          className={styles.textarea}
          placeholder="e.g. Why does L'Hopital's rule work?"
          rows={4}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <label className={styles.label} htmlFor="courseId">
          Course ID (optional)
        </label>
        <input
          id="courseId"
          className={styles.textarea}
          style={{ minHeight: "auto", padding: "0.45rem 0.65rem" }}
          placeholder="e.g. MATH201"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
        />
        <button type="submit" className={styles.primary} disabled={loading || !question.trim()}>
          {loading ? "Thinking..." : "Explain"}
        </button>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      {response && (
        <div className={styles.cards}>
          <div className={styles.card}>
            <p className={styles.cardTitle}>Solution</p>
            <div className={styles.cardBody}><MathRenderer text={response.solution} /></div>
          </div>
          {response.mainConcept && (
            <div className={styles.card}>
              <p className={styles.cardTitle}>Concept</p>
              <p className={styles.cardBody}>{response.mainConcept}</p>
            </div>
          )}
          {response.keyFormulas?.length > 0 && (
            <div className={styles.card}>
              <p className={styles.cardTitle}>Key Formulas</p>
              <ul className={styles.checkList}>
                {response.keyFormulas.map((f, i) => (
                  <li key={i} className={styles.checkRow}><MathRenderer text={f} /></li>
                ))}
              </ul>
            </div>
          )}
          {response.relevantLecture && (
            <div className={styles.card}>
              <p className={styles.cardTitle}>Relevant Material</p>
              <p className={styles.cardBody}>{response.relevantLecture}</p>
            </div>
          )}
          {response.personalizedCallout && (
            <div className={styles.card}>
              <p className={styles.cardTitle}>For You</p>
              <div className={styles.cardBody}><MathRenderer text={response.personalizedCallout} /></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
