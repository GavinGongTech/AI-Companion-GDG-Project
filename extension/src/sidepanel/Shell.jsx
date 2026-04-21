import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./Shell.module.css";

export function Shell({ children }) {
  const location = useLocation();

  const tabClass = ({ isActive }) =>
    isActive ? `${styles.tab} ${styles.active}` : styles.tab;

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <p className={styles.kicker}>AI Companion</p>
        <h1 className={styles.title}>Study Flow</h1>
      </header>

      <nav className={styles.nav}>
        {[
          { to: "/home", label: "Home" },
          { to: "/graph", label: "My Graph" },
          { to: "/course", label: "My Course" },
        ].map(({ to, label }) => (
          <NavLink key={to} to={to} className={tabClass}>
            {({ isActive }) => (
              <div className={styles.tabWrap}>
                {label}
                {isActive && (
                  <motion.div
                    layoutId="tab-indicator"
                    className={styles.indicator}
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <main className={styles.main}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
