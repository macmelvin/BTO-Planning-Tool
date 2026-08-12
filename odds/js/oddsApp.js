import { listProjects, getExerciseSummary, describeApplicationRate } from "./oddsCalculator.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { app, ensureSignedIn } from "../../questionnaire/js/firebase-config.js";

const db = getFirestore(app);
const root = document.getElementById("odds-root");
let allProjects = [];

init();

async function init() {
  await ensureSignedIn();
  allProjects = await loadProjectsWithOfferings();
  render();
}

async function loadProjectsWithOfferings() {
  const projects = await listProjects();
  for (const p of projects) {
    const offeringsSnap = await getDocs(collection(db, "projects", p.id, "flatTypeOfferings"));
    p.offerings = offeringsSnap.docs.map((d) => ({ flatType: d.id, ...d.data() }));
  }
  return projects;
}

function render(filterText = "") {
  root.innerHTML = "";
  root.appendChild(buildHeader());
  root.appendChild(buildSearchBox(filterText));

  const summaryCard = buildExerciseSummaryPlaceholder();
  root.appendChild(summaryCard);
  loadAndRenderSummary(summaryCard);

  root.appendChild(buildProjectTable(filterText));
  root.appendChild(buildFooterDisclaimer());
}

function buildHeader() {
  const wrap = document.createElement("div");
  wrap.className = "app-header";
  wrap.innerHTML = `
    <div class="eyebrow">BTO Planning Tool</div>
    <h1>Application rate reference</h1>
    <p class="helper">Real figures from completed BTO exercises — not every project has a confirmed rate yet; we don't fill gaps with guesses.</p>
  `;
  return wrap;
}

function buildSearchBox(filterText) {
  const field = document.createElement("div");
  field.className = "field";
  field.innerHTML = `<label>Search by town or project name</label>`;
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "e.g. Woodlands";
  input.value = filterText;
  input.style.maxWidth = "300px";
  input.oninput = (e) => render(e.target.value);
  field.appendChild(input);
  return field;
}

function buildExerciseSummaryPlaceholder() {
  const card = document.createElement("div");
  card.className = "card";
  card.id = "exercise-summary-card";
  card.innerHTML = `<p class="helper">Loading exercise summary…</p>`;
  return card;
}

async function loadAndRenderSummary(card) {
  const summary = await getExerciseSummary("2026-06");
  if (!summary) {
    card.innerHTML = `<p class="helper">No exercise summary available yet.</p>`;
    return;
  }
  card.innerHTML = `
    <h2>${summary.exercise} BTO exercise</h2>
    <p class="helper">${summary.totalProjects} projects across ${summary.towns.join(", ")} — ${summary.totalApplications.toLocaleString()} applications for ${summary.totalUnits.toLocaleString()} units (${summary.overallSubscriptionRate}x overall).</p>
    <p class="helper" style="font-size:12px;">${summary.note}</p>
  `;
}

function buildProjectTable(filterText) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h2>By project</h2>`;

  const filtered = allProjects.filter((p) => {
    const haystack = `${p.name} ${p.town}`.toLowerCase();
    return haystack.includes(filterText.toLowerCase());
  });

  if (filtered.length === 0) {
    card.innerHTML += `<p class="helper">No projects match "${filterText}".</p>`;
    return card;
  }

  filtered.forEach((p) => {
    const projectBlock = document.createElement("div");
    projectBlock.className = "repeatable-card";
    projectBlock.innerHTML = `<div class="row" style="margin-bottom:8px;">
      <strong>${p.name}</strong>
      <span class="helper" style="margin-left:auto;">${p.town} · ${p.classification}</span>
    </div>`;

    if (p.offerings.length === 0) {
      const note = document.createElement("p");
      note.className = "helper";
      note.textContent = "No confirmed application rate for this project yet.";
      projectBlock.appendChild(note);
    } else {
      p.offerings.forEach((o) => {
        const rates = o.applicationRates || {};
        const bestRate = rates.firstTimerFamily ?? rates.firstTimerSingle ?? rates.overall;
        const described = describeApplicationRate(bestRate);
        const row = document.createElement("div");
        row.className = "scheme-row";
        row.innerHTML = `
          <span class="scheme-name">${o.flatType}</span>
          <span class="scheme-quota tone-${described.tone}">${described.label}</span>
        `;
        projectBlock.appendChild(row);
      });
    }
    card.appendChild(projectBlock);
  });

  return card;
}

function buildFooterDisclaimer() {
  const footer = document.createElement("div");
  footer.className = "footer-disclaimer";
  footer.innerHTML = `Application rates reflect the most recently completed BTO exercise. Rates for open or future exercises don't exist until that exercise closes.`;
  return footer;
}
