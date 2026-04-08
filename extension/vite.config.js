import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Strip legacy font formats (woff, ttf) from KaTeX CSS @font-face rules.
 * Chrome supports woff2 since v36 — the other formats are dead weight in an extension.
 */
function katexWoff2Only() {
  return {
    name: "katex-woff2-only",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("katex") || !id.endsWith(".css")) return null;
      // Remove url() entries for .woff and .ttf from @font-face src lists
      const cleaned = code.replace(
        /,?\s*url\([^)]*\.(?:woff|ttf)\)[^,;)]*(?:format\([^)]*\))?/g,
        "",
      );
      return { code: cleaned, map: null };
    },
    generateBundle(_, bundle) {
      // Drop .woff and .ttf asset files from the output
      for (const key of Object.keys(bundle)) {
        if (/\.(?:woff|ttf)$/.test(key) && key.includes("KaTeX")) {
          delete bundle[key];
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [react(), katexWoff2Only()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: mode === "production",
    sourcemap: mode !== "production",
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, "sidepanel.html"),
        background: resolve(__dirname, "src/background.js"),
        content: resolve(__dirname, "src/content.js"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks(id) {
          if (id.includes("node_modules/katex")) {
            return "katex";
          }
        },
      },
    },
  },
}));