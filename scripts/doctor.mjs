import { access, constants, readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { isSafeApiUrl } from "../packages/shared/src/index.ts";

const rootDir = process.cwd();

function parseEnvFile(content) {
  const values = {};

  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    values[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }

  return values;
}

async function readEnvFile(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  const content = await readFile(absolutePath, "utf8");
  return parseEnvFile(content);
}

async function fileExists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function checkPortAvailability(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

function hasFirebaseClientConfig(env) {
  return Boolean(
    env.VITE_FIREBASE_API_KEY
    && env.VITE_FIREBASE_AUTH_DOMAIN
    && env.VITE_FIREBASE_PROJECT_ID,
  );
}

export async function runDoctor({ strict = true } = {}) {
  const errors = [];
  const warnings = [];

  const requiredFiles = [
    "server/.env",
    "web/.env.local",
    "extension/.env.local",
  ];

  for (const file of requiredFiles) {
    if (!(await fileExists(path.join(rootDir, file)))) {
      errors.push(`Missing ${file}. Run \`bun run setup\` first.`);
    }
  }

  const [serverEnv, webEnv, extensionEnv] = await Promise.all([
    fileExists(path.join(rootDir, "server/.env")) ? readEnvFile("server/.env") : {},
    fileExists(path.join(rootDir, "web/.env.local")) ? readEnvFile("web/.env.local") : {},
    fileExists(path.join(rootDir, "extension/.env.local")) ? readEnvFile("extension/.env.local") : {},
  ]);

  if (!serverEnv.GEMINI_API_KEY) {
    (strict ? errors : warnings).push("`server/.env` is missing GEMINI_API_KEY.");
  }

  if (!serverEnv.FIREBASE_PROJECT_ID) {
    warnings.push("`server/.env` is missing FIREBASE_PROJECT_ID.");
  }

  if (serverEnv.GOOGLE_APPLICATION_CREDENTIALS) {
    const credentialsPath = path.isAbsolute(serverEnv.GOOGLE_APPLICATION_CREDENTIALS)
      ? serverEnv.GOOGLE_APPLICATION_CREDENTIALS
      : path.join(rootDir, serverEnv.GOOGLE_APPLICATION_CREDENTIALS);

    if (!(await fileExists(credentialsPath))) {
      (strict ? errors : warnings).push(
        `GOOGLE_APPLICATION_CREDENTIALS does not exist: ${credentialsPath}`,
      );
    }
  } else {
    warnings.push("`server/.env` does not set GOOGLE_APPLICATION_CREDENTIALS.");
  }

  if (!hasFirebaseClientConfig(webEnv)) {
    warnings.push("`web/.env.local` is missing one or more VITE_FIREBASE_* values.");
  }

  if (!hasFirebaseClientConfig(extensionEnv)) {
    warnings.push("`extension/.env.local` is missing one or more VITE_FIREBASE_* values.");
  }

  for (const [label, apiUrl] of [
    ["web", webEnv.VITE_API_URL],
    ["extension", extensionEnv.VITE_API_URL],
  ]) {
    if (!apiUrl) {
      warnings.push(`\`${label}/.env.local\` is missing VITE_API_URL. Defaulting to localhost.`);
      continue;
    }

    if (!isSafeApiUrl(apiUrl, false)) {
      errors.push(`\`${label}/.env.local\` has an unsafe or invalid VITE_API_URL: ${apiUrl}`);
    }
  }

  for (const [label, port] of [
    ["server", 3000],
    ["web", 5173],
  ]) {
    const available = await checkPortAvailability(port);
    if (!available) {
      warnings.push(`${label} port ${port} is already in use.`);
    }
  }

  const summaryLines = [
    ...errors.map((message) => `error: ${message}`),
    ...warnings.map((message) => `warn: ${message}`),
  ];

  if (summaryLines.length === 0) {
    process.stdout.write("doctor: all checks passed\n");
  } else {
    for (const line of summaryLines) {
      process.stdout.write(`${line}\n`);
    }
  }

  if (strict && errors.length > 0) {
    process.exitCode = 1;
  }

  return { errors, warnings };
}

if (import.meta.main) {
  await runDoctor({ strict: true });
}
