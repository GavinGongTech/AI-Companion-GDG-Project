import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDUHFxuJt8qyTda9jBVcI5IVajdewV4YyA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gdg-ai-companion.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gdg-ai-companion",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gdg-ai-companion.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "966291933098",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:966291933098:web:d17e67fc12f89ae9244dd3",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-HXJRBN6X7Q",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
