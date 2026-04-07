import { Link, useNavigate } from "react-router-dom";
import styles from "./AuthPages.module.css";
import { doSignInWithEmailAndPassword, doSignInWithGoogle} from "../../firebase/auth";
import { useAuth } from "../contexts/authContexts";

export function Login() {
  const navigate = useNavigate();

  function onSubmit(e) {
    e.preventDefault();
    navigate("/welcome");
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Welcome back</p>
        <h1 className={styles.title}>Log in</h1>
        <p className={styles.lede}>
          Use your university email. Sessions use JWT; Canvas connects via
          OAuth when you enable course ingestion.
        </p>
        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>Email</span>
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
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </label>
          <button type="submit" className={styles.primaryBtnWide}>
            Continue
          </button>
        </form>
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