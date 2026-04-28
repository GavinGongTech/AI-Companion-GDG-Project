/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getInitialAuthUserState,
  subscribeToAuthState,
  type AuthUserState,
} from "@study-flow/client";
import { authState } from "./firebase";

export const AuthContext = createContext<AuthUserState>(
  getInitialAuthUserState(authState),
);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUserState>(() =>
    getInitialAuthUserState(authState),
  );

  useEffect(() => subscribeToAuthState(authState, setUser), []);

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthUserState {
  return useContext(AuthContext);
}
