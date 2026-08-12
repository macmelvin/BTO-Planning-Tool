import { getNextLaunchWindow, getHfeDeadline, daysUntil, formatDate, listLaunchWindows } from "./launchCalendar.js";
import { enableLaunchReminders } from "./notifications.js";
import { ensureSignedIn } from "../../questionnaire/js/firebase-config.js";
import { buildNav } from "../../shared/nav.js";

const root = document.getElementById("calendar-root");

init();

async function init() {
  await ensureSignedIn(); // needed before enableLaunchReminders() can write a token doc
  await render();
}

async function render() {
  root.innerHTML = "";
  root.appendChild(buildHeader());
  root.appendChild(buildNav("calendar"));
  root.appendChild(await buildNextLaunchCard());
  root.appendChild(buildReminderCard());
  root.appendChild(await buildFullCalendar());
  root.appendChild(buildFooterDisclaimer());
}

function buildHeader() {
  const wrap = document.createElement("div");
  wrap.className = "app-header";
  wrap.innerHTML = `
    <div class="eyebrow">BTO Planning Tool</div>
    <h1>Launch calendar &amp; reminders</h1>
  `;
  return wrap;
}

async function buildNextLaunchCard() {
  const card = document.createElement("div");
  card.className = "card";
  const next = await getNextLaunchWindow();

  if (!next) {
    card.innerHTML = `<h2>No upcoming launches on file</h2><p class="helper">Check back soon — this calendar is updated each quarter.</p>`;
    return card;
  }

  const hfeDeadline = getHfeDeadline(next);
  const daysToOpen = daysUntil(new Date(next.applicationOpenDate));
  const daysToHfe = daysUntil(hfeDeadline);
  const hfeDeadlinePassed = daysToHfe < 0;
  const towns = next.towns || [];

  card.innerHTML = `
    <h2>Next launch: ${next.quarter}</h2>
    <p class="helper">${next.dateConfirmed ? "Confirmed" : "Projected — not yet officially announced"} opening date: ${formatDate(new Date(next.applicationOpenDate))}</p>
    <div class="countdown-row">
      <div class="countdown-stat">
        <span class="countdown-num">${Math.max(daysToOpen, 0)}</span>
        <span class="countdown-label">days to application opening</span>
      </div>
      <div class="countdown-stat">
        <span class="countdown-num">${hfeDeadlinePassed ? "—" : daysToHfe}</span>
        <span class="countdown-label">${hfeDeadlinePassed ? "HFE window has closed for this launch" : "days to apply for your HFE letter"}</span>
      </div>
    </div>
    ${towns.length ? `<p class="helper">Towns expected: ${towns.join(", ")}</p>` : ""}
    ${!next.dateConfirmed ? `<div class="flag-box">This date is projected from HDB's quarterly pattern, not yet officially confirmed. Check back closer to the date.</div>` : ""}
    ${hfeDeadlinePassed ? `<div class="flag-box">The typical 6-week HFE lead time for this launch has passed — an HFE letter can still take time to process, so apply as soon as possible if you haven't already.</div>` : ""}
  `;
  return card;
}

function buildReminderCard() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <h2>Get notified</h2>
    <p class="helper">We'll remind you when it's time to apply for your HFE letter, and when applications open — even if you're not on this page.</p>
  `;
  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.textContent = "Enable reminders";
  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = "Setting up…";
    const result = await enableLaunchReminders();
    if (result.success) {
      btn.textContent = "Reminders enabled ✓";
    } else {
      btn.textContent = "Enable reminders";
      btn.disabled = false;
      const msg = document.createElement("p");
      msg.className = "helper";
      msg.style.color = "var(--color-flag)";
      msg.textContent = result.reason;
      card.appendChild(msg);
    }
  };
  card.appendChild(btn);
  return card;
}

async function buildFullCalendar() {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<h2>All known launch windows</h2>`;
  const windows = await listLaunchWindows();

  if (windows.length === 0) {
    card.innerHTML += `<p class="helper">No launch windows on file yet.</p>`;
    return card;
  }

  windows
    .sort((a, b) => a.applicationOpenDate.localeCompare(b.applicationOpenDate))
    .forEach((w) => {
      const row = document.createElement("div");
      row.className = "scheme-row";
      row.innerHTML = `
        <span class="scheme-name">${w.quarter}</span>
        <span class="scheme-quota">${formatDate(new Date(w.applicationOpenDate))}${w.dateConfirmed ? "" : " (projected)"}</span>
      `;
      card.appendChild(row);
    });
  return card;
}

function buildFooterDisclaimer() {
  const footer = document.createElement("div");
  footer.className = "footer-disclaimer";
  footer.innerHTML = `Launch dates are estimates based on HDB's public quarterly pattern and may change. Confirm on HDB's official site before making plans.`;
  return footer;
}
