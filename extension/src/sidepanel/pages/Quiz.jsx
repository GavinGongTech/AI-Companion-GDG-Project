import styles from "./Pages.module.css";

// TODO: wire to POST /api/v1/quiz
// Expected request:  { topic?: string, courseId?: string }
// Expected response: { question, options: string[], answer: number, explanation }

export function Quiz() {
  return (
    <div className={styles.stack}>
      <p className={styles.eyebrow}>test yourself …</p>
      <h1 className={styles.h1}>Quiz</h1>
      <p className={styles.lede}>
        Generate questions from your course materials and track what you know.
      </p>

      {/* TODO: topic selector → fetch quiz → render options → submit → show score */}
      <div className={styles.row}>
        <button className={styles.primary}>
          Generate question
        </button>
      </div>

      {/* TODO: render question card */}
      {/* <div className={styles.card}>
        <p className={styles.cardTitle}>Question</p>
        <ul className={styles.options}>
          {options.map((opt, i) => (
            <li key={i} className={styles.option}>{opt}</li>
          ))}
        </ul>
      </div> */}

      {/* TODO: render results */}
      {/* <div className={styles.results}>
        <span className={styles.score}>Score: 0 / 0</span>
      </div> */}
    </div>
  );
}
