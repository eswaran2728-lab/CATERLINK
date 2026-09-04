import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, type Auth, type User } from "firebase/auth";

/**
 * Browser-side Firebase bootstrap. Same Firebase project as VECTA
 * (airasia-avsec-auth) — these NEXT_PUBLIC_FIREBASE_* values are the same
 * ones from that project's registered web app config, set again here
 * since env vars don't cross Vercel projects. Not secrets either way.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
function getFirebaseClientApp(): FirebaseApp {
  if (app) return app;
  const existing = getApps();
  app = existing.length > 0 ? existing[0]! : initializeApp(firebaseConfig);
  return app;
}

let authInstance: Auth | null = null;
export function getFirebaseClientAuth(): Auth {
  if (!authInstance) authInstance = getAuth(getFirebaseClientApp());
  return authInstance;
}

function createGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  const domain = process.env.NEXT_PUBLIC_AVSEC_WORKSPACE_DOMAIN;
  if (domain) provider.setCustomParameters({ hd: domain });
  return provider;
}

/** Opens the Google sign-in popup and returns the signed-in user. */
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(getFirebaseClientAuth(), createGoogleProvider());
  return result.user;
}
