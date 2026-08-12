/**
 * Seeds /projects/* with real data from the June 2026 BTO exercise —
 * the most recently COMPLETED cycle at build time (Aug 2026's exercise
 * hasn't opened yet, so no application rates exist for it).
 *
 * HONESTY NOTE: only fields with a cited source below are filled in.
 * Where a project's exact unit count or per-flat-type rate isn't publicly
 * available from what was findable, `totalUnitsSupply` and rate fields
 * are left `null` rather than guessed — the odds calculator is designed
 * to show "insufficient data" for these rather than fabricate a number.
 * See docs/BTO-OddsCalculator-and-Questionnaire.md, section A1, for why
 * this matters more than filling every field.
 *
 * Run: node scripts/seedProjects.js
 * Requires a service account key — see README note at the bottom.
 */
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json"); // gitignored — see note below

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const EXERCISE = "2026-06"; // June 2026 BTO

const PROJECTS = [
  {
    projectId: "kebun-baru-breeze-2026-06",
    name: "Kebun Baru Breeze",
    town: "Ang Mo Kio",
    launchExercise: EXERCISE,
    exerciseType: "BTO",
    classification: "Plus",
    townMaturity: "mature",
    flatTypeOfferings: {
      "4Room": {
        totalUnitsSupply: null, // not found in sources — leave unknown rather than guess
        applicationRates: { firstTimerFamily: 1.3, firstTimerSingle: null, secondTimer: null, overall: null },
        dataSource: "MoneySmart BTO Jun 2026 review",
        dataAsOf: "2026-06-24",
      },
    },
  },
  {
    projectId: "kebun-baru-ridge-2026-06",
    name: "Kebun Baru Ridge",
    town: "Ang Mo Kio",
    launchExercise: EXERCISE,
    exerciseType: "BTO",
    classification: "Plus",
    townMaturity: "mature",
    flatTypeOfferings: {
      "4Room": {
        totalUnitsSupply: null,
        applicationRates: { firstTimerFamily: 1.3, firstTimerSingle: null, secondTimer: null, overall: null },
        dataSource: "MoneySmart BTO Jun 2026 review (paired project, same reported rate as Kebun Baru Breeze)",
        dataAsOf: "2026-06-24",
      },
    },
  },
  {
    projectId: "woodgrove-acres-2026-06",
    name: "Woodgrove Acres",
    town: "Woodlands",
    launchExercise: EXERCISE,
    exerciseType: "BTO",
    classification: "Standard",
    townMaturity: "nonMature",
    flatTypeOfferings: {
      "2RoomFlexi": {
        totalUnitsSupply: 157,
        applicationRates: { firstTimerFamily: null, firstTimerSingle: 6.7, secondTimer: null, overall: null }, // 1053 applications / 157 units
        dataSource: "StackedHomes — June BTO Draws 22,312 Applications",
        dataAsOf: "2026-06-24",
      },
    },
  },
  {
    projectId: "lakeview-cascadia-2026-06",
    name: "Lakeview Cascadia",
    town: "Bishan",
    launchExercise: EXERCISE,
    exerciseType: "BTO",
    classification: "Prime",
    townMaturity: "mature",
    flatTypeOfferings: {}, // first BTO in the area in 40 years per sources, but no rate figures found — listed for completeness, no odds data yet
  },
];

// Exercise-level summary — not tied to a single project, but useful
// context for the Application Rate Reference screen.
const EXERCISE_SUMMARY = {
  exercise: EXERCISE,
  totalProjects: 7,
  totalUnits: 6952,
  totalApplications: 22312,
  overallSubscriptionRate: 3.2,
  towns: ["Ang Mo Kio", "Bishan", "Bukit Merah", "Sembawang", "Woodlands"],
  note: "3 of 7 projects in this exercise aren't seeded individually yet — only projects with a findable, cited application rate are included below.",
  dataSource: "StackedHomes, Squares & Portraits, MoneySmart — June 2026 BTO coverage",
};

async function seed() {
  for (const p of PROJECTS) {
    const { flatTypeOfferings, ...projectMeta } = p;
    const projectRef = db.collection("projects").doc(p.projectId);
    await projectRef.set(projectMeta);

    for (const [flatType, data] of Object.entries(flatTypeOfferings)) {
      await projectRef.collection("flatTypeOfferings").doc(flatType).set(data);
    }
    console.log(`Seeded ${p.name}`);
  }

  await db.collection("exerciseSummaries").doc(EXERCISE).set(EXERCISE_SUMMARY);
  console.log("Seeded exercise summary. Done.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

/**
 * SERVICE ACCOUNT KEY SETUP (not included — never commit this file):
 * 1. Firebase Console → Project Settings → Service Accounts tab
 * 2. Click "Generate new private key" → downloads a JSON file
 * 3. Save it as scripts/serviceAccountKey.json (already in .gitignore
 *    via the *-firebase-adminsdk-*.json pattern — double check it matches
 *    your downloaded filename, or rename the file to match that pattern)
 * 4. Run: node scripts/seedProjects.js
 */
