// Firebase init — anonymous auth first (see docs/sprint0-auth-setup.md for
// the reasoning: frictionless start, upgrade to a linked account later).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// TODO: replace with your actual Firebase project config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export function ensureSignedIn() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        resolve(user);
      } else {
        signInAnonymously(auth).then((cred) => resolve(cred.user)).catch(reject);
      }
    });
  });
}

export async function saveProgress(userId, stepData) {
  const ref = doc(db, "users", userId, "eligibilityAnswers", "current");
  await setDoc(ref, stepData, { merge: true });
}

export async function loadProgress(userId) {
  const ref = doc(db, "users", userId, "eligibilityAnswers", "current");
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}
