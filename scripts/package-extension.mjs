import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const extensionDist = path.join(rootDir, "extension", "dist");
const outputDir = path.join(rootDir, "web", "public", "downloads");
const outputFile = path.join(outputDir, "study-flow-extension.zip");
const deployedOutputDir = path.join(rootDir, "web", "dist", "downloads");
const deployedOutputFile = path.join(
  deployedOutputDir,
  "study-flow-extension.zip",
);

async function ensureBuildExists() {
  const files = await readdir(extensionDist);
  if (files.length === 0) {
    throw new Error("extension/dist is empty. Run `bun run --cwd extension build` first.");
  }
}

function runZip(sourceDir, destinationFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "zip",
      ["-qr", destinationFile, "."],
      {
        cwd: sourceDir,
        stdio: ["ignore", "inherit", "inherit"],
      },
    );

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `zip failed with ${signal ? `signal ${signal}` : `exit code ${code}`}`,
        ),
      );
    });
  });
}

await ensureBuildExists();
await mkdir(outputDir, { recursive: true });
await rm(outputFile, { force: true });
await runZip(extensionDist, outputFile);

await mkdir(deployedOutputDir, { recursive: true });
await rm(deployedOutputFile, { force: true });
await runZip(extensionDist, deployedOutputFile);

process.stdout.write(`created ${path.relative(rootDir, outputFile)}\n`);
