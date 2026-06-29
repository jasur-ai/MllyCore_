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

function generateSecretKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  ).join('-');
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
      res.status(403).json({ error: 'Workspace yaratish faqat admin uchun.' });
      return;
    }

    const { name, description = '', leadEmail } = req.body || {};
    const cleanName = String(name || '').trim();
    const cleanLeadEmail = String(leadEmail || '').trim().toLowerCase();
    if (!cleanName) throw new Error('Workspace nomini kiriting.');
    if (!cleanLeadEmail) throw new Error('Team lead emailini kiriting.');

    let leadUser;
    try {
      leadUser = await admin.auth().getUserByEmail(cleanLeadEmail);
      leadUser = await admin.auth().updateUser(leadUser.uid, {
        password: cleanLeadEmail,
        disabled: false,
        emailVerified: false,
        displayName: cleanLeadEmail.split('@')[0]
      });
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
      leadUser = await admin.auth().createUser({
        email: cleanLeadEmail,
        password: cleanLeadEmail,
        emailVerified: false,
        displayName: cleanLeadEmail.split('@')[0],
        disabled: false
      });
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const leadName = leadUser.displayName || cleanLeadEmail.split('@')[0];
    await db.collection('users').doc(leadUser.uid).set({
      name: leadName,
      username: cleanLeadEmail.split('@')[0],
      email: cleanLeadEmail,
      role: 'team_lead',
      avatar: leadName.slice(0, 2).toUpperCase(),
      verified: false,
      blocked: false,
      passwordResetRequired: true,
      temporaryPasswordPolicy: 'email_as_password',
      updatedAt: now,
      joinedAt: now
    }, { merge: true });

    const secretKey = generateSecretKey();
    const teamRef = await db.collection('teams').add({
      name: cleanName,
      description: String(description || '').trim(),
      logo: cleanName.slice(0, 2).toUpperCase(),
      color: 'tl-1',
      createdByUserId: decoded.uid,
      leadUserId: leadUser.uid,
      invitationCode: secretKey,
      secretKey,
      membersCount: 1,
      archived: false,
      createdAt: now,
      updatedAt: now
    });

    await db.collection('teamMembers').doc(`${teamRef.id}_${leadUser.uid}`).set({
      teamId: teamRef.id,
      userId: leadUser.uid,
      role: 'team_lead',
      joinedAt: now,
      updatedAt: now
    });

    res.status(200).json({
      id: teamRef.id,
      leadEmail: cleanLeadEmail,
      temporaryPassword: cleanLeadEmail,
      secretKey
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Workspace yaratishda xatolik yuz berdi.' });
  }
};
