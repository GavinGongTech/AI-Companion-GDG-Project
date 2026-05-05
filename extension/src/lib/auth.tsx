import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import {
  createFirebaseAuthState,
  subscribeToAuthState,
  type CreatedFirebaseAuthState,
} from "@study-flow/client";
import { getRuntimeMode } from "./env";
import { persistFirebaseIdToken } from "./auth-session";
import { STORAGE_KEYS } from "./messages";

export const authState: CreatedFirebaseAuthState = createFirebaseAuthState(import.meta.env, {
  appName: "extension",
  mode: getRuntimeMode(),
});
export const firebaseAuth = authState.auth;
export const hasFirebaseConfig = authState.hasFirebaseConfig;

export interface ExtensionUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// undefined = loading, null = signed out, ExtensionUser = signed in
export type ExtensionAuthState = ExtensionUser | null | undefined;

const AuthContext = createContext<ExtensionAuthState>(undefined);

function parseStoredUser(stored: unknown): ExtensionUser | null {
  if (!stored || typeof stored !== "object") return null;
  const s = stored as Record<string, unknown>;
  if (typeof s.uid !== "string") return null;
  return {
    uid: s.uid,
    email: typeof s.email === "string" ? s.email : null,
    displayName: typeof s.displayName === "string" ? s.displayName : null,
    photoURL: typeof s.photoURL === "string" ? s.photoURL : null,
  };
}

const SESSION_AUTH_KEYS = [STORAGE_KEYS.firebaseIdToken, STORAGE_KEYS.authUser];
const SIGNED_OUT_KEY = "extensionSignedOut";

function fallbackSessionUser(): ExtensionUser {
  return {
    uid: "web-session",
    email: null,
    displayName: null,
    photoURL: null,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  // Firebase auth state: undefined=loading, null=signed out, ExtensionUser=signed in
  const [fbUser, setFbUser] = useState<ExtensionUser | null | undefined>(
    authState.hasFirebaseConfig ? undefined : null,
  );
  // Session storage auth state (set by background when AUTH_FROM_WEB is received)
  const [sessionUser, setSessionUser] = useState<ExtensionUser | null | undefined>(undefined);

  const user: ExtensionAuthState = useMemo(() => {
    if (fbUser) return fbUser;
    if (sessionUser) return sessionUser;
    if (fbUser === null && sessionUser === null) return null;
    return undefined; // still loading
  }, [fbUser, sessionUser]);

  useEffect(() => {
    let disposed = false;

    function syncSessionUser() {
      chrome.storage.local.get([SIGNED_OUT_KEY], (localData) => {
        if (disposed) return;
        if (localData?.[SIGNED_OUT_KEY]) {
          chrome.storage.session.remove(SESSION_AUTH_KEYS);
          setSessionUser(null);
          return;
        }

        chrome.storage.session.get(SESSION_AUTH_KEYS, (sessionData) => {
          if (disposed) return;
          const hasToken = Boolean(sessionData?.[STORAGE_KEYS.firebaseIdToken]);
          setSessionUser(
            hasToken
              ? parseStoredUser(sessionData?.[STORAGE_KEYS.authUser]) ?? fallbackSessionUser()
              : null,
          );
        });
      });
    }

    // Read initial session state immediately (fast path for web-bridge auth)
    syncSessionUser();

    // Watch session storage changes (belt)
    function onStorageChanged(
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) {
      const sessionChanged =
        area === "session" &&
        (STORAGE_KEYS.firebaseIdToken in changes || STORAGE_KEYS.authUser in changes);
      const signedOutChanged = area === "local" && SIGNED_OUT_KEY in changes;
      if (!sessionChanged && !signedOutChanged) return;
      syncSessionUser();
    }
    chrome.storage.onChanged.addListener(onStorageChanged);

    // Also listen for explicit AUTH_UPDATED message from background (suspenders)
    function onMessage(message: unknown) {
      if ((message as { type?: string })?.type !== "AUTH_UPDATED") return;
      syncSessionUser();
    }
    chrome.runtime.onMessage.addListener(onMessage);

    // Subscribe to Firebase auth. Website-bridge auth lives in session storage,
    // so a null Firebase user must not erase the web-provided token.
    const unsubFirebase = subscribeToAuthState(
      authState,
      (fbFirebaseUser) => {
        setFbUser(
          fbFirebaseUser
            ? {
                uid: fbFirebaseUser.uid,
                email: fbFirebaseUser.email,
                displayName: fbFirebaseUser.displayName,
                photoURL: fbFirebaseUser.photoURL,
              }
            : null,
        );
      },
      {
        onUserChange: async (fbFirebaseUser) => {
          if (!fbFirebaseUser) return;
          const token = await fbFirebaseUser.getIdToken();
          await persistFirebaseIdToken(chrome.storage.session, token);
        },
        onRefresh: async (fbFirebaseUser) => {
          const token = await fbFirebaseUser.getIdToken(true);
          await persistFirebaseIdToken(chrome.storage.session, token);
        },
        refreshIntervalMs: 50 * 60 * 1000,
      },
    );

    return () => {
      disposed = true;
      unsubFirebase();
      chrome.storage.onChanged.removeListener(onStorageChanged);
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useAuth(): ExtensionAuthState {
  return useContext(AuthContext);
}
