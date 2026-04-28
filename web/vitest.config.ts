import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@study-flow/client": fileURLToPath(new URL("../packages/client/src/index.ts", import.meta.url)),
      "@study-flow/shared": fileURLToPath(new URL("../packages/shared/src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["lcov", "text"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/test/**"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
