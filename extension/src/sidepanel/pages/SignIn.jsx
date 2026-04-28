import { useState } from "react";
import styles from "./Pages.module.css";

const WEB_URL = (import.meta.env.VITE_WEB_URL || "http://localhost:5173").replace(/\/+$/, "");

export function SignIn() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function openWebAuth(path) {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(path, WEB_URL);
      url.searchParams.set("extensionId", chrome.runtime.id);
      await chrome.tabs.create({ url: url.toString(), active: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.center}>
      <h1 className={styles.h1}>Sign in to Study Flow</h1>
      <p className={styles.lede}>Continue on the Study Flow website to connect your account.</p>
      {error && <p className={styles.error}>{error}</p>}
      <button type="button" className={styles.primary} onClick={() => openWebAuth("/login")} disabled={loading}>
        {loading ? "Opening website..." : "Continue on website"}
      </button>
      <button type="button" className={styles.secondaryButton} onClick={() => openWebAuth("/signup")} disabled={loading}>
        Create account
      </button>
    </div>
  );
}
