// MllyCore Firebase client config.
// Firebase Console > Project settings > General > Your apps > Web app dan qiymatlarni qo'ying.
window.MLLYCORE_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBfFBrvuwwaxeS1JG2YOJ5iL1HaG2wq45Y",
  authDomain: "mllycore.firebaseapp.com",
  projectId: "mllycore",
  storageBucket: "mllycore.firebasestorage.app",
  messagingSenderId: "357782161297",
  appId: "1:357782161297:web:c82c1cc986107bf71b3c30",
  measurementId: "G-MEZEKYV9MN"
};

window.MLLYCORE_FIREBASE_ENABLED = Boolean(
  window.MLLYCORE_FIREBASE_CONFIG.apiKey &&
  window.MLLYCORE_FIREBASE_CONFIG.appId
);
