import { auth } from "./firebase";

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

async function getBearerToken() {
  const user = auth?.currentUser ?? null;
  if (user) return user.getIdToken();

  // Fallback: background/sidepanel auth stores the latest token for service worker calls.
  // This also helps when auth.currentUser hasn't hydrated yet in the side panel.
  if (typeof chrome !== "undefined" && chrome.storage?.session?.get) {
    const session = await new Promise((resolve) => {
      chrome.storage.session.get(["firebaseIdToken"], (data) => resolve(data));
    });
    if (session?.firebaseIdToken) return session.firebaseIdToken;
  }

  return null;
}

async function buildAuthHeaders(extra = {}) {
  const headers = { "Content-Type": "application/json", ...extra };
  const token = await getBearerToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function apiFetch(path, options = {}) {
  const headers = await buildAuthHeaders(options.headers);
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

/** Same as apiFetch but never relies on auth.currentUser timing — pass a token explicitly. */
export async function apiFetchWithToken(path, idToken, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

export async function apiStream(path, body) {
  return fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: await buildAuthHeaders(),
    body: JSON.stringify(body),
  });
}
