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
});
