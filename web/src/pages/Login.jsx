import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth, hasFirebaseConfig } from "../lib/firebase";
import styles from "./AuthPages.module.css";

const googleProvider = new GoogleAuthProvider();

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (!hasFirebaseConfig || !auth) {
      setError("Firebase is not configured yet. Add web/.env.local to test sign-in.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
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
      await signInWithPopup(auth, googleProvider);
      navigate("/dashboard");
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
          Sign in with your email or Google account to continue studying.
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
          <Link to="/signup" className={styles.inlineLink}>
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
