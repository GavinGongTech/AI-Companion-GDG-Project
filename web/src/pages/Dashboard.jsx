import { useState, useEffect, useRef } from "react";
import cytoscape from "cytoscape";
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

  // Initialize cytoscape when nodes change
  useEffect(() => {
    if (!graphRef.current || nodes.length === 0) return;
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
              if (acc < 0.4) return "#ef4444";
              if (acc < 0.7) return "#f59e0b";
              return "#22c55e";
            },
            width: "data(size)",
            height: "data(size)",
            "font-size": "10px",
            color: "#111827",
            "text-valign": "bottom",
            "text-margin-y": 5,
          },
        },
      ],
      layout: { name: "cose", animate: false, padding: 30 },
      userZoomingEnabled: true,
      userPanningEnabled: true,
    });

    return () => {
      if (cyRef.current) cyRef.current.destroy();
    };
  }, [nodes]);

  function barColor(rate) {
    if (rate < 0.4) return "#ef4444";
    if (rate < 0.7) return "#f59e0b";
    return "#22c55e";
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
        <p className={styles.empty}>Loading dashboard...</p>
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
      <h1 className={styles.heading}>
        Dashboard{user?.displayName ? ` \u2014 ${user.displayName}` : ""}
      </h1>
      <p className={styles.subheading}>
        Your progress, review queue, and recent study activity in one place.
      </p>

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
        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Concept Network</h2>
          {nodes.length > 0 ? (
            <div ref={graphRef} className={styles.graphContainer} />
          ) : (
            <p className={styles.empty}>
              No concepts yet. Start studying to build your graph.
            </p>
          )}
        </div>

        <div className={styles.panel}>
          <h2 className={styles.panelTitle}>Drill Queue</h2>
          {drill.length > 0 ? (
            <div className={styles.drillList}>
              {drill.slice(0, 10).map((item) => (
                <div key={item.conceptNode} className={styles.drillItem}>
                  <div className={styles.itemRow}>
                    <span className={styles.itemName}>
                      {item.conceptNode.replace(/_/g, " ")}
                    </span>
                    <span className={styles.itemMeta}>
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
            <p className={styles.empty}>No items in drill queue yet.</p>
          )}
        </div>

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
                  <span className={styles.eventContent}>
                    {evt.content?.slice(0, 80)}
                    {evt.content?.length > 80 ? "..." : ""}
                  </span>
                  <span className={styles.eventTime}>{formatDate(evt.createdAt)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>
              No activity yet. Start asking questions or taking quizzes.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
