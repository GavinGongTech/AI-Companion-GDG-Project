import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, hasFirebaseConfig } from "./firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // undefined = loading, null = logged out
  const [user, setUser] = useState(() => (hasFirebaseConfig && auth ? undefined : null));

  useEffect(() => {
    if (!hasFirebaseConfig || !auth) {
      return undefined;
    }
    return onAuthStateChanged(auth, setUser);
  }, []);

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
