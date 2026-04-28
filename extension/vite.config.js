import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname, resolve, join } from "path";
import { execSync } from "child_process";
import { mkdirSync, existsSync, unlinkSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function zipExtension() {
  return {
    name: "zip-extension",
    closeBundle() {
      const distDir = join(__dirname, "dist");
      const destDir = join(__dirname, "..", "web", "public", "downloads");
      const zipPath = join(destDir, "study-flow-extension.zip");
      console.log("Zipping extension...");
      try {
        mkdirSync(destDir, { recursive: true });
        if (existsSync(zipPath)) unlinkSync(zipPath);
        const zipArg = zipPath.replace(/\\/g, "/");
        if (process.platform === "win32") {
          execSync(`tar.exe -a -c -f "${zipArg}" *`, { cwd: distDir, stdio: "inherit", shell: true });
        } else {
          execSync(`zip -r "${zipArg}" .`, { cwd: distDir, stdio: "inherit" });
        }
        console.log("Extension zipped successfully to web/public/downloads/study-flow-extension.zip");
      } catch (e) {
        console.error("Failed to zip extension:", e);
      }
    }
  };
}

/**
 * Strip legacy font formats (woff, ttf) from KaTeX CSS @font-face rules.
 * Chrome supports woff2 since v36 — the other formats are dead weight in an extension.
 */
function stripCrossOrigin() {
  return {
    name: "strip-crossorigin",
    transformIndexHtml(html) {
      return html.replace(/ crossorigin/g, "");
    },
  };
}

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
  plugins: [react(), katexWoff2Only(), stripCrossOrigin(), zipExtension()],
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
        chunkFileNames: mode === "production" ? "chunks/[name]-[hash].js" : "chunks/[name].js",
        assetFileNames: mode === "production" ? "assets/[name]-[hash][extname]" : "assets/[name][extname]",
        manualChunks(id) {
          if (id.includes("node_modules/katex")) {
            return "katex";
          }
        },
      },
    },
  },
}));