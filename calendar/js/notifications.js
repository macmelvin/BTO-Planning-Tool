/**
 * Push notifications via Firebase Cloud Messaging (FCM).
 *
 * Why FCM and not the plain browser Notification API: Notification API
 * alone only fires while the tab is open — useless for "remind me 6 weeks
 * before the next launch," since nobody keeps this tab open for 6 weeks.
 * FCM lets a server-side Cloud Function (see functions/sendReminders.js)
 * push a notification to the user's device even when the app is closed.
 *
 * REQUIRES SETUP before this works:
 * 1. Firebase Console → Project Settings → Cloud Messaging → generate a
 *    Web Push certificate (VAPID key pair) — paste the public key below.
 * 2. firebase-messaging-sw.js must sit at the DOMAIN ROOT (not inside
 *    /calendar/), so it can control the whole origin's push scope.
 */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getMessaging,
  getToken,
  onMessage,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";
import {
  getFirestore,
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// TODO: same config as questionnaire/js/firebase-config.js — keep in sync,
// or better, extract to one shared config file both pages import from.
const firebaseConfig = {
  apiKey: "AIzaSyCrogqwbg6gzp3rghlem7GRNCPoWtdLxGQ",
  authDomain: "bto-planning-tool.firebaseapp.com",
  projectId: "bto-planning-tool",
  storageBucket: "bto-planning-tool.firebasestorage.app",
  messagingSenderId: "433070319814",
  appId: "1:433070319814:web:1f8cbb0a879f2161f64fc7",
};

// TODO: paste your VAPID public key from Firebase Console → Cloud Messaging
const VAPID_PUBLIC_KEY = "BDqNuxUTFwudpnnE_P1v6L_JASjUd_bD1KLzRkTJuGVTio67e_ZNCWGAezPM63rywDEa0CeXu5TQrAQdjDzZ3m8";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export async function enableLaunchReminders() {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    return { success: false, reason: "Push notifications aren't supported in this browser." };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { success: false, reason: "Notification permission was not granted." };
  }

  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return { success: false, reason: "Could not get a push registration token." };
    }

    const user = auth.currentUser;
    if (!user) {
      return { success: false, reason: "Not signed in yet — try again in a moment." };
    }

    // Store the token so the Cloud Function (functions/sendReminders.js)
    // knows where to deliver this user's reminders.
    await setDoc(
      doc(db, "users", user.uid, "notificationTokens", token),
      { token, createdAt: new Date().toISOString(), platform: navigator.platform },
      { merge: true }
    );

    return { success: true };
  } catch (err) {
    console.error("Failed to enable push reminders:", err);
    return { success: false, reason: "Something went wrong setting up notifications." };
  }
}

// Foreground message handler — fires when a push arrives while the tab is
// actually open. Background/closed-tab delivery is handled entirely by
// firebase-messaging-sw.js instead.
export function listenForForegroundMessages(onMessageCallback) {
  const messaging = getMessaging(app);
  onMessage(messaging, (payload) => {
    onMessageCallback(payload);
  });
}
