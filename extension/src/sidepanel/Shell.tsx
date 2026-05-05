import { NavLink } from "react-router-dom";
import type { PropsWithChildren } from "react";
import { signOut } from "firebase/auth";
import { auth, hasFirebaseConfig } from "./lib/firebase";
import { STORAGE_KEYS } from "../lib/messages";
import styles from "./Shell.module.css";

export function Shell({ children }: PropsWithChildren) {
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? `${styles.tab} ${styles.active}` : styles.tab;

  async function handleSignOut() {
    try {
      if (hasFirebaseConfig && auth) {
        await signOut(auth);
      }
    } catch {
      /* still clear session storage below */
    }
    await chrome.storage.local.set({ extensionSignedOut: true });
    await chrome.storage.session.remove([STORAGE_KEYS.firebaseIdToken, STORAGE_KEYS.authUser]);
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.title}>Study Flow</div>
        <nav className={styles.tabs}>
          <NavLink to="/home" className={tabClass} end>
            Hub
          </NavLink>
          <NavLink to="/ask" className={tabClass}>
            Ask
          </NavLink>
          <NavLink to="/quiz" className={tabClass}>
            Quiz
          </NavLink>
        </nav>
        <button 
          className={styles.signOutButton} 
          onClick={handleSignOut}
          title="Sign out of Study Flow"
        >
          Sign Out
        </button>
      </header>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
