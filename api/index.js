const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* ------------------------------------------------------------------ *
 * Firebase Admin initialization (with key normalization + diagnostics) *
 * ------------------------------------------------------------------ */
function initAdmin() {
  if (admin.apps.length) return admin.app();

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const localPath = path.join(process.cwd(), 'serviceAccountKey.json');
  let serviceAccount;

  if (raw) {
    try {
      const trimmed = raw.trim();
      const parsed = trimmed.startsWith('{')
        ? JSON.parse(trimmed)
        : JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));

      if (parsed.private_key) {
        let key = parsed.private_key.trim();
        if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);
        key = key.replace(/\\n/g, '\n');
        parsed.private_key = key;
      }
      serviceAccount = parsed;
    } catch (e) {
      throw new Error('Firebase Config Parse Error: ' + e.message);
    }
  } else if (fs.existsSync(localPath)) {
    serviceAccount = require(localPath);
  } else {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON topilmadi.');
  }

  if (!serviceAccount.private_key || !serviceAccount.client_email || !serviceAccount.project_id) {
    throw new Error('Firebase Config: Zaruriy maydonlar yetishmayapti.');
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
    projectId: serviceAccount.project_id,
  });
}

const SV = () => admin.firestore.FieldValue.serverTimestamp();
const TS = () => admin.firestore.Timestamp.now();
const arrayUnion = (v) => admin.firestore.FieldValue.arrayUnion(v);
const FieldPath = () => admin.firestore.FieldPath;

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

/* ----------------- T3 Admin 2FA (HMAC-SHA1 TOTP) ----------------- */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input) {
  const clean = String(input || '').toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = '';
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
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

function verifyTOTP(secret, code, windowSize = 1) {
  if (!secret || !code) return false;
  const cleanCode = String(code).trim();
  for (let w = -windowSize; w <= windowSize; w += 1) {
    if (totpAt(secret, 30, Date.now() + w * 30 * 1000) === cleanCode) return true;
  }
  return false;
}

function generateTotpSecret() {
  const bytes = crypto.randomBytes(20);
  let out = '';
  for (const b of bytes) out += BASE32_ALPHABET[b & 0x1f];
  return out;
}

/* ------------------------- Auth / helpers ------------------------- */
async function verifyAuth(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) throw new Error('Token topilmadi.');
  return admin.auth().verifyIdToken(token);
}

async function getUserData(db, uid) {
  const d = await db.collection('users').doc(uid).get();
  if (!d.exists) throw new Error('User topilmadi.');
  return { id: d.id, ...d.data() };
}

// teamMembers documents use the ID "<teamId>_<uid>"
async function getMembership(db, teamId, uid) {
  if (!teamId || !uid) return null;
  const d = await db.collection('teamMembers').doc(teamId + '_' + uid).get();
  return d.exists ? { id: d.id, ...d.data() } : null;
}

function requireRole(user, ...roles) {
  if (!roles.includes(user.role)) throw new Error('Ruxsat yoq.');
}

async function audit(db, action, data) {
  try {
    await db.collection('auditLogs').add({ action, ...data, timestamp: TS() });
  } catch (_) { /* non-fatal */ }
}

function tryParse(body) {
  if (!body) return {};
  if (typeof body === 'object') return body;
  try { return JSON.parse(body); } catch (_) { return {}; }
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* --------------------------- Handlers ----------------------------- */

async function handleCreateWorkspace(req, res, db, decoded, user) {
  const { name, description, leadEmail } = req.body || {};
  if (!name || !name.trim()) return { status: 400, error: "Workspace nomini kiriting." };

  let leadUid = decoded.uid;
  if (leadEmail && leadEmail.trim() && leadEmail.trim().toLowerCase() !== (user.email || '').toLowerCase()) {
    const snap = await db.collection('users').where('email', '==', leadEmail.trim().toLowerCase()).limit(1).get();
    if (!snap.empty) leadUid = snap.docs[0].id;
  }

  const { templateId } = req.body || {};
  const teamRef = await db.collection('teams').add({
    name: name.trim(),
    description: description || '',
    createdByUserId: decoded.uid,
    createdBy: user.email || decoded.email,
    membersCount: 1,
    healthScore: 50,
    status: 'active',
    templateId: templateId || null,
    createdAt: SV(),
  });

  // T13 - shablon bo'yicha oldindan tayyor vazifalarni urug'lash (seeding)
  if (templateId) {
    try {
      const tpl = await db.collection('templates').doc(templateId).get();
      if (tpl.exists) {
        const seed = tpl.data().seedTasks || [];
        const batch = db.batch();
        seed.slice(0, 50).forEach((st) => {
          const r = db.collection('tasks').doc();
          batch.set(r, {
            teamId: teamRef.id,
            title: st.title || 'Vazifa',
            description: st.description || '',
            status: 'todo',
            priority: st.priority || 'medium',
            createdBy: decoded.uid,
            assignedTo: null,
            dueDate: null,
            createdAt: SV(),
          });
        });
        await batch.commit();
      }
    } catch (_) { /* non-fatal */ }
  }

  await db.collection('teamMembers').doc(teamRef.id + '_' + leadUid).set({
    teamId: teamRef.id,
    userId: leadUid,
    role: 'team_lead',
    joinedAt: SV(),
  });

  await audit(db, 'workspace_created', { teamId: teamRef.id, byUserId: decoded.uid, leadUserId: leadUid });
  return { status: 201, success: true, teamId: teamRef.id, message: 'Team yaratildi.' };
}

// T2 - Taklifda rol belgilash (member yoki viewer). Viewer faqat o'qiydi.
async function handleInviteMember(req, res, db, decoded, user) {
  const { teamId, email } = req.body || {};
  if (!teamId || !email) return { status: 400, error: 'teamId va email kerak.' };

  const membership = await getMembership(db, teamId, decoded.uid);
  if (user.role !== 'admin' && !(membership && membership.role === 'team_lead')) {
    return { status: 403, error: 'Ruxsat yoq.' };
  }

  const cleanEmail = email.trim().toLowerCase();
  const userSnap = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
  if (userSnap.empty) return { status: 404, error: 'Foydalanuvchi topilmadi.' };

  const role = (req.body && req.body.role === 'viewer') ? 'viewer' : 'member';
  const target = userSnap.docs[0];
  const secretKey = generateSecretKey();
  await db.collection('workspaceInvites').add({
    teamId,
    inviteeUserId: target.id,
    inviteeEmail: cleanEmail,
    inviterUserId: decoded.uid,
    role,
    secretKey,
    status: 'pending',
    createdAt: SV(),
  });

  await audit(db, 'member_invited', { teamId, inviteeUserId: target.id, role });
  return { status: 201, success: true, message: 'Taklif yuborildi.', secretKey };
}

// T2 - Faqat o'qish huquqiga ega a'zo yozish amallarini bajara olmaydi.
function isReadOnlyMember(membership) {
  return !!(membership && membership.role === 'viewer');
}

async function handleAcceptInvite(req, res, db, decoded) {
  const { inviteId, secretKey } = req.body || {};
  if (!inviteId || !secretKey) return { status: 400, error: 'inviteId va secretKey kerak.' };

  const invRef = db.collection('workspaceInvites').doc(inviteId);
  const inv = await invRef.get();
  if (!inv.exists) return { status: 404, error: 'Taklif topilmadi.' };

  const data = inv.data();
  if ((data.secretKey || '').toUpperCase() !== String(secretKey).trim().toUpperCase()) {
    return { status: 403, error: "Secret key noto'g'ri." };
  }
  if (data.inviteeUserId && data.inviteeUserId !== decoded.uid) {
    return { status: 403, error: 'Bu taklif sizga emas.' };
  }

  const existing = await getMembership(db, data.teamId, decoded.uid);
  if (existing) {
    await invRef.update({ status: 'accepted', acceptedAt: SV() });
    return { status: 200, success: true, message: "Allaqachon a'zosiz." };
  }

  await db.collection('teamMembers').doc(data.teamId + '_' + decoded.uid).set({
    teamId: data.teamId,
    userId: decoded.uid,
    role: data.role === 'viewer' ? 'viewer' : 'member',
    joinedAt: SV(),
  });

  const teamRef = db.collection('teams').doc(data.teamId);
  const teamSnap = await teamRef.get();
  if (teamSnap.exists) {
    await teamRef.update({ membersCount: (teamSnap.data().membersCount || 0) + 1 });
  }

  await invRef.update({ status: 'accepted', acceptedAt: SV() });
  await audit(db, 'invite_accepted', { teamId: data.teamId, userId: decoded.uid });
  return { status: 200, success: true, message: 'Taklif qabul qilindi.' };
}

async function handleCreateTask(req, res, db, decoded, user) {
  const { teamId, title, description, assignedTo, priority, dueDate } = req.body || {};
  if (!teamId || !title) return { status: 400, error: 'teamId va title kerak.' };

  const membership = await getMembership(db, teamId, decoded.uid);
  if (user.role !== 'admin' && !(membership && ['team_lead', 'member'].includes(membership.role))) {
    return { status: 403, error: 'Ruxsat yoq.' };
  }
  if (isReadOnlyMember(membership)) return { status: 403, error: "Viewer faqat o'qishi mumkin." };

  const dependsOn = Array.isArray(req.body.dependsOn) ? req.body.dependsOn.filter(Boolean) : [];
  const requiredSkill = req.body.requiredSkill ? String(req.body.requiredSkill).slice(0, 60) : '';
  const ref = await db.collection('tasks').add({
    teamId,
    title,
    description: description || '',
    status: 'todo',
    priority: priority || 'medium',
    createdBy: decoded.uid,
    assignedTo: assignedTo || null,
    dueDate: dueDate ? new Date(dueDate) : null,
    dependsOn,
    requiredSkill,
    blocked: dependsOn.length > 0,
    createdAt: SV(),
  });

  await audit(db, 'task_created', { teamId, taskId: ref.id });
  return { status: 201, success: true, taskId: ref.id };
}

async function handleSendChat(req, res, db, decoded, user) {
  const { teamId, text, markSeen } = req.body || {};
  if (!teamId) return { status: 400, error: 'teamId kerak.' };

  const membership = await getMembership(db, teamId, decoded.uid);
  const allowed = membership || user.role === 'admin';
  if (!allowed) return { status: 403, error: 'Ruxsat yoq.' };
  if (isReadOnlyMember(membership)) return { status: 403, error: "Viewer faqat o'qishi mumkin." };

  if (markSeen) {
    const snap = await db.collection('chatMessages').where('teamId', '==', teamId).get();
    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach((d) => {
        const m = d.data();
        const seen = Array.isArray(m.seenBy) ? m.seenBy : [];
        if (m.senderUserId !== decoded.uid && !seen.includes(decoded.uid)) {
          batch.update(d.ref, { seenBy: arrayUnion(decoded.uid) });
        }
      });
      await batch.commit();
    }
    return { status: 200, success: true, message: "Ko'rildi." };
  }

  if (!text || !text.trim()) return { status: 400, error: 'Xabar matni kerak.' };

  const ref = await db.collection('chatMessages').add({
    teamId,
    senderUserId: decoded.uid,
    senderName: user.name || decoded.email,
    text: text.trim(),
    seenBy: [decoded.uid],
    createdAt: SV(),
  });
  return { status: 201, success: true, messageId: ref.id };
}

async function handleTaskAction(req, res, db, decoded, user) {
  const { taskId, action, status, resultText, resultLink } = req.body || {};
  if (!taskId) return { status: 400, error: 'taskId kerak.' };

  const taskRef = db.collection('tasks').doc(taskId);
  const task = await taskRef.get();
  if (!task.exists) return { status: 404, error: 'Vazifa topilmadi.' };

  const t = task.data();
  const membership = await getMembership(db, t.teamId, decoded.uid);
  const isLead = membership && membership.role === 'team_lead';
  const isAdminRole = user.role === 'admin';
  const isAssignee = t.assignedTo === decoded.uid;

  const update = { updatedAt: SV() };
  if (status) update.status = status;
  if (action === 'complete') {
    update.status = 'done';
    update.completedAt = SV();
    // T8 - bog'liq vazifalarni blokdan chiqarish
    try {
      const dependents = await db.collection('tasks').where('teamId', '==', t.teamId).where('dependsOn', 'array-contains', taskId).get();
      if (!dependents.empty) {
        const batch = db.batch();
        dependents.docs.forEach((d) => batch.update(d.ref, { blocked: false }));
        await batch.commit();
      }
    } catch (_) { /* non-fatal */ }
  }
  if (action === 'claim') { update.assignedTo = decoded.uid; update.assignmentMode = 'assigned'; }
  if (action === 'submit') {
    update.submission = { text: resultText || '', link: resultLink || '', byUserId: decoded.uid, at: SV() };
    update.status = 'submitted';
  }

  const canEdit = isAdminRole || isLead || isAssignee || (action === 'claim' && membership);
  if (!canEdit) return { status: 403, error: 'Ruxsat yoq.' };

  await taskRef.update(update);
  if (action === 'complete') await audit(db, 'task_completed', { teamId: t.teamId, taskId });
  return { status: 200, success: true, message: 'Vazifa yangilandi.' };
}

async function handleDeleteWorkspace(req, res, db, decoded, user) {
  const { teamId } = req.body || {};
  if (!teamId) return { status: 400, error: 'teamId kerak.' };
  if (user.role !== 'admin') return { status: 403, error: 'Faqat admin.' };

  // T3 - Agar adminda 2FA yoqilgan bo'lsa, kodni talab qilamiz (parol re-auth bilan birga, R3).
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    const code = req.body && req.body.twoFactorCode;
    if (!verifyTOTP(user.twoFactorSecret, code)) {
      return { status: 401, error: '2FA kod noto\'g\'ri.' };
    }
  }

  await deleteTeamCascade(db, teamId);
  await audit(db, 'workspace_deleted', { teamId });
  return { status: 200, success: true, message: 'Workspace o\'chirildi.' };
}

async function deleteQueryBatch(db, query) {
  const snap = await query.limit(300).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  if (snap.size === 300) await deleteQueryBatch(db, query);
}

async function deleteTeamCascade(db, teamId) {
  await deleteQueryBatch(db, db.collection('teamMembers').where('teamId', '==', teamId));
  await deleteQueryBatch(db, db.collection('ideas').where('teamId', '==', teamId));
  await deleteQueryBatch(db, db.collection('tasks').where('teamId', '==', teamId));
  await deleteQueryBatch(db, db.collection('chatMessages').where('teamId', '==', teamId));
  await deleteQueryBatch(db, db.collection('taskSubmissions').where('teamId', '==', teamId));
  await deleteQueryBatch(db, db.collection('reports').where('teamId', '==', teamId));
  await deleteQueryBatch(db, db.collection('workspaceInvites').where('teamId', '==', teamId));
  await db.collection('teams').doc(teamId).delete();
}

async function handleCreateEntry(req, res, db, decoded, user) {
  const { teamId, title, description, type, ownerUserId } = req.body || {};
  if (!teamId || !title) return { status: 400, error: 'teamId va title kerak.' };

  const membership = await getMembership(db, teamId, decoded.uid);
  if (!membership && user.role !== 'admin') return { status: 403, error: 'Ruxsat yoq.' };
  if (isReadOnlyMember(membership)) return { status: 403, error: "Viewer faqat o'qishi mumkin." };

  const ref = await db.collection('ideas').add({
    teamId,
    title: title.trim(),
    description: description || '',
    entryType: type || 'idea',
    status: 'open',
    createdByUserId: decoded.uid,
    createdByName: user.name || decoded.email,
    ownerUserId: ownerUserId || decoded.uid,
    ownerName: user.name || decoded.email,
    createdAt: SV(),
    updatedAt: SV(),
  });
  return { status: 201, success: true, ideaId: ref.id };
}

async function handleUpdateEntryOwner(req, res, db, decoded, user) {
  const { teamId, ideaId, ownerUserId } = req.body || {};
  if (!teamId || !ideaId || !ownerUserId) return { status: 400, error: 'Barcha maydonlar kerak.' };

  const membership = await getMembership(db, teamId, decoded.uid);
  if (!(membership && membership.role === 'team_lead') && user.role !== 'admin') {
    return { status: 403, error: 'Ruxsat yoq.' };
  }
  if (isReadOnlyMember(membership)) return { status: 403, error: "Viewer faqat o'qishi mumkin." };

  const ideaDoc = await db.collection('ideas').doc(ideaId).get();
  const oldOwner = ideaDoc.exists ? ideaDoc.data().ownerUserId : null;
  const userSnap = await db.collection('users').doc(ownerUserId).get();
  const name = userSnap.exists ? (userSnap.data().name || '') : '';
  await db.collection('ideas').doc(ideaId).update({ ownerUserId, ownerName: name, updatedAt: SV() });
  await audit(db, 'entry_owner_changed', {
    teamId, ideaId, fromUserId: oldOwner, toUserId: ownerUserId,
    restoreCollection: 'ideas', restoreDocId: ideaId,
  }, { ownerUserId: oldOwner });
  return { status: 200, success: true };
}

async function handleCreatePersonalIdea(req, res, db, decoded) {
  const { title, description } = req.body || {};
  if (!title || !title.trim()) return { status: 400, error: 'Title kerak.' };

  const ref = await db.collection('personalIdeas').add({
    userId: decoded.uid,
    title: title.trim(),
    description: description || '',
    status: 'draft',
    createdAt: SV(),
    updatedAt: SV(),
  });
  return { status: 201, success: true, ideaId: ref.id };
}

async function handleImportPersonalIdea(req, res, db, decoded, user) {
  const { personalIdeaId, teamId } = req.body || {};
  if (!personalIdeaId || !teamId) return { status: 400, error: 'Barcha maydonlar kerak.' };

  const membership = await getMembership(db, teamId, decoded.uid);
  if (!membership && user.role !== 'admin') return { status: 403, error: 'Ruxsat yoq.' };

  const p = await db.collection('personalIdeas').doc(personalIdeaId).get();
  if (!p.exists || p.data().userId !== decoded.uid) return { status: 404, error: 'Shaxsiy g\'oya topilmadi.' };

  const pd = p.data();
  const ref = await db.collection('ideas').add({
    teamId,
    title: pd.title,
    description: pd.description || '',
    entryType: 'idea',
    status: 'open',
    createdByUserId: decoded.uid,
    createdByName: user.name || decoded.email,
    ownerUserId: decoded.uid,
    importedFrom: personalIdeaId,
    createdAt: SV(),
    updatedAt: SV(),
  });

  await db.collection('personalIdeas').doc(personalIdeaId).update({
    imported: true,
    importedIdeaId: ref.id,
    updatedAt: SV(),
  });
  return { status: 200, success: true, ideaId: ref.id };
}

async function handleSyncTasks(req, res, db, decoded, user) {
  const { teamId } = req.body || {};
  if (!teamId) return { status: 400, error: 'teamId kerak.' };

  const membership = await getMembership(db, teamId, decoded.uid);
  if (!membership && user.role !== 'admin') return { status: 403, error: 'Ruxsat yoq.' };

  const snap = await db.collection('tasks').where('teamId', '==', teamId).get();
  return { status: 200, success: true, count: snap.size };
}

/* ----------------------------- Stats ------------------------------ */
async function handleStats(req, res, db, decoded, user) {
  const { action } = req.query;
  if (action === 'admin-stats') {
    if (user.role !== 'admin') return { status: 403, error: 'Admin emas.' };
    const teams = (await db.collection('teams').get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    const totalUsers = (await db.collection('users').get()).size;
    const totalIdeas = (await db.collection('ideas').get()).size;
    return {
      status: 200,
      platform: {
        totalUsers,
        totalTeams: teams.length,
        totalIdeas,
        avgHealthScore: teams.length ? Math.round(teams.reduce((s, t) => s + (t.healthScore || 0), 0) / teams.length) : 0,
      },
    };
  }
  if (action === 'manager-stats') {
    if (user.role !== 'manager') return { status: 403, error: 'Manager emas.' };
    const ids = Array.isArray(user.assignedTeams) ? user.assignedTeams : [];
    const teamDocs = await Promise.all(ids.map((id) => db.collection('teams').doc(id).get()));
    const teams = teamDocs.filter((t) => t.exists).map((t) => ({ id: t.id, ...t.data() }));

    const enriched = await Promise.all(teams.map(async (t) => {
      const tasksSnap = await db.collection('tasks').where('teamId', '==', t.id).get();
      const total = tasksSnap.size;
      const done = tasksSnap.docs.filter((x) => x.data().status === 'done').length;
      const completionRate = total ? Math.round((done / total) * 100) : 0;
      return {
        teamId: t.id,
        teamName: t.name,
        membersCount: t.membersCount || 0,
        completionRate,
        healthScore: t.healthScore || 0,
        status: (t.healthScore || 0) >= 70 ? 'healthy' : (t.healthScore || 0) >= 50 ? 'warning' : 'critical',
      };
    }));

    return {
      status: 200,
      managerId: decoded.uid,
      teams: enriched,
      summary: {
        totalTeams: enriched.length,
        avgCompletionRate: enriched.length ? Math.round(enriched.reduce((s, t) => s + t.completionRate, 0) / enriched.length) : 0,
        avgHealthScore: enriched.length ? Math.round(enriched.reduce((s, t) => s + t.healthScore, 0) / enriched.length) : 0,
      },
    };
  }
  return { status: 400, error: 'Action xato.' };
}

// Personal statistics for the calling user (profile page)
async function handlePersonalStats(req, res, db, decoded, user) {
  const tasksSnap = await db.collection('tasks').where('assignedTo', '==', decoded.uid).get();
  const tasks = tasksSnap.docs.map((d) => d.data());
  const ideasSnap = await db.collection('ideas').where('createdByUserId', '==', decoded.uid).get();
  return {
    status: 200,
    userId: decoded.uid,
    score: user.score || 0,
    personalStats: {
      completedTasks: tasks.filter((t) => t.status === 'done').length,
      totalTasks: tasks.length,
      ideasCreated: ideasSnap.size,
    },
  };
}

// Team member list (team-lead / admin / manager)
async function handleTeamStats(req, res, db, decoded, user) {
  const { action, teamId } = req.query;
  if (!teamId) return { status: 400, error: 'teamId yoq.' };

  if (action === 'team-members') {
    const membership = await getMembership(db, teamId, decoded.uid);
    if (!(membership && membership.role === 'team_lead') && user.role !== 'admin' && user.role !== 'manager') {
      return { status: 403, error: 'Ruxsat yoq.' };
    }
    const snap = await db.collection('teamMembers').where('teamId', '==', teamId).get();
    const members = await Promise.all(snap.docs.map(async (d) => {
      const m = d.data();
      const prof = await db.collection('users').doc(m.userId).get();
      const p = prof.exists ? prof.data() : {};
      const tasksSnap = await db.collection('tasks').where('teamId', '==', teamId).where('assignedTo', '==', m.userId).get();
      const tasks = tasksSnap.docs.map((x) => x.data());
      return {
        userId: m.userId,
        name: p.name || '',
        email: p.email || '',
        role: m.role,
        score: m.score || 0,
        tasksCompleted: tasks.filter((x) => x.status === 'done').length,
        totalTasks: tasks.length,
      };
    }));
    return { status: 200, teamId, members };
  }

  if (action === 'leaderboard') {
    const membership = await getMembership(db, teamId, decoded.uid);
    if (!membership && user.role !== 'admin') return { status: 403, error: 'Ruxsat yoq.' };

    const snap = await db.collection('teamMembers').where('teamId', '==', teamId).get();
    const members = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    const enriched = await Promise.all(members.map(async (m, i) => {
      const prof = await db.collection('users').doc(m.userId).get();
      const p = prof.exists ? prof.data() : {};
      return {
        userId: m.userId,
        name: p.name || '',
        email: p.email || '',
        role: m.role,
        score: m.score || 0,
        rank: i + 1,
      };
    }));
    return { status: 200, teamId, leaderboard: enriched };
  }
  return { status: 400, error: 'Action xato.' };
}

async function handleUtils(req, res, db, decoded, user) {
  const { action, teamId } = req.query;

  if (action === 'health-score') {
    if (!teamId) return { status: 400, error: 'teamId yoq.' };
    const membership = await getMembership(db, teamId, decoded.uid);
    if (!membership && user.role !== 'admin') return { status: 403, error: 'Ruxsat yoq.' };

    const teamSnap = await db.collection('teams').doc(teamId).get();
    const team = teamSnap.exists ? teamSnap.data() : {};

    const tasksSnap = await db.collection('tasks').where('teamId', '==', teamId).get();
    const tasks = tasksSnap.docs.map((d) => d.data());
    const completed = tasks.filter((t) => t.status === 'done').length;
    const completionRate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

    const reportsSnap = await db.collection('reports').where('teamId', '==', teamId).get();
    const reports = reportsSnap.docs.map((d) => d.data());
    const onTime = reports.filter((r) => r.status === 'approved').length;
    const punctualityRate = reports.length ? Math.round((onTime / reports.length) * 100) : 100;

    const msgs = (await db.collection('chatMessages').where('teamId', '==', teamId).get()).size;
    const chatActivity = Math.min(100, msgs);

    const membersCount = team.membersCount || 0;
    const retention = membersCount > 0 ? 100 : 0;

    const healthScore = Math.round(
      0.4 * completionRate + 0.3 * punctualityRate + 0.2 * chatActivity + 0.1 * retention
    );

    return {
      status: 200,
      teamId,
      teamName: team.name || '',
      healthScore,
      status: healthScore >= 70 ? 'healthy' : healthScore >= 50 ? 'warning' : 'critical',
      components: {
        taskCompletionRate: completionRate,
        reportPunctuality: punctualityRate,
        chatActivityScore: chatActivity,
        memberRetention: retention,
      },
      metrics: {
        totalTasks: tasks.length,
        completedTasks: completed,
        totalReports: reports.length,
        onTimeReports: onTime,
        totalMessages: msgs,
        currentMembers: membersCount,
      },
    };
  }

  if (action === 'audit-logs') {
    if (user.role !== 'admin') return { status: 403, error: 'Admin emas.' };
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    let q = db.collection('auditLogs').orderBy('timestamp', 'desc').limit(limit);
    if (req.query.actionType) q = q.where('action', '==', req.query.actionType);
    if (req.query.userId) q = q.where('byUserId', '==', req.query.userId);
    const logs = (await q.get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    return { status: 200, logs };
  }

  if (action === 'search') {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return { status: 400, error: "Qidiruv so'zi kam." };
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const type = req.query.type || 'all';
    const lower = q.toLowerCase();

    let teamIds;
    if (user.role === 'admin') {
      teamIds = (await db.collection('teams').get()).docs.map((d) => d.id);
    } else {
      const mem = await db.collection('teamMembers').where('userId', '==', decoded.uid).get();
      teamIds = mem.docs.map((d) => d.data().teamId);
    }

    const results = { tasks: [], ideas: [], messages: [], teams: [] };
    const fetchDocs = async (col, field) => {
      const out = [];
      for (const tid of teamIds) {
        const snap = await db.collection(col).where('teamId', '==', tid).get();
        snap.docs.forEach((d) => {
          const data = d.data();
          const hay = ((data[field] || '') + ' ' + (data.description || '')).toLowerCase();
          if (hay.includes(lower)) out.push({ id: d.id, teamId: tid, ...data });
        });
        if (out.length >= limit) break;
      }
      return out.slice(0, limit);
    };

    if (type === 'all' || type === 'tasks') results.tasks = await fetchDocs('tasks', 'title');
    if (type === 'all' || type === 'ideas') results.ideas = await fetchDocs('ideas', 'title');
    if (type === 'all' || type === 'messages') results.messages = await fetchDocs('chatMessages', 'text');
    if (type === 'all' || type === 'teams') {
      if (teamIds.length) {
        const snap = await db.collection('teams')
          .where(FieldPath().documentId(), 'in', teamIds.slice(0, 30)).get();
        snap.docs.forEach((d) => {
          if ((d.data().name || '').toLowerCase().includes(lower)) results.teams.push({ id: d.id, ...d.data() });
        });
      }
    }
    return { status: 200, results };
  }

  return { status: 400, error: 'Action xato.' };
}

async function handleActions(req, res, db, decoded, user) {
  const { action } = req.query;

  if (action === 'convert-idea' && req.method === 'POST') {
    const { ideaId, teamId, title } = req.body || {};
    if (!ideaId || !teamId) return { status: 400, error: 'ideaId va teamId kerak.' };

    const membership = await getMembership(db, teamId, decoded.uid);
    if (!membership && user.role !== 'admin') return { status: 403, error: 'Ruxsat yoq.' };

    const idea = await db.collection('ideas').doc(ideaId).get();
    if (!idea.exists) return { status: 404, error: 'Idea topilmadi.' };

    const ref = await db.collection('tasks').add({
      teamId,
      title: title || idea.data().title,
      description: idea.data().description || '',
      status: 'todo',
      priority: 'medium',
      createdBy: decoded.uid,
      assignedTo: null,
      dueDate: null,
      createdAt: SV(),
    });

    await db.collection('ideas').doc(ideaId).update({ convertedToTaskId: ref.id, convertedAt: SV() });
    await audit(db, 'idea_converted', { teamId, ideaId, taskId: ref.id });
    return { status: 200, success: true, taskId: ref.id };
  }

  if (action === 'update-preferences' && req.method === 'POST') {
    const { workingHours, timezone, emailDigestFrequency, telegramUsername, locale } = req.body || {};
    const upd = {};
    if (workingHours) upd.workingHours = workingHours;
    if (timezone) upd.timezone = timezone;
    if (emailDigestFrequency) upd.emailDigestFrequency = emailDigestFrequency;
    if (telegramUsername) upd.telegramUsername = telegramUsername;
    if (locale) upd.locale = String(locale).slice(0, 10);
    await db.collection('users').doc(decoded.uid).update(upd);
    return { status: 200, success: true, message: 'Yangilandi.' };
  }

  if (action === 'overdue-tasks') {
    let allowed = null;
    if (user.role !== 'admin' && user.role !== 'manager') {
      const mem = await db.collection('teamMembers').where('userId', '==', decoded.uid).get();
      allowed = new Set(mem.docs.map((d) => d.data().teamId));
      if (req.query.teamId && !allowed.has(req.query.teamId)) return { status: 403, error: 'Ruxsat yoq.' };
    }

    const snap = await db.collection('tasks').where('status', '!=', 'done').get();
    const now = Date.now();
    const overdue = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => {
      const due = t.dueDate && t.dueDate.toMillis ? t.dueDate.toMillis() : 0;
      if (!(due > 0 && due < now)) return false;
      if (req.query.teamId && t.teamId !== req.query.teamId) return false;
      if (allowed && !allowed.has(t.teamId)) return false;
      return true;
    });
    return { status: 200, tasks: overdue, totalOverdue: overdue.length };
  }

  return { status: 400, error: 'Action xato.' };
}

async function handleExport(req, res, db, decoded, user) {
  const { action } = req.query;
  if (action === 'export-stats') {
    if (user.role !== 'admin' && user.role !== 'manager') return { status: 403, error: 'Ruxsat yoq.' };
    const teams = (await db.collection('teams').get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    const format = req.query.format || 'csv';

    if (format === 'json') {
      return { status: 200, fileName: `stats-${Date.now()}.json`, data: Buffer.from(JSON.stringify(teams)).toString('base64') };
    }
    const csv = ['Team Nomi,Health Score,Members']
      .concat(teams.map((t) => `"${t.name}","${t.healthScore || 0}","${t.membersCount || 0}"`))
      .join('\n');
    return { status: 200, fileName: `stats-${Date.now()}.csv`, data: Buffer.from(csv).toString('base64') };
  }
  return { status: 400, error: 'Action xato.' };
}

/* ----------------- T6/T1/T11/T12/T15/T4/T7 kengaytmalar ----------------- */

// T1 - Workspace arxivlash (soft delete). Hard delete o'zgarishsiz qoladi (R3).
async function handleArchiveWorkspace(req, res, db, decoded, user) {
  const { teamId, restore } = req.body || {};
  if (!teamId) return { status: 400, error: 'teamId kerak.' };
  if (user.role !== 'admin') {
    const m = await getMembership(db, teamId, decoded.uid);
    if (!m || m.role !== 'team_lead') return { status: 403, error: 'Faqat admin yoki team_lead.' };
  }
  const status = restore ? 'active' : 'archived';
  const upd = { status, updatedAt: SV() };
  if (!restore) { upd.archivedAt = SV(); upd.archivedBy = decoded.uid; }
  await db.collection('teams').doc(teamId).update(upd);
  await audit(db, restore ? 'workspace_restored' : 'workspace_archived', { teamId, byUserId: decoded.uid });
  invalidateTeamCache(); invalidateDashboardCache();
  return { status: 200, success: true, status };
}

// T11 - A'zo uchun maxsus ruxsatlar (faqat admin).
async function handleUpdateMemberPermissions(req, res, db, decoded, user) {
  const { teamId, userId, permissionsOverride } = req.body || {};
  if (!teamId || !userId) return { status: 400, error: 'teamId va userId kerak.' };
  if (user.role !== 'admin') return { status: 403, error: 'Faqat admin.' };
  if (typeof permissionsOverride !== 'object' || permissionsOverride === null) {
    return { status: 400, error: 'permissionsOverride obyekt bolishi kerak.' };
  }
  await db.collection('teamMembers').doc(teamId + '_' + userId).update({ permissionsOverride });
  await audit(db, 'member_permissions_updated', { teamId, userId, permissionsOverride });
  return { status: 200, success: true };
}

// T12 - Audit log'dan qaytarish (faqat admin, 24 soat ichida; parol re-auth client'da).
async function handleRollbackAction(req, res, db, decoded, user) {
  const { auditId } = req.body || {};
  if (!auditId) return { status: 400, error: 'auditId kerak.' };
  if (user.role !== 'admin') return { status: 403, error: 'Faqat admin.' };
  const logRef = db.collection('auditLogs').doc(auditId);
  const log = await logRef.get();
  if (!log.exists) return { status: 404, error: 'Audit yozuvi topilmadi.' };
  const data = log.data();
  if (!data.restoreCollection || !data.restoreDocId || typeof data.previousState === 'undefined') {
    return { status: 400, error: 'Bu amalni qaytarib bolmaydi.' };
  }
  const ts = data.timestamp && data.timestamp.toMillis ? data.timestamp.toMillis() : 0;
  if (ts && Date.now() - ts > 24 * 60 * 60 * 1000) {
    return { status: 400, error: "Qaytarish muddati (24 soat) o'tgan." };
  }
  await db.collection(data.restoreCollection).doc(data.restoreDocId).set(data.previousState, { merge: true });
  await audit(db, 'rollback_performed', { auditId, restoreCollection: data.restoreCollection, restoreDocId: data.restoreDocId });
  return { status: 200, success: true, message: 'Qaytarildi.' };
}

// T6 - Feature Flags o'qish/yozish. GET: flaglarni qaytaradi. POST: admin o'zgartiradi.
async function handleFeatureFlags(req, res, db, decoded, user) {
  const teamId = req.query.teamId || (req.body && req.body.teamId);
  if (req.method === 'POST') {
    if (user.role !== 'admin') return { status: 403, error: 'Faqat admin.' };
    const { flags, target } = req.body || {};
    const docId = target || 'global';
    if (typeof flags !== 'object' || flags === null) return { status: 400, error: 'flags obyekt bolishi kerak.' };
    await db.collection('featureFlags').doc(docId).set(flags, { merge: true });
    return { status: 200, success: true, target: docId };
  }
  const out = { global: {}, team: {} };
  const g = await db.collection('featureFlags').doc('global').get();
  if (g.exists) out.global = g.data();
  if (teamId) {
    if (user.role !== 'admin') {
      const m = await getMembership(db, teamId, decoded.uid);
      if (!m || m.role !== 'team_lead') return { status: 403, error: 'Ruxsat yoq.' };
    }
    const t = await db.collection('featureFlags').doc(teamId).get();
    if (t.exists) out.team = t.data();
  }
  return { status: 200, flags: out };
}

// T15 - Foydalanuvchining barcha workspace'laridagi shaxsiy umumlashma.
async function handleGetMyOverview(req, res, db, decoded) {
  const mem = await db.collection('teamMembers').where('userId', '==', decoded.uid).get();
  const teamIds = mem.docs.map((d) => d.data().teamId);
  const results = [];
  for (const tid of teamIds) {
    const tasksSnap = await db.collection('tasks').where('teamId', '==', tid).where('assignedTo', '==', decoded.uid).get();
    const tasks = tasksSnap.docs.map((d) => d.data());
    const ideasSnap = await db.collection('ideas').where('teamId', '==', tid).where('createdByUserId', '==', decoded.uid).get();
    const notifSnap = await db.collection('notifications').where('userId', '==', decoded.uid).where('read', '==', false).get();
    results.push({
      teamId: tid,
      openTasks: tasks.filter((t) => t.status !== 'done').length,
      completedTasks: tasks.filter((t) => t.status === 'done').length,
      myIdeas: ideasSnap.size,
      unreadNotifications: notifSnap.size,
    });
  }
  return { status: 200, userId: decoded.uid, overview: results };
}

// T4 - Vazifa bo'yicha vaqt kuzatuvi (timeLogs).
async function handleLogTime(req, res, db, decoded, user) {
  const { teamId, taskId, durationMs } = req.body || {};
  if (!teamId || !taskId || !durationMs) return { status: 400, error: 'teamId, taskId, durationMs kerak.' };
  const ms = parseInt(durationMs, 10);
  if (!(ms > 0)) return { status: 400, error: 'durationMs musbat bolishi kerak.' };
  const membership = await getMembership(db, teamId, decoded.uid);
  if (!membership && user.role !== 'admin') return { status: 403, error: 'Ruxsat yoq.' };
  if (isReadOnlyMember(membership)) return { status: 403, error: "Viewer faqat o'qishi mumkin." };
  await db.collection('timeLogs').add({ teamId, taskId, userId: decoded.uid, durationMs: ms, loggedAt: SV() });
  await audit(db, 'time_logged', { teamId, taskId, durationMs: ms });
  return { status: 201, success: true };
}

// T7 - Foydalanuvchi o'z ma'lumotlarini eksport qiladi (faqat o'zi uchun).
async function handleExportMyData(req, res, db, decoded) {
  const profile = await db.collection('users').doc(decoded.uid).get();
  const tasksSnap = await db.collection('tasks').where('assignedTo', '==', decoded.uid).get();
  const ideasSnap = await db.collection('ideas').where('createdByUserId', '==', decoded.uid).get();
  const personalSnap = await db.collection('personalIdeas').where('userId', '==', decoded.uid).get();
  const data = {
    profile: profile.exists ? profile.data() : null,
    tasks: tasksSnap.docs.map((d) => d.data()),
    ideas: ideasSnap.docs.map((d) => d.data()),
    personalIdeas: personalSnap.docs.map((d) => d.data()),
    exportedAt: new Date().toISOString(),
  };
  return { status: 200, fileName: `my-data-${decoded.uid}.json`, data: Buffer.from(JSON.stringify(data)).toString('base64') };
}

// T16 - Shifrlangan fayl metadata (fayl byte'lari Storage'ga client-side yoziladi).
async function handleCreateAttachment(req, res, db, decoded, user) {
  const { teamId, taskId, ideaId, fileName, size, iv } = req.body || {};
  if (!teamId || !fileName) return { status: 400, error: 'teamId va fileName kerak.' };
  const membership = await getMembership(db, teamId, decoded.uid);
  if (!membership && user.role !== 'admin') return { status: 403, error: 'Ruxsat yoq.' };
  if (isReadOnlyMember(membership)) return { status: 403, error: "Viewer faqat o'qishi mumkin." };
  const ref = await db.collection('attachments').add({
    teamId,
    taskId: taskId || null,
    ideaId: ideaId || null,
    fileName,
    size: size || 0,
    iv: iv || null, // client-side shifr uchun IV (server ochiq fayl ko'rmaydi)
    uploadedBy: decoded.uid,
    createdAt: SV(),
  });
  await audit(db, 'attachment_added', { teamId, attachmentId: ref.id });
  return { status: 201, success: true, attachmentId: ref.id };
}

/* ---------------- T3 Admin 2FA (enable / verify / disable) ---------------- */
async function handleEnable2FA(req, res, db, decoded, user) {
  if (user.role !== 'admin') return { status: 403, error: 'Faqat admin.' };
  const secret = generateTotpSecret();
  await db.collection('users').doc(decoded.uid).update({ twoFactorSecret: secret, twoFactorEnabled: false });
  const label = encodeURIComponent(user.email || decoded.uid);
  const otpauth = `otpauth://totp/MllyCore:${label}?secret=${secret}&issuer=MllyCore&period=30&digits=6`;
  return { status: 200, success: true, secret, otpauth };
}

async function handleVerify2FA(req, res, db, decoded, user) {
  if (user.role !== 'admin') return { status: 403, error: 'Faqat admin.' };
  const { code } = req.body || {};
  const docSnap = await db.collection('users').doc(decoded.uid).get();
  const data = docSnap.exists ? docSnap.data() : {};
  if (!data.twoFactorSecret) return { status: 400, error: 'Avval 2FA ni yoqing.' };
  if (!verifyTOTP(data.twoFactorSecret, code)) return { status: 401, error: 'Kod noto\'g\'ri.' };
  await db.collection('users').doc(decoded.uid).update({ twoFactorEnabled: true });
  await audit(db, 'two_factor_enabled', { userId: decoded.uid });
  return { status: 200, success: true, enabled: true };
}

async function handleDisable2FA(req, res, db, decoded, user) {
  if (user.role !== 'admin') return { status: 403, error: 'Faqat admin.' };
  const { code } = req.body || {};
  const docSnap = await db.collection('users').doc(decoded.uid).get();
  const data = docSnap.exists ? docSnap.data() : {};
  if (data.twoFactorEnabled && data.twoFactorSecret) {
    if (!verifyTOTP(data.twoFactorSecret, code)) return { status: 401, error: '2FA kod noto\'g\'ri.' };
  }
  await db.collection('users').doc(decoded.uid).update({ twoFactorEnabled: false });
  await audit(db, 'two_factor_disabled', { userId: decoded.uid });
  return { status: 200, success: true, enabled: false };
}

/* --------------------------- T9 Presence (read) --------------------------- */
async function handlePresence(req, res, db, decoded, user) {
  const { teamId } = req.query.teamId ? req.query : (req.body || {});
  if (!teamId) return { status: 400, error: 'teamId kerak.' };
  const membership = await getMembership(db, teamId, decoded.uid);
  if (!membership && user.role !== 'admin') return { status: 403, error: 'Ruxsat yoq.' };
  const memSnap = await db.collection('teamMembers').where('teamId', '==', teamId).get();
  const uids = memSnap.docs.map((d) => d.data().userId);
  const presence = {};
  await Promise.all(uids.map(async (uid) => {
    const p = await db.collection('presence').doc(uid).get();
    presence[uid] = p.exists ? p.data() : { status: 'offline', lastSeen: null };
  }));
  return { status: 200, teamId, presence };
}

/* --------------------------- T10 AI klasterlash / dublikat --------------------------- */
function tokenize(text) {
  return new Set(String(text || '').toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/).filter((w) => w.length > 2));
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

function unionFind(n) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { parent[find(a)] = find(b); };
  return { find, union };
}

async function handleAnalyzeIdeas(req, res, db, decoded, user) {
  const { teamId } = req.body || {};
  if (!teamId) return { status: 400, error: 'teamId kerak.' };
  const membership = await getMembership(db, teamId, decoded.uid);
  if (!membership && user.role !== 'admin') return { status: 403, error: 'Ruxsat yoq.' };

  const snap = await db.collection('ideas').where('teamId', '==', teamId).get();
  const ideas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (ideas.length < 2) return { status: 200, success: true, clusters: [], duplicates: [], message: 'Klasterlash uchun kamida 2 ta g\'oya kerak.' };

  const tokens = ideas.map((it) => tokenize(`${it.title || ''} ${it.description || ''}`));
  const THRESHOLD = 0.25;
  const similarTo = {};
  ideas.forEach((it) => { similarTo[it.id] = []; });
  const uf = unionFind(ideas.length);

  for (let i = 0; i < ideas.length; i += 1) {
    for (let j = i + 1; j < ideas.length; j += 1) {
      const score = jaccard(tokens[i], tokens[j]);
      if (score >= THRESHOLD) {
        similarTo[ideas[i].id].push({ id: ideas[j].id, score });
        similarTo[ideas[j].id].push({ id: ideas[i].id, score });
        uf.union(i, j);
      }
    }
  }

  // similarTo ni saqlash (batched)
  const batch = db.batch();
  ideas.forEach((it) => {
    const sim = (similarTo[it.id] || []).map((s) => s.id);
    batch.update(db.collection('ideas').doc(it.id), { similarTo: sim });
  });
  await batch.commit();

  const clustersMap = {};
  ideas.forEach((it, idx) => {
    const root = uf.find(idx);
    if (!clustersMap[root]) clustersMap[root] = [];
    clustersMap[root].push(it.id);
  });
  const clusters = Object.values(clustersMap).filter((c) => c.length > 1);
  const duplicates = Object.entries(similarTo).filter(([, v]) => v.length > 0).map(([id, v]) => ({ id, similarTo: v }));

  await audit(db, 'ideas_analyzed', { teamId, clusters: clusters.length, pairs: duplicates.length });
  return { status: 200, success: true, clusters, duplicates, message: `${clusters.length} klaster, ${duplicates.length} o'xshash juftlik topildi.` };
}

/* --------------------------- T13 Shablonlar --------------------------- */
async function handleGetTemplates(req, res, db, decoded, user) {
  if (user.role !== 'admin') return { status: 403, error: 'Faqat admin.' };
  const snap = await db.collection('templates').get();
  return { status: 200, templates: snap.docs.map((d) => ({ id: d.id, ...d.data() })) };
}

async function handleCreateTemplate(req, res, db, decoded, user) {
  if (user.role !== 'admin') return { status: 403, error: 'Faqat admin.' };
  const { name, description, seedTasks } = req.body || {};
  if (!name || !name.trim()) return { status: 400, error: 'Shablon nomi kerak.' };
  const ref = await db.collection('templates').add({
    name: name.trim(),
    description: description || '',
    seedTasks: Array.isArray(seedTasks) ? seedTasks.slice(0, 50) : [],
    createdBy: decoded.uid,
    createdAt: SV(),
  });
  await audit(db, 'template_created', { templateId: ref.id });
  return { status: 201, success: true, templateId: ref.id };
}

/* --------------------------- T14 Quiet Hours (notify) --------------------------- */
function isWithinWorkingHours(profile) {
  const wh = profile && profile.workingHours;
  if (!wh || !wh.start || !wh.end) return true;
  const tz = (profile && profile.timezone) || 'UTC';
  let nowHHMM;
  try {
    nowHHMM = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  } catch (_) { return true; }
  return nowHHMM >= wh.start && nowHHMM <= wh.end;
}

async function handleNotify(req, res, db, decoded, user) {
  const { userId, teamId, type, text, urgent, link } = req.body || {};
  if (!userId || !text) return { status: 400, error: 'userId va text kerak.' };
  const userSnap = await db.collection('users').doc(userId).get();
  if (!userSnap.exists) return { status: 404, error: 'Foydalanuvchi topilmadi.' };
  const recipient = userSnap.data();

  // Quiet Hours faqat yoqilgan feature-flag va urgent bo'lmaganda ishlaydi (T14).
  let quiet = false;
  if (!urgent) {
    const flagDoc = await db.collection('featureFlags').doc('global').get();
    const flags = flagDoc.exists ? flagDoc.data() : {};
    if (flags.quietHours && !isWithinWorkingHours(recipient)) quiet = true;
  }

  const ref = await db.collection('notifications').add({
    userId,
    teamId: teamId || '',
    type: type || 'general',
    text: String(text),
    link: link || '',
    unread: true,
    isRead: false,
    quietHoursSuppressed: quiet,
    deliverAt: quiet ? SV() : SV(),
    createdAt: SV(),
  });
  if (!quiet) pushTelegram(db, userId, String(text)).catch(() => {});
  return { status: 201, success: true, notificationId: ref.id, suppressed: quiet, delivered: !quiet };
}

/* --------------------------- T17 Weekly Digest (cron) --------------------------- */
async function handleWeeklyDigest(req, res, db, decoded, user) {
  if (user.role !== 'admin') return { status: 403, error: 'Faqat admin.' };
  const flagDoc = await db.collection('featureFlags').doc('global').get();
  const flags = flagDoc.exists ? flagDoc.data() : {};
  if (flags.weeklyDigest === false) return { status: 200, success: true, skipped: true, message: 'Weekly digest o\'chirilgan.' };

  const teamsSnap = await db.collection('teams').where('status', '!=', 'archived').get();
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const generated = [];

  for (const t of teamsSnap.docs) {
    const teamId = t.id;
    const [taskSnap, ideaSnap, memberSnap] = await Promise.all([
      db.collection('tasks').where('teamId', '==', teamId).get(),
      db.collection('ideas').where('teamId', '==', teamId).where('createdAt', '>=', weekStart).get(),
      db.collection('teamMembers').where('teamId', '==', teamId).get(),
    ]);
    const tasks = taskSnap.docs.map((d) => d.data());
    const completed = tasks.filter((x) => x.status === 'done').length;
    const members = memberSnap.docs.map((d) => d.data());
    const contributions = {};
    tasks.forEach((tk) => {
      const who = tk.assignedTo || tk.createdBy;
      if (who) contributions[who] = (contributions[who] || 0) + 1;
    });
    let topContributor = null; let topCount = -1;
    Object.entries(contributions).forEach(([uid, c]) => { if (c > topCount) { topCount = c; topContributor = uid; } });

    await db.collection('digests').add({
      teamId,
      teamName: t.data().name || '',
      weekStart: weekStart.toISOString(),
      generatedAt: SV(),
      stats: {
        totalTasks: tasks.length,
        completedTasks: completed,
        newIdeas: ideaSnap.size,
        members: members.length,
      },
      topContributor,
      topContributorCount: topCount > 0 ? topCount : 0,
    });
    generated.push(teamId);
  }
  return { status: 200, success: true, teams: generated.length, processedTeamIds: generated };
}

/* ===================== T18–T37 (kodlangan kengaytmalar) ===================== */

// T18 - Idea Scoring (ICE/RICE)
async function handleScoreIdea(req, res, db, decoded, user) {
  const { ideaId, impact, confidence, ease } = req.body || {};
  if (!ideaId) return { status: 400, error: 'ideaId kerak.' };
  const ref = db.collection('ideas').doc(ideaId);
  const snap = await ref.get();
  if (!snap.exists()) return { status: 404, error: 'G\'oya topilmadi.' };
  const idea = snap.data();
  const membership = await getMembership(db, idea.teamId, decoded.uid);
  if (!(membership && ['team_lead', 'member'].includes(membership.role)) && user.role !== 'admin') return { status: 403, error: 'Ruxsat yoq.' };
  const imp = Number(impact) || 0; const conf = Number(confidence) || 0; const eas = Number(ease) || 0;
  const rice = Math.max(0, Math.min(100, Math.round((imp * conf * eas) / 100)));
  await ref.update({ score: { impact: imp, confidence: conf, ease: eas, rice }, updatedAt: SV() });
  await audit(db, 'idea_scored', { ideaId, rice });
  return { status: 200, success: true, rice };
}

// T19 - Pitch One-Pager (HTML)
async function handleGeneratePitch(req, res, db, decoded, user) {
  const { ideaId } = req.body || {};
  if (!ideaId) return { status: 400, error: 'ideaId kerak.' };
  const ideaSnap = await db.collection('ideas').doc(ideaId).get();
  if (!ideaSnap.exists()) return { status: 404, error: 'G\'oya topilmadi.' };
  const idea = ideaSnap.data();
  const membership = await getMembership(db, idea.teamId, decoded.uid);
  if (!membership && user.role !== 'admin') return { status: 403, error: 'Ruxsat yoq.' };
  const [taskSnap, memberSnap] = await Promise.all([
    db.collection('tasks').where('teamId', '==', idea.teamId).get(),
    db.collection('teamMembers').where('teamId', '==', idea.teamId).get()
  ]);
  const members = [];
  for (const m of memberSnap.docs) {
    const p = await db.collection('users').doc(m.data().userId).get();
    const pd = p.exists ? p.data() : {};
    members.push(pd.name || pd.email || m.data().userId);
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(idea.title)}</title></head>` +
    `<body style="font-family:sans-serif;max-width:820px;margin:40px auto;padding:0 20px;color:#0f172a;">` +
    `<h1>${escapeHtml(idea.title)}</h1><p>${escapeHtml(idea.description || '')}</p>` +
    `<h2>Jamoa</h2><ul>${(members.map((n) => `<li>${escapeHtml(n)}</li>`)).join('')}</ul>` +
    `<h2>Vazifalar</h2><ul>${(taskSnap.docs.map((d) => `<li>${escapeHtml(d.data().title)} — ${escapeHtml(d.data().status || 'open')}</li>`)).join('')}</ul>` +
    `</body></html>`;
  await audit(db, 'pitch_generated', { ideaId });
  return { status: 200, success: true, html };
}

// T20 - Public Showcase (opt-in)
async function handleSetPublic(req, res, db, decoded, user) {
  const { ideaId, isPublic } = req.body || {};
  if (!ideaId) return { status: 400, error: 'ideaId kerak.' };
  const ref = db.collection('ideas').doc(ideaId);
  const snap = await ref.get();
  if (!snap.exists()) return { status: 404, error: 'G\'oya topilmadi.' };
  const membership = await getMembership(db, snap.data().teamId, decoded.uid);
  if (!(membership && membership.role === 'team_lead') && user.role !== 'admin') return { status: 403, error: 'Faqat lead/admin.' };
  if (isPublic) {
    const token = crypto.randomBytes(16).toString('hex');
    await ref.update({ isPublic: true, publicToken: token });
    return { status: 200, success: true, publicToken: token };
  }
  await ref.update({ isPublic: false, publicToken: '' });
  return { status: 200, success: true };
}
async function handlePublicIdea(req, res, db) {
  const token = req.query.token;
  if (!token) return { status: 400, error: 'token kerak.' };
  const snap = await db.collection('ideas').where('publicToken', '==', token).where('isPublic', '==', true).limit(1).get();
  if (snap.empty) return { status: 404, error: 'Topilmadi.' };
  const idea = snap.docs[0].data();
  return { status: 200, idea: { title: idea.title, description: idea.description, status: idea.status, score: idea.score || null, stage: idea.stage || null } };
}

// T21 - Roadmap / Timeline
async function handleRoadmap(req, res, db, decoded, user) {
  const { teamId } = req.query.teamId ? req.query : (req.body || {});
  if (!teamId) return { status: 400, error: 'teamId kerak.' };
  const membership = await getMembership(db, teamId, decoded.uid);
  if (!membership && user.role !== 'admin') return { status: 403, error: 'Ruxsat yoq.' };
  const snap = await db.collection('tasks').where('teamId', '==', teamId).orderBy('dueDate', 'asc').get();
  const tasks = snap.docs.map((d) => ({ id: d.id, title: d.data().title, status: d.data().status, dueDate: d.data().dueDate, dependsOn: d.data().dependsOn || [], assignedTo: d.data().assignedTo }));
  return { status: 200, teamId, tasks };
}

// T22 - Telegram
async function handleLinkTelegram(req, res, db, decoded, user) {
  const { chatId } = req.body || {};
  if (!chatId) return { status: 400, error: 'chatId kerak.' };
  await db.collection('users').doc(decoded.uid).update({ telegramChatId: String(chatId) });
  return { status: 200, success: true };
}
async function handleTelegramWebhook(req, res) {
  return { status: 200, ok: true };
}
async function pushTelegram(db, userId, text) {
  try {
    const u = await db.collection('users').doc(userId).get();
    const data = u.exists ? u.data() : {};
    if (!data.telegramChatId) return;
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: data.telegramChatId, text: String(text).slice(0, 4000) })
    });
  } catch (_) {}
}

// T23 - Financial Runway
async function handleFinances(req, res, db, decoded, user) {
  const { teamId, monthlyBudget, burnRate, currency } = req.body || {};
  if (!teamId) return { status: 400, error: 'teamId kerak.' };
  const membership = await getMembership(db, teamId, decoded.uid);
  if (!(membership && membership.role === 'team_lead') && user.role !== 'admin') return { status: 403, error: 'Faqat lead/admin.' };
  await db.collection('finances').doc(teamId).set({
    teamId, monthlyBudget: Number(monthlyBudget) || 0, burnRate: Number(burnRate) || 0, currency: currency || 'USD', updatedAt: SV()
  }, { merge: true });
  return { status: 200, success: true };
}
async function handleRunway(req, res, db, decoded, user) {
  const { teamId } = req.query.teamId ? req.query : (req.body || {});
  if (!teamId) return { status: 400, error: 'teamId kerak.' };
  const membership = await getMembership(db, teamId, decoded.uid);
  if (!membership && user.role !== 'admin') return { status: 403, error: 'Ruxsat yoq.' };
  const snap = await db.collection('finances').doc(teamId).get();
  const f = snap.exists ? snap.data() : { monthlyBudget: 0, burnRate: 0 };
  const runway = f.burnRate > 0 ? Math.floor(f.monthlyBudget / f.burnRate) : null;
  return { status: 200, teamId, monthlyBudget: f.monthlyBudget, burnRate: f.burnRate, runwayMonths: runway };
}

// T24 - Decision Log
async function handleDecisionLog(req, res, db, decoded, user) {
  const { teamId, title, rationale, decision } = req.body || {};
  if (!teamId || !title) return { status: 400, error: 'teamId va title kerak.' };
  const membership = await getMembership(db, teamId, decoded.uid);
  if (!membership && user.role !== 'admin') return { status: 403, error: 'Ruxsat yoq.' };
  const ref = await db.collection('decisions').add({
    teamId, title, rationale: rationale || '', decision: decision || '',
    authorId: decoded.uid, createdAt: SV()
  });
  await audit(db, 'decision_logged', { teamId, decisionId: ref.id });
  return { status: 201, success: true, decisionId: ref.id };
}

// T25 - Skill Tagging (user skills yangilash)
async function handleUpdateSkills(req, res, db, decoded, user) {
  const { skills } = req.body || {};
  if (!Array.isArray(skills)) return { status: 400, error: 'skills massiv bo\'lishi kerak.' };
  await db.collection('users').doc(decoded.uid).update({ skills: skills.slice(0, 50) });
  return { status: 200, success: true };
}

// T26 - Idea Health (stale)
async function handleStaleIdeas(req, res, db, decoded, user) {
  if (user.role !== 'admin') return { status: 403, error: 'Faqat admin.' };
  const days = parseInt(req.query.days || req.body?.days || '14', 10) || 14;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const snap = await db.collection('ideas').where('status', '!=', 'archived').get();
  const stale = [];
  const batch = db.batch();
  for (const d of snap.docs) {
    const data = d.data();
    const last = data.lastActivityAt ? (data.lastActivityAt.toMillis ? data.lastActivityAt.toMillis() : new Date(data.lastActivityAt).getTime()) : 0;
    if (last && last < cutoff.getTime()) {
      batch.update(d.ref, { stale: true });
      stale.push(d.id);
    }
  }
  if (stale.length) await batch.commit();
  return { status: 200, success: true, staleCount: stale.length, stale };
}

// T27 - Threaded @Mentions (comment)
async function handleComment(req, res, db, decoded, user) {
  const { ideaId, text, mentions } = req.body || {};
  if (!ideaId || !text || !text.trim()) return { status: 400, error: 'ideaId va text kerak.' };
  const ideaSnap = await db.collection('ideas').doc(ideaId).get();
  if (!ideaSnap.exists()) return { status: 404, error: 'G\'oya topilmadi.' };
  const teamId = ideaSnap.data().teamId;
  const membership = await getMembership(db, teamId, decoded.uid);
  if (!membership && user.role !== 'admin') return { status: 403, error: 'Ruxsat yoq.' };
  const ref = await db.collection('ideaComments').add({
    ideaId, teamId, userId: decoded.uid, userName: user.name || decoded.email,
    text: text.trim(), mentions: Array.isArray(mentions) ? mentions.filter(Boolean) : [], createdAt: SV()
  });
  const mentioned = Array.isArray(mentions) ? mentions.filter(Boolean) : [];
  for (const uid of mentioned) {
    await db.collection('notifications').add({ userId: uid, teamId, type: 'mention', text: `${user.name || 'User'} sizni izohda eslatdi`, relatedEntityId: ideaId, unread: true, isRead: false, mentionedUid: uid, createdAt: SV() });
  }
  await db.collection('ideas').doc(ideaId).update({ lastActivityAt: SV() });
  return { status: 201, success: true, commentId: ref.id };
}

// T28 - Reputation
async function handleReputation(req, res, db, decoded, user) {
  const { teamId } = req.query.teamId ? req.query : (req.body || {});
  if (!teamId) return { status: 400, error: 'teamId kerak.' };
  const membership = await getMembership(db, teamId, decoded.uid);
  if (!membership && user.role !== 'admin') return { status: 403, error: 'Ruxsat yoq.' };
  const memSnap = await db.collection('teamMembers').where('teamId', '==', teamId).get();
  const rows = await Promise.all(memSnap.docs.map(async (m) => {
    const p = await db.collection('users').doc(m.data().userId).get();
    const pd = p.exists ? p.data() : {};
    return { userId: m.data().userId, name: pd.name || pd.email || m.data().userId, reputation: pd.reputation || 0, role: m.data().role };
  }));
  return { status: 200, teamId, members: rows.sort((a, b) => b.reputation - a.reputation) };
}

// T29 - Custom Idea Stage
async function handleSetStage(req, res, db, decoded, user) {
  const { ideaId, stage } = req.body || {};
  if (!ideaId || !stage) return { status: 400, error: 'ideaId va stage kerak.' };
  const ref = db.collection('ideas').doc(ideaId);
  const snap = await ref.get();
  if (!snap.exists()) return { status: 404, error: 'G\'oya topilmadi.' };
  const membership = await getMembership(db, snap.data().teamId, decoded.uid);
  if (!(membership && membership.role === 'team_lead') && user.role !== 'admin') return { status: 403, error: 'Faqat lead/admin.' };
  await ref.update({ stage, updatedAt: SV() });
  return { status: 200, success: true };
}

// T30 - Meeting Minutes
async function handleMeetingNotes(req, res, db, decoded, user) {
  const { teamId, title, notes, actionItems, decisions } = req.body || {};
  if (!teamId || !title) return { status: 400, error: 'teamId va title kerak.' };
  const membership = await getMembership(db, teamId, decoded.uid);
  if (!membership && user.role !== 'admin') return { status: 403, error: 'Ruxsat yoq.' };
  const ref = await db.collection('meetingNotes').add({
    teamId, title, notes: notes || '', authorId: decoded.uid,
    actionItems: Array.isArray(actionItems) ? actionItems : [], decisions: Array.isArray(decisions) ? decisions : [],
    createdAt: SV()
  });
  // action item'larni vazifaga aylantirish
  if (Array.isArray(actionItems)) {
    const batch = db.batch();
    actionItems.filter(Boolean).slice(0, 20).forEach((t) => {
      const r = db.collection('tasks').doc();
      batch.set(r, { teamId, title: String(t).slice(0, 200), status: 'todo', priority: 'medium', createdBy: decoded.uid, assignedTo: null, dueDate: null, createdAt: SV() });
    });
    await batch.commit();
  }
  await audit(db, 'meeting_noted', { teamId, noteId: ref.id });
  return { status: 201, success: true, noteId: ref.id };
}

// T31 - GitHub Issues Sync
async function handleSyncGithub(req, res, db, decoded, user) {
  const { taskId, repo, token } = req.body || {};
  if (!taskId || !repo) return { status: 400, error: 'taskId va repo kerak.' };
  const taskSnap = await db.collection('tasks').doc(taskId).get();
  if (!taskSnap.exists()) return { status: 404, error: 'Vazifa topilmadi.' };
  const task = taskSnap.data();
  const membership = await getMembership(db, task.teamId, decoded.uid);
  if (!(membership && membership.role === 'team_lead') && user.role !== 'admin') return { status: 403, error: 'Faqat lead/admin.' };
  const ghToken = token || process.env.GITHUB_TOKEN;
  if (!ghToken) return { status: 400, error: 'GitHub token kerak.' };
  try {
    const resp = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: { Authorization: `token ${ghToken}`, 'Content-Type': 'application/json', 'User-Agent': 'MllyCore' },
      body: JSON.stringify({ title: task.title, body: task.description || '' })
    });
    const json = await resp.json();
    if (!resp.ok) return { status: 502, error: 'GitHub xatosi: ' + (json.message || 'noma\'lum') };
    await taskSnap.ref.update({ githubIssueId: json.id, githubIssueUrl: json.html_url });
    return { status: 200, success: true, issueUrl: json.html_url };
  } catch (e) {
    return { status: 502, error: 'GitHub ga ulanish xatosi.' };
  }
}

// T32 - Onboarding status
async function handleOnboardingStatus(req, res, db, decoded, user) {
  const { teamId } = req.query.teamId ? req.query : (req.body || {});
  if (!teamId) return { status: 400, error: 'teamId kerak.' };
  const [memSnap, ideaSnap] = await Promise.all([
    db.collection('teamMembers').where('teamId', '==', teamId).get(),
    db.collection('ideas').where('teamId', '==', teamId).get()
  ]);
  return { status: 200, teamId, members: memSnap.size, ideas: ideaSnap.size, complete: memSnap.size > 1 && ideaSnap.size > 0 };
}

// T33 - Locale yangilash (update-preferences ga qo'shimcha)
// (handleActions ichidagi update-preferences ga locale qo'shildi)

// T34 - Idea Voting
async function handleVoteIdea(req, res, db, decoded, user) {
  const { ideaId } = req.body || {};
  if (!ideaId) return { status: 400, error: 'ideaId kerak.' };
  const ref = db.collection('ideas').doc(ideaId);
  const snap = await ref.get();
  if (!snap.exists()) return { status: 404, error: 'G\'oya topilmadi.' };
  const votes = Array.isArray(snap.data().votes) ? snap.data().votes : [];
  let next;
  if (votes.includes(decoded.uid)) next = votes.filter((v) => v !== decoded.uid);
  else next = [...votes, decoded.uid];
  await ref.update({ votes: next, voteCount: next.length, lastActivityAt: SV() });
  return { status: 200, success: true, voteCount: next.length, voted: next.includes(decoded.uid) };
}

// T35 - Risk Register
async function handleRisk(req, res, db, decoded, user) {
  const { teamId, ideaId, title, likelihood, impact, mitigation } = req.body || {};
  if (!teamId || !title) return { status: 400, error: 'teamId va title kerak.' };
  const membership = await getMembership(db, teamId, decoded.uid);
  if (!membership && user.role !== 'admin') return { status: 403, error: 'Ruxsat yoq.' };
  const ref = await db.collection('risks').add({
    teamId, ideaId: ideaId || null, title, likelihood: Number(likelihood) || 1, impact: Number(impact) || 1,
    mitigation: mitigation || '', authorId: decoded.uid, createdAt: SV()
  });
  return { status: 201, success: true, riskId: ref.id };
}

// T36 - Activity Timeline
async function handleActivityFeed(req, res, db, decoded, user) {
  const { teamId } = req.query.teamId ? req.query : (req.body || {});
  if (!teamId) return { status: 400, error: 'teamId kerak.' };
  const membership = await getMembership(db, teamId, decoded.uid);
  if (!membership && user.role !== 'admin') return { status: 403, error: 'Ruxsat yoq.' };
  const logs = (await db.collection('auditLogs').where('teamId', '==', teamId).orderBy('timestamp', 'desc').limit(30).get()).docs.map((d) => ({ ...d.data(), kind: 'audit' }));
  const notifs = (await db.collection('notifications').where('teamId', '==', teamId).orderBy('createdAt', 'desc').limit(30).get()).docs.map((d) => ({ ...d.data(), kind: 'notification' }));
  const feed = [...logs, ...notifs].sort((a, b) => {
    const ta = a.timestamp?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
    const tb = b.timestamp?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
    return tb - ta;
  }).slice(0, 40);
  return { status: 200, teamId, feed };
}

// T37 - Workspace Clone
async function handleCloneWorkspace(req, res, db, decoded, user) {
  const { teamId, name, leadEmail } = req.body || {};
  if (!teamId || !name || !name.trim()) return { status: 400, error: 'teamId va name kerak.' };
  if (user.role !== 'admin') return { status: 403, error: 'Faqat admin.' };
  const srcSnap = await db.collection('teams').doc(teamId).get();
  if (!srcSnap.exists()) return { status: 404, error: 'Workspace topilmadi.' };
  const src = srcSnap.data();
  const teamRef = await db.collection('teams').add({
    name: name.trim(), description: src.description || '',
    createdByUserId: decoded.uid, createdBy: user.email || decoded.email,
    membersCount: 1, healthScore: 50, status: 'active', clonedFrom: teamId, createdAt: SV()
  });
  let leadUid = decoded.uid;
  if (leadEmail && leadEmail.trim()) {
    const ls = await db.collection('users').where('email', '==', leadEmail.trim().toLowerCase()).limit(1).get();
    if (!ls.empty) leadUid = ls.docs[0].id;
  }
  await db.collection('teamMembers').doc(teamRef.id + '_' + leadUid).set({ teamId: teamRef.id, userId: leadUid, role: 'team_lead', joinedAt: SV() });
  // Idealar va vazifalarni nusxalash
  const [ideas, tasks] = await Promise.all([
    db.collection('ideas').where('teamId', '==', teamId).get(),
    db.collection('tasks').where('teamId', '==', teamId).get()
  ]);
  const batch = db.batch();
  ideas.docs.slice(0, 100).forEach((d) => {
    const r = db.collection('ideas').doc();
    batch.set(r, { ...d.data(), teamId: teamRef.id, id: r.id, createdAt: SV(), updatedAt: SV() });
  });
  tasks.docs.slice(0, 200).forEach((d) => {
    const r = db.collection('tasks').doc();
    batch.set(r, { ...d.data(), teamId: teamRef.id, id: r.id, createdAt: SV() });
  });
  await batch.commit();
  await audit(db, 'workspace_cloned', { from: teamId, to: teamRef.id });
  return { status: 201, success: true, teamId: teamRef.id };
}

/* --------------------------- Router ------------------------------- */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  // T20 - Public Showcase: tashqi investor login qilmasdan o'qiydi (authsiz)
  const _pathname = (req.url || '').split('?')[0];
  if (_pathname.includes('public-idea')) {
    try {
      initAdmin();
      const _db = admin.firestore();
      const _result = await handlePublicIdea(req, res, _db);
      return res.status(_result.status || 200).json(_result);
    } catch (e) {
      return res.status(400).json({ error: (e && e.message) || 'Xatolik' });
    }
  }

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    initAdmin();
    const decoded = await verifyAuth(req);
    const db = admin.firestore();
    const user = await getUserData(db, decoded.uid);

    const pathname = (req.url || '').split('?')[0];
    const qs = (req.url || '').split('?')[1] || '';
    req.query = {};
    for (const [k, v] of new URLSearchParams(qs)) req.query[k] = v;
    req.body = tryParse(req.body);

    const action = req.query.action || pathname.split('/').pop();
    let result;

    if (pathname.includes('accept-invite')) result = await handleAcceptInvite(req, res, db, decoded, user);
    else if (pathname.includes('create-workspace')) result = await handleCreateWorkspace(req, res, db, decoded, user);
    else if (pathname.includes('invite-member')) result = await handleInviteMember(req, res, db, decoded, user);
    else if (pathname.includes('delete-workspace')) result = await handleDeleteWorkspace(req, res, db, decoded, user);
    else if (pathname.includes('create-entry')) result = await handleCreateEntry(req, res, db, decoded, user);
    else if (pathname.includes('update-entry-owner')) result = await handleUpdateEntryOwner(req, res, db, decoded, user);
    else if (pathname.includes('create-personal-idea')) result = await handleCreatePersonalIdea(req, res, db, decoded, user);
    else if (pathname.includes('import-personal-idea')) result = await handleImportPersonalIdea(req, res, db, decoded, user);
    else if (pathname.includes('sync-tasks')) result = await handleSyncTasks(req, res, db, decoded, user);
    else if (pathname.includes('create-task')) result = await handleCreateTask(req, res, db, decoded, user);
    else if (pathname.includes('send-chat')) result = await handleSendChat(req, res, db, decoded, user);
    else if (pathname.includes('task-action')) result = await handleTaskAction(req, res, db, decoded, user);
    else if (action === 'admin-stats' || action === 'manager-stats') result = await handleStats(req, res, db, decoded, user);
    else if (action === 'member-stats') result = await handlePersonalStats(req, res, db, decoded, user);
    else if (action === 'team-members' || action === 'leaderboard') result = await handleTeamStats(req, res, db, decoded, user);
    else if (action === 'health-score' || action === 'audit-logs' || action === 'search') result = await handleUtils(req, res, db, decoded, user);
    else if (action === 'convert-idea' || action === 'update-preferences' || action === 'overdue-tasks') result = await handleActions(req, res, db, decoded, user);
    else if (action === 'export-stats') result = await handleExport(req, res, db, decoded, user);
    else if (action === 'feature-flags' || action === 'set-feature-flags') result = await handleFeatureFlags(req, res, db, decoded, user);
    else if (pathname.includes('archive-workspace')) result = await handleArchiveWorkspace(req, res, db, decoded, user);
    else if (action === 'member-permissions') result = await handleUpdateMemberPermissions(req, res, db, decoded, user);
    else if (action === 'rollback') result = await handleRollbackAction(req, res, db, decoded, user);
    else if (action === 'my-overview') result = await handleGetMyOverview(req, res, db, decoded, user);
    else if (action === 'log-time') result = await handleLogTime(req, res, db, decoded, user);
    else if (action === 'export-my-data') result = await handleExportMyData(req, res, db, decoded, user);
    else if (pathname.includes('create-attachment')) result = await handleCreateAttachment(req, res, db, decoded, user);
    else if (action === 'enable-2fa') result = await handleEnable2FA(req, res, db, decoded, user);
    else if (action === 'verify-2fa') result = await handleVerify2FA(req, res, db, decoded, user);
    else if (action === 'disable-2fa') result = await handleDisable2FA(req, res, db, decoded, user);
    else if (action === 'presence') result = await handlePresence(req, res, db, decoded, user);
    else if (action === 'analyze-ideas') result = await handleAnalyzeIdeas(req, res, db, decoded, user);
    else if (action === 'get-templates') result = await handleGetTemplates(req, res, db, decoded, user);
    else if (action === 'create-template') result = await handleCreateTemplate(req, res, db, decoded, user);
    else if (action === 'notify') result = await handleNotify(req, res, db, decoded, user);
    else if (action === 'weekly-digest') result = await handleWeeklyDigest(req, res, db, decoded, user);
    else if (action === 'score-idea') result = await handleScoreIdea(req, res, db, decoded, user);
    else if (action === 'generate-pitch') result = await handleGeneratePitch(req, res, db, decoded, user);
    else if (action === 'set-public') result = await handleSetPublic(req, res, db, decoded, user);
    else if (action === 'roadmap') result = await handleRoadmap(req, res, db, decoded, user);
    else if (action === 'link-telegram') result = await handleLinkTelegram(req, res, db, decoded, user);
    else if (action === 'telegram-webhook') result = await handleTelegramWebhook(req, res);
    else if (action === 'finances') result = await handleFinances(req, res, db, decoded, user);
    else if (action === 'runway') result = await handleRunway(req, res, db, decoded, user);
    else if (action === 'decision-log') result = await handleDecisionLog(req, res, db, decoded, user);
    else if (action === 'update-skills') result = await handleUpdateSkills(req, res, db, decoded, user);
    else if (action === 'stale-ideas') result = await handleStaleIdeas(req, res, db, decoded, user);
    else if (action === 'comment') result = await handleComment(req, res, db, decoded, user);
    else if (action === 'reputation') result = await handleReputation(req, res, db, decoded, user);
    else if (action === 'set-stage') result = await handleSetStage(req, res, db, decoded, user);
    else if (action === 'meeting-notes') result = await handleMeetingNotes(req, res, db, decoded, user);
    else if (action === 'sync-github') result = await handleSyncGithub(req, res, db, decoded, user);
    else if (action === 'onboarding-status') result = await handleOnboardingStatus(req, res, db, decoded, user);
    else if (action === 'vote-idea') result = await handleVoteIdea(req, res, db, decoded, user);
    else if (action === 'risk') result = await handleRisk(req, res, db, decoded, user);
    else if (action === 'activity-feed') result = await handleActivityFeed(req, res, db, decoded, user);
    else if (action === 'clone-workspace') result = await handleCloneWorkspace(req, res, db, decoded, user);
    else result = { status: 400, error: `Noto'g'ri endpoint: ${action}` };

    res.status(result.status || 200).json(result);
  } catch (error) {
    console.error('API_ERROR:', error && error.message);
    res.status(400).json({ error: (error && error.message) || 'Xatolik yuz berdi.' });
  }
};

// T17 - Cron (Vercel) dan chaqirish uchun eksport (authsiz ishlaydi)
module.exports.initAdmin = initAdmin;
module.exports.runWeeklyDigest = async () => {
  initAdmin();
  const db = admin.firestore();
  return handleWeeklyDigest({ method: 'POST', body: {} }, {}, db, { uid: 'cron' }, { role: 'admin' });
};
