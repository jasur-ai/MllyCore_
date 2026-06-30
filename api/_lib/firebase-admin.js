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

async function requireUser(req, requiredRole = '') {
  initAdmin();
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) throw new Error('Token yoq.');
  const decoded = await admin.auth().verifyIdToken(token);
  const db = admin.firestore();
  const callerSnap = await db.collection('users').doc(decoded.uid).get();
  const caller = callerSnap.exists ? { id: callerSnap.id, ...callerSnap.data() } : null;
  if (requiredRole && caller?.role !== requiredRole) {
    const error = new Error('Ruxsat yoq.');
    error.statusCode = 403;
    throw error;
  }
  return { admin, db, decoded, caller };
}

function serverNow() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function cleanText(value) {
  return String(value || '').trim();
}

function formatName(profile = {}, fallback = 'User') {
  return cleanText(profile.name) || [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || fallback;
}

function createAvatar(name) {
  return String(name || 'U')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function randomSecretKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  ).join('-');
}

async function notifyUsers(db, users, payloadBuilder) {
  const batch = db.batch();
  users.forEach((userId) => {
    batch.set(db.collection('notifications').doc(), payloadBuilder(userId));
  });
  await batch.commit();
}

module.exports = {
  admin,
  initAdmin,
  requireUser,
  serverNow,
  cleanText,
  formatName,
  createAvatar,
  randomSecretKey,
  notifyUsers
};
