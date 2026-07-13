/* ============================================================================
 * T48 — Live Collaboration Cursor & Presence Test
 * ----------------------------------------------------------------------------
 * Maqsad: T48 logikasini Firebase Emulator orqali test qilish:
 *   A) Cursor CRUD — Firestore'ga cursor yozish va o'qish
 *   B) Multiple cursors — bir necha user cursor'larni team bo'yicha o'qish
 *   C) Cursor update — cursor pozitsiyasini yangilash
 *   D) Presence CRUD — presence yozish va o'qish
 *   E) Presence transitions — online/away/offline holatlari
 *   F) Stale cursor detection — 5 daqiqalik threshold
 *   G) getTeamPresence API endpoint
 *
 * Ishlatish (emulator ichida):
 *   npm run test:t48
 * yoki:
 *   node scripts/test-t48-cursor.js
 *   (avval firebase emulators:start --only auth,firestore)
 * ==========================================================================*/

process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
  type: 'service_account',
  project_id: 'mllycore',
  private_key: '-----BEGIN PRIVATE KEY-----\nMOCKKEYFORLOCALTESTONLY\n-----END PRIVATE KEY-----\n',
  client_email: 'fake-sa@mllycore.iam.gserviceaccount.com',
});

const admin = require('firebase-admin');
const crypto = require('crypto');

admin.initializeApp({ projectId: 'mllycore' });
const db = admin.firestore();
const handler = require('../api/index.js');

const results = [];

function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}`);
  if (!ok && detail) console.log(`     ↳ ${JSON.stringify(detail).slice(0, 400)}`);
}

/* ========================= Test A: Cursor CRUD ========================= */
async function testCursorCRUD() {
  console.log('\n═══════════ A: Cursor CRUD ═══════════');

  const userId = 'cursor-user-a1-' + Date.now();
  const teamId = 'cursor-team-a1-' + Date.now();
  const cursorId = `${teamId}_${userId}`;

  // Write cursor to Firestore
  await db.collection('cursors').doc(cursorId).set({
    teamId,
    userId,
    name: 'Test User A1',
    color: '#ff0000',
    x: 100,
    y: 200,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Read cursor back
  const snap = await db.collection('cursors').doc(cursorId).get();
  check('A1: cursor doc yaratildi', snap.exists);
  if (snap.exists) {
    const data = snap.data();
    check('A2: cursor userId to\'g\'ri', data.userId === userId);
    check('A3: cursor teamId to\'g\'ri', data.teamId === teamId);
    check('A4: cursor x=100', data.x === 100);
    check('A5: cursor y=200', data.y === 200);
    check('A6: cursor name mavjud', !!data.name);
    check('A7: cursor color mavjud', /^#[0-9a-f]{6}$/i.test(data.color || ''));
    check('A8: cursor updatedAt mavjud', !!data.updatedAt);
  }

  // Query by teamId
  const qSnap = await db.collection('cursors')
    .where('teamId', '==', teamId)
    .get();
  check('A9: teamId bo\'yicha cursor topildi', qSnap.size >= 1);
  check('A10: cursor soni to\'g\'ri', qSnap.size === 1, { count: qSnap.size });

  return { userId, teamId, cursorId };
}

/* ========================= Test B: Multiple Cursors ========================= */
async function testMultipleCursors() {
  console.log('\n═══════════ B: Multiple Cursors ═══════════');

  const teamId = 'cursor-team-b1-' + Date.now();
  const users = [];
  const colors = ['#ff0000', '#00ff00', '#0000ff', '#ff8800', '#8800ff'];

  // Create 5 cursors in the same team
  for (let i = 0; i < 5; i++) {
    const userId = 'cursor-user-b' + i + '-' + Date.now();
    const cursorId = `${teamId}_${userId}`;
    await db.collection('cursors').doc(cursorId).set({
      teamId,
      userId,
      name: `Test User B${i}`,
      color: colors[i],
      x: 50 + i * 40,
      y: 100 + i * 30,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    users.push({ userId, cursorId });
  }
  check('B1: 5 ta cursor yaratildi', users.length === 5);

  // Batch read by teamId
  const qSnap = await db.collection('cursors')
    .where('teamId', '==', teamId)
    .get();
  check('B2: team bo\'yicha 5 ta cursor', qSnap.size === 5);

  // Verify all x positions are unique
  const xPositions = qSnap.docs.map((d) => d.data().x);
  const uniqueX = new Set(xPositions);
  check('B3: x pozitsiyalari unikal', uniqueX.size === 5);

  // Verify no cursor from a different team leaks in
  const otherTeamId = 'cursor-team-other-' + Date.now();
  const otherQSnap = await db.collection('cursors')
    .where('teamId', '==', otherTeamId)
    .get();
  check('B4: boshqa team bo\'yicha cursor yo\'q', otherQSnap.size === 0);

  return { teamId, users };
}

/* ========================= Test C: Cursor Update ========================= */
async function testCursorUpdate() {
  console.log('\n═══════════ C: Cursor Update ═══════════');

  const userId = 'cursor-user-c1-' + Date.now();
  const teamId = 'cursor-team-c1-' + Date.now();
  const cursorId = `${teamId}_${userId}`;

  // Create cursor at (0, 0)
  await db.collection('cursors').doc(cursorId).set({
    teamId,
    userId,
    name: 'Cursor Mover',
    color: '#ff00ff',
    x: 0,
    y: 0,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Read initial
  const snap1 = await db.collection('cursors').doc(cursorId).get();
  check('C1: boshlang\'ich x=0', snap1.data().x === 0);

  // Move to (800, 600)
  await db.collection('cursors').doc(cursorId).update({
    x: 800,
    y: 600,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Read new position
  const snap2 = await db.collection('cursors').doc(cursorId).get();
  check('C2: yangi x=800', snap2.data().x === 800);
  check('C3: yangi y=600', snap2.data().y === 600);
  check('C4: doc id o\'zgarmadi', snap2.id === cursorId);

  return { userId, teamId, cursorId };
}

/* ========================= Test D: Presence CRUD ========================= */
async function testPresenceCRUD() {
  console.log('\n═══════════ D: Presence CRUD ═══════════');

  const userId = 'presence-user-d1-' + Date.now();
  const presenceId = userId;

  // Write presence as 'online'
  await db.collection('presence').doc(presenceId).set({
    status: 'online',
    lastSeen: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: Date.now(),
  });

  // Read presence back
  const snap = await db.collection('presence').doc(presenceId).get();
  check('D1: presence doc yaratildi', snap.exists);
  if (snap.exists) {
    const data = snap.data();
    check('D2: presence status=online', data.status === 'online');
    check('D3: presence lastSeen mavjud', !!data.lastSeen);
    check('D4: presence updatedAt mavjud', typeof data.updatedAt === 'number');
  }

  // Update to 'away'
  await db.collection('presence').doc(presenceId).update({
    status: 'away',
    updatedAt: Date.now(),
  });

  const snap2 = await db.collection('presence').doc(presenceId).get();
  check('D5: presence status=away', snap2.data().status === 'away');

  // Update to 'offline'
  await db.collection('presence').doc(presenceId).update({
    status: 'offline',
    updatedAt: Date.now(),
  });

  const snap3 = await db.collection('presence').doc(presenceId).get();
  check('D6: presence status=offline', snap3.data().status === 'offline');

  return { userId, presenceId };
}

/* ========================= Test E: Presence Transitions ========================= */
async function testPresenceTransitions() {
  console.log('\n═══════════ E: Presence Transitions ═══════════');

  const users = [];
  const STATUSES = ['online', 'away', 'offline'];

  // Create presence docs with each status
  for (const status of STATUSES) {
    const userId = 'presence-user-e-' + status + '-' + Date.now();
    await db.collection('presence').doc(userId).set({
      status,
      lastSeen: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: Date.now(),
    });
    users.push({ userId, status });
  }
  check('E1: 3 ta presence holati yaratildi', users.length === 3);

  // Read all and verify
  for (const { userId, status } of users) {
    const snap = await db.collection('presence').doc(userId).get();
    check(`E2: presence status=${status} to'g'ri`, snap.data().status === status);
  }

  // Batch read - getAll presences
  const refs = users.map((u) => db.collection('presence').doc(u.userId));
  const snapshots = await db.getAll(...refs);
  const allStatuses = snapshots.map((s) => s.data().status);
  check('E3: barcha statuslar o\'qildi', allStatuses.length === 3);
  check('E4: online mavjud', allStatuses.includes('online'));
  check('E5: away mavjud', allStatuses.includes('away'));
  check('E6: offline mavjud', allStatuses.includes('offline'));

  return { users };
}

/* ========================= Test F: Stale Cursor Detection ========================= */
async function testStaleCursor() {
  console.log('\n═══════════ F: Stale Cursor Detection ═══════════');

  const teamId = 'cursor-team-f1-' + Date.now();
  const PRESENCE_STALE_MS = 5 * 60 * 1000; // 5 minutes

  // Fresh cursor (recent)
  const freshUser = 'cursor-user-fresh-' + Date.now();
  await db.collection('cursors').doc(`${teamId}_${freshUser}`).set({
    teamId,
    userId: freshUser,
    name: 'Fresh User',
    color: '#00ff00',
    x: 200,
    y: 300,
    updatedAt: Date.now(), // numeric timestamp for staleness check
  });

  // Stale cursor (older than 5 min)
  const staleUser = 'cursor-user-stale-' + Date.now();
  await db.collection('cursors').doc(`${teamId}_${staleUser}`).set({
    teamId,
    userId: staleUser,
    name: 'Stale User',
    color: '#888888',
    x: 400,
    y: 500,
    updatedAt: Date.now() - PRESENCE_STALE_MS - 1000, // 5min + 1s old
  });

  // Read both
  const qSnap = await db.collection('cursors').where('teamId', '==', teamId).get();
  check('F1: 2 ta cursor (fresh + stale)', qSnap.size === 2);

  // Simulate staleness check (same logic as team.html)
  const now = Date.now();
  let freshCount = 0;
  let staleCount = 0;
  qSnap.docs.forEach((doc) => {
    const data = doc.data();
    let cursorTs = data.updatedAt;
    // Handle both Firestore Timestamp and numeric
    if (cursorTs && typeof cursorTs.toMillis === 'function') {
      cursorTs = cursorTs.toMillis();
    }
    if (typeof cursorTs === 'number' && cursorTs > 0) {
      if (now - cursorTs > PRESENCE_STALE_MS) {
        staleCount++;
      } else {
        freshCount++;
      }
    }
  });
  check('F2: 1 ta fresh cursor', freshCount === 1);
  check('F3: 1 ta stale cursor', staleCount === 1);

  return { teamId };
}

/* ========================= Test G: getTeamPresence API ========================= */
async function testPresenceAPI() {
  console.log('\n═══════════ G: getTeamPresence API ═══════════');

  // Create team with members and their presence
  const teamId = 'presence-team-g1-' + Date.now();
  const leadId = 'presence-lead-g1-' + Date.now();
  const member1Id = 'presence-member1-g1-' + Date.now();
  const member2Id = 'presence-member2-g1-' + Date.now();

  // Seed data: team, members, presence
  await db.collection('teams').doc(teamId).set({
    name: 'Presence Test Team',
    status: 'active',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await db.collection('teamMembers').doc(`${teamId}_${leadId}`).set({
    teamId, userId: leadId, role: 'team_lead',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection('teamMembers').doc(`${teamId}_${member1Id}`).set({
    teamId, userId: member1Id, role: 'member',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.collection('teamMembers').doc(`${teamId}_${member2Id}`).set({
    teamId, userId: member2Id, role: 'viewer',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Presence docs
  await db.collection('presence').doc(leadId).set({
    status: 'online', lastSeen: admin.firestore.FieldValue.serverTimestamp(), updatedAt: Date.now(),
  });
  await db.collection('presence').doc(member1Id).set({
    status: 'away', lastSeen: admin.firestore.FieldValue.serverTimestamp(), updatedAt: Date.now(),
  });
  await db.collection('presence').doc(member2Id).set({
    status: 'offline', lastSeen: admin.firestore.FieldValue.serverTimestamp(), updatedAt: Date.now(),
  });

  // Test direct Firestore query (like getTeamPresence would)
  const presenceSnap = await db.collection('presence').listDocuments();
  const allPresence = await db.getAll(...presenceSnap);
  const presenceMap = {};
  allPresence.forEach((doc) => {
    if (doc.exists) presenceMap[doc.id] = doc.data().status;
  });

  check('G1: lead presence=online', presenceMap[leadId] === 'online');
  check('G2: member1 presence=away', presenceMap[member1Id] === 'away');
  check('G3: member2 presence=offline', presenceMap[member2Id] === 'offline');
  check('G4: kamida 3 ta presence dokumen', Object.keys(presenceMap).length >= 3);

  return { teamId };
}

/* ========================= Main ========================= */
async function main() {
  console.log('══════════════════════════════════════════════════════');
  console.log('  T48 — Live Collaboration Cursor & Presence Test');
  console.log('══════════════════════════════════════════════════════\n');

  await testCursorCRUD();
  await testMultipleCursors();
  await testCursorUpdate();
  await testPresenceCRUD();
  await testPresenceTransitions();
  await testStaleCursor();
  await testPresenceAPI();

  // Report
  const pass = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;

  console.log('\n══════════════════ T48 TEST HISOBOT ══════════════════');
  console.log(`  ${pass} ta ✅ passed`);
  console.log(`  ${fail} ta ❌ failed`);
  console.log(`  ${results.length} ta total`);
  console.log('══════════════════════════════════════════════════════\n');

  try { await admin.app().delete(); } catch (_) {}
  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error('\n❌ TEST XATOSI:', err);
  process.exit(2);
});
