import { ensureSignedIn, auth } from "../questionnaire/js/firebase-config.js";

const btn = document.getElementById("delete-data-btn");
const statusEl = document.getElementById("delete-data-status");

if (btn) {
  btn.addEventListener("click", async () => {
    const confirmed = confirm(
      "This permanently deletes all your saved data — eligibility answers, tracked applications, and notification settings. This can't be undone. Continue?"
    );
    if (!confirmed) return;

    btn.disabled = true;
    btn.textContent = "Deleting…";

    try {
      // Ensure there's an active session to delete — most visitors already
      // have one from using the app, but a first-time visitor landing
      // directly on this page might not yet.
      await ensureSignedIn();
      await auth.currentUser.delete();

      statusEl.textContent = "Your data has been deleted. Starting fresh next time you use any part of the app.";
      statusEl.style.color = "var(--color-good)";
      btn.style.display = "none";
    } catch (err) {
      console.error("Delete failed:", err);
      // Firebase can require a recent sign-in for account deletion on
      // non-anonymous accounts if the session is old — surface plainly
      // rather than a raw error code.
      if (err.code === "auth/requires-recent-login") {
        statusEl.textContent = "For security, please refresh the page and try again right after using the app.";
      } else {
        statusEl.textContent = "Something went wrong deleting your data. Please try again, or contact support if this continues.";
      }
      statusEl.style.color = "var(--color-flag)";
      btn.disabled = false;
      btn.textContent = "Delete my data";
    }
  });
}
