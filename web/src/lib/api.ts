import { auth, hasFirebaseConfig } from "./firebase";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");
const apiHost = (() => {
  try { return new URL(API_URL).hostname; } catch { return ""; }
})();
const isLocalHttp =
  API_URL.startsWith("http://") && (apiHost === "localhost" || apiHost === "127.0.0.1");
if (import.meta.env.PROD && !API_URL.startsWith("https://") && !isLocalHttp) {
  throw new Error("VITE_API_URL must use https:// in production.");
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = hasFirebaseConfig && auth ? auth.currentUser : null;
  if (!user) return {};
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
    ...authHeaders,
  };
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function apiStream(
  path: string,
  body: Record<string, unknown>
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...authHeaders,
  };
  return fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}
