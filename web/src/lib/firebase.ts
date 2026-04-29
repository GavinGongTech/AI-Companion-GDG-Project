import { createFirebaseAuthState } from "@study-flow/client";
import { signOut } from "firebase/auth";

export const clientMode: "development" | "production" | "test" =
  import.meta.env.MODE === "test"
    ? "test"
    : import.meta.env.PROD
      ? "production"
      : "development";

export const authState = createFirebaseAuthState(import.meta.env, {
  mode: clientMode,
  appName: "web app",
});

export const { auth, hasFirebaseConfig } = authState;

export async function signOutCurrentUser(): Promise<void> {
  if (!auth) {
    return;
  }

  await signOut(auth);
}
