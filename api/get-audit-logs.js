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
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    initAdmin();
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) throw new Error('Token yoq.');

    const decoded = await admin.auth().verifyIdToken(token);
    const db = admin.firestore();
    const caller = await db.collection('users').doc(decoded.uid).get();
    
    if (!caller.exists || caller.data().role !== 'admin') {
      res.status(403).json({ error: 'Admin huquqi talab etiladi.' });
      return;
    }

    const {
      limit = 50,
      startAfter = null,
      actionType = null,
      userId = null,
      startDate = null,
      endDate = null
    } = req.query;

    const pageLimit = Math.min(parseInt(limit) || 50, 200);
    let query = db.collection('auditLogs').orderBy('timestamp', 'desc');

    // Filtrlash
    if (actionType) {
      query = query.where('action', '==', actionType);
    }
    if (userId) {
      query = query.where('userId', '==', userId);
    }

    // Sana bo'yicha filtrlash
    if (startDate) {
      const start = new Date(startDate);
      query = query.where('timestamp', '>=', start);
    }
    if (endDate) {
      const end = new Date(endDate);
      query = query.where('timestamp', '<=', end);
    }

    // Sahifalash
    if (startAfter) {
      const startDoc = await db.collection('auditLogs').doc(startAfter).get();
      if (startDoc.exists) {
        query = query.startAfter(startDoc);
      }
    }

    query = query.limit(pageLimit + 1); // +1 to check if there are more

    const snapshot = await query.get();
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const hasMore = docs.length > pageLimit;
    const logs = docs.slice(0, pageLimit);
    const nextCursor = hasMore && logs.length > 0 ? logs[logs.length - 1].id : null;

    // Har bir log uchun user ma'lumotlarini qo'shish
    const enrichedLogs = await Promise.all(logs.map(async (log) => {
      let userName = 'Unknown';
      if (log.userId) {
        const userDoc = await db.collection('users').doc(log.userId).get();
        if (userDoc.exists) {
          userName = userDoc.data().name || userDoc.data().email || 'Unknown';
        }
      }
      return {
        ...log,
        userName
      };
    }));

    res.status(200).json({
      timestamp: new Date().toISOString(),
      logs: enrichedLogs,
      pagination: {
        limit: pageLimit,
        hasMore,
        nextCursor
      },
      filters: {
        actionType: actionType || null,
        userId: userId || null,
        startDate: startDate || null,
        endDate: endDate || null
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Audit logs olishda xatolik.' });
  }
};
