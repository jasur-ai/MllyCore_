// T17 - Haftalik "Workspace Digest" uchun Vercel Cron serverless funksiyasi.
// Vercel cron /api/weekly-digest ga murojaat qiladi (vercel.json -> crons).
// Auth: agar Bearer token bo'lsa admin ekanligini tekshiradi; aks holda
// x-cron-secret sarlavhasi CRON_SECRET bilan solishtiriladi.
const admin = require('firebase-admin');
const index = require('./index');

module.exports = async (req, res) => {
  try {
    index.initAdmin();
    const authHeader = (req.headers.authorization || '').trim();
    const cronSecret = req.headers['x-cron-secret'];
    const envSecret = process.env.CRON_SECRET;

    const cronOk = cronSecret && envSecret && cronSecret === envSecret;
    const hasBearer = authHeader.startsWith('Bearer ');

    if (!hasBearer && !cronOk) {
      return res.status(401).json({ error: 'Token yoki cron secret kerak.' });
    }

    if (hasBearer) {
      try {
        const decoded = await admin.auth().verifyIdToken(authHeader.replace('Bearer ', ''));
        const db = admin.firestore();
        const userSnap = await db.collection('users').doc(decoded.uid).get();
        const user = userSnap.exists ? userSnap.data() : {};
        if (user.role !== 'admin') return res.status(403).json({ error: 'Faqat admin.' });
      } catch (e) {
        return res.status(401).json({ error: 'Token noto\'g\'ri.' });
      }
    }

    const result = await index.runWeeklyDigest();
    res.status(200).json(result);
  } catch (error) {
    console.error('WEEKLY_DIGEST_ERROR:', error && error.message);
    res.status(500).json({ error: (error && error.message) || 'Xatolik yuz berdi.' });
  }
};
