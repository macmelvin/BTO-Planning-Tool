/**
 * Shared cross-page navigation. All 4 user-facing pages (questionnaire,
 * calendar, odds, tracker) are sibling folders at the repo root, so the
 * same relative hrefs work identically regardless of which page renders
 * this — no per-page path adjustment needed.
 *
 * Not included: /admin/ — that's a separate, access-gated surface, not
 * part of the regular user journey, so it deliberately doesn't appear here.
 */
export function buildNav(activePage) {
  const wrap = document.createElement("div");

  const home = document.createElement("a");
  home.href = "../";
  home.className = "app-nav-home";
  home.textContent = "← BTO Planning Tool";
  wrap.appendChild(home);

  const nav = document.createElement("div");
  nav.className = "app-nav";

  const links = [
    { key: "eligibility", label: "Eligibility", href: "../questionnaire/" },
    { key: "calendar", label: "Calendar", href: "../calendar/" },
    { key: "odds", label: "Application Rates", href: "../odds/" },
    { key: "tracker", label: "My Applications", href: "../tracker/" },
  ];

  links.forEach((l) => {
    const a = document.createElement("a");
    a.href = l.href;
    a.textContent = l.label;
    if (l.key === activePage) a.classList.add("active");
    nav.appendChild(a);
  });

  wrap.appendChild(nav);
  return wrap;
}
