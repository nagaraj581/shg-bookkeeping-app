// src/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDVKhGOfMw7eVg6hGszAGhadmxlHbzBVnk",
  authDomain: "shg-bookkeeping-app.firebaseapp.com",
  projectId: "shg-bookkeeping-app",
  storageBucket: "shg-bookkeeping-app.firebasestorage.app",
  messagingSenderId: "119893719501",
  appId: "1:119893719501:web:a86cf7470bedc302466c84",
  measurementId: "G-2FXB7ZPRXP",
};

// ✅ Prevent duplicate initialization errors
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ Export named instances
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// ✅ Default export for importing app if needed
export default app;
