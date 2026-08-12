/**
 * Scheme configuration — data, not code. This is the thing you update every
 * BTO launch cycle when HDB tweaks a rule, without touching rulesEngine.js
 * or redeploying the app. Mirrors config/seed-config-data.json; in
 * production this should be fetched from Firestore's /schemeDefinitions/*
 * collection instead of imported as a static file — swap the export at the
 * bottom for a Firestore read once that wiring is in place.
 *
 * Each scheme's `eligibilityConditions` is a small declarative tree
 * evaluated by the generic interpreter in rulesEngine.js. See the `op`
 * list there for what's available.
 */
export const SCHEME_CONFIG = {
  FPPS: {
    name: "Family and Parenthood Priority Scheme",
    quotaNote: "Up to 40% of BTO flat supply, up to 60% of SBF flat supply",
    canPairWithSecondary: true,
    eligibilityConditions: {
      all: [
        { op: "isFirstTimerFamily" },
        { op: "fieldEquals", field: "maritalStatus", value: "married" },
        {
          any: [
            { op: "hasChildUnder", ageLimit: 18 },
            { op: "hasExpectingChild" },
          ],
        },
      ],
    },
  },

  FCS_Proximity: {
    name: "Family Care Scheme (Proximity)",
    quotaNote: "Up to 30% of public supply for first-timer families",
    canPairWithSecondary: true,
    ballotOrder: { position: "beforeFPPS", confidence: "inferred" }, // see note in rulesEngine.js
    postMopComplianceRequired: true,
    eligibilityConditions: {
      all: [
        { op: "parentIncluded" },
        {
          op: "fieldIn",
          field: "parentLink.parentCitizenship",
          values: ["SC", "SPR"],
        },
        { op: "parentProximityOk", maxKm: 4 },
      ],
    },
  },

  FCS_JointBalloting: {
    name: "Family Care Scheme (Joint Balloting)",
    quotaNote: "15% reserved for parent, 15% reserved for child — separate queue numbers",
    canPairWithSecondary: false,
    eligibleFlatTypes: ["2RoomFlexi", "3Room"],
    eligibilityConditions: {
      all: [
        { op: "parentIncluded" },
        { op: "marriedChildIncluded" },
        { op: "flatTypeIn", values: ["2RoomFlexi", "3Room"] },
      ],
    },
  },

  TCPS: {
    name: "Third Child Priority Scheme",
    quotaNote: "Up to 10% of BTO flat supply, up to 10% of SBF flat supply",
    canPairWithSecondary: true,
    ballotOrder: { position: "beforeFPPS", confidence: "confirmed" }, // HDB's own worked example uses this exact case
    eligibilityConditions: {
      all: [
        {
          any: [
            { op: "fieldEquals", field: "citizenship", value: "SC" },
            { op: "fieldEquals", field: "spouseCitizenship", value: "SC" },
          ],
        },
        {
          any: [
            { op: "childCountGte", value: 3 },
            { op: "hasExpectingChild" },
          ],
        },
        { not: { op: "fieldEquals", field: "previouslyBoughtFlatUnderTCPS", value: true } },
      ],
    },
  },

  ASSIST: {
    name: "Assistance Scheme for Second-Timers (Divorced/Widowed Parents)",
    quotaNote: "5% for 2-room Flexi, 10% for 3-room (Standard flats only)",
    canPairWithSecondary: false,
    eligibilityConditions: {
      all: [
        { op: "fieldEquals", field: "isDivorcedOrWidowedWithChildUnder18", value: true },
        { not: { op: "fieldEquals", field: "ownedOrAcquiredPropertyAfterDivorceOrSpouseDeath", value: true } },
        { op: "flatTypeIn", values: ["2RoomFlexi", "3Room"] },
      ],
    },
  },

  SPS: {
    name: "Senior Priority Scheme (near existing home)",
    quotaNote: "Reserved quota within the seniors' 2-room Flexi allocation",
    canPairWithSecondary: false,
    minAge: 55, // confirmed via HDB / Council of Third Age / CPF Board, cross-checked Aug 2026
    eligibilityConditions: {
      all: [
        { op: "ageGte", value: 55 },
        { op: "fieldEquals", field: "targetFlatType", value: "2RoomFlexi" },
        { op: "fieldEquals", field: "ownsOrOccupiesExistingProperty", value: true },
      ],
    },
  },

  TPS: {
    name: "Tenants' Priority Scheme",
    quotaNote: "Up to 10% of eligible flat supply",
    canPairWithSecondary: false,
    eligibilityConditions: {
      all: [
        { op: "fieldEquals", field: "currentlyHdbRentalTenant", value: true },
        { op: "fieldGte", field: "hdbRentalTenancyDurationYears", value: 2 },
        { op: "flatTypeIn", values: ["2RoomFlexi", "3Room"] },
      ],
    },
  },
};
