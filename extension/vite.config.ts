import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function stripCrossOrigin(): Plugin {
  return {
    name: "strip-crossorigin",
    transformIndexHtml(html) {
      return html.replace(/ crossorigin/g, "");
    },
  };
}

function katexWoff2Only(): Plugin {
  return {
    name: "katex-woff2-only",
    enforce: "pre",
    transform(code, id) {
      if (!id.includes("katex") || !id.endsWith(".css")) {
        return null;
      }

      const cleaned = code.replace(
        /,?\s*url\([^)]*\.(?:woff|ttf)\)[^,;)]*(?:format\([^)]*\))?/g,
        "",
      );
      return { code: cleaned, map: null };
    },
    generateBundle(_, bundle) {
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
  plugins: [react(), katexWoff2Only(), stripCrossOrigin()],
  resolve: {
    alias: {
      "@study-flow/client": resolve(__dirname, "../packages/client/src/index.ts"),
      "@study-flow/shared": resolve(__dirname, "../packages/shared/src/index.ts"),
    },
  },
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
        chunkFileNames:
          mode === "production" ? "chunks/[name]-[hash].js" : "chunks/[name].js",
        assetFileNames:
          mode === "production" ? "assets/[name]-[hash][extname]" : "assets/[name][extname]",
        manualChunks(id) {
          if (id.includes("node_modules/katex")) {
            return "katex";
          }

          return undefined;
        },
      },
    },
  },
}));
