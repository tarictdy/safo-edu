const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function findServiceAccountPath() {
  const candidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    path.join(__dirname, '..', 'safio-firebase-adminsdk.json'),
    path.join(__dirname, '..', '..', 'safio-dis', 'safio-firebase-adminsdk.json')
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function initFirebaseAdmin() {
  if (admin.apps.length) {
    return admin.app();
  }

  const serviceAccountPath = findServiceAccountPath();
  if (!serviceAccountPath) {
    throw new Error('Service account Firebase Admin introuvable. Configure FIREBASE_SERVICE_ACCOUNT_PATH.');
  }

  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
}

function getAdminDb() {
  return initFirebaseAdmin().firestore();
}

module.exports = {
  getAdminDb,
  initFirebaseAdmin
};
