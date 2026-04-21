import { useState } from "react";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth, hasFirebaseConfig } from "../lib/firebase";
import styles from "./Pages.module.css";

const WEB_CLIENT_ID = import.meta.env.VITE_FIREBASE_WEB_CLIENT_ID;

export function SignIn() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    if (!hasFirebaseConfig || !auth) {
      setError("Firebase is not configured. Set VITE_FIREBASE_* environment variables.");
      return;
    }
    if (!WEB_CLIENT_ID) {
      setError("VITE_FIREBASE_WEB_CLIENT_ID is not set in extension/.env");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const redirectUrl = chrome.identity.getRedirectURL();
      const authUrl =
        "https://accounts.google.com/o/oauth2/auth" +
        `?client_id=${encodeURIComponent(WEB_CLIENT_ID)}` +
        "&response_type=token" +
        `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
        "&scope=email%20profile";

      const responseUrl = await new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (url) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(url);
        });
      });

      const params = new URLSearchParams(new URL(responseUrl).hash.slice(1));
      const accessToken = params.get("access_token");
      if (!accessToken) throw new Error("No access token in Google response.");

      const credential = GoogleAuthProvider.credential(null, accessToken);
      await signInWithCredential(auth, credential);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.center}>
      <h1 className={styles.h1}>Sign in to Study Flow</h1>
      <p className={styles.lede}>Connect your Google account to get started.</p>
      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.primary} onClick={handleGoogleSignIn} disabled={loading}>
        {loading ? "Signing in..." : "Sign in with Google"}
      </button>
    </div>
  );
}
