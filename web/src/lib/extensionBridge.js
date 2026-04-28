import { auth } from "./firebase";

const DEFAULT_EXTENSION_ID = "mdhinmgplmnfggbhbhmackmpgddgpmed";
const CONFIGURED_EXTENSION_ID = import.meta.env.VITE_EXTENSION_ID || DEFAULT_EXTENSION_ID;

export function getExtensionIdFromSearch(search) {
  const params = new URLSearchParams(search);
  return params.get("extensionId") || "";
}

export async function sendAuthToExtension(extensionId, options = {}) {
  const targetExtensionId = extensionId || CONFIGURED_EXTENSION_ID;
  if (!targetExtensionId) {
    return { ok: false, error: "Missing extension ID." };
  }

  const user = options.user || auth?.currentUser;
  if (!user) {
    return { ok: false, error: "No signed-in user found." };
  }

  const chromeRuntime = globalThis.chrome?.runtime;
  if (!chromeRuntime?.sendMessage) {
    return {
      ok: false,
      error: "Chrome extension messaging is unavailable in this browser.",
    };
  }

  const token = await user.getIdToken();
  const response = await chromeRuntime.sendMessage(targetExtensionId, {
    type: "AUTH_FROM_WEB",
    token,
    closeAfterAuth: Boolean(options.closeAfterAuth),
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
