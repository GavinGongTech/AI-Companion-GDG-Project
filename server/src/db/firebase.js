import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

//this file connects server to firebase admin

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Resolve a path from env: absolute paths is the same, else relative to process.cwd() */
function resolveCredentialPath(p) {
  if (!p || typeof p !== "string") return null;
  const trimmed = p.trim();
  if (!trimmed) return null;
  return isAbsolute(trimmed) ? trimmed : resolve(process.cwd(), trimmed);
}

/**
 * Load service account JSON from disk and return { credential, projectId }.
 * Firebase Console → Project settings → Service accounts → Generate new private key.
 */
function loadServiceAccountFromFile(filePath) {
  const abs = resolveCredentialPath(filePath);
  if (!abs || !existsSync(abs)) return null;
  const json = JSON.parse(readFileSync(abs, "utf8"));
  if (!json.client_email || !json.private_key) {
    throw new Error(
      "Service account JSON is missing client_email or private_key — use the key from Firebase Console.",
    );
  }
  return {
    credential: cert(json),
    projectId: json.project_id,
  };
}

function initFirebaseAdmin() {
  if (getApps().length > 0) return;

  // Path via standard Google env (absolute or relative to server cwd)
  const pathEnv =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  let loaded = pathEnv ? loadServiceAccountFromFile(pathEnv) : null;

  // Default: place the downloaded JSON next to this file as serviceAccount.json
  if (!loaded) {
    const defaultFile = join(__dirname, "serviceAccount.json");
    if (existsSync(defaultFile)) {
      loaded = loadServiceAccountFromFile(defaultFile);
    }
  }

  // Hosted platforms
  if (!loaded && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const json = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    loaded = {
      credential: cert(json),
      projectId: json.project_id,
    };
  }

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

  // Application Default Credentials (e.g. gcloud auth application-default login)
  initializeApp();
}

initFirebaseAdmin();

export const db = getFirestore();
export const auth = getAuth();
