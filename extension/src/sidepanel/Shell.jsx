import { NavLink } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, hasFirebaseConfig } from "./lib/firebase";
import { useAuth } from "./lib/auth";
import styles from "./Shell.module.css";

export function Shell({ children }) {
  const user = useAuth();
  const firstName =
    user?.displayName?.trim?.().split(/\s+/)[0] ||
    user?.email?.split("@")[0] ||
    "there";
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
    chrome.storage.session.remove(["firebaseIdToken", "authUser"]);
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

      <section className={styles.hello} aria-label="Signed-in user">
        <p className={styles.helloText}>Hello, {firstName}</p>
        {user?.email && <p className={styles.helloMeta}>{user.email}</p>}
      </section>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
