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

async function buildAuthHeaders() {
  const user = auth?.currentUser ?? null;
  const headers = { "Content-Type": "application/json" };
  if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
  return headers;
}

export async function apiFetch(path, options = {}) {
  const headers = { ...await buildAuthHeaders(), ...options.headers };
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
