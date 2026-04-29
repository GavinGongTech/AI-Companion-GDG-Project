import { useCallback, useState } from "react";
import styles from "./Pages.module.css";

const WEB_URL = (import.meta.env.VITE_WEB_URL || "http://localhost:5173").replace(/\/+$/, "");
const WEB_ORIGIN = new URL(WEB_URL).origin;

function tabsQuery(queryInfo) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query(queryInfo, (tabs) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(tabs || []);
    });
  });
}

function tabsUpdate(tabId, updateProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, updateProperties, (tab) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(tab);
    });
  });
}

function isWebTab(tab) {
  try {
    return new URL(tab?.url || "").origin === WEB_ORIGIN;
  } catch {
    return false;
  }
}

function isNavigableTab(tab) {
  try {
    const protocol = new URL(tab?.url || "").protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function SignIn() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const openWebAuth = useCallback(async (path) => {
    setLoading(true);
    setError(null);
    try {
      await chrome.storage.local.remove("extensionSignedOut");
      const url = new URL(path, WEB_URL);
      url.searchParams.set("extensionId", chrome.runtime.id);
      const targetUrl = url.toString();

      const currentWindowTabs = await tabsQuery({ currentWindow: true });
      const existingWebTab = currentWindowTabs.find(isWebTab);
      if (existingWebTab?.id) {
        await tabsUpdate(existingWebTab.id, { url: targetUrl, active: true });
        return;
      }

      const [activeTab] = await tabsQuery({ active: true, currentWindow: true });
      if (activeTab?.id && isNavigableTab(activeTab)) {
        await tabsUpdate(activeTab.id, { url: targetUrl, active: true });
        return;
      }

      throw new Error("Open a normal web tab first, then try again.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

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
