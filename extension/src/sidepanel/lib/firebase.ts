import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDUHFxuJt8qyTda9jBVcI5IVajdewV4YyA",
  authDomain: "gdg-ai-companion.firebaseapp.com",
  projectId: "gdg-ai-companion",
  storageBucket: "gdg-ai-companion.firebasestorage.app",
  messagingSenderId: "966291933098",
  appId: "1:966291933098:web:757347a5992982d6276189",
};

function isValidFirebaseValue(value: string | undefined): boolean {
  return Boolean(value) && value !== "undefined" && value !== "null";
}

const hasFirebaseConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId
].every((v) => isValidFirebaseValue(v));

let auth: Auth | null = null;

if (hasFirebaseConfig) {
  const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
} else if (import.meta.env.DEV) {
  console.warn("Firebase config is missing or invalid in the extension build.");
}

export { auth, hasFirebaseConfig };
