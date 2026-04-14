import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import { MathRenderer } from "../components/MathRenderer";
import "katex/dist/katex.min.css";
import styles from "./Pages.module.css";

export function Ask() {
  const [question, setQuestion] = useState("");
  const [courseId] = useState("");
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Pre-fill from content script's "Explain this" button
  useEffect(() => {
    chrome.storage.session.get(["prefillAsk"], (data) => {
      if (data.prefillAsk) {
        setQuestion(data.prefillAsk);
        chrome.storage.session.remove("prefillAsk");
      }
    });
  }, []);

  async function handleSubmit(e) {
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
      <div className={styles.section}>
        <p className={styles.eyebrow}>Ask mode</p>
        <h2 className={styles.h1}>What are you confused about?</h2>
        <p className={styles.text}>Any specific question you are confused on?</p>
        <p className={styles.text}>Or is there anything you wanna prioritize?</p>
      </div>

      <div className={styles.card}>
        <div className={styles.row}>
          <button className={styles.secondaryButton} type="button">
            Use Selected Text
          </button>
          <button className={styles.secondaryButton} type="button">
            Screenshot
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
            <button className={styles.iconButton} type="submit" disabled={loading || !question.trim()}>
              {loading ? "..." : "→"}
            </button>
          </div>
        </form>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {response && (
        <div className={styles.card}>
          <p className={styles.cardTitle}>Question</p>
          <p className={styles.text}>{question}</p>

          <p className={styles.cardTitle}>Step-by-step Solution</p>
          <div className={styles.text}><MathRenderer text={response.solution} /></div>

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
                  <li key={i}><MathRenderer text={f} /></li>
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
              <div className={styles.text}><MathRenderer text={response.personalizedCallout} /></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}