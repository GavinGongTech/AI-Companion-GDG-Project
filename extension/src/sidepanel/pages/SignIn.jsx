import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Pages.module.css";

const WEB_URL = (import.meta.env.VITE_WEB_URL || "http://localhost:5173").replace(/\/+$/, "");

export function SignIn() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const autoStarted = useRef(false);

  const openWebAuth = useCallback(async (path, { auto = false } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(path, WEB_URL);
      url.searchParams.set("extensionId", chrome.runtime.id);
      url.searchParams.set("closeAfterAuth", "1");
      if (auto) {
        url.searchParams.set("auto", "1");
      }
      await chrome.tabs.create({ url: url.toString(), active: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoStarted.current) return;
    autoStarted.current = true;
    void openWebAuth("/login", { auto: true });
  }, [openWebAuth]);

  return (
    <div className={styles.center}>
      <h1 className={styles.h1}>Sign in to Study Flow</h1>
      <p className={styles.lede}>
        Checking your Study Flow website session. If you are not signed in there yet, finish sign-in on the website.
      </p>
      {error && <p className={styles.error}>{error}</p>}
      <button type="button" className={styles.primary} onClick={() => openWebAuth("/login")} disabled={loading}>
        {loading ? "Opening website..." : "Open sign-in page"}
      </button>
      <button type="button" className={styles.secondaryButton} onClick={() => openWebAuth("/signup")} disabled={loading}>
        Create account
      </button>
    </div>
  );
}
