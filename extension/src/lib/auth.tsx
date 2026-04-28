import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import {
  createFirebaseAuthState,
  getInitialAuthUserState,
  subscribeToAuthState,
  type AuthUserState,
  type CreatedFirebaseAuthState,
} from "@study-flow/client";
import { getRuntimeMode } from "./env";
import { persistFirebaseIdToken } from "./auth-session";

export const authState: CreatedFirebaseAuthState = createFirebaseAuthState(import.meta.env, {
  appName: "extension",
  mode: getRuntimeMode(),
});
export const firebaseAuth = authState.auth;
export const hasFirebaseConfig = authState.hasFirebaseConfig;

const AuthContext = createContext<AuthUserState>(getInitialAuthUserState(authState));

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUserState>(() => getInitialAuthUserState(authState));

  useEffect(() => {
    return subscribeToAuthState(authState, setUser, {
      onUserChange: async (user) => {
        const token = user ? await user.getIdToken() : null;
        await persistFirebaseIdToken(chrome.storage.session, token);
      },
      onRefresh: async (user) => {
        const token = await user.getIdToken(true);
        await persistFirebaseIdToken(chrome.storage.session, token);
      },
      refreshIntervalMs: 50 * 60 * 1000,
    });
  }, []);

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthUserState {
  return useContext(AuthContext);
}
