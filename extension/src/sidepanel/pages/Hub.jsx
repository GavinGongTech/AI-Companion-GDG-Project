import { Link } from "react-router-dom";
import styles from "./Pages.module.css";

const quickActions = [
  {
    title: "Ask a Question",
    description: "Paste a problem or concept and get a clear explanation.",
    button: "Go to Ask",
    to: "/ask",
  },
  {
    title: "Take a Quiz",
    description: "Practice weak areas with short personalized questions.",
    button: "Start Quiz",
    to: "/quiz",
  },
  {
    title: "View Progress",
    description: "Track concepts, weak spots, and study momentum.",
    button: "Open Graph",
    to: "/graph",
  },
];

const topics = [
  "Limits & continuity",
  "Implicit differentiation",
  "Series convergence",
];

export function Hub() {
  return (
    <div className={styles.stack}>
      <p className={styles.eyebrow}>study flow</p>
      <h1 className={styles.h1}>Your study hub</h1>
      <p className={styles.lede}>
        Get quick help, practice what you missed, and keep track of your progress.
      </p>

      <section className={styles.section}>
        <h2 className={styles.h2}>Recommended topics</h2>
        <ul className={styles.list}>
          {topics.map((topic) => (
            <li key={topic} className={styles.listItem}>
              {topic}
            </li>
          ))}
        </ul>
      </section>

      <div className={styles.cards}>
        {quickActions.map((action) => (
          <div key={action.title} className={styles.card}>
            <p className={styles.cardTitle}>{action.title}</p>
            <p className={styles.cardBody}>{action.description}</p>
            <div style={{ marginTop: "0.75rem" }}>
              <Link className={styles.primary} to={action.to}>
                {action.button}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}