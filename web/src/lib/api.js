import { auth, hasFirebaseConfig } from "./firebase";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");
const apiHost = (() => {
  try {
    return new URL(API_URL).hostname;
  } catch {
    return "";
  }
})();
const isLocalHttp = API_URL.startsWith("http://") && (apiHost === "localhost" || apiHost === "127.0.0.1");
if (import.meta.env.PROD && !API_URL.startsWith("https://") && !isLocalHttp) {
  throw new Error("VITE_API_URL must use https:// in production.");
}

export async function apiFetch(path, options = {}) {
  const user = hasFirebaseConfig && auth ? auth.currentUser : null;
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (user) {
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}
