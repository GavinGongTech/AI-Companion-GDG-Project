import { NavLink } from "react-router-dom";
import type { PropsWithChildren } from "react";
import styles from "./Shell.module.css";

export function Shell({ children }: PropsWithChildren) {
  const tabClass = ({ isActive }: { isActive: boolean }) =>
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
        <NavLink to="/home" className={tabClass}>
          Home
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
