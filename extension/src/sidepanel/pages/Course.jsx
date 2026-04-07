import styles from "./Pages.module.css";

export function Course() {
  return (
    <div className={styles.stack}>
      <div className={styles.section}>
        <p className={styles.eyebrow}>My Course</p>
        <h2 className={styles.h1}>Current course info</h2>
        <p className={styles.text}>
          Files, deadlines, and concepts that need attention.
        </p>
      </div>

      <div className={styles.card}>
        <p className={styles.cardTitle}>Ingested Documents</p>
        <ul className={styles.simpleList}>
          <li>Lecture 8 Notes.pdf</li>
          <li>Homework 5 Solutions.html</li>
          <li>Midterm Review.pdf</li>
        </ul>
      </div>

      <div className={styles.card}>
        <p className={styles.cardTitle}>Upcoming Deadlines</p>
        <ul className={styles.simpleList}>
          <li>Homework 6 — Tomorrow</li>
          <li>Quiz 3 — In 3 days</li>
        </ul>
      </div>

      <div className={styles.card}>
        <p className={styles.cardTitle}>Urgent Concepts</p>
        <div className={styles.topicList}>
          <div className={styles.topicItem}>chain rule</div>
          <div className={styles.topicItem}>integration by parts</div>
          <div className={styles.topicItem}>convergence tests</div>
        </div>
      </div>
    </div>
  );
}