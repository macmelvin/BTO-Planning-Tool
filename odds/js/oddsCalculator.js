/**
 * Odds Calculator — tiered qualitative estimates only.
 *
 * HDB doesn't publish per-scheme queue data, only overall application
 * rates. A precise-looking percentage ("73% chance") would imply data
 * that doesn't exist. This returns one of three honest tiers instead —
 * see docs/BTO-OddsCalculator-and-Questionnaire.md section A3 for the
 * full reasoning this implements.
 */
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { app } from "../../questionnaire/js/firebase-config.js";

const db = getFirestore(app);

// Community-observed dropout benchmarks — same source/caveats as
// config/seed-config-data.json. These are estimates, not HDB-published.
const DROPOUT_BENCHMARKS = {
  mature: 1.17,
  nonMature: 1.02,
};

export async function listProjects() {
  const snap = await getDocs(collection(db, "projects"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getFlatTypeOffering(projectId, flatType) {
  const ref = doc(db, "projects", projectId, "flatTypeOfferings", flatType);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function getExerciseSummary(exercise) {
  const ref = doc(db, "exerciseSummaries", exercise);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/**
 * queueNumber: the user's actual queue number, once HDB releases it.
 * project: the project doc (for townMaturity).
 * offering: the flatTypeOffering doc (for totalUnitsSupply).
 */
export function estimateOdds(queueNumber, project, offering) {
  if (!offering || offering.totalUnitsSupply == null) {
    return {
      tier: "insufficient-data",
      message: "We don't have a confirmed unit count for this flat type yet — can't estimate odds honestly without it.",
    };
  }

  const supply = offering.totalUnitsSupply;
  const dropoutMultiplier = DROPOUT_BENCHMARKS[project.townMaturity] || DROPOUT_BENCHMARKS.nonMature;

  let tier, message;
  if (queueNumber <= supply) {
    tier = "within-supply";
    message = "Within supply — historically a high chance of selection.";
  } else if (queueNumber <= supply * dropoutMultiplier) {
    tier = "borderline";
    message = "Borderline — selection has historically depended on dropout rate this close to supply.";
  } else {
    tier = "unlikely";
    message = "Above the historical dropout range — selection is unlikely based on past patterns.";
  }

  return {
    tier,
    message,
    effectiveSupply: supply,
    queueNumber,
    disclaimer: "Based on historical patterns, not a guarantee. HDB's actual allocation process is the only authoritative source.",
  };
}

/**
 * Application-rate-only estimate — used on the Reference screen, where we
 * don't have a specific queue number, just "is this project/flat-type
 * competitive." Distinct from estimateOdds() above, which needs a real
 * queue number to be meaningful.
 */
export function describeApplicationRate(rate) {
  if (rate == null) return { label: "No data yet", tone: "neutral" };
  if (rate < 1.7) return { label: `${rate.toFixed(1)}x — most applicants historically get a unit`, tone: "good" };
  if (rate < 3) return { label: `${rate.toFixed(1)}x — moderately competitive`, tone: "caution" };
  return { label: `${rate.toFixed(1)}x — highly competitive`, tone: "high" };
}
