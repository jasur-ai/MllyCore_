// T17 - Haftalik "Workspace Digest" ni lokal yoki CI ortidan yaratish uchun skript.
// Foydalanish:
//   FIREBASE_SERVICE_ACCOUNT_JSON="$(cat serviceAccountKey.json)" node scripts/generate-weekly-digest.js
// Yoki Vercel'da CRON_SECRET o'rnating va Vercel Cron uni avtomatik chaqiradi.
//
// Logika api/index.js ichidagi handleWeeklyDigest() bilan bir xil (bitta manba).

const path = require('path');
const index = require(path.join(__dirname, '..', 'api', 'index'));

(async () => {
  const result = await index.runWeeklyDigest();
  console.log('✅ Weekly digest natijasi:');
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => {
  console.error('❌ Weekly digest xatosi:', error && error.message);
  process.exit(1);
});
