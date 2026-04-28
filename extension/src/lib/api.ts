import { createApiClient, type ApiFetchOptions } from "@study-flow/client";
import { normalizeApiUrl } from "@study-flow/shared";
import { getExtensionEnv, getRuntimeMode } from "./env";
import { storageGet } from "./chrome-storage";
import { authState } from "./auth";
import { STORAGE_KEYS } from "./messages";

async function getApiUrl(): Promise<string> {
  const stored = await storageGet<{ apiUrl?: string }>(chrome.storage.local, [STORAGE_KEYS.apiUrl]);
  return normalizeApiUrl(stored.apiUrl || getExtensionEnv().VITE_API_URL, getRuntimeMode());
}

async function getAuthToken(): Promise<string | null> {
  const user = authState.auth?.currentUser;
  if (user) return user.getIdToken();

  // Fallback for when auth hasn't hydrated yet
  const session = await storageGet<{ firebaseIdToken?: string }>(chrome.storage.session, [
    STORAGE_KEYS.firebaseIdToken,
  ]);
  return session.firebaseIdToken || null;
}

export async function apiFetch<TResponse>(
  path: string,
  init?: ApiFetchOptions,
): Promise<TResponse> {
  const apiUrl = await getApiUrl();
  return createApiClient({
    apiUrl,
    mode: getRuntimeMode(),
    getAuthToken,
  }).apiFetch<TResponse>(path, init);
}

export async function apiFetchParsed<TResponse>(
  path: string,
  schema: { parse(data: unknown): TResponse },
  init?: ApiFetchOptions,
): Promise<TResponse> {
  return schema.parse(await apiFetch<unknown>(path, init));
}
