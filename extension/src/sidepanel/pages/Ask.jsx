import { useState } from "react";
import styles from "./Pages.module.css";

export function Ask() {
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />

          <div className={styles.rowBetween}>
            <button className={styles.iconButton} type="button">
              +
            </button>
            <button className={styles.iconButton} type="submit">
              →
            </button>
          </div>
        </form>
      </div>

      {submitted && (
        <div className={styles.card}>
          <p className={styles.cardTitle}>Question</p>
          <p className={styles.text}>
            {input || "Why does integration by parts work?"}
          </p>

          <p className={styles.cardTitle}>Step-by-step Solution</p>
          <ol className={styles.simpleList}>
            <li>Start from the product rule: (uv)' = u'v + uv'.</li>
            <li>Rearrange it to isolate uv'.</li>
            <li>Integrate both sides to get ∫u dv = uv − ∫v du.</li>
          </ol>

          <p className={styles.cardTitle}>Main Concept</p>
          <p className={styles.text}>Integration techniques</p>

          <p className={styles.cardTitle}>Key Formula</p>
          <p className={styles.text}>∫u dv = uv − ∫v du</p>

          <p className={styles.cardTitle}>Relevant Lecture</p>
          <p className={styles.text}>Lecture 8: Integration by Parts</p>

          <div className={styles.calloutBox}>
            <p className={styles.calloutTitle}>Personalized Callout</p>
            <p className={styles.text}>
              You usually struggle more with choosing <strong>u</strong> and{" "}
              <strong>dv</strong> than with the formula itself.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}