const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

/**
 * Deletes a user's Firestore data when their Auth account is deleted.
 * Auth deletion does NOT cascade to Firestore automatically — this closes
 * that gap. See docs/sprint0-privacy-deletion-note.md for context.
 */
exports.cleanupUserData = functions.auth.user().onDelete(async (user) => {
  const db = admin.firestore();
  const userDocRef = db.collection('users').doc(user.uid);

  // Sprint 3 adds 'notificationTokens' — without this, a deleted user's
  // push token would silently keep receiving reminders indefinitely.
  const subcollections = ['eligibilityAnswers', 'applications', 'notificationTokens'];
  for (const sub of subcollections) {
    const snapshot = await userDocRef.collection(sub).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    if (!snapshot.empty) {
      await batch.commit();
    }
  }

  await userDocRef.delete();

  console.log(`Cleaned up Firestore data for deleted user: ${user.uid}`);
});

// Sprint 3: quarterly launch + HFE deadline reminders via FCM.
exports.sendLaunchReminders = require('./sendReminders').sendLaunchReminders;
