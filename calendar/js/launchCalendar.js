/**
 * BTO Launch Calendar — Sprint 6: now reads from Firestore's
 * /launchWindows/* collection (managed via admin/) instead of a hardcoded
 * array. This eliminates the duplication risk flagged in Sprint 3, where
 * this data lived separately in calendar/js/launchCalendar.js AND
 * functions/launchWindows.json and had to be kept in sync by hand.
 */
import {
  getFirestore,
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { app } from "../../questionnaire/js/firebase-config.js";

const db = getFirestore(app);
const HFE_LEAD_WEEKS = 6;

export async function listLaunchWindows() {
  const snap = await getDocs(collection(db, "launchWindows"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getNextLaunchWindow(fromDate = new Date()) {
  const windows = await listLaunchWindows();
  const upcoming = windows
    .filter((w) => new Date(w.applicationOpenDate) >= fromDate)
    .sort((a, b) => new Date(a.applicationOpenDate) - new Date(b.applicationOpenDate));
  return upcoming[0] || null;
}

export function getHfeDeadline(launchWindow) {
  if (!launchWindow) return null;
  const openDate = new Date(launchWindow.applicationOpenDate);
  const deadline = new Date(openDate);
  deadline.setDate(deadline.getDate() - HFE_LEAD_WEEKS * 7);
  return deadline;
}

export function daysUntil(dateObj, fromDate = new Date()) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((dateObj.getTime() - fromDate.getTime()) / msPerDay);
}

export function formatDate(dateObj) {
  return dateObj.toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" });
}
