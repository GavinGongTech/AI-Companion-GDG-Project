import { auth } from "./firebase";
import type { User } from "firebase/auth";

const DEFAULT_EXTENSION_ID = "fajafcnfcebebbeahbofaihjgogooijhkj";

export function getExtensionIdFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  return params.get("extensionId") || "";
}

export function getConnectExtensionId(search: string): string {
  return getExtensionIdFromSearch(search) || import.meta.env.VITE_EXTENSION_ID || DEFAULT_EXTENSION_ID;
}

interface AuthResponse {
  ok: boolean;
  error?: string;
}

export async function sendAuthToExtension(
  extensionId: string,
  signedInUser: User | null | undefined = auth?.currentUser,
): Promise<AuthResponse> {
  if (!extensionId) {
    return { ok: false, error: "Missing extension ID." };
  }

  const user = signedInUser ?? auth?.currentUser;
  if (!user) {
    return { ok: false, error: "No signed-in user found." };
  }

  const chrome = (globalThis as any).chrome;
  if (!chrome?.runtime?.sendMessage) {
    return {
      ok: false,
      error: "Chrome extension messaging is unavailable in this browser.",
    };
  }

  const token = await user.getIdToken(true);
  const response = await chrome.runtime.sendMessage(extensionId, {
    type: "AUTH_FROM_WEB",
    token,
    user: {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
    },
  });

  if (!response?.ok) {
    return {
      ok: false,
      error: response?.error || "Failed to connect the website session to the extension.",
    };
  }

  return { ok: true };
}
