# BTO Planning Tool — Build Roadmap & Backlog

**Purpose of this file:** the single source of truth. Everything scoped in prior sessions is referenced here in build order, so nothing needs to live in your head. Update this file, not your memory, as things change.

Related specs already written:
- `BTO-Planning-Tool-AllInOne-MVP.md` — full feature list by journey stage
- `BTO-Eligibility-Rules-Engine.md` — priority scheme logic
- `BTO-OddsCalculator-and-Questionnaire.md` — odds calculator data model + questionnaire flow

---

## Sprint 0: Foundations (build this first, before any feature UI)

This sprint has no user-visible output. That's normal — skipping it to get to "something to show" is the most common way this kind of app gets rebuilt from scratch later.

- [X] **Firestore security rules** — lock down `/users/{userId}/*` so only the authenticated owner can read/write their own eligibility answers and applications. This data (marital status, citizenship, children, divorce status) is sensitive; default-open rules are not acceptable even for a prototype.
- [X] **Auth setup** — decide sign-in method (email link, Google sign-in) before building the questionnaire, since Step 1 of the flow needs a userId to persist partial progress against.
- [X] **Config collections as data, not code** — set up `/schemeDefinitions/*` and `/dropoutBenchmarks/*` as Firestore documents you can edit without a redeploy, per the "rules change" risk flagged in the eligibility rules engine doc. Build this scaffolding now, even empty, so Sprint 2 doesn't tempt you into hardcoding.
- [X] **Data privacy note** — decide and document (even briefly) what happens to a user's eligibility data if they delete their account. This matters more here than in Protein Tracker given the sensitivity of the fields involved.

## Sprint 1: Eligibility Questionnaire (Part B of the rules engine doc)

- [X] Build Step 1–2 (household basics, children) — the largest share of users, gets you to a demoable core fast
- [X] Build Step 3–4 (family proximity, housing situation) — branching logic, more complex UI
- [X] Build Step 5–6 (flat type selection, results screen)
- [ ] Wire questionnaire output → `resolveApplicableSchemes()` logic from the rules engine doc
- [ ] Ship the disclaimer language — non-negotiable, ship with Sprint 1, not "later"

## Sprint 2: Priority Scheme Rules Engine (Part A of the rules engine doc)

- [X] Implement per-scheme eligibility functions as data-driven config (not inline conditionals) so scheme updates don't require app releases
- [X] Implement scheme stacking/ballot order resolution
- [X] **Before shipping:** confirm the two open questions flagged in the rules engine doc — senior age threshold for SPS, and FCS(Proximity)+FPPS ballot order. Don't hardcode a guess.

## Sprint 3: Launch Calendar + Reminders

- [X] Static/manually-updated launch calendar (quarterly cycle)
- [X] Push notification setup — confirm TWA web-push support before this sprint, since it determines whether this sprint is straightforward or needs a platform rethink
- [X] HFE letter deadline reminder logic

## Sprint 4: Odds Calculator (Part A of the odds calculator doc)

- [X] Firestore schema for Project / FlatTypeOffering / SchemeQuotaPool
- [X] Seed initial dataset — start with the most recent 1-2 launch cycles, not full historical backfill (get something real and current working before going deep on history)
- [X] Implement tiered qualitative odds algorithm — resist the temptation to show a fake precise percentage
- [X] Application Rate Reference screen (searchable table)

## Sprint 5: Application Tracker

- [ ] User saves their own queue number + project once results are out
- [ ] History across multiple attempts
- [ ] Manual refresh of odds as appointment approaches

---

## Deferred (v1.5+, per the all-in-one MVP doc — don't start these early)

- Affordability snapshot (needs careful framing to avoid looking like financial advice)
- Selection appointment estimator (cold-start problem — needs a real user base first)
- Unit selection checklist
- Payment milestone tracker

---

## Standing Reminders (check before each sprint, not just once)

- **Data maintenance is the real product.** Application rates and dropout benchmarks need updating every BTO cycle (4x/year) — this is ongoing work, not a build-once task. Put a recurring calendar reminder for yourself now, the same way the app will remind users.
- **Rules changed once already (July 2025).** Expect more changes. The config-as-data decision in Sprint 0 is what makes future changes cheap — don't let time pressure push scheme logic back into hardcoded conditionals later.
- **Every user-facing number needs a disclaimer nearby.** Eligibility results and odds estimates are both "estimate, not HDB determination" — this isn't a one-time launch checklist item, check it stays visible as you add screens.
