import { Link } from "react-router-dom";
import styles from "./Pages.module.css";

const recommendedTopics = [
  "Suggestion 1",
  "Suggestion 2",
  "Ex. Lecture 22: Mitosis",
];

export function Hub() {
  return (
    <div className={styles.stack}>
      <div className={styles.section}>
        <p className={styles.eyebrow}>pick mode</p>
      </div>

      <div className={styles.card}>
        <div className={styles.homeModeRow}>
          <Link to="/ask" className={styles.modeButton}>
            Ask
          </Link>
          <Link to="/quiz" className={styles.modeButton}>
            Quiz
          </Link>
        </div>

        <div className={styles.recommendBlock}>
          <p className={styles.cardTitle}>Recommended Topics</p>
          <div className={styles.topicList}>
            {recommendedTopics.map((topic) => (
              <div key={topic} className={styles.topicItem}>
                {topic}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}