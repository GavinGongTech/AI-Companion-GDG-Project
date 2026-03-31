import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import styles from "./Shell.module.css";

const nav = [
  { to: "/hub", label: "Hub" },
  { to: "/ask", label: "Ask" },
  { to: "/quiz", label: "Quiz" },
];

export function Shell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const hideNav = location.pathname === "/";

  return (
    <div className={styles.shell}>
      {!hideNav && (
        <header className={styles.top}>
          <span className={styles.brand}>Study Flow</span>
          <nav className={styles.nav} aria-label="Panel">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `${styles.pill} ${isActive ? styles.pillActive : ""}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>
      )}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
