import { Outlet, NavLink } from "react-router-dom";
import styles from "./Layout.module.css";

export function Layout() {
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
