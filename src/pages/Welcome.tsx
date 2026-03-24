import { Link } from "react-router-dom";
import styles from "./AuthPages.module.css";

export function Welcome() {
  return (
    <div className={styles.wrap}>
      <div className={`${styles.card} ${styles.welcomeCard}`}>
        <p className={styles.hello}>Hello!</p>
        <h1 className={styles.title}>You’re in</h1>
        <p className={styles.lede}>
          Open the extension side panel to start active assistant mode. Passive
          ingestion will keep your course materials synced in the background.
        </p>
        <ul className={styles.checklist}>
          <li>Side panel: capture, explain, quiz</li>
          <li>Backend: ingestion · AI · pgvector</li>
          <li>Misconception graph updates every session</li>
        </ul>
        <div className={styles.welcomeActions}>
          <Link to="/download" className={styles.primaryBtnWide}>
            Get the extension
          </Link>
          <Link to="/" className={styles.secondaryBtnWide}>
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
