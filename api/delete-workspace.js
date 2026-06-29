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

async function deleteQuery(db, collectionName, field, value) {
  while (true) {
    const snap = await db.collection(collectionName).where(field, '==', value).limit(300).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
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
    const db = admin.firestore();
    const caller = await db.collection('users').doc(decoded.uid).get();
    if (!caller.exists || caller.data().role !== 'admin') {
      res.status(403).json({ error: "Workspace o'chirish faqat admin uchun." });
      return;
    }

    const { teamId } = req.body || {};
    if (!teamId) throw new Error('Workspace topilmadi.');

    const ideas = await db.collection('ideas').where('teamId', '==', teamId).get();
    for (const idea of ideas.docs) {
      await deleteQuery(db, 'ideaComments', 'ideaId', idea.id);
    }
    await deleteQuery(db, 'ideas', 'teamId', teamId);
    await deleteQuery(db, 'teamMembers', 'teamId', teamId);
    await deleteQuery(db, 'chatMessages', 'teamId', teamId);
    await deleteQuery(db, 'notifications', 'relatedEntityId', teamId);
    await db.collection('teams').doc(teamId).delete();

    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message || "Workspace o'chirilmadi." });
  }
};
