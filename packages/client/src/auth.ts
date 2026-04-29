import { onAuthStateChanged, type Auth, type User } from "firebase/auth";

export interface FirebaseAuthState {
  auth: Auth | null;
  hasFirebaseConfig: boolean;
}

export type AuthUserState = User | null | undefined;

export interface AuthSubscriptionOptions {
  onUserChange?: (user: User | null, auth: Auth) => Promise<void> | void;
  onRefresh?: (user: User, auth: Auth) => Promise<void> | void;
  refreshIntervalMs?: number;
}

export function getInitialAuthUserState(
  authState: FirebaseAuthState,
): AuthUserState {
  return authState.hasFirebaseConfig && authState.auth ? undefined : null;
}

export function subscribeToAuthState(
  authState: FirebaseAuthState,
  setUser: (user: User | null) => void,
  options: AuthSubscriptionOptions = {},
): () => void {
  if (!authState.hasFirebaseConfig || !authState.auth) {
    return () => undefined;
  }

  const { auth } = authState;
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    setUser(user);
    await options.onUserChange?.(user, auth);
  });

  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  if (options.refreshIntervalMs && options.onRefresh) {
    refreshTimer = setInterval(async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return;
      }

      await options.onRefresh?.(currentUser, auth);
    }, options.refreshIntervalMs);
  }

  return () => {
    unsubscribe();
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }
  };
}
