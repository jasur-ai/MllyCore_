const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Firebase Admin Initialization
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

// Utility Functions
async function verifyAuth(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) throw new Error('Token yoq.');
  return await admin.auth().verifyIdToken(token);
}

async function getUserData(db, uid) {
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) throw new Error('Foydalanuvchi topilmadi.');
  return userDoc.data();
}

// ============ LEGACY HANDLERS (Eski API fayllardan) ============

// accept-invite.js
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

// create-workspace.js
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

// create-task.js
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

// send-chat.js
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

// task-action.js
async function handleTaskAction(req, res, db, decoded) {
  if (req.method !== 'POST') return { status: 405, error: 'Method not allowed' };
  const { taskId, action, status } = req.body || {};
  if (!taskId || !action) return { status: 400, error: 'taskId va action talab etiladi.' };
  
  const updateData = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  if (status) updateData.status = status;
  if (action === 'complete') updateData.status = 'done';
  if (action === 'complete') updateData.completedAt = admin.firestore.FieldValue.serverTimestamp();
  
  await db.collection('tasks').doc(taskId).update(updateData);
  
  return { status: 200, success: true, message: 'Vazifa yangilandi.' };
}

// ============ NEW ANALYTICS HANDLERS ============

// stats.js - Admin & Manager Stats
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

// team-stats.js - Team Member Stats & Leaderboard
async function handleTeamStats(req, res, db, decoded, user) {
  const { action, teamId } = req.query;
  if (!teamId) return { status: 400, error: 'teamId talab etiladi.' };
  
  if (action === 'member-stats') {
    const membersSnap = await db.collection('teamMembers').where('teamId', '==', teamId).get();
    const members = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    return {
      status: 200,
      teamId,
      members: members.map(m => ({ ...m, score: m.score || 0 }))
    };
  }
  
  if (action === 'leaderboard') {
    const membersSnap = await db.collection('teamMembers').where('teamId', '==', teamId).get();
    const members = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const sorted = members.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    return {
      status: 200,
      teamId,
      leaderboard: sorted.map((m, i) => ({ ...m, rank: i + 1 }))
    };
  }
  
  return { status: 400, error: 'Noto\'g\'ri action.' };
}

// utils.js - Health Score, Audit Logs, Search
async function handleUtils(req, res, db, decoded, user) {
  const { action, teamId, q, limit } = req.query;
  
  if (action === 'health-score') {
    if (!teamId) return { status: 400, error: 'teamId talab etiladi.' };
    
    const tasksSnap = await db.collection('tasks').where('teamId', '==', teamId).get();
    const tasks = tasksSnap.docs.map(doc => doc.data());
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const taskCompletionRate = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;
    
    const healthScore = Math.round(taskCompletionRate * 0.4 + 50);
    
    return {
      status: 200,
      teamId,
      healthScore,
      components: { taskCompletionRate: Math.round(taskCompletionRate) }
    };
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

// actions.js - Convert Idea, Update Preferences, Overdue Tasks
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
    const { workingHours, timezone } = req.body || {};
    const updateData = {};
    if (workingHours) updateData.workingHours = workingHours;
    if (timezone) updateData.timezone = timezone;
    
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

// export.js - Export Stats & Member Stats
async function handleExport(req, res, db, decoded, user) {
  const { action } = req.query;
  
  if (action === 'export-stats') {
    if (user.role !== 'admin' && user.role !== 'manager') {
      return { status: 403, error: 'Admin yoki Manager huquqi talab etiladi.' };
    }
    
    const teamsSnap = await db.collection('teams').get();
    const teams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const exportData = teams.map(team => ({
      'Team Nomi': team.name,
      'Health Score': team.healthScore || 0
    }));
    
    const csv = ['Team Nomi,Health Score', ...exportData.map(r => `"${r['Team Nomi']}",${r['Health Score']}`)].join('\n');
    const base64 = Buffer.from(csv).toString('base64');
    
    return { status: 200, fileName: `stats-${Date.now()}.csv`, data: base64 };
  }
  
  if (action === 'member-stats') {
    const { teamId } = req.query;
    const tasksSnap = await db.collection('tasks').where('assignedTo', '==', decoded.uid).get();
    const tasks = tasksSnap.docs.map(doc => doc.data());
    
    return {
      status: 200,
      userId: decoded.uid,
      personalStats: {
        completedTasks: tasks.filter(t => t.status === 'done').length,
        totalTasks: tasks.length
      }
    };
  }
  
  return { status: 400, error: 'Noto\'g\'ri action.' };
}

// ============ MAIN ROUTER ============

module.exports = async (req, res) => {
  try {
    initAdmin();
    const decoded = await verifyAuth(req);
    const db = admin.firestore();
    const user = await getUserData(db, decoded.uid);
    
    const pathname = req.url.split('?')[0];
    const queryString = req.url.split('?')[1] || '';
    const queryParams = new URLSearchParams(queryString);
    
    // Convert query params to object
    req.query = {};
    for (const [key, value] of queryParams) {
      req.query[key] = value;
    }
    
    // Route based on pathname or action parameter
    const action = req.query.action || pathname.split('/').pop();
    
    // Legacy endpoints
    if (pathname.includes('accept-invite')) {
      const result = await handleAcceptInvite(req, res, db, decoded);
      return res.status(result.status).json(result);
    }
    if (pathname.includes('create-workspace')) {
      const result = await handleCreateWorkspace(req, res, db, decoded);
      return res.status(result.status).json(result);
    }
    if (pathname.includes('create-task')) {
      const result = await handleCreateTask(req, res, db, decoded);
      return res.status(result.status).json(result);
    }
    if (pathname.includes('send-chat')) {
      const result = await handleSendChat(req, res, db, decoded);
      return res.status(result.status).json(result);
    }
    if (pathname.includes('task-action')) {
      const result = await handleTaskAction(req, res, db, decoded);
      return res.status(result.status).json(result);
    }
    
    // New analytics endpoints
    if (action === 'admin-stats' || action === 'manager-stats') {
      const result = await handleStats(req, res, db, decoded, user);
      return res.status(result.status).json(result);
    }
    if (action === 'member-stats' || action === 'leaderboard') {
      const result = await handleTeamStats(req, res, db, decoded, user);
      return res.status(result.status).json(result);
    }
    if (action === 'health-score' || action === 'audit-logs' || action === 'search') {
      const result = await handleUtils(req, res, db, decoded, user);
      return res.status(result.status).json(result);
    }
    if (action === 'convert-idea' || action === 'update-preferences' || action === 'overdue-tasks') {
      const result = await handleActions(req, res, db, decoded, user);
      return res.status(result.status).json(result);
    }
    if (action === 'export-stats') {
      const result = await handleExport(req, res, db, decoded, user);
      return res.status(result.status).json(result);
    }
    
    res.status(400).json({ error: 'Noto\'g\'ri endpoint.' });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Xatolik yuz berdi.' });
  }
};
