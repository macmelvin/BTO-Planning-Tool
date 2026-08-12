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

const firebaseConfig = {
  apiKey: "AIzaSyCrogqwbg6gzp3rghlem7GRNCPoWtdLxGQ",
  authDomain: "bto-planning-tool.firebaseapp.com",
  projectId: "bto-planning-tool",
  storageBucket: "bto-planning-tool.firebasestorage.app",
  messagingSenderId: "433070319814",
  appId: "1:433070319814:web:1f8cbb0a879f2161f64fc7",
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
