import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { secureStorage } from './secureStorage';

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const { getAuth, initializeAuth } = FirebaseAuth;
type FirebasePersistenceStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const getReactNativePersistence = (
  FirebaseAuth as unknown as {
    getReactNativePersistence?: (
      storage: FirebasePersistenceStorage
    ) => FirebaseAuth.Persistence;
  }
).getReactNativePersistence;

let authInstance: FirebaseAuth.Auth;
try {
  const persistence = getReactNativePersistence?.(secureStorage);
  authInstance = persistence
    ? initializeAuth(app, { persistence })
    : getAuth(app);
} catch {
  authInstance = getAuth(app);
}

export const auth: FirebaseAuth.Auth = authInstance;
export const db = getFirestore(app);
export { app };
