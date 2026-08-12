/**
 * Applies a research findings JSON file directly to Firestore — the
 * intended workflow: ask Claude to research a BTO launch/exercise, Claude
 * outputs a JSON block matching RESEARCH-UPDATE-TEMPLATE.json's shape,
 * save that as scripts/research-update.json, then run this script once
 * instead of manually retyping every value into the admin forms.
 *
 * Run: node scripts/applyResearchUpdate.js [path-to-json]
 * Defaults to scripts/research-update.json if no path given.
 *
 * Uses the same service account key as seedProjects.js / migrateLaunchWindows.js.
 * Safe to re-run — every write is a setDoc, so re-applying the same file
 * just overwrites with identical values rather than duplicating anything.
 */
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const inputPath = process.argv[2] || path.join(__dirname, "research-update.json");

function validate(data) {
  const errors = [];
  if (!data || typeof data !== "object") {
    errors.push("Root of the file must be a JSON object.");
    return errors;
  }
  const { launchWindows, projects, exerciseSummary } = data;

  if (launchWindows) {
    if (!Array.isArray(launchWindows)) errors.push("launchWindows must be an array.");
    else launchWindows.forEach((w, i) => {
      if (!w.quarter) errors.push(`launchWindows[${i}] missing "quarter"`);
      if (!w.applicationOpenDate) errors.push(`launchWindows[${i}] missing "applicationOpenDate"`);
    });
  }

  if (projects) {
    if (!Array.isArray(projects)) errors.push("projects must be an array.");
    else projects.forEach((p, i) => {
      if (!p.id) errors.push(`projects[${i}] missing "id"`);
      if (!p.name) errors.push(`projects[${i}] missing "name"`);
      if (p.offerings && !Array.isArray(p.offerings)) errors.push(`projects[${i}].offerings must be an array`);
    });
  }

  if (exerciseSummary && !exerciseSummary.exercise) {
    errors.push('exerciseSummary missing "exercise" (the ID, e.g. "2026-08")');
  }

  return errors;
}

async function apply() {
  if (!fs.existsSync(inputPath)) {
    console.error(`File not found: ${inputPath}`);
    console.error(`Save Claude's research JSON there, or pass a path: node scripts/applyResearchUpdate.js path/to/file.json`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, "utf-8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error("Invalid JSON in", inputPath, "—", err.message);
    process.exit(1);
  }

  const errors = validate(data);
  if (errors.length > 0) {
    console.error("Validation failed — nothing was written:");
    errors.forEach((e) => console.error("  -", e));
    process.exit(1);
  }

  let writeCount = 0;

  if (data.launchWindows) {
    for (const w of data.launchWindows) {
      await db.collection("launchWindows").doc(w.quarter).set({
        quarter: w.quarter,
        applicationOpenDate: w.applicationOpenDate,
        dateConfirmed: w.dateConfirmed ?? true,
        towns: w.towns || [],
      });
      console.log(`✓ launchWindows/${w.quarter}`);
      writeCount++;
    }
  }

  if (data.projects) {
    for (const p of data.projects) {
      await db.collection("projects").doc(p.id).set({
        name: p.name,
        town: p.town || "",
        launchExercise: p.launchExercise || "",
        exerciseType: p.exerciseType || "BTO",
        classification: p.classification || "Standard",
        townMaturity: p.townMaturity || "nonMature",
      });
      console.log(`✓ projects/${p.id}`);
      writeCount++;

      if (p.offerings) {
        for (const o of p.offerings) {
          await db.collection("projects").doc(p.id).collection("flatTypeOfferings").doc(o.flatType).set({
            totalUnitsSupply: o.totalUnitsSupply ?? null,
            applicationRates: {
              firstTimerFamily: o.applicationRates?.firstTimerFamily ?? null,
              firstTimerSingle: o.applicationRates?.firstTimerSingle ?? null,
              secondTimer: o.applicationRates?.secondTimer ?? null,
              overall: o.applicationRates?.overall ?? null,
            },
            dataSource: o.dataSource || null,
            dataAsOf: o.dataAsOf || new Date().toISOString().split("T")[0],
          });
          console.log(`  ✓ projects/${p.id}/flatTypeOfferings/${o.flatType}`);
          writeCount++;
        }
      }
    }
  }

  if (data.exerciseSummary) {
    const s = data.exerciseSummary;
    await db.collection("exerciseSummaries").doc(s.exercise).set({
      exercise: s.exercise,
      totalProjects: s.totalProjects ?? 0,
      totalUnits: s.totalUnits ?? 0,
      totalApplications: s.totalApplications ?? 0,
      overallSubscriptionRate: s.overallSubscriptionRate ?? 0,
      towns: s.towns || [],
      note: s.note || "",
      dataSource: s.dataSource || "",
    });
    console.log(`✓ exerciseSummaries/${s.exercise}`);
    writeCount++;
  }

  console.log(`\nDone — ${writeCount} document(s) written from ${path.basename(inputPath)}.`);
}

apply().catch((err) => {
  console.error("Update failed:", err);
  process.exit(1);
});
