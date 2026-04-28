import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert, getApps, ServiceAccount } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveCredentialPath(pathValue: string | undefined): string | null {
  if (!pathValue || typeof pathValue !== "string") return null;
  const trimmed = pathValue.trim();
  if (!trimmed) return null;
  return isAbsolute(trimmed) ? trimmed : resolve(process.cwd(), trimmed);
}

function toServiceAccountConfig(json: any): { credential: any; projectId?: string } {
  if (!json?.client_email || !json?.private_key) {
    throw new Error(
      "Service account JSON is missing client_email or private_key — use a key from Firebase Console.",
    );
  }
  return {
    credential: cert(json as ServiceAccount),
    projectId: json.project_id,
  };
}

function parseServiceAccountJson(raw: string, sourceLabel: string): { credential: any; projectId?: string } {
  try {
    return toServiceAccountConfig(JSON.parse(raw));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid Firebase service account JSON from ${sourceLabel}: ${message}`, {
      cause: err,
    });
  }
}

function loadServiceAccountFromFile(pathValue: string): { credential: any; projectId?: string } | null {
  const abs = resolveCredentialPath(pathValue);
  if (!abs) return null;
  if (!existsSync(abs)) {
    throw new Error(`Firebase credentials file not found: ${abs}`);
  }
  return parseServiceAccountJson(readFileSync(abs, "utf8"), abs);
}

function loadServiceAccountConfig(): { credential: any; projectId?: string } | null {
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (credentials) {
    if (credentials.startsWith("{")) {
      return parseServiceAccountJson(credentials, "GOOGLE_APPLICATION_CREDENTIALS");
    }
    return loadServiceAccountFromFile(credentials);
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath) {
    return loadServiceAccountFromFile(serviceAccountPath);
  }

  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inlineJson) {
    return parseServiceAccountJson(inlineJson, "FIREBASE_SERVICE_ACCOUNT_JSON");
  }

  const defaultFile = join(__dirname, "serviceAccount.json");
  if (existsSync(defaultFile)) {
    return loadServiceAccountFromFile(defaultFile);
  }

  return null;
}

function initFirebaseAdmin() {
  if (getApps().length > 0) return;

  const loaded = loadServiceAccountConfig();
  if (loaded) {
    initializeApp({
      credential: loaded.credential,
      projectId: loaded.projectId || process.env.FIREBASE_PROJECT_ID,
    });
    return;
  }

  if (process.env.FIREBASE_PROJECT_ID) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
    return;
  }

  // Falls back to Application Default Credentials (e.g. gcloud auth)
  initializeApp();
}

initFirebaseAdmin();

export const db = getFirestore();
export const auth = getAuth();
