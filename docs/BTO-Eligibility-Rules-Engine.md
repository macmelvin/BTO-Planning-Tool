# BTO Eligibility & Priority Scheme Rules Engine

Source of truth: HDB / MyNiceHome official priority schemes page, last updated 24 June 2026.
**Build note:** Several older scheme names (MCPS, SPS "living with/near", MGPS) were retired and folded into the **Family Care Scheme (FCS)** from the July 2025 sales exercise onward. A lot of third-party blog content hasn't caught up — this is a real differentiation opportunity if the tool stays current.

---

## 1. Input Data Model

Collect this once per household application (questionnaire, not per-scheme):

```
Applicant {
  citizenship: SC | SPR                      // self
  spouseCitizenship: SC | SPR | null          // null if single
  maritalStatus: single | married | engaged | divorced | widowed
  age: number
  spouseAge: number | null
  isFirstTimer: boolean                       // self
  spouseIsFirstTimer: boolean | null
  priorUnsuccessfulStandardApplications: number  // count, for bonus ballot chance logic

  children: [
    {
      citizenship: SC | SPR
      age: number
      isAdopted: boolean
      isFromExpecting: boolean                // true if unborn, with doctor's cert
    }
  ]

  parentLink: {
    included: boolean                         // parent listed on HFE letter / application
    parentCitizenship: SC | SPR | null
    parentMaritalStatus: married | single | widowed | divorced | null
    parentAge: number | null
    parentOwnsOccupiedProperty: boolean        // HDB flat or private residential
    distanceToTargetFlatKm: number | null      // needs geocoding: parent's address vs project address
  } | null

  marriedChildLink: {
    included: boolean
    childCitizenship: SC | SPR | null
    distanceToTargetFlatKm: number | null
  } | null

  isDivorcedOrWidowedWithChildUnder18: boolean
  ownedOrAcquiredPropertyAfterDivorceOrSpouseDeath: boolean   // disqualifies ASSIST if true (except matrimonial flat)

  currentlyHdbRentalTenant: boolean
  hdbRentalTenancyDurationYears: number

  targetFlatType: 2RoomFlexi | 3Room | 4Room | 5Room | Executive
  targetProjectClassification: Standard | Plus | Prime
  targetTownMaturity: mature | nonMature
}
```

Note: `distanceToTargetFlatKm` requires geocoding parent/child address against the target project — either ask the user to self-report ("yes, within 4km" / "no") to avoid building a geocoding pipeline in v1, or use a simple postal-code-to-postal-code distance lookup (Singapore postal codes map cleanly to planning areas, so this can be a lightweight lookup table rather than a full maps API call).

---

## 2. Per-Scheme Eligibility Logic (pseudocode)

### First-Timer status (baseline — not a "scheme" but gates everything else)
```
isFirstTimerFamily = applicant.isFirstTimer AND (spouse == null OR spouse.isFirstTimer)
// Mixed household (1 first-timer + 1 second-timer) still counts as first-timer family
// for priority purposes, but does NOT get first-timer CPF housing grants — flag this
// distinction in the UI copy, it's a common misunderstanding.
```

### FT(PMC) — First-Timer (Parents & Married Couples)
```
eligible_FTPMC =
  isFirstTimerFamily
  AND maritalStatus == married
  AND (
    hasChild(citizenship == SC, age <= 18)
    OR hasExpectingChildWithDoctorCert()
  )
// Subset of first-timer category — auto-qualifies for FPPS
```

### FPPS — Family and Parenthood Priority Scheme
```
eligible_FPPS =
  isFirstTimerFamily
  AND maritalStatus == married
  AND (
    hasChild(citizenship == SC, age <= 18)
    OR hasExpectingChildWithDoctorCert()
  )
// Note: eligibility conditions are identical to FT(PMC) as currently published —
// FT(PMC) is a priority sub-tier WITHIN FPPS-eligible applicants, not a separate
// qualifying path. Model FT(PMC) as: eligible_FPPS AND applying for 4-room-or-smaller
// in a Standard project → gets first priority within the FPPS quota.
```

### FCS (Proximity) — replaces MCPS + SPS(living with/near)
```
eligible_FCS_Proximity =
  parentLink.included
  AND (parentLink.parentCitizenship == SC OR parentLink.parentCitizenship == SPR
       OR marriedChildLink.childCitizenship == SC OR == SPR)
  AND (
       parentLink.parentMaritalStatus IN [married, single_35plus, widowed, divorced]
       // "single" branch requires age >= 35 per stated conditions
  )
  AND (
       livingWithParentOrChild == true  // included in HFE + flat application
       OR parentLink.distanceToTargetFlatKm <= 4
       OR marriedChildLink.distanceToTargetFlatKm <= 4
  )
// Post-key-collection condition (not eligibility, but a compliance flag to surface):
// the qualifying parent/child must continue living with/within 4km through MOP.
```

### FCS (Joint Balloting) — replaces MGPS
```
eligible_FCS_JointBalloting =
  parentLink.included AND marriedChildLink.included  // must be a genuine joint application
  AND targetFlatType IN [2RoomFlexi, 3Room]           // only these flat types qualify
  AND (
    // parent side
    parentApplyingFor IN [2RoomFlexi, 3Room]
  )
  AND (
    // child side
    (childMaritalStatus == single AND childAge >= 35 AND childIsFirstTimer AND childApplyingFor == 2RoomFlexi)
    OR
    (childMaritalStatus IN [married, engaged] AND childApplyingFor <= 5Room)
  )
// Output note: if successful, parent and child get SEPARATE queue numbers within
// their respective quotas — surface this clearly, it trips people up (they expect
// one shared outcome).
```

### TCPS — Third Child Priority Scheme
```
eligible_TCPS =
  (applicant.citizenship == SC OR spouseCitizenship == SC)   // if divorced/widowed, applicant must be SC
  AND countChildren(legalMarriageOrAdopted) >= 3 OR expectingThirdChild
  AND thirdChild.birthDate >= 1987-01-01
  AND (youngestChild.citizenship == SC OR expectingChild.citizenship == SC)
  AND allOtherChildren.citizenship IN [SC, SPR]
  AND NOT previouslyBoughtFlatUnderTCPS
```

### ASSIST — Assistance Scheme for Second-Timers (Divorced/Widowed Parents)
```
eligible_ASSIST =
  isDivorcedOrWidowedWithChildUnder18
  AND NOT ownedOrAcquiredPropertyAfterDivorceOrSpouseDeath   // matrimonial flat/property exempted
  AND targetFlatType IN [2RoomFlexi, 3Room]
  AND targetProjectClassification == Standard
```

### SPS (near existing home) — seniors, age-in-place
```
eligible_SPS =
  applicant.age >= 55  // confirm exact senior threshold at build time — HDB uses 55 for
                        // most senior housing schemes; verify against current source before
                        // hardcoding, this is the one figure not explicitly stated on the
                        // fetched page
  AND targetFlatType == 2RoomFlexi
  AND ownedOrOccupiesExistingProperty(HDB or private)
  AND distanceExistingHomeToTargetFlatKm <= 4
```

### TPS — Tenants' Priority Scheme
```
eligible_TPS =
  currentlyHdbRentalTenant
  AND hdbRentalTenancyDurationYears >= 2   // "at the time of HFE letter application"
  AND targetFlatType IN [2RoomFlexi, 3Room]
```

---

## 3. Scheme Selection & Stacking Resolution

This is the part most guides get vague on — HDB's actual rule is a **1 + 1 stacking rule with a defined ballot order**, not "pick any schemes you qualify for."

```
function resolveApplicableSchemes(eligibility_results):
  primary = null
  secondary = null

  // Rule: household selects ONE priority scheme when applying.
  // Exception: FPPS-eligible households may ALSO apply for ONE of
  // {FCS (Proximity), TCPS} as a second scheme.

  if eligibility_results.FPPS == true:
    primary = "FPPS"
    // offer choice of secondary scheme if also eligible for FCS(Proximity) or TCPS
    if eligibility_results.TCPS == true:
      secondary = "TCPS"          // TCPS + FPPS is the documented example pairing
    else if eligibility_results.FCS_Proximity == true:
      secondary = "FCS_Proximity"

  else:
    // Not FPPS-eligible: household picks exactly one scheme from whichever
    // they qualify for (present all eligible options, let user choose —
    // don't auto-pick, since which one is "best" depends on their specific
    // odds per scheme, which the odds calculator should inform).
    eligibleList = filter(eligibility_results, value == true)
    primary = null  // user selects from eligibleList in UI

  return { primary, secondary, eligibleList }
```

### Ballot order when 2 schemes apply (documented case: TCPS + FPPS)
```
if secondary != null:
  ballotOrder = [secondary, primary]   // secondary scheme balloted FIRST
  // e.g. TCPS + FPPS → balloted under TCPS first; if unsuccessful, balloted
  // again under FPPS. Model this explicitly in the UI as "2 chances, in this
  // order" rather than implying they're simultaneous/independent.
```

**Open question to verify before hardcoding:** the source confirms the TCPS-before-FPPS order explicitly, but doesn't state the ballot order for FCS(Proximity)+FPPS pairing. Don't assume it mirrors TCPS — flag this as a "confirm with HDB source / HFE letter documentation" item rather than guessing, since getting ballot order wrong is worse than not showing it.

---

## 4. Additional Non-Scheme Priority Logic (still needs modeling)

```
// Bonus ballot chances — separate mechanism from priority schemes, applies on top
function bonusBallotChances(applicant):
  if isFirstTimerFamily AND priorUnsuccessfulStandardApplications >= 2:
    chances = min(1 + (priorUnsuccessfulStandardApplications - 1), 5)  // capped at 5 total
    return chances
  return 1  // baseline
```

This needs to feed into the Odds Calculator (Stage 2 feature), not just the eligibility checker — a household's real odds depend on scheme quota AND bonus ballot chances together.

---

## 5. Output Object (what the UI shows the user)

```
EligibilityResult {
  isFirstTimerFamily: boolean
  qualifiesForFTPMC: boolean
  eligibleSchemes: [
    { scheme: "FPPS", eligible: true, quotaNote: "Up to 40% of BTO / 60% of SBF flats" },
    { scheme: "TCPS", eligible: true, quotaNote: "Up to 10% of BTO / 10% of SBF flats" },
    ...
  ]
  recommendedStacking: { primary: "FPPS", secondary: "TCPS", ballotOrder: ["TCPS", "FPPS"] }
  bonusBallotChances: 2
  complianceFlags: [
    "FCS (Proximity): qualifying parent/child must continue living with you or within 4km through your flat's MOP."
  ]
  disclaimer: "This is an estimate based on publicly available HDB rules as of [date]. Confirm your actual eligibility via your HFE letter application — HDB's own assessment is final."
}
```

---

## 6. Build Risk Notes

- **Rules change.** FCS replaced 3 older schemes in July 2025 — this rules engine *will* need a version/changelog mechanism, not hardcoded logic buried in the app. Structure the scheme definitions as data (JSON config) rather than inline code, so updates don't require a full app release.
- **Don't guess on unconfirmed thresholds.** The senior age threshold (55) and the FCS(Proximity)+FPPS ballot order are flagged above as needing confirmation — verify against HDB's HFE letter documentation or a direct HDB source before hardcoding, rather than inferring from pattern-matching to TCPS.
- **Always show the disclaimer.** This tool estimates eligibility; it is not the HFE letter assessment. Legal/financial-adjacent tools should never imply certainty — frame every output as "likely eligible based on what you told us," not "you qualify."
- **Distance calculations (4km rules)** are the trickiest data dependency — decide early whether v1 self-reports ("is your parent's home within 4km? yes/no") versus computing it from postal codes. Self-report is faster to ship and avoids maintaining geocoding data, at the cost of relying on user honesty/accuracy.
