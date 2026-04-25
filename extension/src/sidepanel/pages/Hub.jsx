import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import styles from "./Pages.module.css";

export function Hub() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/v1/quiz/queue")
      .then((data) => setQueue(data.queue?.slice(0, 5) || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.stack}>
      <div className={styles.section}>
        <p className={styles.eyebrow}>pick mode</p>
      </div>

      <div className={styles.card}>
        <div className={styles.homeModeRow}>
          <Link
            to="/ask"
            className={styles.modeButton}
            title="Ask the AI about your course. Pull in selected text or screenshots from the page behind this panel."
          >
            Ask
          </Link>
          <Link
            to="/quiz"
            className={styles.modeButton}
            title="Practice with auto-generated quiz questions tied to your weakest concepts."
          >
            Quiz
          </Link>
        </div>

        <div className={styles.recommendBlock}>
          <p className={styles.cardTitle}>Due for review</p>
          <div className={styles.topicList}>
            {loading ? (
              <div className={styles.center} style={{ minHeight: "10vh" }}>
                <div className={styles.spinner} aria-hidden />
              </div>
            ) : queue.length > 0 ? (
              queue.map((item) => (
                <div key={item.conceptNode} className={styles.topicItem}>
                  {item.conceptNode.replace(/_/g, " ")}{" "}
                  <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
                    ({Math.round((item.accuracyRate || 0) * 100)}% accuracy)
                  </span>
                </div>
              ))
            ) : (
              <p className={styles.muted}>
                No concepts tracked yet. Start asking questions or taking quizzes to build your review queue.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}