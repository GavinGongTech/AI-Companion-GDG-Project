import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Initialize Firebase Admin SDK.
// In production, provide GOOGLE_APPLICATION_CREDENTIALS env var pointing to
// a service account JSON file. In dev, you can also set individual env vars.
if (getApps().length === 0) {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp({ credential: cert(process.env.GOOGLE_APPLICATION_CREDENTIALS) });
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
