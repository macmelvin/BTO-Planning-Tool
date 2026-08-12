/**
 * BTO Eligibility & Priority Scheme Rules Engine — Sprint 2 refactor.
 *
 * Sprint 1 hardcoded one JS function per scheme. That meant every HDB rule
 * change (and they've already changed once, July 2025) required editing
 * this file and shipping a new app release. This version is a generic
 * condition interpreter that reads scheme rules from schemeConfig.js (or,
 * in production, from Firestore's /schemeDefinitions/* collection) — so a
 * quota or condition change becomes a data update, not a code change.
 */
import { SCHEME_CONFIG } from "./schemeConfig.js";

// ---------- Derived facts (computed once, reused across all schemes) ----------
function computeDerivedFacts(applicant) {
  // Step 1 of the questionnaire asks for the spouse/fiancé(e)'s first-timer
  // status whenever maritalStatus is "married" OR "engaged" — this check
  // must cover both, or an engaged applicant's fiancé(e) answer is silently
  // ignored and a second-timer fiancé(e) wrongly counts as a first-timer family.
  const hasSpouseOrFiance =
    applicant.maritalStatus === "married" || applicant.maritalStatus === "engaged";
  const spouseOk = !hasSpouseOrFiance || applicant.spouseIsFirstTimer;
  return {
    isFirstTimerFamily: Boolean(applicant.isFirstTimer && spouseOk),
  };
}

// ---------- Generic condition interpreter ----------
// `op` list — this is the small vocabulary every scheme's conditions are
// built from. Add a new op here (and use it in schemeConfig.js) rather than
// writing a bespoke per-scheme function, so the vocabulary stays reusable.
function getField(applicant, path) {
  return path.split(".").reduce((obj, key) => (obj == null ? null : obj[key]), applicant);
}

function evaluateCondition(cond, applicant, derived) {
  if (cond.all) return cond.all.every((c) => evaluateCondition(c, applicant, derived));
  if (cond.any) return cond.any.some((c) => evaluateCondition(c, applicant, derived));
  if (cond.not) return !evaluateCondition(cond.not, applicant, derived);
  if (!cond.op) {
    throw new Error(
      `Malformed rules-engine condition — expected "all", "any", "not", or "op", got: ${JSON.stringify(cond)}`
    );
  }

  switch (cond.op) {
    case "isFirstTimerFamily":
      return derived.isFirstTimerFamily;
    case "fieldEquals":
      return getField(applicant, cond.field) === cond.value;
    case "fieldIn":
      return cond.values.includes(getField(applicant, cond.field));
    case "fieldGte":
      return (getField(applicant, cond.field) ?? -Infinity) >= cond.value;
    case "ageGte":
      return (applicant.age ?? -Infinity) >= cond.value;
    case "hasChildUnder":
      return applicant.children.some((c) => c.citizenship === "SC" && c.age <= cond.ageLimit);
    case "hasExpectingChild":
      return applicant.children.some((c) => c.isFromExpecting === true);
    case "childCountGte":
      return applicant.children.length >= cond.value;
    case "flatTypeIn":
      return cond.values.includes(applicant.targetFlatType);
    case "parentIncluded":
      return Boolean(applicant.parentLink && applicant.parentLink.included);
    case "marriedChildIncluded":
      return Boolean(applicant.marriedChildLink && applicant.marriedChildLink.included);
    case "parentProximityOk": {
      const p = applicant.parentLink;
      if (!p || !p.included) return false;
      return Boolean(
        p.livingWithParent === true ||
          (p.distanceToTargetFlatKm !== null && p.distanceToTargetFlatKm <= cond.maxKm)
      );
    }
    default:
      // Fail closed — an unrecognized op should never silently grant
      // eligibility. Surfacing this in dev is safer than a false positive.
      console.warn(`Unknown rules-engine condition op: "${cond.op}"`);
      return false;
  }
}

// ---------- Public API ----------
export function evaluateEligibility(applicant) {
  const derived = computeDerivedFacts(applicant);
  const results = { isFirstTimerFamily: derived.isFirstTimerFamily };

  for (const [schemeKey, scheme] of Object.entries(SCHEME_CONFIG)) {
    results[schemeKey] = evaluateCondition(scheme.eligibilityConditions, applicant, derived);
  }

  // FT(PMC) is a UI-facing sub-label of FPPS eligibility, not a separately
  // configured scheme (see docs/BTO-Eligibility-Rules-Engine.md) — kept as
  // a direct alias here rather than a duplicate config entry.
  results.FTPMC = results.FPPS;

  return results;
}

export function resolveApplicableSchemes(eligibility) {
  let primary = null;
  let secondary = null;
  let ballotOrder = null;
  let ballotOrderConfidence = null;

  if (eligibility.FPPS) {
    primary = "FPPS";
    // Secondary candidates are schemes flagged canPairWithSecondary in
    // config, evaluated in a fixed preference order (TCPS first — HDB's
    // own confirmed worked example — then FCS_Proximity).
    const candidates = ["TCPS", "FCS_Proximity"];
    for (const key of candidates) {
      if (eligibility[key] && SCHEME_CONFIG[key].canPairWithSecondary) {
        secondary = key;
        const order = SCHEME_CONFIG[key].ballotOrder;
        if (order && order.position === "beforeFPPS") {
          ballotOrder = [key, "FPPS"];
          ballotOrderConfidence = order.confidence; // "confirmed" or "inferred"
        }
        break;
      }
    }
  }

  const eligibleList = Object.keys(SCHEME_CONFIG).filter((key) => eligibility[key] === true);

  return { primary, secondary, ballotOrder, ballotOrderConfidence, eligibleList };
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
  if (stacking.ballotOrderConfidence === "inferred") {
    complianceFlags.push(
      "The ballot order shown for FCS (Proximity) + FPPS is inferred from HDB's general description of how paired schemes work, not from a worked example specific to this combination. Confirm with HDB before relying on the exact sequence."
    );
  }

  return {
    isFirstTimerFamily: eligibility.isFirstTimerFamily,
    qualifiesForFTPMC: eligibility.FTPMC,
    eligibleSchemes: stacking.eligibleList.map((key) => ({
      scheme: key,
      quotaNote: SCHEME_CONFIG[key].quotaNote || "",
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
