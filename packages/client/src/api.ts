import { normalizeApiUrl } from "@study-flow/shared";

export interface ApiClientOptions {
  apiUrl: string | undefined;
  getAuthToken?: () => Promise<string | null> | string | null;
  fetchImpl?: typeof fetch;
  mode?: "development" | "production" | "test";
}

export interface ApiFetchOptions extends RequestInit {
  skipJsonContentType?: boolean;
}

export interface ApiClient {
  apiUrl: string;
  apiFetch<T>(path: string, options?: ApiFetchOptions): Promise<T>;
}

function shouldSetJsonContentType(
  body: BodyInit | null | undefined,
  options: ApiFetchOptions,
): boolean {
  if (options.skipJsonContentType) {
    return false;
  }

  if (!body) {
    return true;
  }

  return !(body instanceof FormData);
}

export function createApiClient({
  apiUrl,
  getAuthToken,
  fetchImpl = fetch,
  mode = "development",
}: ApiClientOptions): ApiClient {
  const normalizedApiUrl = normalizeApiUrl(apiUrl, mode);

  return {
    apiUrl: normalizedApiUrl,
    async apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
      const token = await getAuthToken?.();
      const headers = new Headers(options.headers);

      if (shouldSetJsonContentType(options.body ?? null, options)) {
        headers.set("Content-Type", headers.get("Content-Type") ?? "application/json");
      }

      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }

      const response = await fetchImpl(`${normalizedApiUrl}${path}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          typeof body?.error === "string" && body.error.length > 0
            ? body.error
            : response.statusText;
        throw new Error(message || "Request failed");
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return response.json() as Promise<T>;
    },
  };
}
