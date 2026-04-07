import { NavLink } from "react-router-dom";
import styles from "./Shell.module.css";

export function Shell({ children }) {
  const tabClass = ({ isActive }) =>
    isActive ? `${styles.tab} ${styles.active}` : styles.tab;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>AI Companion</p>
          <h1 className={styles.title}>Study Flow</h1>
        </div>
      </header>

      <nav className={styles.nav}>
        <NavLink to="/ask" className={tabClass}>
          Ask
        </NavLink>
        <NavLink to="/quiz" className={tabClass}>
          Quiz
        </NavLink>
        <NavLink to="/graph" className={tabClass}>
          My Graph
        </NavLink>
        <NavLink to="/course" className={tabClass}>
          My Course
        </NavLink>
      </nav>

      <main className={styles.main}>{children}</main>
    </div>
  );
}