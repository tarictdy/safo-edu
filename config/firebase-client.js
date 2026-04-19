const { initializeApp, getApps } = require('firebase/app');
const { getFirestore } = require('firebase/firestore/lite');

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyAw3WIbrOS-T0bo__4xtDPE9nRTp_Jaaec',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'safio-77414.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || 'safio-77414',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'safio-77414.firebasestorage.app',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '314002536366',
  appId: process.env.FIREBASE_APP_ID || '1:314002536366:web:83bb2a9f3161cd59807a3f'
};

let appInstance;
let firestoreInstance;

function initFirebaseClient() {
  if (!appInstance) {
    appInstance = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  }

  if (!firestoreInstance) {
    firestoreInstance = getFirestore(appInstance);
  }

  return firestoreInstance;
}

function getDb() {
  return firestoreInstance || initFirebaseClient();
}

module.exports = {
  firebaseConfig,
  initFirebaseClient,
  getDb
};
