import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth, hasFirebaseConfig } from "../lib/firebase";
import styles from "./AuthPages.module.css";
import { apiFetch } from "../lib/api";

export function SignUp() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (!hasFirebaseConfig || !auth) {
      setError("Firebase is not configured yet. Add web/.env.local to test account creation.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      await updateProfile(user, { displayName: name });
      const token = await user.getIdToken();
      apiFetch("/api/v1/events/track", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          eventType: "auth_signup",
          content: "signup",
          meta: { provider: "password" },
        }),
      }).catch(() => {});
      navigate("/welcome");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>New student</p>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.lede}>
          We’ll build your misconception graph as you study. You can connect
          your courses after signup for auto-ingestion.
        </p>
        {error && <p className={styles.error}>{error}</p>}
        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>Full name</span>
            <input
              className={styles.input}
              type="text"
              name="name"
              autoComplete="name"
              placeholder="Alex Chen"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>University email</span>
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
              autoComplete="new-password"
              placeholder="At least 8 characters"
              minLength={8}
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
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
        <p className={styles.footerLine}>
          Already have an account?{" "}
          <Link to="/login" className={styles.inlineLink}>
            Log in
          </Link>
        </p>
        <Link to="/" className={styles.back}>
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
