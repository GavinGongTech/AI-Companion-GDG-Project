import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    alias: {
      "@google/genai/server": "node_modules/@google/genai/dist/node/index.mjs",
    },
    coverage: {
      provider: "v8",
      reporter: ["lcov", "text"],
      all: true,
      exclude: ["**/node_modules/**", "**/dist/**", "src/index.js", "**/*.test.js", "**/*.integration.test.js", "vitest.config.js", "eslint.config.js"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
