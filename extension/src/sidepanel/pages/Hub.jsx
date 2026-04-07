import { Link } from "react-router-dom";
import styles from "./Pages.module.css";

export function Hub() {
  return (
    <div className={styles.stack}>
      <div className={styles.section}>
        <p className={styles.eyebrow}>Home</p>
        <h2 className={styles.h1}>Welcome back</h2>
        <p className={styles.text}>
          Pick a tab to ask a question, take a quiz, check your graph, or review your course.
        </p>
      </div>

      <div className={styles.grid2}>
        <Link to="/ask" className={styles.bigButton}>
          Ask
        </Link>
        <Link to="/quiz" className={styles.bigButton}>
          Quiz
        </Link>
      </div>

      <div className={styles.card}>
        <p className={styles.cardTitle}>Recommended Topics</p>
        <div className={styles.topicList}>
          <div className={styles.topicItem}>Chain Rule</div>
          <div className={styles.topicItem}>Implicit Differentiation</div>
          <div className={styles.topicItem}>Lecture 8: Integration Techniques</div>
        </div>
      </div>
    </div>
  );
}