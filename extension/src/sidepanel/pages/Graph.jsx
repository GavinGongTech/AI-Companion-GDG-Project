import styles from "./Pages.module.css";

const concepts = [
  { name: "Chain Rule", mastery: 25 },
  { name: "Implicit Diff", mastery: 48 },
  { name: "Series", mastery: 72 },
  { name: "Integration", mastery: 84 },
];

export function Graph() {
  return (
    <div className={styles.stack}>
      <div className={styles.section}>
        <p className={styles.eyebrow}>My Graph</p>
        <h2 className={styles.h1}>Concept mastery</h2>
        <p className={styles.text}>Compact mastery view for your current course.</p>
      </div>

      <div className={styles.card}>
        {concepts.map((concept) => (
          <div key={concept.name} className={styles.graphRow}>
            <div className={styles.rowBetween}>
              <span className={styles.text}>{concept.name}</span>
              <span className={styles.muted}>{concept.mastery}%</span>
            </div>
            <div className={styles.barTrack}>
              <div
                className={
                  concept.mastery < 40
                    ? `${styles.barFill} ${styles.low}`
                    : concept.mastery < 70
                    ? `${styles.barFill} ${styles.mid}`
                    : `${styles.barFill} ${styles.high}`
                }
                style={{ width: `${concept.mastery}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}