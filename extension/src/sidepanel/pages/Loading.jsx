import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Pages.module.css";

export function Loading() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = window.setTimeout(() => {
      navigate("/hub", { replace: true });
    }, 900);
    return () => window.clearTimeout(t);
  }, [navigate]);

  return (
    <div className={styles.center}>
      <div className={styles.spinner} aria-hidden />
      <p className={styles.muted}>loading…</p>
    </div>
  );
}
