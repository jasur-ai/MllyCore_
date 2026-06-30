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
    const db = admin.firestore();
    const { teamId, title, description = '', type = 'idea' } = req.body || {};
    const cleanType = String(type || 'idea').trim().toLowerCase();
    const cleanTitle = String(title || '').trim();
    const cleanDescription = String(description || '').trim();

    if (!teamId) throw new Error('Workspace topilmadi.');
    if (!cleanTitle) throw new Error(cleanType === 'startup' ? 'Startup nomini kiriting.' : "G'oya nomini kiriting.");
    if (!['idea', 'startup'].includes(cleanType)) throw new Error('Noto\'g\'ri entry turi.');

    const memberRef = db.collection('teamMembers').doc(`${teamId}_${decoded.uid}`);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) {
      res.status(403).json({ error: 'Siz bu workspace a\'zosi emassiz.' });
      return;
    }

    const member = memberSnap.data();
    if (cleanType === 'startup' && member.role !== 'team_lead') {
      res.status(403).json({ error: 'Startup faqat team lead tomonidan qo\'shiladi.' });
      return;
    }

    const userSnap = await db.collection('users').doc(decoded.uid).get();
    const profile = userSnap.exists ? userSnap.data() : {};
    const now = admin.firestore.FieldValue.serverTimestamp();

    const ideaRef = await db.collection('ideas').add({
      teamId,
      title: cleanTitle,
      description: cleanDescription,
      status: cleanType === 'startup' ? 'Startup' : 'Raw',
      category: cleanType === 'startup' ? 'startup' : 'idea',
      entryType: cleanType,
      createdByUserId: decoded.uid,
      createdByName: profile.name || decoded.email || 'User',
      createdAt: now,
      updatedAt: now
    });

    const memberSnaps = await db.collection('teamMembers').where('teamId', '==', teamId).get();
    const batch = db.batch();
    memberSnaps.docs.forEach((doc) => {
      const targetUserId = doc.data().userId;
      batch.set(db.collection('notifications').doc(), {
        userId: targetUserId,
        teamId,
        type: cleanType === 'startup' ? 'startup_created' : 'idea_created',
        text: cleanType === 'startup'
          ? `Yangi startup qo'shildi: ${cleanTitle}`
          : `Yangi g'oya qo'shildi: ${cleanTitle}`,
        relatedEntityId: ideaRef.id,
        unread: targetUserId !== decoded.uid,
        isRead: targetUserId === decoded.uid,
        createdAt: now
      });
    });
    await batch.commit();

    res.status(200).json({
      id: ideaRef.id,
      type: cleanType
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Entry yaratilmadi.' });
  }
};
