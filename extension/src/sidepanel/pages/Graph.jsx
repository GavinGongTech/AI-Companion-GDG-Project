import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import styles from "./Pages.module.css";

function sortNodes(nodes, sortBy) {
  return [...nodes].sort((a, b) => {
    if (sortBy === "weakness") return a.accuracyRate - b.accuracyRate;
    if (sortBy === "urgency") return b.overdue - a.overdue;
    return (b.interactionCount || 0) - (a.interactionCount || 0);
  });
}

export function Graph() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("weakness"); // weakness | urgency | recent

  useEffect(() => {
    apiFetch("/api/v1/graph")
      .then((data) => {
        const now = Date.now();
        const enriched = (data.nodes || []).map((n) => {
          const ts = n.nextReviewDate?._seconds ? n.nextReviewDate._seconds * 1000 : new Date(n.nextReviewDate).getTime();
          return { ...n, overdue: Math.max(0, now - ts) };
        });
        setNodes(enriched);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const sorted = sortNodes(nodes, sortBy);

  // Color: red (<0.4), yellow (0.4-0.7), green (>0.7)
  function barColor(rate) {
    if (rate < 0.4) return "#f07178";
    if (rate < 0.7) return "#ffcb6b";
    return "#3ee0d0";
  }

  if (loading) return (
    <div className={styles.center}>
      <div className={styles.spinner} aria-hidden />
      <p className={styles.muted}>Loading graph...</p>
    </div>
  );

  if (error) return (
    <div className={styles.stack}>
      <p className={styles.error}>{error}</p>
    </div>
  );

  if (nodes.length === 0) return (
    <div className={styles.stack}>
      <p className={styles.eyebrow}>my graph</p>
      <h1 className={styles.h1}>My Graph</h1>
      <p className={styles.lede}>No data yet. Start asking questions or taking quizzes to build your misconception graph.</p>
    </div>
  );

  return (
    <div className={styles.stack}>
      <p className={styles.eyebrow}>my graph</p>
      <h1 className={styles.h1}>My Graph</h1>
      <p className={styles.lede}>{nodes.length} concepts tracked</p>

      <div className={styles.row} style={{ gap: "0.35rem" }}>
        {["weakness", "urgency", "recent"].map((key) => (
          <button
            key={key}
            className={sortBy === key ? styles.primary : styles.secondary}
            style={{ fontSize: "0.72rem", padding: "0.3rem 0.6rem" }}
            onClick={() => setSortBy(key)}
          >
            {key}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {sorted.map((node) => (
          <div key={node.conceptNode} className={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                {node.conceptNode.replace(/_/g, " ")}
              </span>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                {Math.round((node.accuracyRate || 0) * 100)}%
              </span>
            </div>
            <div style={{ height: "6px", borderRadius: "3px", background: "var(--border-subtle)", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.max(5, (node.accuracyRate || 0) * 100)}%`,
                background: barColor(node.accuracyRate || 0),
                borderRadius: "3px",
                transition: "width 0.3s ease",
              }} />
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem", fontSize: "0.68rem", color: "var(--text-muted)" }}>
              <span>{node.interactionCount || 0} interactions</span>
              {node.errorTypeMap && Object.keys(node.errorTypeMap).length > 0 && (
                <span>Top error: {Object.entries(node.errorTypeMap).sort((a, b) => b[1] - a[1])[0][0].replace(/_/g, " ")}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
