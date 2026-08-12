/**
 * BTO Launch Calendar — static/manually-updated data, per Sprint 3 scope.
 *
 * HDB runs BTO launches on a quarterly cycle: Feb, May, Aug, Nov. Exact
 * project names and dates for a given quarter are only announced roughly
 * 1-2 months ahead, so this file holds the *known* launch windows (update
 * each quarter as HDB announces them) plus logic to project future windows
 * when a specific one isn't yet announced.
 *
 * Update this file every quarter — same "config as data" principle as
 * schemeConfig.js. In production, move this to Firestore too
 * (/launchWindows/*) so updates don't need a redeploy.
 */

// Known/announced launch windows — update as HDB confirms each quarter.
// dateConfirmed: false means this is a projected date based on the
// quarterly pattern, not an official HDB announcement yet.
export const LAUNCH_WINDOWS = [
  { quarter: "2026-08", applicationOpenDate: "2026-08-19", dateConfirmed: true, towns: ["Tengah", "Bukit Merah", "Kallang Whampoa"] },
  { quarter: "2026-11", applicationOpenDate: "2026-11-18", dateConfirmed: false, towns: [] },
  { quarter: "2027-02", applicationOpenDate: "2027-02-17", dateConfirmed: false, towns: [] },
];

const HFE_LEAD_WEEKS = 6;

export function getNextLaunchWindow(fromDate = new Date()) {
  const upcoming = LAUNCH_WINDOWS.filter(
    (w) => new Date(w.applicationOpenDate) >= fromDate
  ).sort((a, b) => new Date(a.applicationOpenDate) - new Date(b.applicationOpenDate));
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
