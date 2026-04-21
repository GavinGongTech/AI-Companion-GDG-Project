import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  build: {
    minify: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/")) return "vendor";
          if (id.includes("node_modules/react-router")) return "router";
          if (id.includes("node_modules/d3")) return "d3";
          if (id.includes("node_modules/katex")) return "katex";
          if (id.includes("node_modules/framer-motion")) return "motion";
          if (id.includes("node_modules/@radix-ui")) return "radix";
          if (id.includes("node_modules/firebase")) return "firebase";
          if (id.includes("node_modules/@sentry")) return "sentry";
        },
      },
    },
  },
});
