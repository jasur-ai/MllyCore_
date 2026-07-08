const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

/**
 * Firebase Admin Initialization
 * Barcha API endpointlarini bitta funksiyada jamlagan router.
 * Vercel Hobby plan limitini (12 ta funksiya) chetlab o'tish uchun yaratilgan.
 */
function initAdmin() {
  if (admin.apps.length) return admin.app();
  
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const localPath = path.join(process.cwd(), 'serviceAccountKey.json');
  
  let serviceAccount;
  
  if (raw) {
    try {
      // 1. JSON parse qilish
      const trimmed = raw.trim();
      let parsed;
      if (trimmed.startsWith('{')) {
        parsed = JSON.parse(trimmed);
      } else {
        // Base64 formatda bo'lsa
        parsed = JSON.parse(Buffer.from(trimmed, 'base64').toString('utf8'));
      }
      
      // 2. Private Key formatini to'g'rilash (Vercel \n muammosi)
      if (parsed.private_key && typeof parsed.private_key === 'string') {
        // Har qanday \\n ni haqiqiy yangi qatorga aylantiramiz
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
        
        // Agar kalit qo'shtirnoqlar ichida bo'lsa (ba'zan Vercel shunday qiladi)
        if (parsed.private_key.startsWith('"') && parsed.private_key.endsWith('"')) {
          parsed.private_key = parsed.private_key.substring(1, parsed.private_key.length - 1).replace(/\\n/g, '\n');
        }
      }
      
      serviceAccount = parsed;
    } catch (e) {
      console.error('FIREBASE_CONFIG_ERROR:', e.message);
      throw new Error(`Firebase Config Parse Error: ${e.message}`);
    }
  } else if (fs.existsSync(localPath)) {
    serviceAccount = require(localPath);
  } else {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON topilmadi. Vercel Environment Variables sozlang.');
  }

  // Kalit mavjudligini tekshirish
  if (!serviceAccount || !serviceAccount.private_key) {
    throw new Error('Firebase Private Key topilmadi. Kalitni to\'g\'ri formatda kiriting.');
  }

  try {
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
  } catch (initError) {
    console.error('FIREBASE_INIT_ERROR:', initError.message);
    throw initError;
  }
}

// Utility Functions
async function verifyAuth(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) throw new Error('Avtorizatsiya tokeni topilmadi.');
  try {
    return await admin.auth().verifyIdToken(token);
  } catch (e) {
    throw new Error('Token yaroqsiz yoki muddati o\'tgan.');
  }
}

async function getUserData(db, uid) {
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) throw new Error('Foydalanuvchi ma\'lumotlari bazadan topilmadi.');
  return userDoc.data();
}

// ============ API HANDLERS (Barcha funksiyalar birlashtirilgan) ============

async function handleAcceptInvite(req, res, db, decoded) {
  if (req.method !== 'POST') return { status: 405, error: 'Method not allowed' };
  const { inviteId } = req.body || {};
  if (!inviteId) return { status: 400, error: 'inviteId talab etiladi.' };
  const inviteDoc = await db.collection('invites').doc(inviteId).get();
  if (!inviteDoc.exists) return { status: 404, error: 'Taklif topilmadi.' };
  const invite = inviteDoc.data();
  if (invite.email !== decoded.email) return { status: 403, error: 'Bu taklif sizga emas.' };
  await db.collection('teamMembers').add({
    teamId: invite.teamId,
    userId: decoded.uid,
    role: invite.role || 'member',
    joinedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  await db.collection('invites').doc(inviteId).update({ accepted: true, acceptedAt: admin.firestore.FieldValue.serverTimestamp() });
  return { status: 200, success: true, message: 'Taklif qabul qilindi.' };
}

async function handleCreateWorkspace(req, res, db, decoded) {
  if (req.method !== 'POST') return { status: 405, error: 'Method not allowed' };
  const { name, description } = req.body || {};
  if (!name) return { status: 400, error: 'Team nomi talab etiladi.' };
  const teamRef = await db.collection('teams').add({
    name,
    description: description || '',
    createdBy: decoded.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    membersCount: 1,
    healthScore: 50
  });
  await db.collection('teamMembers').add({
    teamId: teamRef.id,
    userId: decoded.uid,
    role: 'team_lead',
    joinedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { status: 201, success: true, teamId: teamRef.id, message: 'Team muvaffaqiyatli yaratildi.' };
}

async function handleCreateTask(req, res, db, decoded) {
  if (req.method !== 'POST') return { status: 405, error: 'Method not allowed' };
  const { teamId, title, description, assignedTo, priority, dueDate } = req.body || {};
  if (!teamId || !title) return { status: 400, error: 'teamId va title talab etiladi.' };
  const taskRef = await db.collection('tasks').add({
    teamId,
    title,
    description: description || '',
    status: 'todo',
    priority: priority || 'medium',
    createdBy: decoded.uid,
    assignedTo: assignedTo || null,
    dueDate: dueDate ? new Date(dueDate) : null,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { status: 201, success: true, taskId: taskRef.id };
}

async function handleSendChat(req, res, db, decoded) {
  if (req.method !== 'POST') return { status: 405, error: 'Method not allowed' };
  const { teamId, text } = req.body || {};
  if (!teamId || !text) return { status: 400, error: 'teamId va text talab etiladi.' };
  const messageRef = await db.collection('chatMessages').add({
    teamId,
    userId: decoded.uid,
    text,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { status: 201, success: true, messageId: messageRef.id };
}

async function handleTaskAction(req, res, db, decoded) {
  if (req.method !== 'POST') return { status: 405, error: 'Method not allowed' };
  const { taskId, action, status } = req.body || {};
  if (!taskId || !action) return { status: 400, error: 'taskId va action talab etiladi.' };
  const updateData = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  if (status) updateData.status = status;
  if (action === 'complete') {
    updateData.status = 'done';
    updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();
  }
  await db.collection('tasks').doc(taskId).update(updateData);
  return { status: 200, success: true, message: 'Vazifa yangilandi.' };
}

async function handleStats(req, res, db, decoded, user) {
  const { action } = req.query;
  if (action === 'admin-stats') {
    if (user.role !== 'admin') return { status: 403, error: 'Admin huquqi talab etiladi.' };
    const teamsSnap = await db.collection('teams').get();
    const teams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const totalUsers = (await db.collection('users').get()).size;
    return {
      status: 200,
      platform: {
        totalUsers,
        totalTeams: teams.length,
        avgHealthScore: teams.length > 0 ? Math.round(teams.reduce((s, t) => s + (t.healthScore || 0), 0) / teams.length) : 0
      }
    };
  }
  if (action === 'manager-stats') {
    if (user.role !== 'manager') return { status: 403, error: 'Manager huquqi talab etiladi.' };
    const assignedIds = Array.isArray(user.assignedTeams) ? user.assignedTeams : [];
    const teams = await Promise.all(assignedIds.map(id => db.collection('teams').doc(id).get()));
    return {
      status: 200,
      managerId: decoded.uid,
      teams: teams.filter(t => t.exists).map(t => ({ id: t.id, ...t.data() }))
    };
  }
  return { status: 400, error: 'Noto\'g\'ri action.' };
}

async function handleTeamStats(req, res, db, decoded, user) {
  const { action, teamId } = req.query;
  if (!teamId) return { status: 400, error: 'teamId talab etiladi.' };
  if (action === 'member-stats') {
    const membersSnap = await db.collection('teamMembers').where('teamId', '==', teamId).get();
    const members = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { status: 200, teamId, members: members.map(m => ({ ...m, score: m.score || 0 })) };
  }
  if (action === 'leaderboard') {
    const membersSnap = await db.collection('teamMembers').where('teamId', '==', teamId).get();
    const members = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const sorted = members.sort((a, b) => (b.score || 0) - (a.score || 0));
    return { status: 200, teamId, leaderboard: sorted.map((m, i) => ({ ...m, rank: i + 1 })) };
  }
  return { status: 400, error: 'Noto\'g\'ri action.' };
}

async function handleUtils(req, res, db, decoded, user) {
  const { action, teamId, q } = req.query;
  if (action === 'health-score') {
    if (!teamId) return { status: 400, error: 'teamId talab etiladi.' };
    const tasksSnap = await db.collection('tasks').where('teamId', '==', teamId).get();
    const tasks = tasksSnap.docs.map(doc => doc.data());
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const taskCompletionRate = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;
    const healthScore = Math.round(taskCompletionRate * 0.4 + 50);
    return { status: 200, teamId, healthScore, components: { taskCompletionRate: Math.round(taskCompletionRate) } };
  }
  if (action === 'audit-logs') {
    if (user.role !== 'admin') return { status: 403, error: 'Admin huquqi talab etiladi.' };
    const logsSnap = await db.collection('auditLogs').orderBy('timestamp', 'desc').limit(50).get();
    const logs = logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return { status: 200, logs };
  }
  if (action === 'search') {
    if (!q || q.length < 2) return { status: 400, error: 'Qidiruv so\'zi kamida 2 ta belgi.' };
    const tasksSnap = await db.collection('tasks').limit(20).get();
    const tasks = tasksSnap.docs
      .map(doc => doc.data())
      .filter(t => (t.title || '').toLowerCase().includes(q.toLowerCase()));
    return { status: 200, results: { tasks } };
  }
  return { status: 400, error: 'Noto\'g\'ri action.' };
}

async function handleActions(req, res, db, decoded, user) {
  const { action } = req.query;
  if (action === 'convert-idea' && req.method === 'POST') {
    const { ideaId, teamId, title } = req.body || {};
    if (!ideaId || !teamId) return { status: 400, error: 'ideaId va teamId talab etiladi.' };
    const ideaDoc = await db.collection('ideas').doc(ideaId).get();
    if (!ideaDoc.exists) return { status: 404, error: 'Idea topilmadi.' };
    const taskRef = await db.collection('tasks').add({
      teamId,
      title: title || ideaDoc.data().title,
      status: 'todo',
      createdBy: decoded.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('ideas').doc(ideaId).update({
      convertedToTaskId: taskRef.id,
      convertedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { status: 200, success: true, taskId: taskRef.id };
  }
  if (action === 'update-preferences' && req.method === 'POST') {
    const { workingHours, timezone, emailDigestFrequency, telegramUsername } = req.body || {};
    const updateData = {};
    if (workingHours) updateData.workingHours = workingHours;
    if (timezone) updateData.timezone = timezone;
    if (emailDigestFrequency) updateData.emailDigestFrequency = emailDigestFrequency;
    if (telegramUsername) updateData.telegramUsername = telegramUsername;
    await db.collection('users').doc(decoded.uid).update(updateData);
    return { status: 200, success: true, message: 'Sozlamalar yangilandi.' };
  }
  if (action === 'overdue-tasks') {
    const tasksSnap = await db.collection('tasks').where('status', '!=', 'done').get();
    const tasks = tasksSnap.docs.map(doc => doc.data());
    const now = Date.now();
    const overdue = tasks.filter(t => {
      const dueDate = t.dueDate?.toMillis?.() || t.dueDateMs || 0;
      return dueDate > 0 && dueDate < now;
    });
    return { status: 200, tasks: overdue, totalOverdue: overdue.length };
  }
  return { status: 400, error: 'Noto\'g\'ri action.' };
}

async function handleExport(req, res, db, decoded, user) {
  const { action } = req.query;
  if (action === 'export-stats') {
    if (user.role !== 'admin' && user.role !== 'manager') return { status: 403, error: 'Admin yoki Manager huquqi talab etiladi.' };
    const teamsSnap = await db.collection('teams').get();
    const teams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const csv = ['Team Nomi,Health Score', ...teams.map(t => `"${t.name}",${t.healthScore || 0}`)].join('\n');
    return { status: 200, fileName: `stats-${Date.now()}.csv`, data: Buffer.from(csv).toString('base64') };
  }
  if (action === 'member-stats') {
    const tasksSnap = await db.collection('tasks').where('assignedTo', '==', decoded.uid).get();
    const tasks = tasksSnap.docs.map(doc => doc.data());
    const ideasSnap = await db.collection('ideas').where('userId', '==', decoded.uid).get();
    return {
      status: 200,
      userId: decoded.uid,
      score: user.score || 0,
      personalStats: {
        completedTasks: tasks.filter(t => t.status === 'done').length,
        totalTasks: tasks.length,
        ideasCreated: ideasSnap.size
      }
    };
  }
  return { status: 400, error: 'Noto\'g\'ri action.' };
}

// ============ MAIN ROUTER ============

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    initAdmin();
    const decoded = await verifyAuth(req);
    const db = admin.firestore();
    const user = await getUserData(db, decoded.uid);
    
    const pathname = req.url.split('?')[0];
    const queryString = req.url.split('?')[1] || '';
    const queryParams = new URLSearchParams(queryString);
    req.query = {};
    for (const [key, value] of queryParams) req.query[key] = value;
    
    const action = req.query.action || pathname.split('/').pop();
    
    let result;
    if (pathname.includes('accept-invite')) result = await handleAcceptInvite(req, res, db, decoded);
    else if (pathname.includes('create-workspace')) result = await handleCreateWorkspace(req, res, db, decoded);
    else if (pathname.includes('create-task')) result = await handleCreateTask(req, res, db, decoded);
    else if (pathname.includes('send-chat')) result = await handleSendChat(req, res, db, decoded);
    else if (pathname.includes('task-action')) result = await handleTaskAction(req, res, db, decoded);
    else if (action === 'admin-stats' || action === 'manager-stats') result = await handleStats(req, res, db, decoded, user);
    else if (action === 'member-stats' || action === 'leaderboard') result = await handleTeamStats(req, res, db, decoded, user);
    else if (action === 'health-score' || action === 'audit-logs' || action === 'search') result = await handleUtils(req, res, db, decoded, user);
    else if (action === 'convert-idea' || action === 'update-preferences' || action === 'overdue-tasks') result = await handleActions(req, res, db, decoded, user);
    else if (action === 'export-stats') result = await handleExport(req, res, db, decoded, user);
    else result = { status: 400, error: `Noma'lum endpoint: ${action}` };
    
    res.status(result.status || 200).json(result);
  } catch (error) {
    console.error('SERVER_ERROR:', error.message);
    res.status(400).json({ error: error.message || 'Serverda xatolik yuz berdi.' });
  }
};
