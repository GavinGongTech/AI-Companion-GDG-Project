import { Link } from "react-router-dom";
import styles from "./Pages.module.css";

const topics = [
  { id: "1", label: "Topic 1 — limits & continuity" },
  { id: "2", label: "Topic 2 — implicit differentiation" },
  { id: "3", label: "Topic 3 — series convergence" },
];

export function Hub() {
  return (
    <div className={styles.stack}>
      <p className={styles.eyebrow}>pick …</p>
      <h1 className={styles.h1}>Hub</h1>
      <p className={styles.lede}>
        Recommended from your misconception graph (static preview).
      </p>

      <section className={styles.section}>
        <h2 className={styles.h2}>Recommended topics</h2>
        <ul className={styles.list}>
          {topics.map((t) => (
            <li key={t.id} className={styles.listItem}>
              {t.label}
            </li>
          ))}
        </ul>
      </section>

      <div className={styles.row}>
        <Link className={styles.primary} to="/ask">
          Ask (capture)
        </Link>
        <Link className={styles.secondary} to="/quiz">
          Quiz
        </Link>
      </div>
    </div>
  );
}
