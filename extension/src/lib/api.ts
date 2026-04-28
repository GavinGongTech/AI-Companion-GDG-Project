import { createFirebaseApiClient, type ApiFetchOptions } from "@study-flow/client";
import { normalizeApiUrl } from "@study-flow/shared";
import { getExtensionEnv, getRuntimeMode } from "./env";
import { storageGet } from "./chrome-storage";
import { authState } from "./auth";
import { STORAGE_KEYS } from "./messages";

async function getApiUrl(): Promise<string> {
  const stored = await storageGet<{ apiUrl?: string }>(chrome.storage.local, [STORAGE_KEYS.apiUrl]);
  return normalizeApiUrl(stored.apiUrl || getExtensionEnv().VITE_API_URL, getRuntimeMode());
}

export async function apiFetch<TResponse>(
  path: string,
  init?: ApiFetchOptions,
): Promise<TResponse> {
  const apiUrl = await getApiUrl();
  return createFirebaseApiClient(authState, apiUrl, {
    mode: getRuntimeMode(),
  }).apiFetch<TResponse>(path, init);
}

export async function apiFetchParsed<TResponse>(
  path: string,
  schema: { parse(data: unknown): TResponse },
  init?: ApiFetchOptions,
): Promise<TResponse> {
  return schema.parse(await apiFetch<unknown>(path, init));
}
