# BTO Odds Calculator — Data Model & Questionnaire UI Flow

---

# PART A: Odds Calculator Data Model

## A1. The honesty problem to design around

HDB publishes **overall application rates** (first-timer vs second-timer, per project/flat-type) but does **not** publish per-scheme queue data (e.g. how many people specifically applied under FCS Proximity vs TCPS for a given launch). This caps how precise the odds calculator can honestly be.

**Design implication:** don't fabricate false precision. The calculator should give a **qualitative tiered estimate** ("likely," "borderline," "unlikely") backed by the numbers it *can* verify, not a fake percentage like "73.2% chance" that implies data you don't have. This is also a legal-safety consideration — precise-looking numbers create liability if wrong; ranges don't.

## A2. Core Entities

```
Project {
  projectId: string
  name: string                    // e.g. "Ghim Moh Natura"
  town: string
  launchExercise: string          // e.g. "2026-08" (Aug 2026 BTO)
  exerciseType: BTO | SBF
  classification: Standard | Plus | Prime
  townMaturity: mature | nonMature
  flatTypeOfferings: [FlatTypeOffering]
}

FlatTypeOffering {
  flatType: 2RoomFlexi | 3Room | 4Room | 5Room | Executive
  totalUnitsSupply: number
  applicationRates: {
    firstTimerFamily: number | null      // e.g. 0.8 = 0.8 applicants per unit
    firstTimerSingle: number | null
    secondTimer: number | null
    overall: number | null
  }
  schemeQuotaPools: [SchemeQuotaPool]     // reserved-unit breakdown where publicly known
  dataSource: string                      // citation — HDB release, news aggregator, etc.
  dataAsOf: date
}

SchemeQuotaPool {
  scheme: FPPS | FCS_Proximity | FCS_JointBalloting | TCPS | ASSIST | SPS | TPS | GeneralFirstTimer | SecondTimer
  quotaPercent: number           // e.g. 40 for FPPS "up to 40%"
  unitsReserved: number | null   // computed if quotaPercent known; null if HDB doesn't disclose exact split for this launch
  applicantsInPool: number | null  // usually unknown — most launches don't disclose this
}

DropoutBenchmark {
  townMaturity: mature | nonMature
  historicalThresholdMultiplier: number
  // e.g. mature: 1.17, non-mature: 1.02 — "applicants with queue numbers up to
  // this multiple of supply have historically still gotten a unit, due to
  // dropouts ahead of them in the queue"
  sourceNote: string             // these figures are community-observed
                                  // (unofficial trackers), not HDB-published —
                                  // label clearly as an estimate, not a guarantee
  lastUpdated: date
}

UserApplication {
  userId: string
  projectId: string
  flatType: string
  schemeApplied: string | null
  queueNumber: number | null       // filled in once HDB releases it
  applicationDate: date
  outcomeStatus: pending | withinSupply | borderline | unsuccessful | selected
  appointmentDate: date | null
}
```

## A3. Odds Calculation Algorithm (qualitative tiers, not fake precision)

```
function estimateOdds(queueNumber, flatTypeOffering, schemeApplied, townMaturity):

  supply = flatTypeOffering.totalUnitsSupply
  dropoutMultiplier = lookupDropoutBenchmark(townMaturity).historicalThresholdMultiplier

  // If applying under a specific scheme with a known quota, compare against
  // that pool's reserved units where available; otherwise fall back to
  // overall supply (most conservative honest estimate).
  pool = findPool(flatTypeOffering.schemeQuotaPools, schemeApplied)
  effectiveSupply = (pool != null AND pool.unitsReserved != null)
                      ? pool.unitsReserved
                      : supply

  if queueNumber <= effectiveSupply:
    tier = "Within supply — historically high chance of selection"
  else if queueNumber <= effectiveSupply * dropoutMultiplier:
    tier = "Borderline — selection has historically depended on dropout rate this close to supply"
  else:
    tier = "Above historical dropout range — selection unlikely based on past patterns"

  return {
    tier,
    effectiveSupply,
    queueNumber,
    confidenceNote: pool.unitsReserved != null
      ? "Estimated against this scheme's disclosed quota."
      : "Scheme-specific quota not disclosed for this launch — estimated against total flat supply instead, which is more conservative.",
    disclaimer: "Based on historical patterns, not a guarantee. HDB's actual allocation process is the only authoritative source."
  }
```

## A4. Firestore Schema Sketch

```
/projects/{projectId}
    name, town, launchExercise, classification, townMaturity

/projects/{projectId}/flatTypeOfferings/{flatType}
    totalUnitsSupply, applicationRates, dataSource, dataAsOf

/projects/{projectId}/flatTypeOfferings/{flatType}/schemeQuotaPools/{scheme}
    quotaPercent, unitsReserved, applicantsInPool

/dropoutBenchmarks/{townMaturity}
    historicalThresholdMultiplier, sourceNote, lastUpdated

/users/{userId}/applications/{applicationId}
    projectId, flatType, schemeApplied, queueNumber, outcomeStatus, appointmentDate
```

Keep `dropoutBenchmarks` and `schemeQuotaPools` as admin-editable config, not user-facing input — this is the dataset you (or a small mod/contributor team) maintain each quarter as launches happen, similar to how the eligibility rules engine config should be versioned data rather than hardcoded.

## A5. Data Maintenance Reality Check

This calculator's credibility depends entirely on you updating `applicationRates` and `dropoutBenchmarks` every launch cycle (4x/year). Budget for this as ongoing operational work, not a one-time build task — it's the actual moat (accurate, current data), but only if it stays current. A stale application-rate table is worse than none, since it actively misleads.

---

# PART B: Questionnaire UI Flow

## B1. Design Principles

- **Progressive disclosure** — don't show all 25 possible input fields upfront. Branch based on early answers (e.g. skip all "parent/child proximity" questions if the user says they're not applying under any family-proximity scheme).
- **Save partial progress** — this questionnaire has enough steps that users will abandon and return. Persist state in Firestore keyed by userId from step 1, not just at the end.
- **Plain language over HDB jargon** — ask "Do you own a home right now?" not "Are you a first-timer applicant?" Map plain-language answers to the rules engine's technical fields behind the scenes.
- **Show *why* at the end, not just *what*** — the eligibility result should explain which answer triggered which scheme match, so users trust the output instead of treating it as a black box.

## B2. Flow Structure

```
Step 1: Household Basics
  - "Are you applying alone or with a spouse/fiancé(e)?" → single | married | engaged
  - "Have you or your spouse owned an HDB flat or private property before?"
    → determines isFirstTimer / spouseIsFirstTimer
  - Citizenship (self + spouse if applicable) → SC | SPR
  [Branch: if divorced/widowed selected instead of single/married/engaged →
   jump to Step 1b]

Step 1b: Divorced/Widowed Path
  - "Do you have a child aged 18 or under living with you?"
  - "Have you acquired any property since your divorce/spouse's passing
     (other than your matrimonial home)?"
  → feeds ASSIST eligibility directly, can shortcut some later steps

Step 2: Children
  - "Do you have children, or are you expecting?" (skip to Step 3 if no)
  - For each child: age, citizenship, adopted? (repeatable card, not a huge form)
  - "Expecting a child with a doctor's certification?" → toggle
  → feeds FPPS, FT(PMC), TCPS

Step 3: Family Proximity (only shown if user indicates interest —
         see framing note below)
  - Framing: "Some schemes give priority if you're applying to live near
     or with a parent or married child. Want to check if this applies to you?"
     [Yes / No — skip entirely if No, avoids overwhelming singles/young couples
      with irrelevant questions]
  - If Yes:
    - "Include a parent on this application?" → parent citizenship, marital
       status, age (only ask age if they select "single" — needed for the
       35+ condition)
    - "Will you live within 4km of their home, or with them?" → yes/no
       (self-report distance, per the v1 tradeoff noted in the rules engine doc)
    - Same pattern for married child, if relevant
    - Separately ask: "Are you and your parent planning to apply together
       for two separate units (joint balloting)?" → routes to FCS Joint
       Balloting instead of FCS Proximity — these are mutually exclusive
       framings, don't present as if stackable

Step 4: Current Housing Situation
  - "Are you currently living in an HDB rental flat?" → if yes, "For how long?"
    → feeds TPS
  - "Is anyone in your household aged 55+, applying for a 2-room Flexi flat
     to move closer to their current home?" → feeds SPS (only show this
     framing if a 2-room Flexi flat type is selected in Step 5)

Step 5: What You're Applying For
  - Flat type: 2-room Flexi | 3-room | 4-room | 5-room | Executive
  - Project classification: Standard | Plus | Prime (if known — user may be
     exploring before a specific project is chosen, in which case make this
     optional and default assumptions transparent)
  - Town / project (if a specific launch is selected — links into the Odds
     Calculator dataset from Part A)

Step 6: Results
  - Eligible schemes, with plain-language quota notes
  - Recommended stacking (primary + secondary, ballot order) per the
     rules engine's resolveApplicableSchemes() output
  - Compliance flags (e.g. FCS Proximity's post-MOP condition)
  - "Check your odds" CTA → routes into the Odds Calculator (Part A) using
     the flat type/town/scheme just determined, pre-filled
  - Disclaimer, prominently — this is an estimate, not an HDB determination
```

## B3. Conditional Logic Summary (for implementation reference)

| Step | Skip condition |
|---|---|
| 1b (Divorced/Widowed) | Only shown if maritalStatus = divorced or widowed |
| 2 (Children) | Skippable if user indicates no children and not expecting |
| 3 (Family Proximity) | Entirely optional entry point — don't force singles/young couples through parent/child questions |
| 4 SPS sub-question | Only shown if flat type = 2-room Flexi selected in Step 5 (may require re-ordering Step 4/5 or asking flat type earlier — flag as a UX sequencing decision) |

**Sequencing note:** Step 5 (flat type) actually needs to come *before* Step 4's SPS question logically, since SPS only applies to 2-room Flexi. Two options: (a) ask flat type early as part of Step 1, or (b) ask it generically in Step 4 ("thinking about a 2-room Flexi flat?") without waiting for Step 5's formal selection. Recommend (a) — ask intended flat type upfront, since it also lets you skip irrelevant scheme questions earlier (e.g. skip FCS Joint Balloting questions entirely if user already said they want a 5-room flat, since that scheme only applies to 2-room Flexi/3-room).

## B4. Output → Rules Engine Mapping

The questionnaire's job is purely to populate the `Applicant` object defined in the rules engine spec (Part 1 of the prior document). Keep the UI layer and the rules engine logic decoupled — the questionnaire should emit a clean data object, and `resolveApplicableSchemes()` / the per-scheme eligibility functions consume it without knowing anything about UI steps. This makes it much easier to update rules (new scheme, changed quota) without touching questionnaire UI code, and vice versa.
