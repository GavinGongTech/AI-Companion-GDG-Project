import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api";
import styles from "./Pages.module.css";

export function Course() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch("/api/v1/courses")
      .then((data) => setCourses(data.courses || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
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
        <p className={styles.eyebrow}>My Course</p>
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
        <div className={styles.card}>
          <p className={styles.muted}>
            No courses yet. Ingest course materials via the web dashboard to get
            started.
          </p>
        </div>
      )}
    </div>
  );
}

function CourseCard({ course }) {
  const [details, setDetails] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    if (details) return;
    apiFetch(`/api/v1/courses/${course.courseId}`)
      .then(setDetails)
      .catch(() => {});
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

      {expanded && details && (
        <>
          {details.ingestedDocs?.length > 0 && (
            <>
              <p className={styles.cardTitle}>Ingested Documents</p>
              <ul className={styles.simpleList}>
                {details.ingestedDocs.map((doc) => (
                  <li key={doc.fileId}>
                    {doc.filename || doc.fileId}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className={styles.muted}>
            {details.chunkCount ?? 0} chunks indexed
          </p>
        </>
      )}
    </div>
  );
}
