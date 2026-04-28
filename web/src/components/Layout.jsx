import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { apiFetch } from "../lib/api";
import { sendAuthToExtension } from "../lib/extensionBridge";
import styles from "./Layout.module.css";
import { useEffect, useState } from "react";

export function Layout() {
  const user = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [extensionStatus, setExtensionStatus] = useState("");
  const [connectingExtension, setConnectingExtension] = useState(false);

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

    await signOut(auth);
    navigate("/");
  }

  async function handleConnectExtension() {
    setConnectingExtension(true);
    setExtensionStatus("");
    try {
      const result = await sendAuthToExtension("", { user });
      if (!result.ok) {
        setExtensionStatus(result.error);
        return;
      }
      setExtensionStatus("Extension connected");
    } catch (err) {
      setExtensionStatus(err?.message || "Could not connect extension.");
    } finally {
      setConnectingExtension(false);
    }
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
                className={styles.extensionBtn}
                onClick={handleConnectExtension}
                disabled={connectingExtension}
                title={extensionStatus || "Sign in to the installed Study Flow extension with this web session."}
              >
                {connectingExtension ? "Connecting..." : "Connect extension"}
              </button>
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
      {user && extensionStatus && (
        <div
          className={
            extensionStatus === "Extension connected"
              ? styles.extensionNotice
              : `${styles.extensionNotice} ${styles.extensionError}`
          }
          role="status"
        >
          {extensionStatus}
        </div>
      )}
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
