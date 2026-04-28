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
      if (!auto) {
        await chrome.storage.local.remove("extensionSignedOut");
      }
      const url = new URL(path, WEB_URL);
      url.searchParams.set("extensionId", chrome.runtime.id);
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
    chrome.storage.local.get(["extensionSignedOut"], (data) => {
      if (data?.extensionSignedOut) return;
      void openWebAuth("/login", { auto: true });
    });
  }, [openWebAuth]);

  return (
    <div className={styles.center}>
      <h1 className={styles.h1}>Sign in to Study Flow</h1>
      <p className={styles.lede}>
        Log in on the Study Flow website, then connect the extension from your dashboard.
      </p>
      {error && <p className={styles.error}>{error}</p>}
      <button type="button" className={styles.primary} onClick={() => openWebAuth("/login")} disabled={loading}>
        {loading ? "Opening website..." : "Login through webpage"}
      </button>
    </div>
  );
}
