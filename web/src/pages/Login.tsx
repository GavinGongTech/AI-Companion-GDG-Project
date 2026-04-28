import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { trackClientEvent } from "../lib/api";
import { auth, hasFirebaseConfig } from "../lib/firebase";
import styles from "./AuthPages.module.css";
import { getExtensionIdFromSearch, sendAuthToExtension } from "../lib/extensionBridge";

const googleProvider = new GoogleAuthProvider();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred.";
}

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const extensionId = getExtensionIdFromSearch(searchParams.toString());
  const extensionSearch = extensionId ? `?extensionId=${encodeURIComponent(extensionId)}` : "";

  async function completeExtensionAuth() {
    if (!extensionId) {
      return true;
    }

    setStatus("Connecting your website session to the extension...");
    const result = await sendAuthToExtension(extensionId);
    if (!result.ok) {
      setError(result.error || "Failed to connect to extension");
      setStatus("");
      return false;
    }

    setStatus("Extension connected. You can return to Study Flow.");
    return true;
  }

  useEffect(() => {
    if (!extensionId || !auth?.currentUser) {
      return;
    }

    void completeExtensionAuth();
  }, [extensionId]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!hasFirebaseConfig || !auth) {
      setError("Firebase is not configured yet. Add web/.env.local to test sign-in.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      trackClientEvent({
        eventType: "auth_login",
        content: "login",
        meta: { provider: "password" },
      }).catch(() => {});
      
      if (!(await completeExtensionAuth())) {
        return;
      }
      if (!extensionId) {
        navigate("/dashboard");
      }
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleSignIn(): Promise<void> {
    if (!hasFirebaseConfig || !auth) {
      setError("Firebase is not configured yet. Add web/.env.local to test Google sign-in.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await signInWithPopup(auth, googleProvider);
      trackClientEvent({
        eventType: "auth_login",
        content: "login",
        meta: { provider: "google" },
      }).catch(() => {});
      
      if (!(await completeExtensionAuth())) {
        return;
      }
      if (!extensionId) {
        navigate("/dashboard");
      }
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
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
        {status && <p className={styles.note}>{status}</p>}
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
              onChange={(event) => setEmail(event.target.value)}
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
              onChange={(event) => setPassword(event.target.value)}
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
