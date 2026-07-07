const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

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

// Health Score
async function calculateHealthScore(db, teamId) {
  const teamDoc = await db.collection('teams').doc(teamId).get();
  if (!teamDoc.exists) return null;

  const team = teamDoc.data();

  const tasksSnap = await db.collection('tasks').where('teamId', '==', teamId).get();
  const tasks = tasksSnap.docs.map(doc => doc.data());
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const taskCompletionRate = tasks.length > 0 ? (completedTasks / tasks.length) : 0;

  const reportsSnap = await db.collection('reports').where('teamId', '==', teamId).get();
  const reports = reportsSnap.docs.map(doc => doc.data());
  const onTimeReports = reports.filter(r => !r.isLate && r.status === 'approved').length;
  const reportPunctuality = reports.length > 0 ? (onTimeReports / reports.length) : 0;

  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const messagesSnap = await db.collection('chatMessages').where('teamId', '==', teamId).get();
  const messages = messagesSnap.docs.map(doc => doc.data());
  const weeklyMessages = messages.filter(m => {
    const createdAt = m.createdAt?.toMillis?.() || m.createdAtMs || 0;
    return createdAt > oneWeekAgo;
  }).length;

  const chatActivityNormalized = Math.min(weeklyMessages / 50, 1);

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const membersSnap = await db.collection('teamMembers').where('teamId', '==', teamId).get();
  const members = membersSnap.docs.map(doc => doc.data());
  const currentMembers = members.length;
  const newMembers = members.filter(m => {
    const joinedAt = m.joinedAt?.toMillis?.() || m.joinedAtMs || 0;
    return joinedAt > thirtyDaysAgo;
  }).length;

  const memberRetention = currentMembers > 0 ? Math.min(newMembers / Math.max(currentMembers, 1), 1) : 0;

  const healthScore = Math.round(
    (taskCompletionRate * 0.4 + reportPunctuality * 0.3 + chatActivityNormalized * 0.2 + memberRetention * 0.1) * 100
  );

  return {
    teamId,
    teamName: team.name,
    healthScore,
    components: {
      taskCompletionRate: Math.round(taskCompletionRate * 100),
      reportPunctuality: Math.round(reportPunctuality * 100),
      chatActivityScore: Math.round(chatActivityNormalized * 100),
      memberRetention: Math.round(memberRetention * 100)
    },
    status: healthScore >= 70 ? 'healthy' : healthScore >= 50 ? 'warning' : 'critical',
    metrics: {
      totalTasks: tasks.length,
      completedTasks,
      totalReports: reports.length,
      onTimeReports,
      weeklyMessages,
      currentMembers,
      newMembersInMonth: newMembers
    }
  };
}

// Audit Logs
async function getAuditLogs(db, decoded, limit, actionType, userId, startDate, endDate, startAfter) {
  const pageLimit = Math.min(parseInt(limit) || 50, 200);
  let query = db.collection('auditLogs').orderBy('timestamp', 'desc');

  if (actionType) {
    query = query.where('action', '==', actionType);
  }
  if (userId) {
    query = query.where('userId', '==', userId);
  }

  if (startDate) {
    const start = new Date(startDate);
    query = query.where('timestamp', '>=', start);
  }
  if (endDate) {
    const end = new Date(endDate);
    query = query.where('timestamp', '<=', end);
  }

  if (startAfter) {
    const startDoc = await db.collection('auditLogs').doc(startAfter).get();
    if (startDoc.exists) {
      query = query.startAfter(startDoc);
    }
  }

  query = query.limit(pageLimit + 1);

  const snapshot = await query.get();
  const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const hasMore = docs.length > pageLimit;
  const logs = docs.slice(0, pageLimit);
  const nextCursor = hasMore && logs.length > 0 ? logs[logs.length - 1].id : null;

  const enrichedLogs = await Promise.all(logs.map(async (log) => {
    let userName = 'Unknown';
    if (log.userId) {
      const userDoc = await db.collection('users').doc(log.userId).get();
      if (userDoc.exists) {
        userName = userDoc.data().name || userDoc.data().email || 'Unknown';
      }
    }
    return { ...log, userName };
  }));

  return {
    logs: enrichedLogs,
    pagination: { limit: pageLimit, hasMore, nextCursor },
    filters: { actionType: actionType || null, userId: userId || null, startDate: startDate || null, endDate: endDate || null }
  };
}

// Global Search
function matchesQuery(text, query) {
  return text.toLowerCase().includes(query.toLowerCase());
}

async function getSearchResults(db, decoded, q, type, limit, user) {
  if (!q || q.trim().length < 2) {
    throw new Error('Qidiruv so\'zi kamida 2 ta belgi bo\'lishi kerak.');
  }

  const query = q.trim().toLowerCase();
  const pageLimit = Math.min(parseInt(limit) || 20, 100);

  const memberSnap = await db.collection('teamMembers').where('userId', '==', decoded.uid).get();
  const memberTeams = memberSnap.docs.map(doc => doc.data().teamId);

  const isAdmin = user.role === 'admin';
  const isManager = user.role === 'manager';

  let results = { tasks: [], ideas: [], messages: [], teams: [] };

  if (type === 'all' || type === 'tasks') {
    let tasksQuery = db.collection('tasks');
    if (!isAdmin) {
      tasksQuery = tasksQuery.where('teamId', 'in', memberTeams.length > 0 ? memberTeams : ['__none__']);
    }
    const tasksSnap = await tasksQuery.limit(pageLimit * 2).get();
    const tasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    results.tasks = tasks
      .filter(t => matchesQuery(t.title || '', query) || matchesQuery(t.description || '', query))
      .slice(0, pageLimit)
      .map(t => ({
        id: t.id,
        type: 'task',
        title: t.title,
        description: t.description?.substring(0, 100),
        teamId: t.teamId,
        status: t.status,
        priority: t.priority,
        createdAt: t.createdAt?.toMillis?.() || t.createdAtMs || 0
      }));
  }

  if (type === 'all' || type === 'ideas') {
    let ideasQuery = db.collection('ideas');
    if (!isAdmin) {
      ideasQuery = ideasQuery.where('teamId', 'in', memberTeams.length > 0 ? memberTeams : ['__none__']);
    }
    const ideasSnap = await ideasQuery.limit(pageLimit * 2).get();
    const ideas = ideasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    results.ideas = ideas
      .filter(i => matchesQuery(i.title || '', query) || matchesQuery(i.description || '', query))
      .slice(0, pageLimit)
      .map(i => ({
        id: i.id,
        type: 'idea',
        title: i.title,
        description: i.description?.substring(0, 100),
        teamId: i.teamId,
        createdBy: i.createdBy,
        createdAt: i.createdAt?.toMillis?.() || i.createdAtMs || 0,
        convertedToTaskId: i.convertedToTaskId || null
      }));
  }

  if (type === 'all' || type === 'messages') {
    let messagesQuery = db.collection('chatMessages');
    if (!isAdmin) {
      messagesQuery = messagesQuery.where('teamId', 'in', memberTeams.length > 0 ? memberTeams : ['__none__']);
    }
    const messagesSnap = await messagesQuery.limit(pageLimit * 2).get();
    const messages = messagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    results.messages = messages
      .filter(m => matchesQuery(m.text || '', query))
      .slice(0, pageLimit)
      .map(m => ({
        id: m.id,
        type: 'message',
        text: m.text?.substring(0, 100),
        teamId: m.teamId,
        userId: m.userId,
        createdAt: m.createdAt?.toMillis?.() || m.createdAtMs || 0
      }));
  }

  if ((type === 'all' || type === 'teams') && (isAdmin || isManager)) {
    const teamsSnap = await db.collection('teams').limit(pageLimit * 2).get();
    const teams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    results.teams = teams
      .filter(t => matchesQuery(t.name || '', query) || matchesQuery(t.description || '', query))
      .slice(0, pageLimit)
      .map(t => ({
        id: t.id,
        type: 'team',
        name: t.name,
        description: t.description?.substring(0, 100),
        membersCount: t.membersCount || 0,
        createdAt: t.createdAt?.toMillis?.() || t.createdAtMs || 0
      }));
  }

  const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

  return { query, totalResults, results, filters: { type: type || 'all', limit: pageLimit } };
}

// Main Router
module.exports = async (req, res) => {
  try {
    initAdmin();
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) throw new Error('Token yoq.');

    const decoded = await admin.auth().verifyIdToken(token);
    const db = admin.firestore();
    const caller = await db.collection('users').doc(decoded.uid).get();
    
    if (!caller.exists) {
      res.status(403).json({ error: 'Foydalanuvchi topilmadi.' });
      return;
    }

    const user = caller.data();
    const { action } = req.query;

    // Health Score
    if (action === 'health-score') {
      const { teamId } = req.query;
      if (!teamId) {
        res.status(400).json({ error: 'teamId talab etiladi.' });
        return;
      }
      const data = await calculateHealthScore(db, teamId);
      if (!data) {
        res.status(404).json({ error: 'Team topilmadi.' });
        return;
      }
      await db.collection('teams').doc(teamId).update({
        healthScore: data.healthScore,
        healthScoreUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.status(200).json({ timestamp: new Date().toISOString(), ...data });
      return;
    }

    // Audit Logs
    if (action === 'audit-logs') {
      if (user.role !== 'admin') {
        res.status(403).json({ error: 'Admin huquqi talab etiladi.' });
        return;
      }
      const { limit, actionType, userId, startDate, endDate, startAfter } = req.query;
      const data = await getAuditLogs(db, decoded, limit, actionType, userId, startDate, endDate, startAfter);
      res.status(200).json({ timestamp: new Date().toISOString(), ...data });
      return;
    }

    // Search
    if (action === 'search') {
      const { q, type, limit } = req.query;
      const data = await getSearchResults(db, decoded, q, type, limit, user);
      res.status(200).json({ timestamp: new Date().toISOString(), ...data });
      return;
    }

    res.status(400).json({ error: 'Noto\'g\'ri action parametri.' });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Xatolik yuz berdi.' });
  }
};
