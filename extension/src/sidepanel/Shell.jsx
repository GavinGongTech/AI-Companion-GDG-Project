import { NavLink } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, hasFirebaseConfig } from "./lib/firebase";
import styles from "./Shell.module.css";

export function Shell({ children }) {
  const tabClass = ({ isActive }) =>
    isActive ? `${styles.tab} ${styles.active}` : styles.tab;

  async function handleSignOut() {
    try {
      if (hasFirebaseConfig && auth) {
        await signOut(auth);
      }
    } catch {
      /* still clear session storage below */
    }
    chrome.storage.session.remove("firebaseIdToken");
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>AI Companion</p>
          <h1 className={styles.title}>Study Flow</h1>
        </div>
        <button
          type="button"
          className={styles.signOut}
          title="Sign out of Study Flow on this browser (Firebase session cleared)."
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </header>

      <nav className={styles.nav}>
        <NavLink to="/home" className={tabClass} title="Shortcuts to Ask and Quiz modes.">
          Home
        </NavLink>
        <NavLink to="/graph" className={tabClass} title="View your concept practice graph from the server.">
          My Graph
        </NavLink>
        <NavLink to="/course" className={tabClass} title="Courses and ingested materials from your account.">
          My Course
        </NavLink>
      </nav>

      <main className={styles.main}>{children}</main>
    </div>
  );
}