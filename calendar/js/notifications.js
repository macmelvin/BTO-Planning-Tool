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
 *
 * Config consolidation note: this file now imports the already-initialized
 * `app`, `auth`, and `db` from questionnaire/js/firebase-config.js instead
 * of calling initializeApp() again with its own copy of the credentials —
 * that duplication was the same pattern that caused the Sprint 6 rework
 * for launch windows, fixed here before it caused the same problem twice.
 *
 * firebase-messaging-sw.js (the service worker) still has its own copy of
 * the config, and that one genuinely can't be consolidated the same way:
 * it's registered as a classic script (not an ES module), so it can't use
 * `import` — only `importScripts()`, which doesn't support importing a
 * plain JS object from another file the way ES modules do. Left as a
 * documented exception rather than silently duplicated without explanation.
 */
import {
  getMessaging,
  getToken,
  onMessage,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";
import {
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { app, auth, db } from "../../questionnaire/js/firebase-config.js";

// TODO: paste your VAPID public key from Firebase Console → Cloud Messaging
const VAPID_PUBLIC_KEY = "YOUR_VAPID_PUBLIC_KEY";

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
