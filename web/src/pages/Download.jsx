import { Link } from "react-router-dom";
import styles from "./AuthPages.module.css";

export function Download() {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Chrome · Manifest V3</p>
        <h1 className={styles.title}>Install Study Flow</h1>
        <p className={styles.lede}>
          Add the extension to capture math from any tab and open the side
          panel for structured explanations tied to your courses.
        </p>
        <div className={styles.chromeRow}>
          <button type="button" className={styles.primaryBtn} disabled>
            Add to Chrome (store link TBD)
          </button>
          <span className={styles.hint}>
            Dev: run <code className={styles.code}>npm run build --workspace=extension</code>,
            then Chrome → Extensions → Developer mode → Load unpacked → select{" "}
            <code className={styles.code}>extension/dist</code>.
          </span>
        </div>
        <p className={styles.note}>
          After install, sign in from the extension or{" "}
          <Link to="/login" className={styles.inlineLink}>
            log in on the web
          </Link>{" "}
          to connect OAuth (Canvas) and sync materials.
        </p>
        <Link to="/" className={styles.back}>
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
