import { useState } from "react";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth, hasFirebaseConfig } from "../lib/firebase";
import styles from "./Pages.module.css";

export function SignIn() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    if (!hasFirebaseConfig || !auth) {
      setError("Firebase is not configured. Set VITE_FIREBASE_* environment variables.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Use chrome.identity to get Google OAuth token
      const token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (tok) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(tok);
        });
      });
      const credential = GoogleAuthProvider.credential(null, token);
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
