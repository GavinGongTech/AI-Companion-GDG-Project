import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import styles from "./Pages.module.css";

export function Graph() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch("/api/v1/graph")
      .then((data) => setNodes(data.nodes || []))
      .catch((err) => {
        // 404 means no SMG data yet — not an error
        if (err.message?.includes("No SMG data")) {
          setNodes([]);
        } else {
          setError(err.message);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={styles.center}>
        <div className={styles.spinner} aria-hidden />
        <p className={styles.muted}>Loading graph...</p>
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <div className={styles.section}>
        <p className={styles.eyebrow}>My Graph</p>
        <h2 className={styles.h1}>Concept mastery</h2>
        <p className={styles.text}>Your mastery across tracked concepts.</p>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.card}>
        {nodes.length > 0 ? (
          nodes.map((node) => {
            const accuracy = Math.round((node.accuracyRate || 0) * 100);
            return (
              <div key={node.conceptNode} className={styles.graphRow}>
                <div className={styles.rowBetween}>
                  <span className={styles.text}>
                    {node.conceptNode.replace(/_/g, " ")}
                  </span>
                  <span className={styles.muted}>{accuracy}%</span>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={
                      accuracy < 40
                        ? `${styles.barFill} ${styles.low}`
                        : accuracy < 70
                          ? `${styles.barFill} ${styles.mid}`
                          : `${styles.barFill} ${styles.high}`
                    }
                    style={{ width: `${Math.max(5, accuracy)}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <p className={styles.muted}>
            No concepts tracked yet. Start asking questions or taking quizzes to
            build your misconception graph.
          </p>
        )}
      </div>
    </div>
  );
}
