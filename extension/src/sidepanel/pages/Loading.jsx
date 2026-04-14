import styles from "./Pages.module.css";

export function Loading() {
  return (
    <div className={styles.center}>
      <div className={styles.spinner} aria-hidden />
      <p className={styles.muted}>loading...</p>
    </div>
  );
}
