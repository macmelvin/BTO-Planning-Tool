# Sprint 0: Data Deletion Note

## The gap to close

Deleting a Firebase Auth user does **not** automatically delete their Firestore data. If a user deletes their account, `/users/{uid}/*` (eligibility answers, applications — the sensitive fields: marital status, citizenship, children, divorce/widowhood status) will silently persist unless you explicitly clean it up.

## Minimum viable fix for Sprint 0

A Cloud Function triggered on Auth user deletion:

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.cleanupUserData = functions.auth.user().onDelete(async (user) => {
  const db = admin.firestore();
  const userDocRef = db.collection('users').doc(user.uid);

  // Delete subcollections first, then the parent doc.
  const subcollections = ['eligibilityAnswers', 'applications'];
  for (const sub of subcollections) {
    const snapshot = await userDocRef.collection(sub).get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  await userDocRef.delete();
});
```

## What to expose in the UI

Even a one-line "Delete my data" option in settings, wired to `auth.currentUser.delete()`, matters more here than it would for a lower-sensitivity app — this tool asks about divorce, widowhood, and household composition. Don't defer this to a later sprint; it's cheap to add now while the data model is still small, and expensive to retrofit once you have real users' sensitive data at rest.

## Not required for Sprint 0, but worth deciding

- Data export ("download my data") — nice-to-have, defer
- Automatic data expiry for abandoned anonymous sessions (someone starts the questionnaire, never returns, never converts to a linked account) — consider a TTL policy later once you see real abandonment rates, not a Sprint 0 concern
