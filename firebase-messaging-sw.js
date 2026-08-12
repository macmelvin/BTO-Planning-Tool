// firebase-messaging-sw.js
// MUST live at the domain root (not in a subfolder) so its push scope
// covers the whole site. This handles notifications that arrive while
// the app/tab is closed — foreground handling is in calendar/js/notifications.js.

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// Same config as calendar/js/notifications.js — keep in sync.
firebase.initializeApp({
  apiKey: "AIzaSyCrogqwbg6gzp3rghlem7GRNCPoWtdLxGQ",
  authDomain: "bto-planning-tool.firebaseapp.com",
  projectId: "bto-planning-tool",
  storageBucket: "bto-planning-tool.firebasestorage.app",
  messagingSenderId: "433070319814",
  appId: "1:433070319814:web:1f8cbb0a879f2161f64fc7",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "BTO Planning Tool", {
    body: body || "You have a new reminder.",
    icon: "/icon-192.png", // TODO: add a real app icon at this path
  });
});
