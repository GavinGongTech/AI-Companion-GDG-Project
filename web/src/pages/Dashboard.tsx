import { useEffect, useRef, useState } from "react";
import type { ApiFetchOptions } from "@study-flow/client";
import type {
  DrillQueueResponse,
  EventRecord,
  EventsResponse,
  GraphNode,
  GraphResponse,
} from "@study-flow/shared";
import {
  fetchDrillQueue,
  fetchGraph,
  fetchRecentEvents,
  fetchGamification,
  ingestTextContent,
  uploadIngestFile,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import styles from "./Dashboard.module.css";

const EMPTY_GRAPH: GraphResponse = { nodes: [] };
const EMPTY_DRILL: DrillQueueResponse = { queue: [] };
const EMPTY_EVENTS: EventsResponse = { events: [], count: 0 };
const EMPTY_GAMIFICATION = { xp: 0, level: 1, xpIntoLevel: 0, nextLevelXP: 100, streak: 0, achievements: [] };

interface CytoscapeInstance {
  destroy(): void;
}

export interface DashboardInitialData {
  nodes: GraphNode[];
  drill: DrillQueueResponse["queue"];
  events: EventRecord[];
  gamification: any;
}

interface DashboardProps {
  initialData?: DashboardInitialData;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ingestion failed.";
}

function barColor(rate: number): string {
  if (rate < 0.4) {
    return "#ef4444";
  }

  if (rate < 0.7) {
    return "#f59e0b";
  }

  return "#22c55e";
}

function formatDate(value: EventRecord["createdAt"]): string {
  if (!value) {
    return "";
  }

  const date =
    typeof value === "object" && !(value instanceof Date) && "_seconds" in value
      ? new Date(value._seconds * 1000)
      : new Date(value);

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Dashboard({
  initialData,
}: DashboardProps = {}) {
  const user = useAuth();
  const graphRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<CytoscapeInstance | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>(() => initialData?.nodes ?? []);
  const [drill, setDrill] = useState<DrillQueueResponse["queue"]>(
    () => initialData?.drill ?? [],
  );
  const [events, setEvents] = useState<EventRecord[]>(
    () => initialData?.events ?? [],
  );
  const [gamification, setGamification] = useState<any>(
    () => initialData?.gamification ?? EMPTY_GAMIFICATION,
  );
  const [loading, setLoading] = useState(() => !initialData);

  const [ingestTab, setIngestTab] = useState<"file" | "text">("file");
  const [ingestCourse, setIngestCourse] = useState("");
  const [ingestFile, setIngestFile] = useState<File | null>(null);
  const [ingestText, setIngestText] = useState("");
  const [ingestStatus, setIngestStatus] = useState<
    "loading" | "success" | "error" | null
  >(null);
  const [ingestError, setIngestError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      return;
    }

    const controller = new AbortController();
    const options: ApiFetchOptions = { signal: controller.signal };

    Promise.all([
      fetchGraph(options).catch(() => EMPTY_GRAPH),
      fetchDrillQueue(options).catch(() => EMPTY_DRILL),
      fetchRecentEvents(20, options).catch(() => EMPTY_EVENTS),
      fetchGamification(options).catch(() => EMPTY_GAMIFICATION),
    ]).then(([graphData, drillData, eventsData, gamificationData]) => {
      if (controller.signal.aborted) {
        return;
      }

      setNodes(graphData.nodes);
      setDrill(drillData.queue);
      setEvents(eventsData.events);
      setGamification(gamificationData);
      setLoading(false);
    });

    return () => controller.abort();
  }, [initialData]);

  useEffect(() => {
    if (!graphRef.current || nodes.length === 0) {
      return;
    }

    let cancelled = false;

    import("cytoscape").then(({ default: cytoscape }) => {
      if (cancelled || !graphRef.current) {
        return;
      }

      if (cyRef.current) {
        cyRef.current.destroy();
      }

      const elements = nodes.map((node) => ({
        data: {
          id: node.conceptNode,
          label: node.conceptNode.replace(/_/g, " "),
          accuracy: node.accuracyRate || 0,
          size: Math.max(20, Math.min(60, (node.interactionCount || 1) * 5)),
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
              "background-color": (element: { data(key: string): number }) => {
                const accuracy = element.data("accuracy");
                if (accuracy < 0.4) {
                  return "#f07178";
                }
                if (accuracy < 0.7) {
                  return "#ffcb6b";
                }
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
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, [nodes]);

  async function handleIngest(): Promise<void> {
    setIngestStatus("loading");
    setIngestError(null);

    try {
      if (ingestTab === "file") {
        if (!ingestFile) {
          throw new Error("Please choose a file to upload.");
        }

        await uploadIngestFile(ingestFile, ingestCourse);
      } else {
        await ingestTextContent({
          courseId: ingestCourse,
          rawContent: ingestText,
          filename: "dashboard-pasted-content",
          sourcePlatform: "dashboard",
        });
      }

      setIngestStatus("success");
    } catch (caughtError) {
      setIngestStatus("error");
      setIngestError(getErrorMessage(caughtError));
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>Loading dashboard...</p>
      </div>
    );
  }

  const totalInteractions = nodes.reduce(
    (sum, node) => sum + (node.interactionCount || 0),
    0,
  );
  const avgAccuracy =
    nodes.length > 0
      ? nodes.reduce((sum, node) => sum + (node.accuracyRate || 0), 0) /
        nodes.length
      : 0;

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
          <span className={styles.statValue}>{gamification.streak} 🔥</span>
          <span className={styles.statLabel}>Day Streak</span>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={`${styles.panel} ${styles.fullWidth}`}>
          <h2 className={styles.panelTitle}>Your Progress</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <span style={{ fontWeight: 600 }}>Level {gamification.level}</span>
                <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                  {gamification.xpIntoLevel} / {gamification.nextLevelXP} XP
                </span>
              </div>
              <div className={styles.barTrack} style={{ height: "12px", borderRadius: "6px" }}>
                <div
                  className={styles.barFill}
                  style={{
                    width: `${Math.max(2, (gamification.xpIntoLevel / gamification.nextLevelXP) * 100)}%`,
                    background: "var(--primary)",
                  }}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {gamification.achievements.map((a: any) => (
                <div 
                  key={a.id} 
                  title={`${a.name}: ${a.description}`}
                  style={{ 
                    fontSize: "2rem", 
                    opacity: a.unlocked ? 1 : 0.2,
                    filter: a.unlocked ? "none" : "grayscale(100%)",
                    transition: "opacity 0.2s"
                  }}
                >
                  {a.icon}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`${styles.panel} ${styles.fullWidth}`}>
          <h2 className={styles.panelTitle}>Ingest Materials</h2>
          <div className={styles.ingestForm}>
            <input
              className={styles.ingestInput}
              placeholder="Course name (e.g. Calculus I)"
              value={ingestCourse}
              onChange={(event) => setIngestCourse(event.target.value)}
            />
            <div className={styles.tabRow}>
              <button
                className={`${styles.tabBtn} ${ingestTab === "file" ? styles.tabBtnActive : ""}`}
                onClick={() => {
                  setIngestTab("file");
                  setIngestStatus(null);
                  setIngestError(null);
                }}
              >
                Upload File
              </button>
              <button
                className={`${styles.tabBtn} ${ingestTab === "text" ? styles.tabBtnActive : ""}`}
                onClick={() => {
                  setIngestTab("text");
                  setIngestStatus(null);
                  setIngestError(null);
                }}
              >
                Paste Text
              </button>
            </div>
            {ingestTab === "file" && (
              <input
                className={styles.ingestInput}
                type="file"
                accept=".pdf,.txt,.md"
                onChange={(event) => setIngestFile(event.target.files?.[0] ?? null)}
              />
            )}
            {ingestTab === "text" && (
              <textarea
                className={styles.ingestTextarea}
                rows={5}
                placeholder="Paste course notes, syllabus, or lecture content..."
                value={ingestText}
                onChange={(event) => setIngestText(event.target.value)}
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
              {events.map((event) => (
                <div key={event.eventId} className={styles.eventItem}>
                  <span
                    className={styles.eventType}
                    data-type={event.eventType}
                  >
                    {event.eventType.replace(/_/g, " ")}
                  </span>
                  <span className={styles.eventContent}>
                    {event.content?.slice(0, 80)}
                    {event.content && event.content.length > 80 ? "..." : ""}
                  </span>
                  <span className={styles.eventTime}>
                    {formatDate(event.createdAt)}
                  </span>
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
