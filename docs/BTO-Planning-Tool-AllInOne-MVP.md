# BTO Planning Tool — All-in-One MVP Feature List

**Vision:** A single companion app that follows a household through the entire BTO journey — from "should we even apply" to "we got our keys" — replacing the patchwork of Excel sheets, Telegram trackers, and scattered blog posts.

**Working assumption:** TWA-wrapped web app (reuses your Document Tools packaging pattern). Flag if you'd rather go native — tradeoffs below.

---

## The Journey Map

The BTO process has 4 distinct stages, each with its own anxiety and its own current DIY workaround. The all-in-one tool should have *something* at every stage, even if shallow at first — that's what makes it a "planning tool" rather than a "calculator."

| Stage | Duration | Current DIY tool | User's core question |
|---|---|---|---|
| 1. Explore & Plan | Ongoing, before applying | Blog posts, mortgage broker calculators | "Can I afford this? Where should I apply?" |
| 2. Application & Balloting | ~1 month application + 3-6 week wait | Excel sheets, HDB portal | "What are my odds? Am I eligible for priority?" |
| 3. Selection | Weeks after ballot results | Unofficial Telegram tracker | "When's my appointment? What unit should I pick?" |
| 4. Post-Selection | Months to years | HDB's own payment calculator | "What do I owe, and when?" |

---

## Stage 1: Explore & Plan

- **Eligibility & Priority Scheme Matcher** — questionnaire on marital status, citizenship, income, parents' address, children → tells user which schemes apply (FPPS, MCPS, First-Timer, Non-Mature bonus) and what % of flats are reserved for them
- **Affordability Snapshot** — rough monthly payment estimate from income + flat price range (link out to HDB/bank calculators for the precise figure rather than rebuilding CPF logic — reduces liability and build time)
- **Town/Project Shortlist** — user bookmarks towns or upcoming projects they're interested in, sees historical application rates for that town to calibrate expectations early
- **Launch Calendar + Reminders** — quarterly BTO cycle (Feb/May/Aug/Nov), push notification for HFE letter deadline (6 weeks before launch) and application window opening

## Stage 2: Application & Balloting

- **Queue Number Odds Calculator** — the original core hook: queue number + flat supply + priority scheme → plain-language odds using historical dropout-rate benchmarks
- **Application Rate Reference** — searchable table of past projects' application rates by town/flat type, so users self-assess competitiveness before balloting
- **HFE Letter Checklist** — simple checklist/reminder flow (documents needed, processing time) since a missed HFE letter invalidates the whole application

## Stage 3: Selection

- **Selection Appointment Estimator** — community-submitted queue-number-to-appointment-date data (structured version of the unofficial Telegram tracker), refined over time by your own users
- **Unit Selection Checklist** — non-editorial reference: sun direction/facing, floor level tradeoffs, PM (pipe/mechanical) heat considerations — helps first-timers who don't know what to weigh in the room
- **Application Tracker** — user logs their queue number once results are out, sees status update as their appointment approaches; keeps history across multiple ballot attempts (many households try 2-3+ times)

## Stage 4: Post-Selection

- **Payment Milestone Tracker** — option fee, down payment, key milestone dates with reminders (lower build priority — mostly a checklist/calendar feature, low differentiation vs. HDB's own tools)
- **Key Dates Overview** — single screen showing "what's next and when" from booking to key collection

---

## Recommended v1 Scope

Building all 4 stages shallowly beats building 1 stage deeply — the "all-in-one" positioning *is* the differentiator, and each stage feature above is individually simple (mostly rules engines and reference tables, no AI). Recommended cut for v1:

**Ship in v1 (Stages 1–3):**
- Eligibility & Priority Scheme Matcher
- Launch Calendar + Reminders
- Queue Number Odds Calculator
- Application Rate Reference
- Application Tracker

**Defer to v1.5:**
- Affordability Snapshot (needs careful framing to avoid looking like financial advice)
- Selection Appointment Estimator (needs a critical mass of community-submitted data to be useful — cold-start problem, better after you have users)
- Unit Selection Checklist (nice-to-have, low urgency)
- Payment Milestone Tracker (lowest differentiation — HDB's own portal already does this adequately)

This gives you a genuinely "all-in-one" feel (covers explore → apply → select) without building the harder, lower-value, or cold-start-dependent pieces first.

---

## Explicitly Out of Scope (v1 and v1.5)
- Real-time scraping of HDB systems — keep all data manually updated or community-sourced
- Full mortgage/loan comparison engine — link out to PropertyGuru/MoneySmart/bank calculators instead
- Any AI/vision component — this is a rules-engine + reference-data product, not a fit for your vision-model stack
- Renovation planning/contractor matching — adjacent but a different product entirely; resist scope creep here

---

## Data Sources Needed
- HDB's public BTO sales launch data (project names, flat supply, flat types) — published each launch cycle
- Historical application rates — HDB post-launch releases + aggregated news coverage (Mothership, Stacked Homes, PropertyGuru)
- Priority scheme rules — publicly documented, stable enough to hardcode with periodic manual review
- Dropout-rate benchmarks — start with community-sourced/published figures, refine using your own users' self-reported outcomes over time
- Appointment date correlations — cold-start problem; only viable once you have a real user base submitting data (this is why it's deferred)

---

## Tech Notes
- Firebase/Firestore: project data, user's saved shortlist/applications, reminder scheduling — same pattern as your other tools
- TWA-wrapped web app lets you validate the full journey concept fast before committing to native; native Kotlin becomes worth it once retention data justifies richer push notifications and offline access
- Push notifications are the retention backbone here (launch reminders, HFE deadlines, appointment tracking) — worth confirming your TWA setup supports web push before locking in the platform choice

---

## Monetization Notes
- The "all-in-one" framing gives you more surface area than a single calculator: users touch the app across months, not once
- **Free tier:** Eligibility checker, odds calculator, application rate reference — builds trust and shareability (this is a "send to your partner/Telegram group" tool)
- **One-time Pro unlock:** Application tracker across multiple attempts, launch reminders, priority access to appointment estimator once built — fits infrequent-but-recurring usage better than a subscription
- **Affiliate/lead-gen layer:** Natural handoff points to mortgage brokers (Stage 1 affordability), loan providers (Stage 4 payment), and renovation services (post-key-collection) — each stage transition is a monetizable handoff without you having to build those verticals yourself
