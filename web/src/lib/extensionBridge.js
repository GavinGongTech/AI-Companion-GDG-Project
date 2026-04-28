import { auth } from "./firebase";

export function getExtensionIdFromSearch(search) {
  const params = new URLSearchParams(search);
  return params.get("extensionId") || "";
}

export async function sendAuthToExtension(extensionId) {
  if (!extensionId) {
    return { ok: false, error: "Missing extension ID." };
  }

  const user = auth?.currentUser;
  if (!user) {
    return { ok: false, error: "No signed-in user found." };
  }

  if (!globalThis.chrome?.runtime?.sendMessage) {
    return {
      ok: false,
      error: "Chrome extension messaging is unavailable in this browser.",
    };
  }

  const token = await user.getIdToken();
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
