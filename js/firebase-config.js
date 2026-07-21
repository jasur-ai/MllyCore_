// MllyCore Firebase client config.
// Firebase Console > Project settings > General > Your apps > Web app dan qiymatlarni qo'ying.
(function() {
  // Local emulator detection: localhost yoki 127.0.0.1 bo'lsa fake config ishlatiladi
  var isLocalDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  if (isLocalDev) {
    // Emulator uchun fake config — barcha so'rovlar localhost:9099 va :8081 ga ketadi
    window.MLLYCORE_FIREBASE_CONFIG = {
      apiKey: "fake-emulator-api-key",
      authDomain: "localhost",
      projectId: "mllycore",
      storageBucket: "mllycore.appspot.com",
      messagingSenderId: "000000000000",
      appId: "1:000000000000:web:0000000000000000000000"
    };
  } else {
    window.MLLYCORE_FIREBASE_CONFIG = {
      apiKey: "AIzaSyBfFBrvuwwaxeS1JG2YOJ5iL1HaG2wq45Y",
      authDomain: "mllycore.firebaseapp.com",
      projectId: "mllycore",
      storageBucket: "mllycore.firebasestorage.app",
      messagingSenderId: "357782161297",
      appId: "1:357782161297:web:c82c1cc986107bf71b3c30",
      measurementId: "G-MEZEKYV9MN"
    };
  }

  window.MLLYCORE_FIREBASE_ENABLED = Boolean(
    window.MLLYCORE_FIREBASE_CONFIG.apiKey &&
    window.MLLYCORE_FIREBASE_CONFIG.appId
  );
})();
