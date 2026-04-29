import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const sharedIndexPath = fileURLToPath(
  new URL("../shared/src/index.ts", import.meta.url),
);

export default defineConfig({
  resolve: {
    alias: {
      "@study-flow/shared": sharedIndexPath,
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["lcov", "text"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/test/**"],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
