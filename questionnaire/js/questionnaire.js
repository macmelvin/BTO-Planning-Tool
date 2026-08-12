import { ensureSignedIn, saveProgress, loadProgress } from "./firebase-config.js";
import { buildEligibilityResult, SCHEME_QUOTA_NOTES } from "./rulesEngine.js";

// --- Applicant state — this shape matches the Applicant object in
// docs/BTO-Eligibility-Rules-Engine.md exactly, so the rules engine can
// consume it directly with no translation layer. ---
function blankApplicant() {
  return {
    citizenship: null,
    spouseCitizenship: null,
    maritalStatus: null,
    age: null,
    isFirstTimer: null,
    spouseIsFirstTimer: null,
    isDivorcedOrWidowedWithChildUnder18: false,
    ownedOrAcquiredPropertyAfterDivorceOrSpouseDeath: false,
    children: [],
    parentLink: null,
    marriedChildLink: null,
    currentlyHdbRentalTenant: false,
    hdbRentalTenancyDurationYears: 0,
    ownsOrOccupiesExistingProperty: false,
    previouslyBoughtFlatUnderTCPS: false,
    targetFlatType: null,
    targetProjectClassification: null,
  };
}

let applicant = blankApplicant();
let currentStep = "1";
let userId = null;
let wantsFamilyProximity = null; // Step 3 opt-in gate

const STEP_ORDER = ["1", "1b", "2", "3", "4", "6"]; // "5" folded into Step 1 (flat type asked early)

const root = document.getElementById("app-root");

// ---------- Boot ----------
init();

async function init() {
  const user = await ensureSignedIn();
  userId = user.uid;
  const saved = await loadProgress(userId);
  if (saved && saved.applicant) {
    applicant = { ...blankApplicant(), ...saved.applicant };
    currentStep = saved.currentStep || "1";
  }
  render();
}

async function persist() {
  if (!userId) return;
  await saveProgress(userId, { applicant, currentStep });
}

function goTo(step) {
  currentStep = step;
  persist();
  render();
}

function nextStepFrom(step) {
  if (step === "1") {
    return ["divorced", "widowed"].includes(applicant.maritalStatus) ? "1b" : "2";
  }
  if (step === "1b") return "2";
  if (step === "2") return "3";
  if (step === "3") return "4";
  if (step === "4") return "6";
  return "6";
}

function prevStepFrom(step) {
  if (step === "1b") return "1";
  if (step === "2") return applicant.maritalStatus && ["divorced", "widowed"].includes(applicant.maritalStatus) ? "1b" : "1";
  if (step === "3") return "2";
  if (step === "4") return "3";
  if (step === "6") return "4";
  return "1";
}

// ---------- Render dispatch ----------
function render() {
  root.innerHTML = "";
  root.appendChild(buildHeader());
  root.appendChild(buildTicketStub());

  const card = document.createElement("div");
  card.className = "card";

  switch (currentStep) {
    case "1": renderStep1(card); break;
    case "1b": renderStep1b(card); break;
    case "2": renderStep2(card); break;
    case "3": renderStep3(card); break;
    case "4": renderStep4(card); break;
    case "6": renderResults(card); break;
  }
  root.appendChild(card);
}

function buildHeader() {
  const wrap = document.createElement("div");
  wrap.className = "app-header";
  wrap.innerHTML = `
    <div class="eyebrow">BTO Planning Tool</div>
    <h1>Eligibility &amp; priority scheme check</h1>
  `;
  return wrap;
}

function buildTicketStub() {
  const stubLabels = [
    { key: "1", label: "Household" },
    { key: "2", label: "Children" },
    { key: "3", label: "Proximity" },
    { key: "4", label: "Housing" },
    { key: "6", label: "Result" },
  ];
  const wrap = document.createElement("div");
  wrap.className = "ticket-stub";
  const visited = STEP_ORDER.indexOf(currentStep === "1b" ? "1" : currentStep);
  stubLabels.forEach((s, i) => {
    const stepIdx = STEP_ORDER.indexOf(s.key);
    const div = document.createElement("div");
    div.className = "stub" + (s.key === currentStep || (currentStep === "1b" && s.key === "1") ? " active" : stepIdx < visited ? " done" : "");
    div.innerHTML = `<span class="num">${String(i + 1).padStart(2, "0")}</span>${s.label}`;
    wrap.appendChild(div);
  });
  return wrap;
}

// ---------- Field helpers ----------
function choiceGroup(container, label, options, selectedValue, onSelect) {
  const field = document.createElement("div");
  field.className = "field";
  field.innerHTML = `<label>${label}</label>`;
  const group = document.createElement("div");
  group.className = "choice-group";
  options.forEach(({ value, text }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice-btn" + (selectedValue === value ? " selected" : "");
    btn.textContent = text;
    btn.onclick = () => onSelect(value);
    group.appendChild(btn);
  });
  field.appendChild(group);
  container.appendChild(field);
}

function navRow(container, { backStep, nextLabel, onNext, showBack = true }) {
  const nav = document.createElement("div");
  nav.className = "nav-row";
  if (showBack) {
    const back = document.createElement("button");
    back.className = "btn btn-secondary";
    back.textContent = "Back";
    back.onclick = () => goTo(backStep);
    nav.appendChild(back);
  } else {
    nav.appendChild(document.createElement("span"));
  }
  const next = document.createElement("button");
  next.className = "btn btn-primary";
  next.textContent = nextLabel || "Continue";
  next.onclick = onNext;
  nav.appendChild(next);
  container.appendChild(nav);
}

// ---------- Step 1: Household Basics ----------
function renderStep1(card) {
  card.innerHTML = `<h2>Tell us about your household</h2><p class="helper">This decides which priority schemes could apply to you — takes under a minute.</p>`;

  choiceGroup(card, "Are you applying alone or with someone?", [
    { value: "single", text: "Single" },
    { value: "married", text: "Married" },
    { value: "engaged", text: "Engaged" },
    { value: "divorced", text: "Divorced" },
    { value: "widowed", text: "Widowed" },
  ], applicant.maritalStatus, (v) => { applicant.maritalStatus = v; persist(); render(); });

  choiceGroup(card, "Have you owned an HDB flat or private property before?", [
    { value: "no", text: "No — first-timer" },
    { value: "yes", text: "Yes — second-timer" },
  ], applicant.isFirstTimer === null ? null : (applicant.isFirstTimer ? "no" : "yes"),
    (v) => { applicant.isFirstTimer = v === "no"; persist(); render(); });

  if (applicant.maritalStatus === "married" || applicant.maritalStatus === "engaged") {
    choiceGroup(card, "Has your spouse/fiancé(e) owned a flat or property before?", [
      { value: "no", text: "No — first-timer" },
      { value: "yes", text: "Yes — second-timer" },
    ], applicant.spouseIsFirstTimer === null ? null : (applicant.spouseIsFirstTimer ? "no" : "yes"),
      (v) => { applicant.spouseIsFirstTimer = v === "no"; persist(); render(); });
  }

  choiceGroup(card, "Your citizenship", [
    { value: "SC", text: "Singapore Citizen" },
    { value: "SPR", text: "Singapore PR" },
  ], applicant.citizenship, (v) => { applicant.citizenship = v; persist(); render(); });

  choiceGroup(card, "What flat type are you considering?", [
    { value: "2RoomFlexi", text: "2-Room Flexi" },
    { value: "3Room", text: "3-Room" },
    { value: "4Room", text: "4-Room" },
    { value: "5Room", text: "5-Room" },
    { value: "Executive", text: "Executive" },
  ], applicant.targetFlatType, (v) => { applicant.targetFlatType = v; persist(); render(); });

  const ready = applicant.maritalStatus && applicant.isFirstTimer !== null && applicant.citizenship && applicant.targetFlatType;
  navRow(card, {
    showBack: false,
    onNext: () => { if (ready) goTo(nextStepFrom("1")); },
  });
}

// ---------- Step 1b: Divorced/Widowed ----------
function renderStep1b(card) {
  card.innerHTML = `<h2>A couple more questions</h2><p class="helper">These determine whether the Assistance Scheme (ASSIST) could apply to you.</p>`;

  choiceGroup(card, "Do you have a child aged 18 or under living with you?", [
    { value: "yes", text: "Yes" }, { value: "no", text: "No" },
  ], applicant.isDivorcedOrWidowedWithChildUnder18 ? "yes" : "no",
    (v) => { applicant.isDivorcedOrWidowedWithChildUnder18 = v === "yes"; persist(); render(); });

  choiceGroup(card, "Have you acquired any property since your divorce or spouse's passing (other than your matrimonial home)?", [
    { value: "yes", text: "Yes" }, { value: "no", text: "No" },
  ], applicant.ownedOrAcquiredPropertyAfterDivorceOrSpouseDeath ? "yes" : "no",
    (v) => { applicant.ownedOrAcquiredPropertyAfterDivorceOrSpouseDeath = v === "yes"; persist(); render(); });

  navRow(card, { backStep: prevStepFrom("1b"), onNext: () => goTo(nextStepFrom("1b")) });
}

// ---------- Step 2: Children ----------
function renderStep2(card) {
  card.innerHTML = `<h2>Children</h2><p class="helper">Include children you have now, or are expecting.</p>`;

  const hasAny = applicant.children.length > 0;
  choiceGroup(card, "Do you have children, or are you expecting?", [
    { value: "yes", text: "Yes" }, { value: "no", text: "No" },
  ], hasAny ? "yes" : (applicant.children.length === 0 && currentStep === "2" ? null : "no"),
    (v) => {
      if (v === "no") { applicant.children = []; }
      else if (applicant.children.length === 0) { applicant.children.push({ citizenship: "SC", age: 0, isAdopted: false, isFromExpecting: false }); }
      persist(); render();
    });

  if (applicant.children.length > 0) {
    applicant.children.forEach((child, i) => {
      const cwrap = document.createElement("div");
      cwrap.className = "repeatable-card";
      cwrap.innerHTML = `<div class="row" style="margin-bottom:8px;"><strong>Child ${i + 1}</strong>
        <button class="remove-btn" data-idx="${i}">Remove</button></div>`;
      cwrap.querySelector(".remove-btn").onclick = () => { applicant.children.splice(i, 1); persist(); render(); };

      const ageField = document.createElement("div");
      ageField.className = "field";
      ageField.innerHTML = `<label>Age (0 if expecting)</label>`;
      const ageInput = document.createElement("input");
      ageInput.type = "number"; ageInput.min = 0; ageInput.value = child.age;
      ageInput.oninput = (e) => { child.age = Number(e.target.value); persist(); };
      ageField.appendChild(ageInput);
      cwrap.appendChild(ageField);

      choiceGroup(cwrap, "Citizenship", [
        { value: "SC", text: "Singapore Citizen" }, { value: "SPR", text: "Singapore PR" },
      ], child.citizenship, (v) => { child.citizenship = v; persist(); render(); });

      choiceGroup(cwrap, "Expecting (with doctor's certification)?", [
        { value: "yes", text: "Yes" }, { value: "no", text: "No" },
      ], child.isFromExpecting ? "yes" : "no", (v) => { child.isFromExpecting = v === "yes"; persist(); render(); });

      card.appendChild(cwrap);
    });

    const addBtn = document.createElement("button");
    addBtn.className = "link-btn";
    addBtn.textContent = "+ Add another child";
    addBtn.onclick = () => { applicant.children.push({ citizenship: "SC", age: 0, isAdopted: false, isFromExpecting: false }); persist(); render(); };
    card.appendChild(addBtn);
  }

  navRow(card, { backStep: prevStepFrom("2"), onNext: () => goTo(nextStepFrom("2")) });
}

// ---------- Step 3: Family Proximity (opt-in) ----------
function renderStep3(card) {
  card.innerHTML = `<h2>Living near family</h2><p class="helper">Some schemes give priority if you're applying to live near or with a parent or married child.</p>`;

  choiceGroup(card, "Want to check if this applies to you?", [
    { value: "yes", text: "Yes, check this" }, { value: "no", text: "No, skip this" },
  ], wantsFamilyProximity, (v) => { wantsFamilyProximity = v; if (v === "no") { applicant.parentLink = null; applicant.marriedChildLink = null; } persist(); render(); });

  if (wantsFamilyProximity === "yes") {
    if (!applicant.parentLink) applicant.parentLink = { included: false, parentCitizenship: null, livingWithParent: false, distanceToTargetFlatKm: null };

    choiceGroup(card, "Include a parent on this application?", [
      { value: "yes", text: "Yes" }, { value: "no", text: "No" },
    ], applicant.parentLink.included ? "yes" : "no", (v) => { applicant.parentLink.included = v === "yes"; persist(); render(); });

    if (applicant.parentLink.included) {
      choiceGroup(card, "Parent's citizenship", [
        { value: "SC", text: "Singapore Citizen" }, { value: "SPR", text: "Singapore PR" },
      ], applicant.parentLink.parentCitizenship, (v) => { applicant.parentLink.parentCitizenship = v; persist(); render(); });

      choiceGroup(card, "Will you live with them, or within 4km of their home?", [
        { value: "with", text: "Living with them" },
        { value: "near", text: "Within 4km" },
        { value: "no", text: "Neither" },
      ], applicant.parentLink.livingWithParent ? "with" : (applicant.parentLink.distanceToTargetFlatKm <= 4 ? "near" : "no"),
        (v) => {
          applicant.parentLink.livingWithParent = v === "with";
          applicant.parentLink.distanceToTargetFlatKm = v === "near" ? 3 : (v === "with" ? 0 : 99);
          persist(); render();
        });
    }

    if (!["2RoomFlexi", "3Room"].includes(applicant.targetFlatType)) {
      const note = document.createElement("p");
      note.className = "helper";
      note.textContent = "Joint Balloting (with a married child) only applies to 2-Room Flexi and 3-Room flats — not shown since that's not your selected flat type.";
      card.appendChild(note);
    } else {
      if (!applicant.marriedChildLink) applicant.marriedChildLink = { included: false };
      choiceGroup(card, "Applying together with a married child for joint balloting?", [
        { value: "yes", text: "Yes" }, { value: "no", text: "No" },
      ], applicant.marriedChildLink.included ? "yes" : "no", (v) => { applicant.marriedChildLink.included = v === "yes"; persist(); render(); });
    }
  }

  navRow(card, { backStep: prevStepFrom("3"), onNext: () => goTo(nextStepFrom("3")) });
}

// ---------- Step 4: Current Housing ----------
function renderStep4(card) {
  card.innerHTML = `<h2>Your current housing</h2>`;

  choiceGroup(card, "Are you currently living in an HDB rental flat?", [
    { value: "yes", text: "Yes" }, { value: "no", text: "No" },
  ], applicant.currentlyHdbRentalTenant ? "yes" : "no",
    (v) => { applicant.currentlyHdbRentalTenant = v === "yes"; persist(); render(); });

  if (applicant.currentlyHdbRentalTenant) {
    const field = document.createElement("div");
    field.className = "field";
    field.innerHTML = `<label>For how many years?</label>`;
    const input = document.createElement("input");
    input.type = "number"; input.min = 0; input.value = applicant.hdbRentalTenancyDurationYears;
    input.oninput = (e) => { applicant.hdbRentalTenancyDurationYears = Number(e.target.value); persist(); };
    field.appendChild(input);
    card.appendChild(field);
  }

  if (applicant.targetFlatType === "2RoomFlexi") {
    choiceGroup(card, "Is anyone in your household 55+, moving closer to their current home?", [
      { value: "yes", text: "Yes" }, { value: "no", text: "No" },
    ], applicant.age >= 55 && applicant.ownsOrOccupiesExistingProperty ? "yes" : "no",
      (v) => {
        if (v === "yes") { applicant.age = 55; applicant.ownsOrOccupiesExistingProperty = true; }
        else { applicant.ownsOrOccupiesExistingProperty = false; }
        persist(); render();
      });
  }

  navRow(card, { backStep: prevStepFrom("4"), nextLabel: "See my results", onNext: () => goTo(nextStepFrom("4")) });
}

// ---------- Step 6: Results ----------
function renderResults(card) {
  const result = buildEligibilityResult(applicant);
  card.innerHTML = `<h2>Your eligibility snapshot</h2>`;

  const summary = document.createElement("p");
  summary.className = "helper";
  summary.textContent = result.isFirstTimerFamily
    ? "You qualify as a first-timer family for BTO purposes."
    : "Based on your answers, you'd be applying as a second-timer household.";
  card.appendChild(summary);

  const block = document.createElement("div");
  block.className = "result-block";
  block.innerHTML = `<h3>Schemes you may be eligible for</h3>`;
  if (result.eligibleSchemes.length === 0) {
    block.innerHTML += `<p class="helper">No priority schemes matched your answers — you'd apply under the general first-timer or second-timer category.</p>`;
  } else {
    result.eligibleSchemes.forEach((s) => {
      const row = document.createElement("div");
      row.className = "scheme-row";
      const isPrimary = s.scheme === result.recommendedStacking.primary;
      const isSecondary = s.scheme === result.recommendedStacking.secondary;
      row.innerHTML = `
        <span class="scheme-name">${s.scheme}${isPrimary ? ' <span class="badge primary">Primary</span>' : ""}${isSecondary ? ' <span class="badge">Secondary</span>' : ""}</span>
        <span class="scheme-quota">${s.quotaNote}</span>`;
      block.appendChild(row);
    });
  }
  card.appendChild(block);

  if (result.recommendedStacking.ballotOrder) {
    const p = document.createElement("p");
    p.className = "helper";
    p.textContent = `Ballot order: ${result.recommendedStacking.ballotOrder.join(" → ")}. You'll be balloted under the first scheme; if unsuccessful, balloted again under the second.`;
    card.appendChild(p);
  } else if (result.recommendedStacking.secondary) {
    const flag = document.createElement("div");
    flag.className = "flag-box";
    flag.textContent = "Ballot order for this scheme combination isn't confirmed yet — check directly with HDB before relying on a specific sequence.";
    card.appendChild(flag);
  }

  result.complianceFlags.forEach((f) => {
    const flag = document.createElement("div");
    flag.className = "flag-box";
    flag.textContent = f;
    card.appendChild(flag);
  });

  const disclaimer = document.createElement("div");
  disclaimer.className = "disclaimer";
  disclaimer.textContent = result.disclaimer;
  card.appendChild(disclaimer);

  navRow(card, { backStep: prevStepFrom("6"), nextLabel: "Start over", onNext: () => { applicant = blankApplicant(); wantsFamilyProximity = null; goTo("1"); } });
}
