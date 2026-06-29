const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const serviceAccountPath = path.join(root, 'serviceAccountKey.json');
const adminEmail = 'jasurjonai@gmail.com';
const adminPassword = 'abduvayitovv';

if (!fs.existsSync(serviceAccountPath)) {
  console.error('serviceAccountKey.json topilmadi.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath)),
  projectId: 'mllycore'
});

const db = admin.firestore();

async function deleteCollection(collectionName) {
  const ref = db.collection(collectionName);
  while (true) {
    const snap = await ref.limit(300).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

async function resetAuthUsers(adminUid) {
  let nextPageToken;
  do {
    const result = await admin.auth().listUsers(1000, nextPageToken);
    for (const user of result.users) {
      if (user.uid !== adminUid) {
        await admin.auth().deleteUser(user.uid);
      }
    }
    nextPageToken = result.pageToken;
  } while (nextPageToken);
}

async function ensureAdmin() {
  let user;
  try {
    user = await admin.auth().getUserByEmail(adminEmail);
    user = await admin.auth().updateUser(user.uid, {
      password: adminPassword,
      emailVerified: true,
      disabled: false,
      displayName: 'Jasur Admin'
    });
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    user = await admin.auth().createUser({
      email: adminEmail,
      password: adminPassword,
      emailVerified: true,
      displayName: 'Jasur Admin',
      disabled: false
    });
  }

  await db.collection('users').doc(user.uid).set({
    name: 'Jasur Admin',
    username: 'jasur_admin',
    email: adminEmail,
    role: 'admin',
    avatar: 'JA',
    verified: true,
    blocked: false,
    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return user.uid;
}

async function main() {
  const adminUid = await ensureAdmin();

  await Promise.all([
    deleteCollection('teams'),
    deleteCollection('teamMembers'),
    deleteCollection('ideas'),
    deleteCollection('ideaComments'),
    deleteCollection('chatMessages'),
    deleteCollection('notifications'),
    deleteCollection('auditLogs'),
    deleteCollection('settings')
  ]);

  const users = await db.collection('users').get();
  const batch = db.batch();
  users.docs.forEach((doc) => {
    if (doc.id !== adminUid) batch.delete(doc.ref);
  });
  await batch.commit();

  await resetAuthUsers(adminUid);
  console.log(`Reset tugadi. Faqat admin qoldi: ${adminEmail} / ${adminPassword}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
