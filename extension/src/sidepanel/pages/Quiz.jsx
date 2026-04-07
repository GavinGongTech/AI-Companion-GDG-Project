import { useState } from "react";
import styles from "./Pages.module.css";

const topics = [
  { id: 1, name: "Lecture 1", note: "you did this 0x times" },
  { id: 2, name: "Lecture 2", note: "you did this 1x time" },
  { id: 3, name: "Lecture 3", note: "weak area" },
];

export function Quiz() {
  const [selectedTopics, setSelectedTopics] = useState([1]);
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [answer, setAnswer] = useState("");

  function toggleTopic(id) {
    setSelectedTopics((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  return (
    <div className={styles.stack}>
      <div className={styles.section}>
        <p className={styles.eyebrow}>Quiz mode</p>
        <h2 className={styles.h1}>Pick the topics you want to be quizzed on</h2>
      </div>

      <div className={styles.card}>
        {topics.map((topic) => (
          <label key={topic.id} className={styles.checkRow}>
            <input
              type="checkbox"
              checked={selectedTopics.includes(topic.id)}
              onChange={() => toggleTopic(topic.id)}
            />
            <span>
              <strong>{topic.name}</strong>
              <br />
              <span className={styles.muted}>{topic.note}</span>
            </span>
          </label>
        ))}

        <button
          className={styles.primaryButton}
          type="button"
          onClick={() => setStarted(true)}
        >
          Start Quiz
        </button>
      </div>

      {started && (
        <div className={styles.card}>
          <div className={styles.rowBetween}>
            <p className={styles.cardTitle}>Question 1</p>
            <div className={styles.row}>
              <button className={styles.secondaryButton} type="button">
                Easier
              </button>
              <button className={styles.secondaryButton} type="button">
                Harder
              </button>
            </div>
          </div>

          <p className={styles.text}>
            Evaluate ∫ x e^x dx and explain why your choice of u and dv makes sense.
          </p>

          <textarea
            className={styles.textarea}
            rows={5}
            placeholder="Type your answer..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />

          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => setSubmitted(true)}
          >
            Submit Answer
          </button>
        </div>
      )}

      {submitted && (
        <div className={styles.card}>
          <p className={styles.cardTitle}>Answer Reveal</p>
          <p className={styles.text}>
            Let u = x and dv = e^x dx. Then du = dx and v = e^x.
          </p>
          <p className={styles.text}>
            So ∫ x e^x dx = x e^x − ∫ e^x dx = x e^x − e^x + C.
          </p>

          <p className={styles.cardTitle}>Your Performance</p>
          <p className={styles.text}>You answered 1 / 3 correctly.</p>

          <p className={styles.cardTitle}>Past Performance</p>
          <p className={styles.text}>Last time: 0 / 3</p>

          <div className={styles.calloutBox}>
            <p className={styles.calloutTitle}>Progress</p>
            <p className={styles.text}>You did better this round. Good job.</p>
          </div>
        </div>
      )}
    </div>
  );
}