import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import styles from "./Layout.module.css";

export function Layout() {
  const user = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut(auth);
    navigate("/");
  }

  return (
    <div className={styles.shell}>
      <div className={styles.bgGrid} aria-hidden />
      <div className={styles.bgGlow} aria-hidden />
      <header className={styles.header}>
        <NavLink to="/" className={styles.brand}>
          <span className={styles.brandMark} />
          <span className={styles.brandText}>Study Flow</span>
        </NavLink>
        <nav className={styles.nav} aria-label="Primary">
          <NavLink
            to="/download"
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navActive : ""}`
            }
          >
            Download
          </NavLink>
          {user ? (
            <>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.navActive : ""}`
                }
              >
                Dashboard
              </NavLink>
              <button
                type="button"
                className={styles.cta}
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  `${styles.navLink} ${isActive ? styles.navActive : ""}`
                }
              >
                Log in
              </NavLink>
              <NavLink to="/signup" className={styles.cta}>
                Sign up
              </NavLink>
            </>
          )}
        </nav>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <p className={styles.footerNote}>
          Built for students — contextual math help, course-aware RAG, and a
          persistent misconception graph.
        </p>
      </footer>
    </div>
  );
}
