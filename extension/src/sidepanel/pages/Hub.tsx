import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  drillQueueResponseSchema,
  gamificationResponseSchema,
  type DrillQueueResponse,
  type GamificationResponse,
} from "@study-flow/shared";
import { apiFetchParsed } from "../../lib/api";
import styles from "./Pages.module.css";

type DrillQueueItem = DrillQueueResponse["queue"][number];

export function Hub() {
  const [queue, setQueue] = useState<DrillQueueItem[]>([]);
  const [gamification, setGamification] = useState<GamificationResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetchParsed("/api/v1/quiz/queue", drillQueueResponseSchema)
        .then((data) => setQueue(data.queue?.slice(0, 5) || []))
        .catch(() => {}),
      apiFetchParsed("/api/v1/gamification", gamificationResponseSchema)
        .then((data) => setGamification(data))
        .catch(() => {})
    ]).finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.stack}>
      <div className={styles.section}>
        <p className={styles.eyebrow}>pick mode</p>
      </div>

      <div className={styles.card}>
        {gamification && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <div>
              <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>Level</span>
              <div style={{ fontSize: "1.25rem", fontWeight: "bold" }}>{gamification.level}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>Streak</span>
              <div style={{ fontSize: "1.25rem", fontWeight: "bold" }}>{gamification.streak} 🔥</div>
            </div>
          </div>
        )}

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
