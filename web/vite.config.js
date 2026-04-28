import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const studyFlowClientEntry = fileURLToPath(
  new URL("../packages/client/src/index.ts", import.meta.url),
);
const studyFlowSharedEntry = fileURLToPath(
  new URL("../packages/shared/src/index.ts", import.meta.url),
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@study-flow/client": studyFlowClientEntry,
      "@study-flow/shared": studyFlowSharedEntry,
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    fs: {
      allow: [repoRoot],
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  build: {
    minify: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) {
            return "vendor";
          }
          if (id.includes("node_modules/react-router")) {
            return "router";
          }
          if (id.includes("node_modules/cytoscape")) {
            return "cytoscape";
          }
          if (id.includes("node_modules/katex")) {
            return "katex";
          }
        },
      },
    },
  },
});
