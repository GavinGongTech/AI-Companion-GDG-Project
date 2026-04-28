import { describe, expect, it } from "vitest";
import {
  parseClientEnvironment,
  parseExtensionEnvironment,
  parseServerEnvironment,
} from "../src/env";
import { normalizeApiUrl, isSafeApiUrl } from "../src/utils/url";

describe("shared utilities and environment", () => {
  describe("env parsers", () => {
    it("parses client environment with defaults", () => {
      const env = parseClientEnvironment({});
      expect(env.VITE_API_URL).toBe("http://localhost:3000");
      expect(env.VITE_FIREBASE_API_KEY).toBe("");
    });

    it("parses extension environment with extra keys", () => {
      const env = parseExtensionEnvironment({
        VITE_FIREBASE_WEB_CLIENT_ID: "test-client-id",
      });
      expect(env.VITE_FIREBASE_WEB_CLIENT_ID).toBe("test-client-id");
      expect(env.VITE_API_URL).toBe("http://localhost:3000");
    });

    it("parses server environment with defaults and overrides", () => {
      const env = parseServerEnvironment({ PORT: "4000", NODE_ENV: "production" });
      expect(env.PORT).toBe(4000);
      expect(env.NODE_ENV).toBe("production");
      expect(env.GEMINI_API_KEY).toBe("");
    });
  });

  describe("url utilities", () => {
    it("normalizes API URLs", () => {
      expect(normalizeApiUrl("http://localhost:3000/")).toBe("http://localhost:3000");
      expect(normalizeApiUrl(undefined)).toBe("http://localhost:3000");
      expect(normalizeApiUrl("https://api.studyflow.app")).toBe("https://api.studyflow.app");
    });

    it("throws on invalid URLs", () => {
      expect(() => normalizeApiUrl("not-a-url")).toThrow("Invalid API URL");
    });

    it("enforces HTTPS in production mode", () => {
      expect(() => normalizeApiUrl("http://api.studyflow.app", "production")).toThrow(
        "VITE_API_URL must use https:// in production",
      );
      // Localhost should still be allowed in production for testing
      expect(normalizeApiUrl("http://localhost:3000", "production")).toBe("http://localhost:3000");
    });

    it("validates safe API URLs", () => {
      expect(isSafeApiUrl("https://api.studyflow.app")).toBe(true);
      expect(isSafeApiUrl("http://localhost:3000")).toBe(true);
      expect(isSafeApiUrl("http://127.0.0.1:3000")).toBe(true);
      expect(isSafeApiUrl("http://[::1]:3000")).toBe(true);
      expect(isSafeApiUrl("http://example.com")).toBe(false);
      expect(isSafeApiUrl(undefined)).toBe(true);
      expect(isSafeApiUrl(undefined, true)).toBe(false);
      expect(isSafeApiUrl("not-a-url")).toBe(false);
      expect(isSafeApiUrl("ftp://localhost")).toBe(false);
    });
  });
});
