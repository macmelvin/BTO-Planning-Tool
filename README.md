# BTO Planning Tool

An all-in-one companion app for the Singapore HDB BTO (Build-To-Order) journey — eligibility checking, priority scheme guidance, odds estimation, and launch reminders, in one place instead of scattered spreadsheets and blog posts.

## Status

Sprint 0 (foundations) — security rules, auth, and config scaffolding in place. Not yet feature-complete.

## Project Structure

```
bto-planning-tool/
├── firestore.rules              # Security rules — user data isolation, read-only public config
├── functions/
│   └── index.js                 # Cloud Functions (e.g. cleanupUserData on account deletion)
├── config/
│   └── seed-config-data.json    # Scheme definitions + dropout benchmarks (admin-maintained)
├── docs/
│   ├── BTO-Build-Roadmap.md               # Start here — sprint sequencing and checklist
│   ├── BTO-Planning-Tool-AllInOne-MVP.md  # Full feature list by journey stage
│   ├── BTO-Eligibility-Rules-Engine.md    # Priority scheme eligibility logic
│   ├── BTO-OddsCalculator-and-Questionnaire.md
│   ├── sprint0-auth-setup.md
│   └── sprint0-privacy-deletion-note.md
└── README.md
```

## Data Sources

Scheme rules and quotas are sourced from HDB / MyNiceHome official documentation. HDB updates priority scheme structures periodically (most recently July 2025 — see `docs/BTO-Eligibility-Rules-Engine.md` for details) — `config/seed-config-data.json` is versioned and should be re-verified against the current HDB source before each BTO launch cycle, not treated as permanently accurate.

## Disclaimer

This tool provides estimates based on publicly available HDB rules and historical patterns. It is not affiliated with HDB and does not replace the official HFE letter eligibility assessment. Always confirm actual eligibility through HDB's official channels.

## Development

See `docs/BTO-Build-Roadmap.md` for the current sprint plan and what's next.
