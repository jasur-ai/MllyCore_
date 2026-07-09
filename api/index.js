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

/* --------------------------- Handlers ----------------------------- */

async function handleCreateWorkspace(req, res, db, decoded, user) {
  const { name, description, leadEmail } = req.body || {};
  if (!name || !name.trim()) return { status: 400, error: "Workspace nomini kiriting." };

  let leadUid = decoded.uid;
  if (leadEmail && leadEmail.trim() && leadEmail.trim().toLowerCase() !== (user.email || '').toLowerCase()) {
    const snap = await db.collection('users').where('email', '==', leadEmail.trim().toLowerCase()).limit(1).get();
    if (!snap.empty) leadUid = snap.docs[0].id;
  }

  const teamRef = await db.collection('teams').add({
    name: name.trim(),
    description: description || '',
    createdByUserId: decoded.uid,
    createdBy: user.email || decoded.email,
    membersCount: 1,
    healthScore: 50,
    status: 'active',
    createdAt: SV(),
  });

  await db.collection('teamMembers').doc(teamRef.id + '_' + leadUid).set({
    teamId: teamRef.id,
    userId: leadUid,
    role: 'team_lead',
    joinedAt: SV(),
  });

  await audit(db, 'workspace_created', { teamId: teamRef.id, byUserId: decoded.uid, leadUserId: leadUid });
  return { status: 201, success: true, teamId: teamRef.id, message: 'Team yaratildi.' };
}

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

  const target = userSnap.docs[0];
  const secretKey = generateSecretKey();
  await db.collection('workspaceInvites').add({
    teamId,
    inviteeUserId: target.id,
    inviteeEmail: cleanEmail,
    inviterUserId: decoded.uid,
    secretKey,
    status: 'pending',
    createdAt: SV(),
  });

  await audit(db, 'member_invited', { teamId, inviteeUserId: target.id });
  return { status: 201, success: true, message: 'Taklif yuborildi.', secretKey };
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
    role: 'member',
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

  const ref = await db.collection('tasks').add({
    teamId,
    title,
    description: description || '',
    status: 'todo',
    priority: priority || 'medium',
    createdBy: decoded.uid,
    assignedTo: assignedTo || null,
    dueDate: dueDate ? new Date(dueDate) : null,
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
  if (action === 'complete') { update.status = 'done'; update.completedAt = SV(); }
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
    const { workingHours, timezone, emailDigestFrequency, telegramUsername } = req.body || {};
    const upd = {};
    if (workingHours) upd.workingHours = workingHours;
    if (timezone) upd.timezone = timezone;
    if (emailDigestFrequency) upd.emailDigestFrequency = emailDigestFrequency;
    if (telegramUsername) upd.telegramUsername = telegramUsername;
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

/* --------------------------- Router ------------------------------- */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

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
    else result = { status: 400, error: `Noto'g'ri endpoint: ${action}` };

    res.status(result.status || 200).json(result);
  } catch (error) {
    console.error('API_ERROR:', error && error.message);
    res.status(400).json({ error: (error && error.message) || 'Xatolik yuz berdi.' });
  }
};
