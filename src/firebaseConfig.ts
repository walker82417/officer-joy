// src/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCV7L52H_T3GjewWk2cfJnSI7P6FI3-Uww",
  authDomain: "officer-joy.firebaseapp.com",
  projectId: "officer-joy",
  storageBucket: "officer-joy.firebasestorage.app",
  messagingSenderId: "206841124508",
  appId: "1:206841124508:web:f3857de2fa2c1e08a07f59"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
