import { useState, useEffect } from "react";
import {
  courseDetailsResponseSchema,
  coursesResponseSchema,
  type CourseDetailsResponse,
  type CoursesResponse,
} from "@study-flow/shared";
import { apiFetchParsed } from "../../lib/api";
import { getErrorMessage } from "../../lib/error";
import styles from "./Pages.module.css";

type CourseSummary = CoursesResponse["courses"][number];

export function Course() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = () => {
    setLoading(true);
    setError(null);
    void apiFetchParsed("/api/v1/courses", coursesResponseSchema)
      .then((data) => setCourses(data.courses || []))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  if (loading && courses.length === 0) {
    return (
      <div className={styles.center}>
        <div className={styles.spinner} aria-hidden />
        <p className={styles.muted}>Loading courses...</p>
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <div className={styles.section}>
        <div className={styles.rowBetween}>
          <p className={styles.eyebrow}>My Course</p>
          <button
            type="button"
            className={styles.linkButton}
            onClick={fetchCourses}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <h2 className={styles.h1}>Current course info</h2>
        <p className={styles.text}>
          Files, deadlines, and concepts that need attention.
        </p>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {courses.length > 0 ? (
        courses.map((course) => (
          <CourseCard key={course.courseId} course={course} />
        ))
      ) : (
        !error && !loading && (
          <div className={styles.card}>
            <p className={styles.muted}>
              No courses yet. Ingest course materials via the web dashboard or
              extension to get started.
            </p>
          </div>
        )
      )}
    </div>
  );
}

interface CourseCardProps {
  course: CourseSummary;
}

function CourseCard({ course }: CourseCardProps) {
  const [details, setDetails] = useState<CourseDetailsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    if (details) return;
    setLoading(true);
    setError(null);
    void apiFetchParsed(
      `/api/v1/courses/${course.courseId}`,
      courseDetailsResponseSchema,
    )
      .then(setDetails)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [expanded, course.courseId, details]);

  return (
    <div className={styles.card}>
      <div className={styles.rowBetween}>
        <p className={styles.cardTitle}>
          {course.courseName || course.courseId}
        </p>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide" : "Details"}
        </button>
      </div>

      {expanded && (
        <div className={styles.stack} style={{ gap: "12px", marginTop: "4px" }}>
          {loading && (
            <div className={styles.feedbackBusy}>
              <div className={styles.feedbackBusyDot} />
              Loading details...
            </div>
          )}
          {error && <p className={styles.error}>{error}</p>}
          {details && (
            <>
              {details.ingestedDocs?.length > 0 && (
                <div>
                  <p className={styles.cardTitle} style={{ marginBottom: "8px" }}>
                    Ingested Documents
                  </p>
                  <ul className={styles.simpleList}>
                    {details.ingestedDocs.map((doc) => (
                      <li key={doc.fileId}>{doc.filename || doc.fileId}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className={styles.muted}>
                {details.chunkCount ?? 0} chunks indexed
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
