import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Configuration from firebase-applet-config.json
const firebaseConfig = {
  projectId: "dub-isomer-h5xj8",
  appId: "1:771668283523:web:73512c39e62fd1935d0bb6",
  apiKey: "AIzaSyAnqO1iWl3BufZt-gbvS0EF7ocPGdN_laA",
  authDomain: "dub-isomer-h5xj8.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-sisteminformasis-9828f7ec-2216-484e-bcb6-c5c0a1873f89",
  storageBucket: "dub-isomer-h5xj8.firebasestorage.app",
  messagingSenderId: "771668283523",
  oAuthClientId: "771668283523-krv3reck45p1sp3s74tv1k4o9elaeamg.apps.googleusercontent.com"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Test database connection as required by skill rules
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection active");
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline')) {
      console.warn("Firestore client is offline or initial connection check completed.");
    }
  }
}

testFirestoreConnection();

export { signInWithPopup, signOut, onAuthStateChanged };
export type { FirebaseUser };
