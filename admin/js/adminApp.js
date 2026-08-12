import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { app, auth, signInAsAdmin, signOutAdmin } from "../../questionnaire/js/firebase-config.js";

const ADMIN_EMAIL = "macmelvin.tan@gmail.com"; // client-side gate only — the
// real enforcement is in firestore.rules' isAdmin(); this just controls
// whether the form renders, not whether a write would actually succeed.

const db = getFirestore(app);
const root = document.getElementById("admin-root");
let currentUser = null;
let windows = [];

onAuthStateChanged(auth, (user) => {
  currentUser = user && !user.isAnonymous ? user : null;
  render();
});

async function loadWindows() {
  const snap = await getDocs(collection(db, "launchWindows"));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.applicationOpenDate.localeCompare(b.applicationOpenDate));
}

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
  const listCard = buildListPlaceholder();
  root.appendChild(listCard);
  loadAndRenderList(listCard);
  root.appendChild(buildAddForm(listCard));
}

function buildHeader() {
  const wrap = document.createElement("div");
  wrap.className = "app-header";
  wrap.innerHTML = `
    <div class="eyebrow">BTO Planning Tool — Admin</div>
    <h1>Manage launch windows</h1>
    <p class="helper"><a href="projects/index.html">Manage projects & application rates →</a></p>
  `;
  return wrap;
}

function buildSignInCard() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h2>Sign in required</h2><p class="helper">This page is restricted to one admin account.</p>`;
  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.textContent = "Sign in with Google";
  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = "Signing in…";
    try {
      await signInAsAdmin();
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      btn.textContent = "Sign in with Google";
    }
  };
  card.appendChild(btn);
  return card;
}

function buildNotAuthorizedCard() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h2>Not authorized</h2>
    <p class="helper">Signed in as ${currentUser.email}, which isn't the admin account for this app.</p>
  `;
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

function buildListPlaceholder() {
  const card = document.createElement("div");
  card.className = "card";
  card.id = "windows-list";
  card.innerHTML = `<h2>Current launch windows</h2><p class="helper">Loading…</p>`;
  return card;
}

async function loadAndRenderList(card) {
  windows = await loadWindows();
  const body = document.createElement("div");
  card.innerHTML = `<h2>Current launch windows</h2>`;

  if (windows.length === 0) {
    card.innerHTML += `<p class="helper">No launch windows yet — add one below.</p>`;
    return;
  }

  windows.forEach((w) => {
    const row = document.createElement("div");
    row.className = "repeatable-card";
    row.innerHTML = `
      <div class="row" style="margin-bottom:6px;">
        <strong>${w.quarter}</strong>
        <span class="helper" style="margin-left:8px;">${w.applicationOpenDate}${w.dateConfirmed ? "" : " (projected)"}</span>
      </div>
      <p class="helper" style="margin:0 0 8px;">Towns: ${(w.towns || []).join(", ") || "—"}</p>
    `;
    const delBtn = document.createElement("button");
    delBtn.className = "remove-btn";
    delBtn.textContent = "Delete";
    delBtn.onclick = async () => {
      if (!confirm(`Delete ${w.quarter}?`)) return;
      await deleteDoc(doc(db, "launchWindows", w.id));
      loadAndRenderList(card);
    };
    row.appendChild(delBtn);
    card.appendChild(row);
  });
}

function buildAddForm(listCard) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h2>Add / update a launch window</h2><p class="helper">Using the same quarter ID (e.g. 2026-11) as an existing window updates it instead of duplicating.</p>`;

  const quarterField = document.createElement("div");
  quarterField.className = "field";
  quarterField.innerHTML = `<label>Quarter ID (YYYY-MM, e.g. 2026-11)</label>`;
  const quarterInput = document.createElement("input");
  quarterInput.type = "text";
  quarterInput.placeholder = "2026-11";
  quarterField.appendChild(quarterInput);
  card.appendChild(quarterField);

  const dateField = document.createElement("div");
  dateField.className = "field";
  dateField.innerHTML = `<label>Application opening date</label>`;
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateField.appendChild(dateInput);
  card.appendChild(dateField);

  const townsField = document.createElement("div");
  townsField.className = "field";
  townsField.innerHTML = `<label>Towns (comma-separated, leave blank if not announced)</label>`;
  const townsInput = document.createElement("input");
  townsInput.type = "text";
  townsInput.placeholder = "Tengah, Yishun";
  townsField.appendChild(townsInput);
  card.appendChild(townsField);

  const confirmedField = document.createElement("div");
  confirmedField.className = "field";
  const confirmedLabel = document.createElement("label");
  const confirmedCheckbox = document.createElement("input");
  confirmedCheckbox.type = "checkbox";
  confirmedCheckbox.style.marginRight = "8px";
  confirmedLabel.appendChild(confirmedCheckbox);
  confirmedLabel.appendChild(document.createTextNode("Officially confirmed by HDB (uncheck if this is a projected date)"));
  confirmedField.appendChild(confirmedLabel);
  card.appendChild(confirmedField);

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-primary";
  saveBtn.textContent = "Save";
  saveBtn.onclick = async () => {
    if (!quarterInput.value || !dateInput.value) {
      alert("Quarter ID and opening date are required.");
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    await setDoc(doc(db, "launchWindows", quarterInput.value), {
      quarter: quarterInput.value,
      applicationOpenDate: dateInput.value,
      dateConfirmed: confirmedCheckbox.checked,
      towns: townsInput.value ? townsInput.value.split(",").map((t) => t.trim()) : [],
    });
    quarterInput.value = "";
    dateInput.value = "";
    townsInput.value = "";
    confirmedCheckbox.checked = false;
    saveBtn.disabled = false;
    saveBtn.textContent = "Save";
    loadAndRenderList(listCard);
  };
  card.appendChild(saveBtn);

  return card;
}
