import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./Layout.module.css";
import { useEffect } from "react";
import { motion } from "framer-motion";

export function Layout() {
  const user = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    apiFetch("/api/v1/events/track", {
      method: "POST",
      body: JSON.stringify({
        eventType: "page_view",
        content: location.pathname,
        meta: { pathname: location.pathname, search: location.search || "" },
      }),
    }).catch(() => {});
  }, [user, location.pathname, location.search]);

  async function handleSignOut() {
    await apiFetch("/api/v1/events/track", {
      method: "POST",
      body: JSON.stringify({
        eventType: "auth_logout",
        content: "logout",
      }),
    }).catch(() => {});

    if (auth) await signOut(auth);
    navigate("/");
  }

  function navClass({ isActive }: { isActive: boolean }) {
    return `${styles.navLink} ${isActive ? styles.navActive : ""}`;
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.brand}>
          <span className={styles.brandMark} />
          <span className={styles.brandText}>Study Flow</span>
        </NavLink>
        <nav className={styles.nav} aria-label="Primary">
          <div className={styles.navIndicatorWrap}>
            <NavLink to="/download" className={navClass}>
              {({ isActive }) => (
                <>
                  Download
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-dot"
                      className={styles.navIndicator}
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          </div>

          {user ? (
            <>
              <div className={styles.navIndicatorWrap}>
                <NavLink to="/dashboard" className={navClass}>
                  {({ isActive }) => (
                    <>
                      Dashboard
                      {isActive && (
                        <motion.span
                          layoutId="nav-active-dot"
                          className={styles.navIndicator}
                          transition={{ type: "spring", stiffness: 420, damping: 36 }}
                        />
                      )}
                    </>
                  )}
                </NavLink>
              </div>
              <ThemeToggle />
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
              <div className={styles.navIndicatorWrap}>
                <NavLink to="/login" className={navClass}>
                  {({ isActive }) => (
                    <>
                      Log in
                      {isActive && (
                        <motion.span
                          layoutId="nav-active-dot"
                          className={styles.navIndicator}
                          transition={{ type: "spring", stiffness: 420, damping: 36 }}
                        />
                      )}
                    </>
                  )}
                </NavLink>
              </div>
              <ThemeToggle />
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
