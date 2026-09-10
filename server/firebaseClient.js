import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// These match the Firebase web config you shared. Web/app config values
// like `apiKey` here are meant to be public (they identify your project,
// they don't grant access by themselves) — what actually protects your
// data are the Realtime Database *rules* in the Firebase console.
// Make sure your rules require some form of auth before this goes live
// publicly; for local/personal use, test-mode rules are fine.
//
// You can also override any of these via .env instead of editing this file.
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getDatabase(firebaseApp);
