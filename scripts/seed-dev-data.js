/* ============================================================================
 * MllyCore — Seed Dev Data (Firebase Emulator)
 * ----------------------------------------------------------------------------
 * Run this AFTER firebase emulators are started:
 *   node scripts/seed-dev-data.js
 *
 * Creates:
 *   - Admin user: admin@test.com / password123
 *   - Regular user: user@test.com / password123
 *   - Sample workspace with data
 * ==========================================================================*/

const admin = require('firebase-admin');
const path = require('path');

// Connect to Firebase emulators
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8081';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({ projectId: 'mllycore' });

const db = admin.firestore();
const auth = admin.auth();

const SV = () => admin.firestore.FieldValue.serverTimestamp();

function generateSecretKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const parts = [];
  for (let p = 0; p < 4; p += 1) {
    let part = '';
    for (let i = 0; i < 4; i += 1) part += chars[Math.floor(Math.random() * chars.length)];
    parts.push(part);
  }
  return parts.join('-');
}

async function seed() {
  console.log('🌱 Seeding dev data...\n');

  // Create admin user
  let adminUid, userUid;
  try {
    const adminUser = await auth.createUser({
      email: 'admin@test.com',
      password: 'password123',
      emailVerified: true,
      displayName: 'Admin User'
    });
    adminUid = adminUser.uid;
    console.log('  ✅ Admin user: admin@test.com / password123');
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      const u = await auth.getUserByEmail('admin@test.com');
      adminUid = u.uid;
      console.log('  ℹ️ Admin user already exists');
    } else { throw e; }
  }

  try {
    const normalUser = await auth.createUser({
      email: 'user@test.com',
      password: 'password123',
      emailVerified: true,
      displayName: 'Test User'
    });
    userUid = normalUser.uid;
    console.log('  ✅ Regular user: user@test.com / password123');
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      const u = await auth.getUserByEmail('user@test.com');
      userUid = u.uid;
      console.log('  ℹ️ Regular user already exists');
    } else { throw e; }
  }

  // Create user documents in Firestore
  await db.collection('users').doc(adminUid).set({
    name: 'Admin User',
    username: 'admin',
    email: 'admin@test.com',
    role: 'admin',
    avatar: 'AU',
    verified: true,
    joinedAt: SV(),
  }, { merge: true });
  console.log('  ✅ Admin profile created');

  await db.collection('users').doc(userUid).set({
    name: 'Test User',
    username: 'testuser',
    email: 'user@test.com',
    role: 'member',
    avatar: 'TU',
    verified: true,
    joinedAt: SV(),
  }, { merge: true });
  console.log('  ✅ User profile created');

  // Create a sample workspace
  const secretKey = generateSecretKey();
  const teamRef = await db.collection('teams').add({
    name: 'Test Workspace',
    description: 'Sinov uchun workspace',
    createdByUserId: adminUid,
    createdBy: 'admin@test.com',
    membersCount: 2,
    healthScore: 75,
    status: 'active',
    secretKey: secretKey,
    createdAt: SV(),
  });
  const teamId = teamRef.id;
  console.log(`  ✅ Workspace created: ${teamId}`);
  console.log(`  🔑 Secret key: ${secretKey}`);

  // Add team members
  await db.collection('teamMembers').doc(teamId + '_' + adminUid).set({
    teamId: teamId,
    userId: adminUid,
    role: 'team_lead',
    joinedAt: SV(),
  });
  console.log('  ✅ Admin added as team_lead');

  await db.collection('teamMembers').doc(teamId + '_' + userUid).set({
    teamId: teamId,
    userId: userUid,
    role: 'member',
    joinedAt: SV(),
  });
  console.log('  ✅ User added as member');

  // Add sample ideas
  const idea1 = await db.collection('ideas').add({
    teamId: teamId,
    title: 'AI Chat Integration',
    description: 'Sun\'iy intellekt yordamida chatni kengaytirish',
    entryType: 'idea',
    status: 'open',
    createdByUserId: adminUid,
    createdByName: 'Admin User',
    ownerUserId: userUid,
    ownerName: 'Test User',
    createdAt: SV(),
    updatedAt: SV(),
  });
  console.log(`  ✅ Sample idea created: ${idea1.id}`);

  // Add sample tasks
  const task1 = await db.collection('tasks').add({
    teamId: teamId,
    title: 'Landing page redesign',
    description: 'Yangi dizayn konsepsiyasi',
    status: 'open',
    priority: 'high',
    createdBy: adminUid,
    assignedTo: userUid,
    createdAt: SV(),
  });
  console.log(`  ✅ Sample task created: ${task1.id}`);

  // Add sample chat messages
  await db.collection('chatMessages').add({
    teamId: teamId,
    senderUserId: adminUid,
    senderName: 'Admin User',
    text: 'Xush kelibsiz! Bu test workspace.',
    seenBy: [adminUid],
    createdAt: SV(),
  });
  await db.collection('chatMessages').add({
    teamId: teamId,
    senderUserId: userUid,
    senderName: 'Test User',
    text: 'Rahmat! Ishni boshlaymiz.',
    seenBy: [userUid, adminUid],
    createdAt: SV(),
  });
  console.log('  ✅ Sample chat messages created');

  console.log('\n✅✅✅ Seed complete!');
  console.log('\n📋 Login credentials:');
  console.log('   Admin: admin@test.com / password123');
  console.log('   User:  user@test.com / password123');
  console.log(`   Workspace ID: ${teamId}`);
  console.log(`   Secret Key: ${secretKey}\n`);

  await admin.app().delete();
}

seed().catch(e => {
  console.error('\n❌ Seed error:', e);
  process.exit(1);
});
