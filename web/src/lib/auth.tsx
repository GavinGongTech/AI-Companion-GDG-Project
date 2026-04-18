import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { auth, hasFirebaseConfig } from "./firebase";

const AuthContext = createContext<User | null | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(
    () => (hasFirebaseConfig && auth ? undefined : null)
  );

  useEffect(() => {
    if (!hasFirebaseConfig || !auth) return undefined;
    return onAuthStateChanged(auth, setUser);
  }, []);

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): User | null | undefined {
  return useContext(AuthContext);
}
