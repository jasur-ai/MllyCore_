const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function initAdmin() {
  if (admin.apps.length) return admin.app();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const localPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (!raw && !fs.existsSync(localPath)) {
    throw new Error('Vercel env FIREBASE_SERVICE_ACCOUNT_JSON sozlanmagan.');
  }
  const serviceAccount = raw ? parseServiceAccount(raw) : require(localPath);
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || 'mllycore'
  });
}

function parseServiceAccount(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  return JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    initAdmin();
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) throw new Error('Token yoq.');

    const decoded = await admin.auth().verifyIdToken(token);
    const {
      workingHours = null,
      timezone = null,
      notificationPreferences = null,
      telegramUsername = null,
      emailDigestFrequency = null
    } = req.body || {};

    const db = admin.firestore();

    // Validatsiya
    if (workingHours) {
      if (!workingHours.start || !workingHours.end) {
        res.status(400).json({ error: 'workingHours uchun start va end vaqti talab etiladi.' });
        return;
      }
      // Vaqt formati: "HH:MM"
      if (!/^\d{2}:\d{2}$/.test(workingHours.start) || !/^\d{2}:\d{2}$/.test(workingHours.end)) {
        res.status(400).json({ error: 'Vaqt formati noto\'g\'ri. HH:MM formatida kiriting.' });
        return;
      }
    }

    if (timezone && typeof timezone !== 'string') {
      res.status(400).json({ error: 'timezone string bo\'lishi kerak.' });
      return;
    }

    if (emailDigestFrequency && !['never', 'daily', 'weekly', 'immediately'].includes(emailDigestFrequency)) {
      res.status(400).json({ error: 'emailDigestFrequency noto\'g\'ri qiymat.' });
      return;
    }

    // Update qilish
    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (workingHours) {
      updateData.workingHours = workingHours;
    }
    if (timezone) {
      updateData.timezone = timezone;
    }
    if (notificationPreferences) {
      updateData.notificationPreferences = notificationPreferences;
    }
    if (telegramUsername) {
      updateData.telegramUsername = telegramUsername;
    }
    if (emailDigestFrequency) {
      updateData.emailDigestFrequency = emailDigestFrequency;
    }

    await db.collection('users').doc(decoded.uid).update(updateData);

    // Audit log qo'shish
    await db.collection('auditLogs').add({
      action: 'user_preferences_updated',
      userId: decoded.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        changedFields: Object.keys(updateData).filter(k => k !== 'updatedAt')
      }
    });

    res.status(200).json({
      success: true,
      message: 'Sozlamalar muvaffaqiyatli yangilandi.',
      preferences: {
        workingHours: workingHours || null,
        timezone: timezone || null,
        notificationPreferences: notificationPreferences || null,
        telegramUsername: telegramUsername || null,
        emailDigestFrequency: emailDigestFrequency || null
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Sozlamalar yangilashda xatolik.' });
  }
};
