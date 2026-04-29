import { useCallback, useState } from "react";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth, hasFirebaseConfig } from "../lib/firebase";
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

  function showError(err) {
    setError(err instanceof Error ? err.message : "Something went wrong.");
  }

  async function handleGoogleSignIn() {
    if (!hasFirebaseConfig || !auth) {
      setError("Firebase is not configured correctly.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Use Native Chrome Identity API
      const token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(token);
          }
        });
      });

      if (!token) throw new Error("Failed to get Google Auth Token.");

      const credential = GoogleAuthProvider.credential(null, token);
      await signInWithCredential(auth, credential);
    } catch (err) {
      showError(err);
      // If there's a cached bad token, remove it so the user can try again
      if (err instanceof Error && (err.message.includes("OAuth2") || err.message.includes("token"))) {
        chrome.identity.clearAllCachedAuthTokens(() => {});
      }
    } finally {
      setLoading(false);
    }
  }

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
      showError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className={styles.center}>
      <h1 className={styles.h1}>Sign in to Study Flow</h1>
      <p className={styles.lede}>Connect your Google account or use your website session.</p>
      {error && <p className={styles.error}>{error}</p>}
      <button type="button" className={styles.primary} onClick={handleGoogleSignIn} disabled={loading}>
        {loading ? "Signing in..." : "Sign in with Google"}
      </button>
      <button
        type="button"
        className={styles.secondaryButton}
        onClick={() => openWebAuth("/login")}
        disabled={loading}
      >
        {loading ? "Opening..." : "Login through webpage"}
      </button>
    </div>
  );
}
