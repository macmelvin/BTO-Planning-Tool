import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { app, auth, signInAsAdmin, signOutAdmin } from "../../../questionnaire/js/firebase-config.js";

const ADMIN_EMAIL = "macmelvin.tan@gmail.com"; // client-side gate only —
// real enforcement is in firestore.rules' isAdmin(), same as launchWindows.

const db = getFirestore(app);
const root = document.getElementById("admin-root");
let currentUser = null;
let projects = [];

onAuthStateChanged(auth, (user) => {
  currentUser = user && !user.isAnonymous ? user : null;
  render();
});

// ---------- Data ----------
async function loadProjects() {
  const snap = await getDocs(collection(db, "projects"));
  const list = [];
  for (const d of snap.docs) {
    const offeringsSnap = await getDocs(collection(db, "projects", d.id, "flatTypeOfferings"));
    list.push({
      id: d.id,
      ...d.data(),
      offerings: offeringsSnap.docs.map((o) => ({ flatType: o.id, ...o.data() })),
    });
  }
  return list;
}

async function loadExerciseSummary(exercise) {
  const snap = await getDocs(collection(db, "exerciseSummaries"));
  return snap.docs.find((d) => d.id === exercise)?.data() || null;
}

// ---------- Render ----------
function render() {
  root.innerHTML = "";
  root.appendChild(buildHeader());

  if (!currentUser) {
    root.appendChild(buildSignInCard());
    return;
  }
  if (currentUser.email !== ADMIN_EMAIL) {
    root.appendChild(buildNotAuthorizedCard());
    return;
  }

  root.appendChild(buildSignedInBar());
  root.appendChild(buildExerciseSummaryCard());
  const listCard = buildListPlaceholder();
  root.appendChild(listCard);
  loadAndRenderProjects(listCard);
  root.appendChild(buildAddProjectForm(listCard));
}

function buildHeader() {
  const wrap = document.createElement("div");
  wrap.className = "app-header";
  wrap.innerHTML = `
    <div class="eyebrow">BTO Planning Tool — Admin</div>
    <h1>Manage projects &amp; application rates</h1>
    <p class="helper"><a href="../index.html">← Launch windows</a></p>
  `;
  return wrap;
}

function buildSignInCard() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h2>Sign in required</h2>`;
  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.textContent = "Sign in with Google";
  btn.onclick = async () => {
    btn.disabled = true;
    try { await signInAsAdmin(); } catch (err) { console.error(err); btn.disabled = false; }
  };
  card.appendChild(btn);
  return card;
}

function buildNotAuthorizedCard() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h2>Not authorized</h2><p class="helper">Signed in as ${currentUser.email}.</p>`;
  const btn = document.createElement("button");
  btn.className = "btn btn-secondary";
  btn.textContent = "Sign out";
  btn.onclick = () => signOutAdmin();
  card.appendChild(btn);
  return card;
}

function buildSignedInBar() {
  const bar = document.createElement("div");
  bar.className = "field";
  bar.innerHTML = `<p class="helper">Signed in as ${currentUser.email}</p>`;
  const btn = document.createElement("button");
  btn.className = "link-btn";
  btn.textContent = "Sign out";
  btn.onclick = () => signOutAdmin();
  bar.appendChild(btn);
  return bar;
}

// ---------- Exercise Summary ----------
function buildExerciseSummaryCard() {
  const card = document.createElement("div");
  card.className = "card";
  card.id = "exercise-summary-admin";
  card.innerHTML = `<h2>Exercise summary</h2><p class="helper">Loading…</p>`;
  populateExerciseSummaryCard(card);
  return card;
}

async function populateExerciseSummaryCard(card) {
  const exercise = "2026-06"; // TODO: make this selectable once you have 2+ exercises seeded
  const existing = await loadExerciseSummary(exercise);

  card.innerHTML = `<h2>Exercise summary — ${exercise}</h2><p class="helper">Overall figures shown at the top of the Application Rate Reference page.</p>`;

  const fields = [
    { key: "totalProjects", label: "Total projects", type: "number" },
    { key: "totalUnits", label: "Total units", type: "number" },
    { key: "totalApplications", label: "Total applications", type: "number" },
    { key: "overallSubscriptionRate", label: "Overall subscription rate", type: "number" },
  ];
  const inputs = {};
  fields.forEach((f) => {
    const field = document.createElement("div");
    field.className = "field";
    field.innerHTML = `<label>${f.label}</label>`;
    const input = document.createElement("input");
    input.type = f.type;
    input.step = "0.1";
    if (existing) input.value = existing[f.key] ?? "";
    inputs[f.key] = input;
    field.appendChild(input);
    card.appendChild(field);
  });

  const townsField = document.createElement("div");
  townsField.className = "field";
  townsField.innerHTML = `<label>Towns (comma-separated)</label>`;
  const townsInput = document.createElement("input");
  townsInput.type = "text";
  townsInput.value = existing?.towns?.join(", ") || "";
  townsField.appendChild(townsInput);
  card.appendChild(townsField);

  const noteField = document.createElement("div");
  noteField.className = "field";
  noteField.innerHTML = `<label>Note (e.g. what's not yet seeded)</label>`;
  const noteInput = document.createElement("input");
  noteInput.type = "text";
  noteInput.value = existing?.note || "";
  noteField.appendChild(noteInput);
  card.appendChild(noteField);

  const sourceField = document.createElement("div");
  sourceField.className = "field";
  sourceField.innerHTML = `<label>Data source</label>`;
  const sourceInput = document.createElement("input");
  sourceInput.type = "text";
  sourceInput.value = existing?.dataSource || "";
  sourceField.appendChild(sourceInput);
  card.appendChild(sourceField);

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-primary";
  saveBtn.textContent = "Save summary";
  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    await setDoc(doc(db, "exerciseSummaries", exercise), {
      exercise,
      totalProjects: Number(inputs.totalProjects.value) || 0,
      totalUnits: Number(inputs.totalUnits.value) || 0,
      totalApplications: Number(inputs.totalApplications.value) || 0,
      overallSubscriptionRate: Number(inputs.overallSubscriptionRate.value) || 0,
      towns: townsInput.value ? townsInput.value.split(",").map((t) => t.trim()) : [],
      note: noteInput.value,
      dataSource: sourceInput.value,
    });
    saveBtn.disabled = false;
    saveBtn.textContent = "Saved ✓";
    setTimeout(() => { saveBtn.textContent = "Save summary"; }, 1500);
  };
  card.appendChild(saveBtn);
}

// ---------- Projects List ----------
function buildListPlaceholder() {
  const card = document.createElement("div");
  card.className = "card";
  card.id = "projects-list";
  card.innerHTML = `<h2>Projects</h2><p class="helper">Loading…</p>`;
  return card;
}

async function loadAndRenderProjects(card) {
  projects = await loadProjects();
  card.innerHTML = `<h2>Projects</h2>`;

  if (projects.length === 0) {
    card.innerHTML += `<p class="helper">No projects yet — add one below.</p>`;
    return;
  }

  projects.forEach((p) => {
    const projCard = document.createElement("div");
    projCard.className = "repeatable-card";
    projCard.innerHTML = `
      <div class="row" style="margin-bottom:8px;">
        <strong>${p.name}</strong>
        <span class="helper" style="margin-left:8px;">${p.town} · ${p.classification} · ${p.townMaturity}</span>
      </div>
    `;
    const delProjBtn = document.createElement("button");
    delProjBtn.className = "remove-btn";
    delProjBtn.textContent = "Delete project";
    delProjBtn.onclick = async () => {
      if (!confirm(`Delete ${p.name} and all its flat type offerings?`)) return;
      for (const o of p.offerings) {
        await deleteDoc(doc(db, "projects", p.id, "flatTypeOfferings", o.flatType));
      }
      await deleteDoc(doc(db, "projects", p.id));
      loadAndRenderProjects(card);
    };
    projCard.querySelector(".row").appendChild(delProjBtn);

    // Existing offerings
    p.offerings.forEach((o) => {
      const offRow = document.createElement("div");
      offRow.className = "scheme-row";
      const rateText = describeRates(o.applicationRates);
      offRow.innerHTML = `
        <span class="scheme-name">${o.flatType} (${o.totalUnitsSupply ?? "units unknown"})</span>
        <span class="scheme-quota">${rateText}</span>
      `;
      const delOffBtn = document.createElement("button");
      delOffBtn.className = "remove-btn";
      delOffBtn.textContent = "×";
      delOffBtn.title = "Remove this flat type offering";
      delOffBtn.onclick = async () => {
        await deleteDoc(doc(db, "projects", p.id, "flatTypeOfferings", o.flatType));
        loadAndRenderProjects(card);
      };
      offRow.appendChild(delOffBtn);
      projCard.appendChild(offRow);
    });

    // Add/update a flat type offering for this project
    projCard.appendChild(buildOfferingForm(p, card));

    card.appendChild(projCard);
  });
}

function describeRates(rates) {
  if (!rates) return "no rates";
  const parts = [];
  if (rates.firstTimerFamily != null) parts.push(`FT family ${rates.firstTimerFamily}x`);
  if (rates.firstTimerSingle != null) parts.push(`FT single ${rates.firstTimerSingle}x`);
  if (rates.secondTimer != null) parts.push(`2nd-timer ${rates.secondTimer}x`);
  if (rates.overall != null) parts.push(`overall ${rates.overall}x`);
  return parts.length ? parts.join(", ") : "no confirmed rate";
}

function buildOfferingForm(project, listCard) {
  const wrap = document.createElement("div");
  wrap.style.marginTop = "10px";
  wrap.style.paddingTop = "10px";
  wrap.style.borderTop = "1px dashed var(--color-line)";

  const flatTypeSelect = document.createElement("select");
  flatTypeSelect.className = "choice-select";
  flatTypeSelect.style.marginBottom = "8px";
  flatTypeSelect.innerHTML = ["2RoomFlexi", "3Room", "4Room", "5Room", "Executive"]
    .map((f) => `<option value="${f}">${f}</option>`).join("");
  wrap.appendChild(flatTypeSelect);

  const unitsInput = document.createElement("input");
  unitsInput.type = "number";
  unitsInput.placeholder = "Total units (leave blank if unknown)";
  unitsInput.style.marginBottom = "8px";
  unitsInput.style.display = "block";
  wrap.appendChild(unitsInput);

  const rateFields = ["firstTimerFamily", "firstTimerSingle", "secondTimer", "overall"];
  const rateInputs = {};
  rateFields.forEach((key) => {
    const input = document.createElement("input");
    input.type = "number";
    input.step = "0.1";
    input.placeholder = key;
    input.style.marginBottom = "6px";
    input.style.marginRight = "6px";
    input.style.maxWidth = "120px";
    rateInputs[key] = input;
    wrap.appendChild(input);
  });

  const sourceInput = document.createElement("input");
  sourceInput.type = "text";
  sourceInput.placeholder = "Data source (e.g. article name)";
  sourceInput.style.display = "block";
  sourceInput.style.marginTop = "6px";
  sourceInput.style.marginBottom = "8px";
  wrap.appendChild(sourceInput);

  const saveBtn = document.createElement("button");
  saveBtn.className = "link-btn";
  saveBtn.textContent = "+ Add/update this flat type";
  saveBtn.onclick = async () => {
    const applicationRates = {};
    rateFields.forEach((key) => {
      applicationRates[key] = rateInputs[key].value ? Number(rateInputs[key].value) : null;
    });
    await setDoc(doc(db, "projects", project.id, "flatTypeOfferings", flatTypeSelect.value), {
      totalUnitsSupply: unitsInput.value ? Number(unitsInput.value) : null,
      applicationRates,
      dataSource: sourceInput.value || null,
      dataAsOf: new Date().toISOString().split("T")[0],
    });
    loadAndRenderProjects(listCard);
  };
  wrap.appendChild(saveBtn);

  return wrap;
}

// ---------- Add New Project ----------
function buildAddProjectForm(listCard) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h2>Add a new project</h2>`;

  const idField = document.createElement("div");
  idField.className = "field";
  idField.innerHTML = `<label>Project ID (URL-safe slug, e.g. woodgrove-acres-2026-06)</label>`;
  const idInput = document.createElement("input");
  idInput.type = "text";
  idField.appendChild(idInput);
  card.appendChild(idField);

  const nameField = document.createElement("div");
  nameField.className = "field";
  nameField.innerHTML = `<label>Project name</label>`;
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameField.appendChild(nameInput);
  card.appendChild(nameField);

  const townField = document.createElement("div");
  townField.className = "field";
  townField.innerHTML = `<label>Town</label>`;
  const townInput = document.createElement("input");
  townInput.type = "text";
  townField.appendChild(townInput);
  card.appendChild(townField);

  const exerciseField = document.createElement("div");
  exerciseField.className = "field";
  exerciseField.innerHTML = `<label>Launch exercise (e.g. 2026-06)</label>`;
  const exerciseInput = document.createElement("input");
  exerciseInput.type = "text";
  exerciseField.appendChild(exerciseInput);
  card.appendChild(exerciseField);

  const classificationSelect = document.createElement("select");
  classificationSelect.className = "choice-select";
  classificationSelect.innerHTML = ["Standard", "Plus", "Prime"].map((c) => `<option value="${c}">${c}</option>`).join("");
  const classField = document.createElement("div");
  classField.className = "field";
  classField.innerHTML = `<label>Classification</label>`;
  classField.appendChild(classificationSelect);
  card.appendChild(classField);

  const maturitySelect = document.createElement("select");
  maturitySelect.className = "choice-select";
  maturitySelect.innerHTML = `<option value="mature">Mature</option><option value="nonMature">Non-mature</option>`;
  const maturityField = document.createElement("div");
  maturityField.className = "field";
  maturityField.innerHTML = `<label>Town maturity</label>`;
  maturityField.appendChild(maturitySelect);
  card.appendChild(maturityField);

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-primary";
  saveBtn.textContent = "Add project";
  saveBtn.onclick = async () => {
    if (!idInput.value || !nameInput.value) {
      alert("Project ID and name are required.");
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    await setDoc(doc(db, "projects", idInput.value), {
      name: nameInput.value,
      town: townInput.value,
      launchExercise: exerciseInput.value,
      exerciseType: "BTO",
      classification: classificationSelect.value,
      townMaturity: maturitySelect.value,
    });
    idInput.value = "";
    nameInput.value = "";
    townInput.value = "";
    exerciseInput.value = "";
    saveBtn.disabled = false;
    saveBtn.textContent = "Add project";
    loadAndRenderProjects(listCard);
  };
  card.appendChild(saveBtn);

  return card;
}
