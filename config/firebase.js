const admin = require("firebase-admin");

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      ...serviceAccount,
      private_key: serviceAccount.private_key.replace(/\\n/g, "\n"),
    }),
    storageBucket: `${serviceAccount.project_id}.appspot.com`,
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = { db, bucket };
