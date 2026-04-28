import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, hasFirebaseConfig } from "./firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    let disposed = false;

    async function syncFromStorage() {
      const session = await chrome.storage.session.get(["firebaseIdToken", "authUser"]);
      if (disposed) return;
      setUser(session.firebaseIdToken ? (session.authUser || {}) : null);
    }

    void syncFromStorage();

    const onStorageChange = (changes, areaName) => {
      if (areaName !== "session") return;
      if (!changes.firebaseIdToken && !changes.authUser) return;
      const token = changes.firebaseIdToken?.newValue;
      const nextUser = changes.authUser?.newValue;
      setUser(token ? (nextUser || {}) : null);
    };

    chrome.storage.onChanged.addListener(onStorageChange);

    let unsub = () => {};
    let interval = null;

    if (hasFirebaseConfig && auth) {
      unsub = onAuthStateChanged(auth, async (u) => {
        if (u) {
          const token = await u.getIdToken();
          const nextUser = {
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            photoURL: u.photoURL,
          };
          await chrome.storage.session.set({
            firebaseIdToken: token,
            authUser: nextUser,
          });
        } else {
          await chrome.storage.session.remove(["firebaseIdToken", "authUser"]);
        }
      });

      // Refresh token every 50 minutes (tokens expire after 60)
      interval = setInterval(async () => {
        const current = auth.currentUser;
        if (current) {
          const token = await current.getIdToken(true);
          await chrome.storage.session.set({ firebaseIdToken: token });
        }
      }, 50 * 60 * 1000);
    }

    return () => {
      disposed = true;
      chrome.storage.onChanged.removeListener(onStorageChange);
      unsub();
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
