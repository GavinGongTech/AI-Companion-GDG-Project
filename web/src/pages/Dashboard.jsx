import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";
import { sendAuthToExtension } from "../lib/extensionBridge";
import styles from "./Dashboard.module.css";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");

export default function Dashboard() {
  const user = useAuth();
  const [searchParams] = useSearchParams();
  const extensionId = searchParams.get("extensionId") || "";
  const graphRef = useRef(null);
  const cyRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [drill, setDrill] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [ingestTab, setIngestTab] = useState("file");
  const [ingestCourse, setIngestCourse] = useState("");
  const [ingestFile, setIngestFile] = useState(null);
  const [ingestText, setIngestText] = useState("");
  const [ingestStatus, setIngestStatus] = useState(null);
  const [ingestError, setIngestError] = useState(null);
  const [extensionStatus, setExtensionStatus] = useState("");
  const [connectingExtension, setConnectingExtension] = useState(false);

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

  async function handleIngest() {
    setIngestStatus("loading");
    setIngestError(null);
    try {
      if (ingestTab === "file") {
        const token = await user?.getIdToken?.();
        const fd = new FormData();
        fd.append("file", ingestFile);
        fd.append("courseId", ingestCourse);
        const res = await fetch(`${API_URL}/api/v1/ingest/upload`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || res.statusText);
        }
      } else {
        await apiFetch("/api/v1/ingest/text", {
          method: "POST",
          body: JSON.stringify({
            courseId: ingestCourse,
            rawContent: ingestText,
            courseName: ingestCourse,
          }),
        });
      }
      setIngestStatus("success");
    } catch (err) {
      setIngestStatus("error");
      setIngestError(err.message || "Ingestion failed.");
    }
  }

  async function handleConnectExtension() {
    setConnectingExtension(true);
    setExtensionStatus("");
    try {
      const result = await sendAuthToExtension(extensionId, {
        user,
      });
      if (!result.ok) {
        setExtensionStatus(result.error);
        return;
      }
      setExtensionStatus("Extension connected. You can return to Study Flow.");
    } catch (err) {
      setExtensionStatus(err?.message || "Could not connect the extension.");
    } finally {
      setConnectingExtension(false);
    }
  }

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

      <div className={styles.extensionConnect}>
        <div>
          <h2 className={styles.extensionTitle}>Chrome extension</h2>
          <p className={styles.extensionText}>
            Connect the installed extension to this signed-in web session.
          </p>
        </div>
        <button
          type="button"
          className={styles.extensionButton}
          onClick={handleConnectExtension}
          disabled={connectingExtension || !user}
        >
          {connectingExtension ? "Connecting..." : "Connect to extension"}
        </button>
      </div>
      {extensionStatus && (
        <p
          className={
            extensionStatus.startsWith("Extension connected")
              ? styles.extensionSuccess
              : styles.extensionError
          }
        >
          {extensionStatus}
        </p>
      )}

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
        <div className={`${styles.panel} ${styles.fullWidth}`}>
          <h2 className={styles.panelTitle}>Ingest Materials</h2>
          <div className={styles.ingestForm}>
            <input
              className={styles.ingestInput}
              placeholder="Course name (e.g. Calculus I)"
              value={ingestCourse}
              onChange={(e) => setIngestCourse(e.target.value)}
            />
            <div className={styles.tabRow}>
              <button
                className={`${styles.tabBtn} ${ingestTab === "file" ? styles.tabBtnActive : ""}`}
                onClick={() => { setIngestTab("file"); setIngestStatus(null); setIngestError(null); }}
              >
                Upload File
              </button>
              <button
                className={`${styles.tabBtn} ${ingestTab === "text" ? styles.tabBtnActive : ""}`}
                onClick={() => { setIngestTab("text"); setIngestStatus(null); setIngestError(null); }}
              >
                Paste Text
              </button>
            </div>
            {ingestTab === "file" && (
              <input
                className={styles.ingestInput}
                type="file"
                accept=".pdf,.txt,.md"
                onChange={(e) => setIngestFile(e.target.files[0])}
              />
            )}
            {ingestTab === "text" && (
              <textarea
                className={styles.ingestTextarea}
                rows={5}
                placeholder="Paste course notes, syllabus, or lecture content..."
                value={ingestText}
                onChange={(e) => setIngestText(e.target.value)}
              />
            )}
            <button
              className={styles.ingestBtn}
              onClick={handleIngest}
              disabled={
                ingestStatus === "loading" ||
                !ingestCourse.trim() ||
                (ingestTab === "file" ? !ingestFile : !ingestText.trim())
              }
            >
              {ingestStatus === "loading" ? "Ingesting..." : "Ingest"}
            </button>
            {ingestStatus === "success" && (
              <p className={styles.ingestSuccess}>Ingested successfully.</p>
            )}
            {ingestStatus === "error" && (
              <p className={styles.ingestError}>{ingestError}</p>
            )}
          </div>
        </div>

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
