/* ============================================================================
 * T-CRUD — Comprehensive CRUD Lifecycle Test (Emulator)
 * ----------------------------------------------------------------------------
 * To'liq lifecycle: team → member → idea → task → chat → archive → delete.
 * Har bir qadamda API javobi + Firestore hujjati tekshiriladi.
 *
 * Ishlatish: npm run test:crud
 *   (yoki: firebase emulators:exec --only auth,firestore "node scripts/test-crud.js")
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

/* ----------------------------- TOTP (2FA) -------------------------------- */
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(input) {
  const clean = String(input || '').toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = '';
  for (const ch of clean) { const idx = BASE32.indexOf(ch); if (idx === -1) continue; bits += idx.toString(2).padStart(5, '0'); }
  const bytes = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totpAt(secret, timeStep = 30, forTime = Date.now()) {
  const counter = Math.floor(forTime / 1000 / timeStep);
  const buf = Buffer.alloc(8); buf.writeBigInt64BE(BigInt(counter));
  const key = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, '0');
}

/* ------------------------------ Mock req/res ---------------------------- */
function makeRes() {
  const res = { _status: 200, _json: null, _body: null };
  res.setHeader = () => {};
  res.status = (s) => { res._status = s; return res; };
  res.json = (j) => { res._json = j; return res; };
  res.send = (s) => { res._body = s; return res; };
  res.end = () => {};
  return res;
}
function callApi(action, body, token, usePathname = false) {
  const url = usePathname ? `/api/${action}` : `/api/index?action=${action}`;
  const req = { url, method: 'POST', headers: { authorization: `Bearer ${token || ''}` }, body: JSON.stringify(body || {}), query: {} };
  const res = makeRes();
  return handler(req, res).then(() => res._json);
}

/* ----------------------- Auth emulator sign-in -------------------------- */
async function signIn(email, password) {
  const r = await fetch(
    'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) }
  );
  const data = await r.json();
  if (!data.idToken) throw new Error('signIn failed: ' + JSON.stringify(data));
  return data.idToken;
}

/* -------------------------------- Runner -------------------------------- */
async function main() {
  const results = [];
  const check = (name, cond, detail) => results.push({ name, ok: !!cond, detail });
  const PASS = 'CrudTest123!';
  const TS = Date.now();
  const adminUid = 'crud-admin-' + TS;
  const memberUid = 'crud-member-' + TS;

  console.log('══════════════════════════════════════════════');
  console.log('  T-CRUD — Comprehensive Lifecycle Test');
  console.log('══════════════════════════════════════════════\n');

  /* ---- Setup: Create admin + member users ---- */
  await admin.auth().createUser({ uid: adminUid, email: `crud-admin-${TS}@example.com`, password: PASS });
  await db.collection('users').doc(adminUid).set({ role: 'admin', email: `crud-admin-${TS}@example.com`, twoFactorEnabled: false, name: 'CRUD Admin' });
  await admin.auth().createUser({ uid: memberUid, email: `crud-member-${TS}@example.com`, password: PASS });
  await db.collection('users').doc(memberUid).set({ role: 'member', email: `crud-member-${TS}@example.com`, twoFactorEnabled: false, name: 'CRUD Member' });

  const adminToken = await signIn(`crud-admin-${TS}@example.com`, PASS);
  const memberToken = await signIn(`crud-member-${TS}@example.com`, PASS);

  console.log('─── 1. WORKSPACE (Team) CRUD ───\n');

  // 1a) CREATE workspace
  const ws = await callApi('create-workspace', { name: 'CRUD Team', description: 'CRUD lifecycle test' }, adminToken, true);
  check('C1: create-workspace → 201', ws && ws.status === 201, ws);
  const teamId = ws && ws.teamId;
  let secretKey;
  if (teamId) {
    const td = await db.collection('teams').doc(teamId).get();
    check('C2: teams doc exists', td.exists);
    check('C3: teams doc fields', td.exists && td.data().name === 'CRUD Team' && td.data().status === 'active' && td.data().membersCount === 1);
    secretKey = td.data().secretKey;
    check('C4: secretKey generated', !!secretKey && secretKey.length >= 16);
    const leadMem = await db.collection('teamMembers').doc(teamId + '_' + adminUid).get();
    check('C5: team_lead membership', leadMem.exists && leadMem.data().role === 'team_lead');
  }

  // 1b) READ workspace (verify via Firestore)
  if (teamId) {
    const td = await db.collection('teams').doc(teamId).get();
    check('C6: teams doc readable', td.exists && td.data().name === 'CRUD Team');
  }

  console.log('\n─── 2. MEMBER CRUD ───\n');

  // 2a) INVITE member
  let inviteId;
  if (teamId) {
    const inv = await callApi('invite-member', { teamId, email: `crud-member-${TS}@example.com` }, adminToken, true);
    check('C7: invite-member → 201', inv && inv.status === 201, inv);
    const iv = await db.collection('workspaceInvites').where('teamId', '==', teamId).where('inviteeEmail', '==', `crud-member-${TS}@example.com`).limit(1).get();
    check('C8: workspaceInvites doc', !iv.empty);
    if (!iv.empty) {
      inviteId = iv.docs[0].id;
      check('C9: invite status=pending', iv.docs[0].data().status === 'pending');
    }
  }

  // 2b) ACCEPT invite (member+secretKey)
  if (inviteId && teamId && secretKey) {
    const acc = await callApi('accept-invite', { inviteId, secretKey }, memberToken, true);
    check('C10: accept-invite → 200', acc && acc.status === 200, acc);
    const mm = await db.collection('teamMembers').doc(teamId + '_' + memberUid).get();
    check('C11: member membership exists', mm.exists);
    check('C12: member role=member', mm.exists && mm.data().role === 'member');
    const teamRef = await db.collection('teams').doc(teamId).get();
    check('C13: membersCount=2', teamRef.exists && teamRef.data().membersCount === 2);
  }

  // 2c) READ member list
  if (teamId) {
    const memSnap = await db.collection('teamMembers').where('teamId', '==', teamId).get();
    check('C14: 2 members total', memSnap.size === 2);
  }

  console.log('\n─── 3. IDEA CRUD ───\n');

  // 3a) CREATE idea (entry)
  let ideaId;
  if (teamId) {
    const idea = await callApi('create-entry', { teamId, title: 'CRUD Idea', description: 'Test idea for CRUD', type: 'idea' }, adminToken, true);
    check('C15: create-entry → 201', idea && idea.status === 201, idea);
    ideaId = idea && idea.ideaId;
    if (ideaId) {
      const idDoc = await db.collection('ideas').doc(ideaId).get();
      check('C16: ideas doc exists', idDoc.exists);
      check('C17: idea fields', idDoc.exists && idDoc.data().title === 'CRUD Idea' && idDoc.data().entryType === 'idea' && idDoc.data().status === 'open');
    }
  }

  // 3b) UPDATE idea owner (only team_lead)
  if (teamId && ideaId) {
    const upd = await callApi('update-entry-owner', { teamId, ideaId, ownerUserId: memberUid }, adminToken, true);
    check('C18: update-entry-owner → 200', upd && upd.status === 200, upd);
    const idDoc = await db.collection('ideas').doc(ideaId).get();
    check('C19: owner changed to member', idDoc.exists && idDoc.data().ownerUserId === memberUid);
  }

  // 3c) READ idea
  if (ideaId) {
    const idDoc = await db.collection('ideas').doc(ideaId).get();
    check('C20: idea readable', idDoc.exists && idDoc.data().title === 'CRUD Idea');
  }

  // 3d) Personal idea + Import
  let personalIdeaId;
  const pi = await callApi('create-personal-idea', { title: 'CRUD Personal Idea', description: 'Will be imported' }, memberToken, true);
  check('C21: create-personal-idea → 201', pi && pi.status === 201, pi);
  personalIdeaId = pi && pi.ideaId;
  if (personalIdeaId) {
    const piDoc = await db.collection('personalIdeas').doc(personalIdeaId).get();
    check('C22: personalIdeas doc exists', piDoc.exists && piDoc.data().title === 'CRUD Personal Idea');
  }
  if (personalIdeaId && teamId) {
    const imp = await callApi('import-personal-idea', { personalIdeaId, teamId }, memberToken, true);
    check('C23: import-personal-idea → 200', imp && imp.status === 200, imp);
    if (imp && imp.ideaId) {
      const iiDoc = await db.collection('ideas').doc(imp.ideaId).get();
      check('C24: imported idea in team', iiDoc.exists && iiDoc.data().title === 'CRUD Personal Idea');
      const piDoc = await db.collection('personalIdeas').doc(personalIdeaId).get();
      check('C25: personal idea marked imported', piDoc.exists && piDoc.data().imported === true);
    }
  }

  console.log('\n─── 4. TASK CRUD ───\n');

  // 4a) CREATE task
  let taskId;
  if (teamId) {
    const ct = await callApi('create-task', { teamId, title: 'CRUD Task', description: 'Test task', assignedTo: memberUid }, adminToken, true);
    check('C26: create-task → 201', ct && ct.status === 201, ct);
    taskId = ct && ct.taskId;
    if (taskId) {
      const tk = await db.collection('tasks').doc(taskId).get();
      check('C27: tasks doc exists', tk.exists);
      check('C28: task fields', tk.exists && tk.data().title === 'CRUD Task' && tk.data().status === 'todo' && tk.data().assignedTo === memberUid);
    }
  }

  // 4b) CLAIM task (member claims open task)
  if (taskId) {
    const claim = await callApi('task-action', { taskId, action: 'claim' }, memberToken, true);
    check('C29: task-claim → 200', claim && claim.status === 200, claim);
    const tk = await db.collection('tasks').doc(taskId).get();
    check('C30: task assigned to member', tk.exists && tk.data().assignedTo === memberUid);
  }

  // 4c) SUBMIT task result
  if (taskId) {
    const sub = await callApi('task-action', { taskId, action: 'submit', resultText: 'Done!', resultLink: 'https://example.com/result' }, memberToken, true);
    check('C31: task-submit → 200', sub && sub.status === 200, sub);
    const tk = await db.collection('tasks').doc(taskId).get();
    check('C32: task submitted', tk.exists && tk.data().status === 'submitted' && tk.data().submission.text === 'Done!');
  }

  // 4d) COMPLETE task (admin)
  if (taskId) {
    const comp = await callApi('task-action', { taskId, action: 'complete' }, adminToken, true);
    check('C33: task-complete → 200', comp && comp.status === 200, comp);
    const tk = await db.collection('tasks').doc(taskId).get();
    check('C34: task done', tk.exists && tk.data().status === 'done');
  }

  console.log('\n─── 5. CHAT CRUD ───\n');

  // 5a) SEND chat
  let messageId;
  if (teamId) {
    const sc = await callApi('send-chat', { teamId, text: 'CRUD test message' }, adminToken, true);
    check('C35: send-chat → 201', sc && sc.status === 201, sc);
    messageId = sc && sc.messageId;
    if (messageId) {
      const msg = await db.collection('chatMessages').doc(messageId).get();
      check('C36: chatMessages doc exists', msg.exists);
      check('C37: chat fields', msg.exists && msg.data().text === 'CRUD test message' && msg.data().senderUserId === adminUid);
    }
  }

  // 5b) READ chat messages
  if (teamId) {
    const msgs = await db.collection('chatMessages').where('teamId', '==', teamId).get();
    check('C38: chat messages count >= 1', msgs.size >= 1);
  }

  console.log('\n─── 6. WORKSPACE ARCHIVE / RESTORE ───\n');

  // 6a) ARCHIVE workspace
  if (teamId) {
    const arch = await callApi('archive-workspace', { teamId }, adminToken, true);
    check('C39: archive-workspace → 200', arch && arch.status === 200, arch);
    const td = await db.collection('teams').doc(teamId).get();
    check('C40: team status=archived', td.exists && td.data().status === 'archived');
  }

  // 6b) RESTORE workspace
  if (teamId) {
    const rest = await callApi('archive-workspace', { teamId, restore: true }, adminToken, true);
    check('C41: restore-workspace → 200', rest && rest.status === 200, rest);
    const td = await db.collection('teams').doc(teamId).get();
    check('C42: team status=active', td.exists && td.data().status === 'active');
  }

  console.log('\n─── 7. WORKSPACE HARD DELETE ───\n');

  // 7a) Enable 2FA for admin (needed for delete-workspace)
  let secret;
  const en = await callApi('enable-2fa', {}, adminToken);
  if (en && en.secret) {
    secret = en.secret;
    await callApi('verify-2fa', { code: totpAt(secret) }, adminToken);
  }

  // 7b) DELETE workspace (admin + 2FA)
  if (teamId && secret) {
    const del = await callApi('delete-workspace', { teamId, twoFactorCode: totpAt(secret) }, adminToken, true);
    check('C43: delete-workspace → 200', del && del.status === 200, del);

    // Verify cascade delete
    const td = await db.collection('teams').doc(teamId).get();
    check('C44: team deleted from Firestore', !td.exists);

    const memSnap = await db.collection('teamMembers').where('teamId', '==', teamId).get();
    check('C45: teamMembers cascade deleted', memSnap.empty);

    const taskSnap = await db.collection('tasks').where('teamId', '==', teamId).get();
    check('C46: tasks cascade deleted', taskSnap.empty);

    const chatSnap = await db.collection('chatMessages').where('teamId', '==', teamId).get();
    check('C47: chatMessages cascade deleted', chatSnap.empty);

    const ideaSnap = await db.collection('ideas').where('teamId', '==', teamId).get();
    check('C48: ideas cascade deleted', ideaSnap.empty);
  }

  /* ---- Report ---- */
  let pass = 0, fail = 0;
  console.log('\n══════════════════ CRUD TEST HISOBOT ══════════════════');
  for (const r of results) {
    console.log(`${r.ok ? '  ✅' : '  ❌'} ${r.name}`);
    if (!r.ok) { fail++; console.log('     ↳', JSON.stringify(r.detail).slice(0, 400)); } else pass++;
  }
  console.log(`\n  ${pass} passed, ${fail} failed, ${results.length} total`);
  console.log('══════════════════════════════════════════════════════\n');
  try { await admin.app().delete(); } catch (_) {}
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('\n❌ CRUD TEST XATOSI:', e); process.exit(2); });
