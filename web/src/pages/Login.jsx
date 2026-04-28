import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth, hasFirebaseConfig } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import styles from "./AuthPages.module.css";
import { apiFetch } from "../lib/api";
import { getExtensionIdFromSearch } from "../lib/extensionBridge";

const googleProvider = new GoogleAuthProvider();

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUser = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const extensionId = getExtensionIdFromSearch(searchParams.toString());
  const extensionSearch = extensionId ? `?extensionId=${encodeURIComponent(extensionId)}` : "";

  useEffect(() => {
    if (extensionId && currentUser) {
      navigate(`/dashboard${extensionSearch}`, { replace: true });
    }
  }, [currentUser, extensionId, extensionSearch, navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    if (!hasFirebaseConfig || !auth) {
      setError("Firebase is not configured yet. Add web/.env.local to test sign-in.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      const token = await user.getIdToken();
      apiFetch("/api/v1/events/track", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          eventType: "auth_login",
          content: "login",
          meta: { provider: "password" },
        }),
      }).catch(() => {});
      navigate(extensionId ? `/dashboard${extensionSearch}` : "/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleSignIn() {
    if (!hasFirebaseConfig || !auth) {
      setError("Firebase is not configured yet. Add web/.env.local to test Google sign-in.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { user } = await signInWithPopup(auth, googleProvider);
      const token = await user.getIdToken();
      apiFetch("/api/v1/events/track", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          eventType: "auth_login",
          content: "login",
          meta: { provider: "google" },
        }),
      }).catch(() => {});
      navigate(extensionId ? `/dashboard${extensionSearch}` : "/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Welcome back</p>
        <h1 className={styles.title}>Log in</h1>
        <p className={styles.lede}>
          {extensionId
            ? "Sign in here and we’ll connect your website session back to the extension."
            : "Sign in with your email or Google account to continue studying."}
        </p>
        {error && <p className={styles.error}>{error}</p>}
        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input
              className={styles.input}
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Password</span>
            <input
              className={styles.input}
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            className={styles.primaryBtnWide}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Continue"}
          </button>
        </form>
        <div className={styles.divider}>
          <span className={styles.dividerText}>or</span>
        </div>
        <button
          type="button"
          className={styles.secondaryBtnWide}
          onClick={onGoogleSignIn}
          disabled={loading}
        >
          Continue with Google
        </button>
        <p className={styles.footerLine}>
          No account?{" "}
          <Link to={`/signup${extensionSearch}`} className={styles.inlineLink}>
            Sign up
          </Link>
        </p>
        <Link to="/" className={styles.back}>
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
