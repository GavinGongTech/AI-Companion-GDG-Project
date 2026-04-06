// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {getAuth} from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDUHFxuJt8qyTda9jBVcI5IVajdewV4YyA",
  authDomain: "gdg-ai-companion.firebaseapp.com",
  projectId: "gdg-ai-companion",
  storageBucket: "gdg-ai-companion.firebasestorage.app",
  messagingSenderId: "966291933098",
  appId: "1:966291933098:web:d17e67fc12f89ae9244dd3",
  measurementId: "G-HXJRBN6X7Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

export {app, analytics, auth};