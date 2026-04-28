import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { parseClientEnvironment, type ClientEnvironment } from "@study-flow/shared";
import { createApiClient, type ApiClient } from "./api";

const DEFAULT_FIREBASE_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
] as const;

export interface CreateFirebaseAuthStateOptions {
  mode?: "development" | "production" | "test";
  requiredKeys?: ReadonlyArray<keyof ClientEnvironment>;
  logger?: Pick<Console, "warn">;
  appName?: string;
}

export interface CreatedFirebaseAuthState {
  auth: Auth | null;
  hasFirebaseConfig: boolean;
  firebaseConfig: FirebaseOptions;
  env: ClientEnvironment;
}

export function createFirebaseAuthState(
  rawEnvironment: Record<string, unknown>,
  {
    mode = "development",
    requiredKeys = DEFAULT_FIREBASE_KEYS,
    logger = console,
    appName = "client",
  }: CreateFirebaseAuthStateOptions = {},
): CreatedFirebaseAuthState {
  const env = parseClientEnvironment(rawEnvironment);
  const firebaseConfig: FirebaseOptions = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
    appId: env.VITE_FIREBASE_APP_ID || undefined,
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
  };

  const hasFirebaseConfig = requiredKeys.every((key) => {
    const value = env[key];
    return typeof value === "string" && value.length > 0;
  });

  if (!hasFirebaseConfig) {
    if (mode !== "production") {
      logger.warn(
        `Firebase config is missing. Running the ${appName} in UI-only mode.`,
      );
    }

    return {
      auth: null,
      hasFirebaseConfig,
      firebaseConfig,
      env,
    };
  }

  const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  return {
    auth: getAuth(app),
    hasFirebaseConfig,
    firebaseConfig,
    env,
  };
}

export function createFirebaseApiClient(
  authState: CreatedFirebaseAuthState,
  apiUrl: string | undefined = authState.env.VITE_API_URL,
  options: { fetchImpl?: typeof fetch; mode?: "development" | "production" | "test" } = {},
): ApiClient {
  return createApiClient({
    apiUrl,
    fetchImpl: options.fetchImpl,
    mode: options.mode,
    getAuthToken: async () => {
      const currentUser = authState.auth?.currentUser ?? null;
      return currentUser ? currentUser.getIdToken() : null;
    },
  });
}
