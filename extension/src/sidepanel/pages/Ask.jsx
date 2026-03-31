import styles from "./Pages.module.css";

// TODO: wire form submission to POST /api/v1/explain
// Expected request:  { question: string }
// Expected response: { question, solution, mainConcept, relevantLecture }

export function Ask() {
  return (
    <div className={styles.stack}>
      <p className={styles.eyebrow}>capture …</p>
      <h1 className={styles.h1}>Ask</h1>
      <p className={styles.lede}>
        Type or paste a problem. Study Flow will explain it using your course
        materials.
      </p>

      {/* TODO: controlled textarea + submit button */}
      <form className={styles.form}>
        <label className={styles.label} htmlFor="question">
          Your question
        </label>
        <textarea
          id="question"
          className={styles.textarea}
          placeholder="e.g. Why does L'Hôpital's rule work?"
          rows={4}
        />
        <button type="submit" className={styles.primary}>
          Explain
        </button>
      </form>

      {/* TODO: render response card when answer arrives */}
    </div>
  );
}
