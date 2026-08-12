const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

// initializeApp() is already called in functions/index.js — this file
// assumes that's imported first. If deploying standalone, uncomment:
// admin.initializeApp();

const LAUNCH_WINDOWS = require("./launchWindows.json");
const HFE_LEAD_WEEKS = 6;

function getUpcomingReminders(today) {
  const reminders = [];
  for (const w of LAUNCH_WINDOWS) {
    const openDate = new Date(w.applicationOpenDate);
    const hfeDeadline = new Date(openDate);
    hfeDeadline.setDate(hfeDeadline.getDate() - HFE_LEAD_WEEKS * 7);

    const daysToOpen = Math.ceil((openDate - today) / (1000 * 60 * 60 * 24));
    const daysToHfe = Math.ceil((hfeDeadline - today) / (1000 * 60 * 60 * 24));

    // Fire once, on the day itself — this function runs daily, so a
    // same-day match is how we avoid re-sending every day in the window.
    if (daysToHfe === 0) {
      reminders.push({
        title: "HFE letter deadline approaching",
        body: `Apply for your HFE letter now — the ${w.quarter} BTO launch opens in 6 weeks.`,
      });
    }
    if (daysToOpen === 0) {
      reminders.push({
        title: "BTO applications are open",
        body: `The ${w.quarter} BTO launch is open for applications today.`,
      });
    }
  }
  return reminders;
}

/**
 * Runs once daily. Checks the static launch calendar for any reminder
 * that should fire today, then pushes to every registered device token
 * across all users. This is a broadcast, not per-user targeting — every
 * user gets the same launch-cycle reminders, since the calendar itself
 * isn't personalized (personalized eligibility-based targeting would be
 * a v1.5 enhancement, not Sprint 3 scope).
 */
exports.sendLaunchReminders = onSchedule(
  { schedule: "every day 09:00", timeZone: "Asia/Singapore" },
  async () => {
    const db = admin.firestore();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reminders = getUpcomingReminders(today);
    if (reminders.length === 0) {
      console.log("No reminders due today.");
      return;
    }

    const usersSnap = await db.collection("users").get();
    const tokens = [];
    for (const userDoc of usersSnap.docs) {
      const tokensSnap = await userDoc.ref.collection("notificationTokens").get();
      tokensSnap.forEach((t) => tokens.push(t.id));
    }

    if (tokens.length === 0) {
      console.log("No registered device tokens — nothing to send.");
      return;
    }

    for (const reminder of reminders) {
      const message = {
        notification: { title: reminder.title, body: reminder.body },
        tokens,
      };
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(
        `Sent "${reminder.title}": ${response.successCount} succeeded, ${response.failureCount} failed`
      );
      // TODO: for failed sends, check response.responses[i].error.code —
      // "messaging/registration-token-not-registered" means that token is
      // stale (user uninstalled, cleared data, etc.) and should be deleted
      // from Firestore so future sends don't keep failing on it. Not
      // implemented here — worth adding once you see real failure volume.
    }
  }
);
