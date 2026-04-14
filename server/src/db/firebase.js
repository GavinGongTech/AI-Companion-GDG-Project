import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "node:fs";

function loadServiceAccount() {
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!credentials) return null;

  try {
    if (credentials.startsWith("{")) {
      return JSON.parse(credentials);
    }
    const raw = readFileSync(credentials, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid GOOGLE_APPLICATION_CREDENTIALS: ${message}`, { cause: err });
  }
}

// Initialize Firebase Admin SDK.
// In production, provide GOOGLE_APPLICATION_CREDENTIALS env var pointing to
// a service account JSON file. In dev, you can also set individual env vars.
if (getApps().length === 0) {
  const serviceAccount = loadServiceAccount();
  if (serviceAccount) {
    initializeApp({ credential: cert(serviceAccount) });
  } else if (process.env.FIREBASE_PROJECT_ID) {
    initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  } else {
    // Falls back to Application Default Credentials (e.g. gcloud auth)
    initializeApp();
  }
}

export const db = getFirestore();
export const auth = getAuth();
