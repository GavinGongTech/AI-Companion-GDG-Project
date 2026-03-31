import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import styles from "./AuthPages.module.css";

export function SignUp() {
  const navigate = useNavigate();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    navigate("/welcome");
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>New student</p>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.lede}>
          We’ll build your misconception graph and vector index as you study.
          You can connect Canvas after signup for auto-ingestion.
        </p>
        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>Full name</span>
            <input
              className={styles.input}
              type="text"
              name="name"
              autoComplete="name"
              placeholder="Alex Chen"
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
              required
            />
          </label>
          <button type="submit" className={styles.primaryBtnWide}>
            Create account
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
