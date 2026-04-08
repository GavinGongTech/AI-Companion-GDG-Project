import { useState, useEffect, useRef } from "react";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";
import styles from "./Dashboard.module.css";

export default function Dashboard() {
  const user = useAuth();
  const graphRef = useRef(null);
  const cyRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [drill, setDrill] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };
    Promise.all([
      apiFetch("/api/v1/graph", opts).catch(() => ({ nodes: [] })),
      apiFetch("/api/v1/graph/drill", opts).catch(() => ({ queue: [] })),
      apiFetch("/api/v1/events?limit=20", opts).catch(() => ({ events: [] })),
    ]).then(([graphData, drillData, eventsData]) => {
      if (controller.signal.aborted) return;
      setNodes(graphData.nodes || []);
      setDrill(drillData.queue || []);
      setEvents(eventsData.events || []);
      setLoading(false);
    });
    return () => controller.abort();
  }, []);

  // Lazy-load and initialize cytoscape only when there are nodes to render
  useEffect(() => {
    if (!graphRef.current || nodes.length === 0) return;
    let cancelled = false;

    import("cytoscape").then(({ default: cytoscape }) => {
      if (cancelled || !graphRef.current) return;
      if (cyRef.current) cyRef.current.destroy();

      const elements = nodes.map((n) => ({
        data: {
          id: n.conceptNode,
          label: n.conceptNode.replace(/_/g, " "),
          accuracy: n.accuracyRate || 0,
          size: Math.max(20, Math.min(60, (n.interactionCount || 1) * 5)),
        },
      }));

      cyRef.current = cytoscape({
        container: graphRef.current,
        elements,
        style: [
          {
            selector: "node",
            style: {
              label: "data(label)",
              "background-color": (ele) => {
                const acc = ele.data("accuracy");
                if (acc < 0.4) return "#f07178";
                if (acc < 0.7) return "#ffcb6b";
                return "#3ee0d0";
              },
              width: "data(size)",
              height: "data(size)",
              "font-size": "10px",
              color: "#f2f5f9",
              "text-valign": "bottom",
              "text-margin-y": 5,
            },
          },
        ],
        layout: { name: "cose", animate: false, padding: 30 },
        userZoomingEnabled: true,
        userPanningEnabled: true,
      });
    });

    return () => {
      cancelled = true;
      if (cyRef.current) cyRef.current.destroy();
    };
  }, [nodes]);

  function barColor(rate) {
    if (rate < 0.4) return "#f07178";
    if (rate < 0.7) return "#ffcb6b";
    return "#3ee0d0";
  }

  function formatDate(ts) {
    if (!ts) return "";
    const date = ts._seconds ? new Date(ts._seconds * 1000) : new Date(ts);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <p style={{ color: "#8b97a8" }}>Loading dashboard...</p>
      </div>
    );
  }

  const totalInteractions = nodes.reduce(
    (sum, n) => sum + (n.interactionCount || 0),
    0,
  );
  const avgAccuracy =
    nodes.length > 0
      ? nodes.reduce((sum, n) => sum + (n.accuracyRate || 0), 0) / nodes.length
      : 0;
  const dueForReview = drill.filter((d) => d.urgency > 0).length;

  return (
    <div className={styles.page}>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.5rem" }}>
        Dashboard{user?.displayName ? ` \u2014 ${user.displayName}` : ""}
      </h1>

      {/* Stats row */}
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{nodes.length}</span>
          <span className={styles.statLabel}>Concepts</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{totalInteractions}</span>
          <span className={styles.statLabel}>Interactions</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {Math.round(avgAccuracy * 100)}%
          </span>
          <span className={styles.statLabel}>Avg Accuracy</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{dueForReview}</span>
          <span className={styles.statLabel}>Due for Review</span>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Network Graph */}
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Concept Network</h2>
          {nodes.length > 0 ? (
            <div ref={graphRef} className={styles.graphContainer} />
          ) : (
            <p style={{ color: "#8b97a8", fontSize: "0.85rem" }}>
              No concepts yet. Start studying to build your graph.
            </p>
          )}
        </div>

        {/* Drill Queue */}
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Drill Queue</h2>
          {drill.length > 0 ? (
            <div className={styles.drillList}>
              {drill.slice(0, 10).map((item) => (
                <div key={item.conceptNode} className={styles.drillItem}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "0.25rem",
                    }}
                  >
                    <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                      {item.conceptNode.replace(/_/g, " ")}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "#8b97a8" }}>
                      {Math.round((item.accuracyRate || 0) * 100)}%
                    </span>
                  </div>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${Math.max(5, (item.accuracyRate || 0) * 100)}%`,
                        background: barColor(item.accuracyRate || 0),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#8b97a8", fontSize: "0.85rem" }}>
              No items in drill queue yet.
            </p>
          )}
        </div>

        {/* Session History */}
        <div className={`${styles.panel} ${styles.fullWidth}`}>
          <h2 className={styles.panelTitle}>Recent Activity</h2>
          {events.length > 0 ? (
            <div className={styles.eventList}>
              {events.map((evt) => (
                <div key={evt.eventId} className={styles.eventItem}>
                  <span
                    className={styles.eventType}
                    data-type={evt.eventType}
                  >
                    {evt.eventType?.replace(/_/g, " ")}
                  </span>
                  <span style={{ flex: 1, fontSize: "0.85rem" }}>
                    {evt.content?.slice(0, 80)}
                    {evt.content?.length > 80 ? "..." : ""}
                  </span>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: "#8b97a8",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatDate(evt.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#8b97a8", fontSize: "0.85rem" }}>
              No activity yet. Start asking questions or taking quizzes.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
