export function normalizeApiUrl(
  rawApiUrl: string | undefined,
  mode: "development" | "production" | "test" = "development",
): string {
  const apiUrl = (rawApiUrl || "http://localhost:3000").replace(/\/+$/, "");

  let parsed: URL;
  try {
    parsed = new URL(apiUrl);
  } catch (error) {
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`Invalid API URL: ${apiUrl} - ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!isSafeApiUrl(parsed.href, mode === "production")) {
    throw new Error("VITE_API_URL must use https:// in production.");
  }

  return parsed.href.replace(/\/+$/, "");
}

export function isSafeApiUrl(
  rawApiUrl: string | undefined,
  requireHttps = false,
): boolean {
  if (!rawApiUrl) {
    return !requireHttps;
  }

  try {
    const parsed = new URL(rawApiUrl);
    if (parsed.protocol === "https:") {
      return true;
    }

    const isLocalhost =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "[::1]" ||
      parsed.hostname === "::1";

    if (parsed.protocol === "http:") {
      return !requireHttps || isLocalhost;
    }

    return false;
  } catch {
    return false;
  }
}
