import { auth } from "./firebase";

export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");

function validateApiUrl() {
  const apiHost = (() => {
    try {
      return new URL(API_URL).hostname;
    } catch {
      return "";
    }
  })();
  const isLocalHttp =
    API_URL.startsWith("http://") &&
    (apiHost === "localhost" ||
      apiHost === "127.0.0.1" ||
      apiHost === "[::1]" ||
      apiHost === "::1");
  if (import.meta.env.PROD && !API_URL.startsWith("https://") && !isLocalHttp) {
    throw new Error("VITE_API_URL must use https:// in production.");
  }
}

function mapNetworkError(err) {
  const msg = err?.message || String(err);
  if (msg === "Failed to fetch" || msg === "Load failed" || err?.name === "TypeError") {
    return `Cannot reach API at ${API_URL}. Start the backend (bun run dev:server from repo root) and reload the extension; rebuild the extension if you changed VITE_API_URL in extension/.env.`;
  }
  return msg;
}

/** Short, readable API errors for the side panel (avoids dumping full Gemini JSON). */
function formatHttpErrorMessage(status, body) {
  const raw =
    body?.error ??
    body?.message ??
    (typeof body === "string" ? body : null) ??
    (body && typeof body === "object" ? JSON.stringify(body) : null) ??
    "";
  let text = typeof raw === "string" ? raw : JSON.stringify(raw);
  const lower = text.toLowerCase();
  if (
    status === 429 ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("billing")
  ) {
    return "Gemini API quota exceeded (429). Check your API key / billing in Google AI Studio, or wait and try again.";
  }
  if (text.length > 420) {
    text = `${text.slice(0, 420)}…`;
  }
  return text || `Request failed (${status})`;
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
  validateApiUrl();
  const headers = await buildAuthHeaders(options.headers);
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch (err) {
    throw new Error(mapNetworkError(err), { cause: err });
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(formatHttpErrorMessage(res.status, body));
  }
  return res.json();
}
