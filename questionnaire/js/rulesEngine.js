/**
 * BTO Eligibility & Priority Scheme Rules Engine
 * Implements the logic specified in docs/BTO-Eligibility-Rules-Engine.md
 *
 * Kept as pure functions operating on a plain Applicant object, decoupled
 * from the questionnaire UI — the UI's only job is to populate this shape
 * and call resolveApplicableSchemes(). See docs for the "why" behind each rule.
 */

// Scheme quota reference — mirrors config/seed-config-data.json.
// In production, fetch this from Firestore's /schemeDefinitions/* collection
// instead of hardcoding, so quota updates don't require a redeploy. Kept
// inline here for Sprint 1 so the questionnaire is demoable without wiring
// Firestore reads first.
export const SCHEME_QUOTA_NOTES = {
  FPPS: "Up to 40% of BTO flat supply, up to 60% of SBF flat supply",
  FCS_PROXIMITY: "Up to 30% of public supply for first-timer families",
  FCS_JOINT_BALLOTING: "15% reserved for parent, 15% reserved for child — separate queue numbers",
  TCPS: "Up to 10% of BTO flat supply, up to 10% of SBF flat supply",
  ASSIST: "5% for 2-room Flexi, 10% for 3-room (Standard flats only)",
  SPS: "Reserved quota for eligible 2-room Flexi applicants",
  TPS: "Up to 10% of eligible flat supply",
};

function hasChildUnder(applicant, ageLimit) {
  return applicant.children.some(
    (c) => c.citizenship === "SC" && c.age <= ageLimit
  );
}

function hasExpectingChildWithCert(applicant) {
  return applicant.children.some((c) => c.isFromExpecting === true);
}

function isFirstTimerFamily(applicant) {
  const spouseOk =
    applicant.maritalStatus !== "married" || applicant.spouseIsFirstTimer;
  return applicant.isFirstTimer && spouseOk;
}

export function evaluateEligibility(applicant) {
  const results = {};

  // --- First-Timer baseline ---
  results.isFirstTimerFamily = isFirstTimerFamily(applicant);

  // --- FT(PMC) — subset of FPPS-eligible applicants ---
  results.FTPMC =
    results.isFirstTimerFamily &&
    applicant.maritalStatus === "married" &&
    (hasChildUnder(applicant, 18) || hasExpectingChildWithCert(applicant));

  // --- FPPS ---
  results.FPPS =
    results.isFirstTimerFamily &&
    applicant.maritalStatus === "married" &&
    (hasChildUnder(applicant, 18) || hasExpectingChildWithCert(applicant));

  // --- FCS (Proximity) ---
  const parent = applicant.parentLink;
  results.FCS_Proximity = Boolean(
    parent &&
      parent.included &&
      (parent.parentCitizenship === "SC" || parent.parentCitizenship === "SPR") &&
      (parent.livingWithParent === true ||
        (parent.distanceToTargetFlatKm !== null &&
          parent.distanceToTargetFlatKm <= 4))
  );

  // --- FCS (Joint Balloting) ---
  const marriedChild = applicant.marriedChildLink;
  results.FCS_JointBalloting = Boolean(
    parent &&
      parent.included &&
      marriedChild &&
      marriedChild.included &&
      ["2RoomFlexi", "3Room"].includes(applicant.targetFlatType)
  );

  // --- TCPS ---
  const childCount = applicant.children.length;
  const expectingThird = applicant.children.some((c) => c.isFromExpecting);
  results.TCPS = Boolean(
    (applicant.citizenship === "SC" || applicant.spouseCitizenship === "SC") &&
      (childCount >= 3 || expectingThird) &&
      !applicant.previouslyBoughtFlatUnderTCPS
  );

  // --- ASSIST ---
  results.ASSIST = Boolean(
    applicant.isDivorcedOrWidowedWithChildUnder18 &&
      !applicant.ownedOrAcquiredPropertyAfterDivorceOrSpouseDeath &&
      ["2RoomFlexi", "3Room"].includes(applicant.targetFlatType)
  );

  // --- SPS (near existing home) ---
  // NOTE: senior age threshold not confirmed against an official source as of
  // this build — see docs/BTO-Eligibility-Rules-Engine.md open question.
  // Defaulting to 55 with a visible confidence flag rather than silently
  // guessing; surface `results.SPS_needsConfirmation` in the UI.
  results.SPS = Boolean(
    applicant.age >= 55 &&
      applicant.targetFlatType === "2RoomFlexi" &&
      applicant.ownsOrOccupiesExistingProperty
  );
  results.SPS_needsConfirmation = true;

  // --- TPS ---
  results.TPS = Boolean(
    applicant.currentlyHdbRentalTenant &&
      applicant.hdbRentalTenancyDurationYears >= 2 &&
      ["2RoomFlexi", "3Room"].includes(applicant.targetFlatType)
  );

  return results;
}

/**
 * Resolves which scheme(s) an applicant should apply under, and in what
 * ballot order, per the 1+1 stacking rule documented in the rules engine.
 */
export function resolveApplicableSchemes(eligibility) {
  let primary = null;
  let secondary = null;
  let ballotOrder = null;

  if (eligibility.FPPS) {
    primary = "FPPS";
    if (eligibility.TCPS) {
      secondary = "TCPS";
      ballotOrder = ["TCPS", "FPPS"]; // documented order: secondary balloted first
    } else if (eligibility.FCS_Proximity) {
      secondary = "FCS_Proximity";
      ballotOrder = null; // NOT confirmed — see open question in rules engine doc
    }
  }

  const eligibleList = Object.entries(eligibility)
    .filter(([key, val]) => val === true && SCHEME_QUOTA_NOTES[key])
    .map(([key]) => key);

  return { primary, secondary, ballotOrder, eligibleList };
}

export function buildEligibilityResult(applicant) {
  const eligibility = evaluateEligibility(applicant);
  const stacking = resolveApplicableSchemes(eligibility);

  const complianceFlags = [];
  if (eligibility.FCS_Proximity) {
    complianceFlags.push(
      "FCS (Proximity): the qualifying parent/child must continue living with you or within 4km through your flat's Minimum Occupation Period."
    );
  }
  if (eligibility.SPS_needsConfirmation && eligibility.SPS) {
    complianceFlags.push(
      "Senior Priority Scheme eligibility shown here uses an unconfirmed age threshold — verify directly with HDB before relying on this."
    );
  }

  return {
    isFirstTimerFamily: eligibility.isFirstTimerFamily,
    qualifiesForFTPMC: eligibility.FTPMC,
    eligibleSchemes: stacking.eligibleList.map((key) => ({
      scheme: key,
      quotaNote: SCHEME_QUOTA_NOTES[key] || "",
    })),
    recommendedStacking: {
      primary: stacking.primary,
      secondary: stacking.secondary,
      ballotOrder: stacking.ballotOrder,
    },
    complianceFlags,
    disclaimer:
      "This is an estimate based on publicly available HDB rules. Confirm your actual eligibility via your HFE letter application — HDB's own assessment is final.",
  };
}
