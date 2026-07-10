/* ============================================================================
 * T38 — Emulator-based Smoke Test Suite
 * ----------------------------------------------------------------------------
 * Maqsad: T1–T37 endpoint'larning haqiqatan ham ishlashini tasdiqlash.
 * `node --check` faqat SINTAKSISni tekshiradi; bu skript esa Firebase
 * Emulator'ga REAL so'rov yuborib, Firestore'dagi REAL yozuvni tekshiradi.
 *
 * Ishlatish (emulator ichida ishga tushiradi, keyin to'xtatadi):
 *   npm run test:smoke
 * yoki:
 *   firebase emulators:start --only auth,firestore   (aloqador terminalda)
 *   node scripts/smoke-test.js
 *
 * Firebase Admin SDK emulator'da real credentials talab qilmaydi, lekin
 * api/index.js ichidagi `initAdmin()` private_key/client_email/project_id
 * mavjudligini tekshiradi — shuning uchun quyida soxta (fake) SA berilgan.
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
// api/index.js -> module.exports = async (req,res)  (+ .initAdmin, .runWeeklyDigest)
const handler = require('../api/index.js');

/* ----------------------------- TOTP (2FA test) ---------------------------- */
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(input) {
  const clean = String(input || '').toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = '';
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totpAt(secret, timeStep = 30, forTime = Date.now()) {
  const counter = Math.floor(forTime / 1000 / timeStep);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const key = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, '0');
}

/* ------------------------------ mock req/res ------------------------------ */
function makeRes() {
  const res = { _status: 200, _json: null, _body: null };
  res.setHeader = () => {};
  res.status = (s) => { res._status = s; return res; };
  res.json = (j) => { res._json = j; return res; };
  res.send = (s) => { res._body = s; return res; };
  res.end = () => {};
  return res;
}
// usePathname=true  -> url '/api/<action>'   (create-workspace, invite-member,
//                  delete-workspace, accept-invite, archive-workspace, ...)
// usePathname=false -> url '/api/index?action=<action>'  (my-overview, enable-2fa, ...)
async function callApi(action, body, token, usePathname = false) {
  const url = usePathname ? `/api/${action}` : `/api/index?action=${action}`;
  const req = {
    url,
    method: 'POST',
    headers: { authorization: `Bearer ${token || ''}` },
    body: JSON.stringify(body || {}),
    query: {},
  };
  const res = makeRes();
  await handler(req, res);
  return res._json;
}

/* ----------------------- Auth emulator sign-in (REST) --------------------- */
async function signIn(email, password) {
  const r = await fetch(
    'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await r.json();
  if (!data.idToken) throw new Error('signIn failed: ' + JSON.stringify(data));
  return data.idToken;
}

/* --------------------------------- runner -------------------------------- */
async function main() {
  const results = [];
  const check = (name, cond, detail) => results.push({ name, ok: !!cond, detail });
  const PASS = 'Password123!';

  const adminUid = 'smoke-admin-' + Date.now();
  const memberUid = 'smoke-member-' + Date.now();

  await admin.auth().createUser({ uid: adminUid, email: 'smoke-admin@example.com', password: PASS });
  await db.collection('users').doc(adminUid).set({
    role: 'admin', email: 'smoke-admin@example.com', twoFactorEnabled: false, name: 'Smoke Admin',
  });
  await admin.auth().createUser({ uid: memberUid, email: 'smoke-member@example.com', password: PASS });
  await db.collection('users').doc(memberUid).set({
    role: 'member', email: 'smoke-member@example.com', twoFactorEnabled: false, name: 'Smoke Member',
  });

  const adminToken = await signIn('smoke-admin@example.com', PASS);
  const memberToken = await signIn('smoke-member@example.com', PASS);

  // 1) create-workspace (pathname-based router)
  const ws = await callApi('create-workspace', { name: 'Smoke Team' }, adminToken, true);
  check('create-workspace → 201', ws && ws.status === 201, ws);
  const teamId = ws && ws.teamId;
  if (teamId) {
    const td = await db.collection('teams').doc(teamId).get();
    check('teams doc Firestore’da yaratildi', td.exists);
    const md = await db.collection('teamMembers').doc(teamId + '_' + adminUid).get();
    check('team_lead membership yaratildi', md.exists && md.data().role === 'team_lead');
  }

  // 2) invite-member
  let inviteId;
  if (teamId) {
    const inv = await callApi('invite-member', { teamId, email: 'smoke-member@example.com' }, adminToken, true);
    check('invite-member → 201', inv && inv.status === 201, inv);
    const iv = await db.collection('workspaceInvites')
      .where('teamId', '==', teamId).where('inviteeEmail', '==', 'smoke-member@example.com').limit(1).get();
    check('workspaceInvites doc yaratildi', !iv.empty);
    if (!iv.empty) inviteId = iv.docs[0].id;
  }

  // 3) accept-invite (member token + secretKey)
  if (inviteId && teamId) {
    const tk = await db.collection('teams').doc(teamId).get();
    const acc = await callApi('accept-invite', { inviteId, secretKey: tk.data().secretKey }, memberToken, true);
    check('accept-invite → 200', acc && acc.status === 200, acc);
    const mm = await db.collection('teamMembers').doc(teamId + '_' + memberUid).get();
    check('member membership yaratildi', mm.exists);
  }

  // 4) enable-2fa + verify-2fa
  const en = await callApi('enable-2fa', {}, adminToken);
  check('enable-2fa → secret qaytardi', en && en.status === 200 && !!en.secret, en);
  let secret;
  if (en && en.secret) {
    secret = en.secret;
    const vf = await callApi('verify-2fa', { code: totpAt(secret) }, adminToken);
    check('verify-2fa → enabled=true', vf && vf.status === 200 && vf.enabled === true, vf);
    const ud = await db.collection('users').doc(adminUid).get();
    check('users.twoFactorEnabled=true Firestore’da', ud.data().twoFactorEnabled === true);
  }

  // 5) create-task
  if (teamId) {
    const ct = await callApi('create-task', { teamId, title: 'Smoke task' }, adminToken);
    check('create-task → 201', ct && ct.status === 201, ct);
    if (ct && ct.taskId) {
      const tk = await db.collection('tasks').doc(ct.taskId).get();
      check('task doc Firestore’da', tk.exists);
    }
  }

  // 6) send-chat
  if (teamId) {
    const sc = await callApi('send-chat', { teamId, message: 'salom' }, adminToken);
    check('send-chat → 201', sc && sc.status === 201, sc);
  }

  // 7) my-overview
  const ov = await callApi('my-overview', {}, adminToken);
  check('my-overview → teams qaytardi', ov && (ov.teams || ov.workspaces), ov);

  // 8) delete-workspace (admin + 2FA re-auth) — R3
  if (teamId && secret) {
    const del = await callApi('delete-workspace', { teamId, twoFactorCode: totpAt(secret) }, adminToken, true);
    check('delete-workspace → 200', del && del.status === 200, del);
    const td = await db.collection('teams').doc(teamId).get();
    check('team Firestore’dan o‘chirildi', !td.exists);
  }

  // ---- report ----
  let pass = 0, fail = 0;
  console.log('\n================ SMOKE TEST NATIJALARI ================');
  for (const r of results) {
    console.log(`${r.ok ? 'PASS ' : 'FAIL '} ${r.name}`);
    if (!r.ok) { fail++; console.log('      ↳', JSON.stringify(r.detail).slice(0, 400)); } else pass++;
  }
  console.log(`\n${pass} passed, ${fail} failed, ${results.length} total`);
  try { await admin.app().delete(); } catch (_) {}
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('\nSMOKE TEST ERROR:', e); process.exit(2); });
