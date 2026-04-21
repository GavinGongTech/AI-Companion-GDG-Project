import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { EASE } from "../lib/motion";
import styles from "./AuthPages.module.css";

export function Welcome() {
  return (
    <motion.div
      className={styles.wrap}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div className={`${styles.card} ${styles.welcomeCard}`}>
        <p className={styles.hello}>Hello!</p>
        <h1 className={styles.title}>You're in</h1>
        <p className={styles.lede}>
          Open the extension side panel to start active assistant mode. Passive
          ingestion will keep your course materials synced in the background.
        </p>
        <ul className={styles.checklist}>
          <li>Side panel: capture, explain, quiz</li>
          <li>Backend: ingestion · AI · knowledge graph</li>
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
    </motion.div>
  );
}
