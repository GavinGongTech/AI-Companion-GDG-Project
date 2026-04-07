import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Store ID token for background.js API calls
        const token = await u.getIdToken();
        chrome.storage.session.set({ firebaseIdToken: token });
      } else {
        chrome.storage.session.remove("firebaseIdToken");
      }
    });

    // Refresh token every 50 minutes (tokens expire after 60)
    const interval = setInterval(async () => {
      const current = auth.currentUser;
      if (current) {
        const token = await current.getIdToken(true);
        chrome.storage.session.set({ firebaseIdToken: token });
      }
    }, 50 * 60 * 1000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
