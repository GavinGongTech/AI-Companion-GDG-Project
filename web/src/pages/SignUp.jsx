import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import { auth, hasFirebaseConfig } from "../lib/firebase";
import styles from "./AuthPages.module.css";
import { apiFetch } from "../lib/api";
import { getExtensionIdFromSearch, sendAuthToExtension } from "../lib/extensionBridge";

export function SignUp() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const extensionId = getExtensionIdFromSearch(searchParams.toString());
  const closeAfterAuth = searchParams.get("closeAfterAuth") === "1";
  const extensionSearch = extensionId
    ? `?extensionId=${encodeURIComponent(extensionId)}${closeAfterAuth ? "&closeAfterAuth=1" : ""}`
    : "";

  const completeExtensionAuth = useCallback(async (options = {}) => {
    if (!extensionId) {
      return true;
    }

    setStatus("Connecting your website session to the extension...");
    const result = await sendAuthToExtension(extensionId, options);
    if (!result.ok) {
      setError(result.error);
      setStatus("");
      return false;
    }

    setStatus("Extension connected. You can return to Study Flow.");
    return true;
  }, [extensionId]);

  useEffect(() => {
    if (!extensionId || !hasFirebaseConfig || !auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      void completeExtensionAuth({ closeAfterAuth });
    });

    return unsubscribe;
  }, [closeAfterAuth, completeExtensionAuth, extensionId]);

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
      if (!(await completeExtensionAuth({ closeAfterAuth }))) {
        return;
      }
      if (!extensionId) {
        navigate("/welcome");
      }
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
          {extensionId
            ? "Create your account here and we’ll connect the new session back to the extension."
            : "We’ll build your misconception graph as you study. You can connect your courses after signup for auto-ingestion."}
        </p>
        {error && <p className={styles.error}>{error}</p>}
        {status && <p className={styles.note}>{status}</p>}
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
          <Link to={`/login${extensionSearch}`} className={styles.inlineLink}>
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
