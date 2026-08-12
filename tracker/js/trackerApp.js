import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { app, ensureSignedIn } from "../../questionnaire/js/firebase-config.js";
import { listProjects, getFlatTypeOffering, estimateOdds } from "../../odds/js/oddsCalculator.js";

const db = getFirestore(app);
const root = document.getElementById("tracker-root");
let userId = null;
let projects = [];
let applications = [];
let showAddForm = false;

init();

async function init() {
  const user = await ensureSignedIn();
  userId = user.uid;
  projects = await listProjects();
  applications = await loadApplications();
  render();
}

async function loadApplications() {
  const snap = await getDocs(collection(db, "users", userId, "applications"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function saveApplication(appData) {
  const id = appData.id || crypto.randomUUID();
  const ref = doc(db, "users", userId, "applications", id);
  const { id: _drop, ...data } = appData;
  await setDoc(ref, data, { merge: true });
  return id;
}

async function removeApplication(id) {
  await deleteDoc(doc(db, "users", userId, "applications", id));
}

// ---------- Render ----------
function render() {
  root.innerHTML = "";
  root.appendChild(buildHeader());
  root.appendChild(buildAddCard());
  root.appendChild(buildApplicationsList());
  root.appendChild(buildFooterDisclaimer());
}

function buildHeader() {
  const wrap = document.createElement("div");
  wrap.className = "app-header";
  wrap.innerHTML = `
    <div class="eyebrow">BTO Planning Tool</div>
    <h1>My applications</h1>
    <p class="helper">Track your queue numbers across attempts — many households ballot more than once.</p>
  `;
  return wrap;
}

function buildAddCard() {
  const card = document.createElement("div");
  card.className = "card";

  if (!showAddForm) {
    card.innerHTML = `<h2>Add an application</h2>`;
    const btn = document.createElement("button");
    btn.className = "btn btn-primary";
    btn.textContent = "+ Add application";
    btn.onclick = () => { showAddForm = true; render(); };
    card.appendChild(btn);
    return card;
  }

  card.innerHTML = `<h2>Add an application</h2>`;

  const projectField = document.createElement("div");
  projectField.className = "field";
  projectField.innerHTML = `<label>Project</label>`;
  const select = document.createElement("select");
  select.className = "choice-select";
  select.innerHTML = `<option value="">Select a project…</option>` +
    projects.map((p) => `<option value="${p.id}">${p.name} — ${p.town}</option>`).join("");
  projectField.appendChild(select);
  card.appendChild(projectField);

  const flatTypeField = document.createElement("div");
  flatTypeField.className = "field";
  flatTypeField.innerHTML = `<label>Flat type</label>`;
  const flatSelect = document.createElement("select");
  flatSelect.className = "choice-select";
  flatSelect.innerHTML = ["2RoomFlexi", "3Room", "4Room", "5Room", "Executive"]
    .map((f) => `<option value="${f}">${f}</option>`).join("");
  flatTypeField.appendChild(flatSelect);
  card.appendChild(flatTypeField);

  const queueField = document.createElement("div");
  queueField.className = "field";
  queueField.innerHTML = `<label>Queue number (leave blank if not out yet)</label>`;
  const queueInput = document.createElement("input");
  queueInput.type = "number";
  queueInput.min = 1;
  queueField.appendChild(queueInput);
  card.appendChild(queueField);

  const dateField = document.createElement("div");
  dateField.className = "field";
  dateField.innerHTML = `<label>Application date</label>`;
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = new Date().toISOString().split("T")[0];
  dateField.appendChild(dateInput);
  card.appendChild(dateField);

  const nav = document.createElement("div");
  nav.className = "nav-row";
  const cancel = document.createElement("button");
  cancel.className = "btn btn-secondary";
  cancel.textContent = "Cancel";
  cancel.onclick = () => { showAddForm = false; render(); };
  const save = document.createElement("button");
  save.className = "btn btn-primary";
  save.textContent = "Save";
  save.onclick = async () => {
    if (!select.value) {
      alert("Please select a project.");
      return;
    }
    save.disabled = true;
    save.textContent = "Saving…";
    await saveApplication({
      projectId: select.value,
      flatType: flatSelect.value,
      queueNumber: queueInput.value ? Number(queueInput.value) : null,
      applicationDate: dateInput.value,
      outcomeStatus: "pending",
    });
    applications = await loadApplications();
    showAddForm = false;
    render();
  };
  nav.appendChild(cancel);
  nav.appendChild(save);
  card.appendChild(nav);

  return card;
}

function buildApplicationsList() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h2>Your applications</h2>`;

  if (applications.length === 0) {
    card.innerHTML += `<p class="helper">No applications saved yet — add one above once you've applied.</p>`;
    return card;
  }

  applications.forEach((application) => {
    const project = projects.find((p) => p.id === application.projectId);
    const entryCard = document.createElement("div");
    entryCard.className = "repeatable-card";
    entryCard.dataset.appId = application.id;

    const header = document.createElement("div");
    header.className = "row";
    header.style.marginBottom = "8px";
    header.innerHTML = `
      <strong>${project ? project.name : "Unknown project"}</strong>
      <span class="helper" style="margin-left:8px;">${application.flatType}</span>
    `;
    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "Remove";
    removeBtn.onclick = async () => {
      await removeApplication(application.id);
      applications = await loadApplications();
      render();
    };
    header.appendChild(removeBtn);
    entryCard.appendChild(header);

    const meta = document.createElement("p");
    meta.className = "helper";
    meta.textContent = `Applied ${application.applicationDate || "—"} · Queue #${application.queueNumber ?? "not out yet"}`;
    entryCard.appendChild(meta);

    const oddsContainer = document.createElement("div");
    oddsContainer.className = "odds-result";
    entryCard.appendChild(oddsContainer);

    if (application.queueNumber && project) {
      const refreshBtn = document.createElement("button");
      refreshBtn.className = "link-btn";
      refreshBtn.textContent = "Check odds";
      refreshBtn.onclick = () => refreshOdds(application, project, oddsContainer, refreshBtn);
      entryCard.appendChild(refreshBtn);
    }

    card.appendChild(entryCard);
  });

  return card;
}

async function refreshOdds(application, project, container, btn) {
  btn.textContent = "Checking…";
  btn.disabled = true;
  const offering = await getFlatTypeOffering(application.projectId, application.flatType);
  const result = estimateOdds(application.queueNumber, project, offering);

  container.innerHTML = "";
  const tierClass = result.tier === "within-supply" ? "tone-good" : result.tier === "borderline" ? "tone-caution" : result.tier === "unlikely" ? "tone-high" : "tone-neutral";
  const p = document.createElement("p");
  p.className = tierClass;
  p.style.fontWeight = "500";
  p.textContent = result.message;
  container.appendChild(p);

  if (result.disclaimer) {
    const d = document.createElement("p");
    d.className = "helper";
    d.style.fontSize = "12px";
    d.textContent = result.disclaimer;
    container.appendChild(d);
  }

  btn.textContent = "Refresh odds";
  btn.disabled = false;
}

function buildFooterDisclaimer() {
  const footer = document.createElement("div");
  footer.className = "footer-disclaimer";
  footer.innerHTML = `Odds are historical-pattern estimates, not guarantees. Your applications are private and only visible to you.`;
  return footer;
}
