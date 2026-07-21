/* ============================================================================
 * MllyCore — Seed data for team lbFtpA6iZbe8TADoyskG
 * ----------------------------------------------------------------------------
 * Run this AFTER firebase emulators are started:
 *   node scripts/seed-team-lbFtpA6iZbe8TADoyskG.js
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

const TEAM_ID = 'lbFtpA6iZbe8TADoyskG';

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
  console.log('🌱 Seeding team lbFtpA6iZbe8TADoyskG...\n');

  // Get existing users
  let adminUid, userUid;
  try {
    const adminUser = await auth.getUserByEmail('admin@test.com');
    adminUid = adminUser.uid;
    console.log('  ✅ Found admin: admin@test.com');
  } catch (e) {
    console.log('  ❌ Admin user not found! Run seed-dev-data.js first.');
    process.exit(1);
  }

  try {
    const normalUser = await auth.getUserByEmail('user@test.com');
    userUid = normalUser.uid;
    console.log('  ✅ Found user: user@test.com');
  } catch (e) {
    console.log('  ❌ Normal user not found! Run seed-dev-data.js first.');
    process.exit(1);
  }

  // Check if team already exists
  const existingTeam = await db.collection('teams').doc(TEAM_ID).get();
  if (existingTeam.exists) {
    console.log('  ℹ️  Team already exists, deleting old data first...');
    // Delete existing data
    const members = await db.collection('teamMembers').where('teamId', '==', TEAM_ID).get();
    for (const doc of members.docs) await doc.ref.delete();
    const ideas = await db.collection('ideas').where('teamId', '==', TEAM_ID).get();
    for (const doc of ideas.docs) await doc.ref.delete();
    const tasks = await db.collection('tasks').where('teamId', '==', TEAM_ID).get();
    for (const doc of tasks.docs) await doc.ref.delete();
    const chats = await db.collection('chatMessages').where('teamId', '==', TEAM_ID).get();
    for (const doc of chats.docs) await doc.ref.delete();
    const invites = await db.collection('workspaceInvites').where('teamId', '==', TEAM_ID).get();
    for (const doc of invites.docs) await doc.ref.delete();
    const notifs = await db.collection('notifications').where('teamId', '==', TEAM_ID).get();
    for (const doc of notifs.docs) await doc.ref.delete();
    console.log('  ✅ Old data deleted');
  }

  // Create the team with the specific ID
  const secretKey = generateSecretKey();
  await db.collection('teams').doc(TEAM_ID).set({
    name: 'MllyCore Development',
    description: 'Asosiy development workspace — startup va g\'oyalar markazi',
    createdByUserId: adminUid,
    createdBy: 'admin@test.com',
    membersCount: 2,
    healthScore: 85,
    status: 'active',
    secretKey: secretKey,
    createdAt: SV(),
    updatedAt: SV(),
  });
  console.log(`  ✅ Team created: ${TEAM_ID}`);
  console.log(`  🔑 Secret key: ${secretKey}`);

  // Add team members
  await db.collection('teamMembers').doc(TEAM_ID + '_' + adminUid).set({
    teamId: TEAM_ID,
    userId: adminUid,
    role: 'team_lead',
    joinedAt: SV(),
  });
  console.log('  ✅ Admin added as team_lead');

  await db.collection('teamMembers').doc(TEAM_ID + '_' + userUid).set({
    teamId: TEAM_ID,
    userId: userUid,
    role: 'member',
    joinedAt: SV(),
  });
  console.log('  ✅ User added as member');

  // Add sample ideas/startups
  const idea1 = await db.collection('ideas').add({
    teamId: TEAM_ID,
    title: 'AI-powered Code Review',
    description: 'Sun\'iy intellekt yordamida avtomatik kod review tizimi. Pull request\'larni tekshirib, xatolarni topib beradi va takliflar beradi.',
    entryType: 'startup',
    status: 'active',
    createdByUserId: adminUid,
    createdByName: 'Admin User',
    ownerUserId: userUid,
    ownerName: 'Test User',
    createdAt: SV(),
    updatedAt: SV(),
  });
  console.log(`  ✅ Startup created: ${idea1.id}`);

  const idea2 = await db.collection('ideas').add({
    teamId: TEAM_ID,
    title: 'Real-time Analytics Dashboard',
    description: 'Foydalanuvchi faoliyatini real-time kuzatish paneli. Graf ikonlar, statistika va trend tahlili.',
    entryType: 'idea',
    status: 'open',
    createdByUserId: userUid,
    createdByName: 'Test User',
    ownerUserId: userUid,
    ownerName: 'Test User',
    createdAt: SV(),
    updatedAt: SV(),
  });
  console.log(`  ✅ Idea created: ${idea2.id}`);

  // Add sample tasks
  const task1 = await db.collection('tasks').add({
    teamId: TEAM_ID,
    title: 'Backend API documentation',
    description: 'Barcha REST API endpointlar uchun Swagger dokumentatsiya yozish',
    status: 'in_progress',
    priority: 'high',
    createdBy: adminUid,
    assignedTo: userUid,
    createdAt: SV(),
    updatedAt: SV(),
  });
  console.log(`  ✅ Task created: ${task1.id}`);

  const task2 = await db.collection('tasks').add({
    teamId: TEAM_ID,
    title: 'Mobile responsive design',
    description: 'Barcha sahifalarni mobil qurilmalar uchun moslashtirish',
    status: 'open',
    priority: 'medium',
    createdBy: adminUid,
    assignedTo: adminUid,
    createdAt: SV(),
    updatedAt: SV(),
  });
  console.log(`  ✅ Task created: ${task2.id}`);

  const task3 = await db.collection('tasks').add({
    teamId: TEAM_ID,
    title: 'Unit tests qo\'shish',
    description: 'CRUD operatsiyalari uchun test yozish',
    status: 'done',
    priority: 'medium',
    createdBy: adminUid,
    assignedTo: userUid,
    createdAt: SV(),
    updatedAt: SV(),
  });
  console.log(`  ✅ Task created: ${task3.id}`);

  // Add sample chat messages
  await db.collection('chatMessages').add({
    teamId: TEAM_ID,
    senderUserId: adminUid,
    senderName: 'Admin User',
    text: 'Xush kelibsiz! Bu MllyCore development workspace.',
    seenBy: [adminUid],
    createdAt: SV(),
  });

  await db.collection('chatMessages').add({
    teamId: TEAM_ID,
    senderUserId: userUid,
    senderName: 'Test User',
    text: 'Rahmat! Bugun AI Code Review ustida ishlaymizmi?',
    seenBy: [userUid, adminUid],
    createdAt: SV(),
  });

  await db.collection('chatMessages').add({
    teamId: TEAM_ID,
    senderUserId: adminUid,
    senderName: 'Admin User',
    text: 'Ha, avval backend API dokumentatsiyasini tugatib keyin AI review ga o\'tamiz.',
    seenBy: [adminUid, userUid],
    createdAt: SV(),
  });
  console.log('  ✅ Chat messages created');

  console.log('\n✅✅✅ Seed complete for team lbFtpA6iZbe8TADoyskG!');
  console.log('\n📋 Access:');
  console.log('   Admin: admin@test.com / password123');
  console.log('   User:  user@test.com / password123');
  console.log(`   Team:  http://localhost:3000/team.html?id=${TEAM_ID}`);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
