/**
 * One-time migration: moves the 3 launch windows that previously lived in
 * calendar/js/launchCalendar.js and functions/launchWindows.json into
 * Firestore's /launchWindows/* collection — the new single source of truth.
 *
 * Run once: node scripts/migrateLaunchWindows.js
 * Uses the same service account key as scripts/seedProjects.js.
 * Safe to re-run — setDoc overwrites by quarter ID, doesn't duplicate.
 */
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const EXISTING_WINDOWS = [
  { quarter: "2026-08", applicationOpenDate: "2026-08-19", dateConfirmed: true, towns: ["Tengah", "Bukit Merah", "Kallang Whampoa"] },
  { quarter: "2026-11", applicationOpenDate: "2026-11-18", dateConfirmed: false, towns: [] },
  { quarter: "2027-02", applicationOpenDate: "2027-02-17", dateConfirmed: false, towns: [] },
];

async function migrate() {
  for (const w of EXISTING_WINDOWS) {
    await db.collection("launchWindows").doc(w.quarter).set(w);
    console.log(`Migrated ${w.quarter}`);
  }
  console.log("Done. You can now manage these via /admin/ instead of editing files.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
