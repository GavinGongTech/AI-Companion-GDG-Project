import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["lcov", "text"],
      exclude: ["**/node_modules/**", "**/dist/**"],
      thresholds: {
        lines: 40,
        functions: 35,
        branches: 35,
        statements: 40,
      },
    },
  },
});
