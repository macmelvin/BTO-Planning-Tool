# Sprint 0: Auth Setup

## Why anonymous auth first

The questionnaire (Sprint 1) needs a `userId` from Step 1 onward to persist partial progress. Forcing sign-up before someone answers a single question adds friction to the exact moment you most want them to stay. Firebase Anonymous Auth solves this: every visitor gets a real `uid` immediately, with no signup screen, and that `uid` stays stable if they later link a real account — so no data migration step is needed.

## Firebase Console Setup

1. Firebase Console → Authentication → Sign-in method
2. Enable **Anonymous**
3. Enable **Email link (passwordless sign-in)** and/or **Google** — pick based on your audience; Google sign-in is typically higher-conversion for a Singapore consumer app, email link avoids needing a Google account

## Client-side flow

```javascript
import { getAuth, signInAnonymously, onAuthStateChanged,
         linkWithPopup, GoogleAuthProvider } from "firebase/auth";

const auth = getAuth();

// On app load: ensure every visitor has a uid immediately
onAuthStateChanged(auth, (user) => {
  if (!user) {
    signInAnonymously(auth);
  }
});

// Later, when the user chooses to "save my progress" / "create an account":
async function upgradeToGoogleAccount() {
  const provider = new GoogleAuthProvider();
  try {
    // linkWithPopup preserves the existing uid — all their Firestore data
    // under /users/{uid}/* stays attached automatically.
    await linkWithPopup(auth.currentUser, provider);
  } catch (err) {
    if (err.code === 'auth/credential-already-in-use') {
      // Edge case: this Google account already has a separate anonymous
      // session elsewhere (e.g. they used the app on another device first).
      // Decide your merge strategy now rather than discovering it in
      // production — simplest v1 approach: keep the existing linked
      // account's data and discard the current anonymous session's data,
      // but tell the user this is happening rather than silently dropping it.
    }
  }
}
```

## When to prompt the upgrade

Don't ask immediately. Prompt "save your progress" after they've invested something — e.g. right after completing the eligibility questionnaire (Sprint 1's Step 6 results screen) or when they try to set a launch reminder (Sprint 3), since that's the first genuinely cross-session feature. Prompting too early feels like a paywall; prompting at the point of real value feels like a helpful save.

## What NOT to build in Sprint 0

- Password-based auth — passwordless (link or Google) avoids you handling password storage/reset flows entirely, which is a meaningful scope reduction for a solo dev
- Phone auth — adds SMS cost and complexity; revisit only if user research specifically asks for it
