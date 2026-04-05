import { NavLink } from "react-router-dom";
import styles from "./Shell.module.css";

export function Shell({ children }) {
  const navClass = ({ isActive }) =>
    isActive ? styles.pillActive : styles.pill;

  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <span>Study Flow</span>
        <nav className={styles.nav}>
          <NavLink to="/hub" className={navClass}>
            Hub
          </NavLink>
          <NavLink to="/ask" className={navClass}>
            Ask
          </NavLink>
          <NavLink to="/quiz" className={navClass}>
            Quiz
          </NavLink>
          <NavLink to="/graph" className={navClass}>
            Graph
          </NavLink>
        </nav>
      </header>
      <main className={styles.body}>{children}</main>
    </div>
  );
}
