const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

// Sprint 6: reads /launchWindows/* from Firestore directly, no more
// launchWindows.json duplicate. That file was a real risk flagged in
// Sprint 3 — this function and calendar/js/launchCalendar.js could drift
// out of sync if updated separately. Now there's exactly one place this
// data lives, managed via admin/.

const HFE_LEAD_WEEKS = 6;

function getUpcomingReminders(launchWindows, today) {
  const reminders = [];
  for (const w of launchWindows) {
    const openDate = new Date(w.applicationOpenDate);
    const hfeDeadline = new Date(openDate);
    hfeDeadline.setDate(hfeDeadline.getDate() - HFE_LEAD_WEEKS * 7);

    const daysToOpen = Math.ceil((openDate - today) / (1000 * 60 * 60 * 24));
    const daysToHfe = Math.ceil((hfeDeadline - today) / (1000 * 60 * 60 * 24));

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

exports.sendLaunchReminders = onSchedule(
  { schedule: "every day 09:00", timeZone: "Asia/Singapore" },
  async () => {
    const db = admin.firestore();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const windowsSnap = await db.collection("launchWindows").get();
    const launchWindows = windowsSnap.docs.map((d) => d.data());

    const reminders = getUpcomingReminders(launchWindows, today);
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
    }
  }
);
