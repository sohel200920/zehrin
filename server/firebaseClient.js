import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// These match the Firebase web config you shared. Web/app config values
// like `apiKey` here are meant to be public (they identify your project,
// they don't grant access by themselves) — what actually protects your
// data are the Realtime Database *rules* in the Firebase console.
// Make sure your rules require some form of auth before this goes live
// publicly; for local/personal use, test-mode rules are fine.
//
// Environment variables override these public Firebase web config values.
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyAUcuFEfv45O4zJxx6bzZsd3LiBries4Yw",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "zehrin-a6804.firebaseapp.com",
  databaseURL:
    process.env.FIREBASE_DATABASE_URL || "https://zehrin-a6804-default-rtdb.firebaseio.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "zehrin-a6804",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "zehrin-a6804.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "887381500819",
  appId: process.env.FIREBASE_APP_ID || "1:887381500819:web:37fb5f989244fe66"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getDatabase(firebaseApp);
