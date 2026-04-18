import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { apiFetch } from "../lib/api";
import styles from "./Pages.module.css";

const ACTION_CARDS = [
  { to: "/ask", label: "Ask", icon: "?" },
  { to: "/quiz", label: "Quiz", icon: "✦" },
];

export function Hub() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queueError, setQueueError] = useState(null);

  useEffect(() => {
    apiFetch("/api/v1/quiz/queue")
      .then((data) => setQueue(data.queue?.slice(0, 5) || []))
      .catch((err) => setQueueError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div
      className={styles.stack}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
    >
      <motion.div
        className={styles.section}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0, duration: 0.22 }}
      >
        <p className={styles.eyebrow}>pick mode</p>
      </motion.div>

      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06, duration: 0.22 }}
      >
        <div className={styles.homeModeRow}>
          {ACTION_CARDS.map(({ to, label }, i) => (
            <motion.div
              key={to}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 + 0.1, duration: 0.22 }}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              style={{ flex: 1 }}
            >
              <Link to={to} className={styles.modeButton}>
                {label}
              </Link>
            </motion.div>
          ))}
        </div>

        <div className={styles.recommendBlock}>
          <p className={styles.cardTitle}>Due for review</p>
          <div className={styles.topicList}>
            {loading ? (
              <div className={styles.center} style={{ minHeight: "10vh" }}>
                <div className={styles.spinner} aria-hidden />
              </div>
            ) : queueError ? (
              <p className={styles.error}>{queueError}</p>
            ) : queue.length > 0 ? (
              queue.map((item, i) => (
                <motion.div
                  key={item.conceptNode}
                  className={styles.topicItem}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 + 0.24, duration: 0.18 }}
                >
                  {item.conceptNode.replace(/_/g, " ")}{" "}
                  <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
                    ({Math.round((item.accuracyRate || 0) * 100)}% accuracy)
                  </span>
                </motion.div>
              ))
            ) : (
              <p className={styles.muted}>
                No concepts tracked yet. Start asking questions or taking quizzes to build your review queue.
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
