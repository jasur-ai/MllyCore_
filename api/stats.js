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

// Admin Stats
async function getAdminStats(db, decoded) {
  const usersSnap = await db.collection('users').get();
  const users = usersSnap.docs.map(doc => doc.data());
  const totalUsers = users.length;
  const verifiedUsers = users.filter(u => u.verified || u.emailVerified).length;
  const unverifiedPercent = totalUsers > 0 ? Math.round((1 - verifiedUsers / totalUsers) * 100) : 0;

  const teamsSnap = await db.collection('teams').get();
  const teams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const totalTeams = teams.length;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const newTeamsInMonth = teams.filter(t => {
    const createdAt = t.createdAt?.toMillis?.() || t.createdAtMs || 0;
    return createdAt > thirtyDaysAgo;
  }).length;

  const managers = users.filter(u => u.role === 'manager');
  const managerStats = await Promise.all(managers.map(async (mgr) => {
    const assignedIds = Array.isArray(mgr.assignedTeams) ? mgr.assignedTeams : [];
    const assignedTeams = assignedIds.map(tid => teams.find(t => t.id === tid)).filter(Boolean);
    
    let totalTasks = 0, completedTasks = 0, totalReports = 0, onTimeReports = 0;
    for (const team of assignedTeams) {
      const tasksSnap = await db.collection('tasks').where('teamId', '==', team.id).get();
      const tasks = tasksSnap.docs.map(doc => doc.data());
      totalTasks += tasks.length;
      completedTasks += tasks.filter(t => t.status === 'done').length;

      const reportsSnap = await db.collection('reports').where('teamId', '==', team.id).get();
      const reports = reportsSnap.docs.map(doc => doc.data());
      totalReports += reports.length;
      onTimeReports += reports.filter(r => !r.isLate && r.status === 'approved').length;
    }

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const punctualityRate = totalReports > 0 ? Math.round((onTimeReports / totalReports) * 100) : 0;

    return {
      managerId: mgr.id,
      name: mgr.name || mgr.email,
      email: mgr.email,
      assignedTeamsCount: assignedIds.length,
      completionRate,
      punctualityRate,
      score: (completionRate * 0.6 + punctualityRate * 0.4)
    };
  }));

  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const ideasSnap = await db.collection('ideas').get();
  const ideas = ideasSnap.docs.map(doc => doc.data());
  const newIdeasInDay = ideas.filter(i => {
    const createdAt = i.createdAt?.toMillis?.() || i.createdAtMs || 0;
    return createdAt > oneDayAgo;
  }).length;

  const tasksSnap = await db.collection('tasks').get();
  const tasks = tasksSnap.docs.map(doc => doc.data());
  const newTasksInDay = tasks.filter(t => {
    const createdAt = t.createdAt?.toMillis?.() || t.createdAtMs || 0;
    return createdAt > oneDayAgo;
  }).length;

  const auditSnap = await db.collection('auditLogs').orderBy('timestamp', 'desc').limit(1000).get();
  const auditLogs = auditSnap.docs.map(doc => doc.data());
  const userActionCounts = {};
  auditLogs.forEach(log => {
    const uid = log.userId;
    userActionCounts[uid] = (userActionCounts[uid] || 0) + 1;
  });
  const topActors = Object.entries(userActionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([uid, count]) => {
      const user = users.find(u => u.id === uid);
      return { userId: uid, name: user?.name || 'Unknown', actionCount: count };
    });

  const healthScores = teams.map(t => t.healthScore || 0);
  const avgHealthScore = healthScores.length > 0 
    ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length)
    : 0;

  return {
    platform: {
      totalUsers,
      verifiedUsers,
      unverifiedPercent,
      totalTeams,
      newTeamsInMonth,
      avgHealthScore
    },
    dailyActivity: {
      newIdeasInDay,
      newTasksInDay,
      estimatedDAU: Math.round(totalUsers * 0.3)
    },
    managers: managerStats.sort((a, b) => b.score - a.score),
    topActors
  };
}

// Manager Stats
async function getManagerStats(db, decoded, user) {
  const assignedIds = Array.isArray(user.assignedTeams) ? user.assignedTeams : [];

  if (assignedIds.length === 0) {
    return {
      managerId: decoded.uid,
      managerName: user.name || user.email,
      teams: [],
      summary: {
        totalTeams: 0,
        avgCompletionRate: 0,
        avgPunctualityRate: 0,
        avgChatActivity: 0,
        avgHealthScore: 0
      }
    };
  }

  const teamStats = await Promise.all(assignedIds.map(async (teamId) => {
    const teamDoc = await db.collection('teams').doc(teamId).get();
    if (!teamDoc.exists) return null;

    const team = { id: teamDoc.id, ...teamDoc.data() };

    const tasksSnap = await db.collection('tasks').where('teamId', '==', teamId).get();
    const tasks = tasksSnap.docs.map(doc => doc.data());
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const reportsSnap = await db.collection('reports').where('teamId', '==', teamId).get();
    const reports = reportsSnap.docs.map(doc => doc.data());
    const totalReports = reports.length;
    const onTimeReports = reports.filter(r => !r.isLate && r.status === 'approved').length;
    const punctualityRate = totalReports > 0 ? Math.round((onTimeReports / totalReports) * 100) : 0;

    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const messagesSnap = await db.collection('chatMessages').where('teamId', '==', teamId).get();
    const messages = messagesSnap.docs.map(doc => doc.data());
    const weeklyMessages = messages.filter(m => {
      const createdAt = m.createdAt?.toMillis?.() || m.createdAtMs || 0;
      return createdAt > oneWeekAgo;
    }).length;

    const overdueCount = tasks.filter(t => {
      const dueDate = t.dueDate?.toMillis?.() || t.dueDateMs || 0;
      return dueDate < Date.now() && t.status !== 'done';
    }).length;

    const membersSnap = await db.collection('teamMembers').where('teamId', '==', teamId).get();
    const membersCount = membersSnap.size;

    const healthScore = team.healthScore || 0;

    return {
      teamId,
      teamName: team.name,
      membersCount,
      completionRate,
      punctualityRate,
      weeklyMessages,
      overdueCount,
      healthScore,
      status: healthScore >= 70 ? 'healthy' : healthScore >= 50 ? 'warning' : 'critical'
    };
  }));

  const validStats = teamStats.filter(Boolean);

  const avgCompletionRate = validStats.length > 0
    ? Math.round(validStats.reduce((sum, t) => sum + t.completionRate, 0) / validStats.length)
    : 0;
  const avgPunctualityRate = validStats.length > 0
    ? Math.round(validStats.reduce((sum, t) => sum + t.punctualityRate, 0) / validStats.length)
    : 0;
  const avgChatActivity = validStats.length > 0
    ? Math.round(validStats.reduce((sum, t) => sum + t.weeklyMessages, 0) / validStats.length)
    : 0;
  const avgHealthScore = validStats.length > 0
    ? Math.round(validStats.reduce((sum, t) => sum + t.healthScore, 0) / validStats.length)
    : 0;

  return {
    managerId: decoded.uid,
    managerName: user.name || user.email,
    teams: validStats.sort((a, b) => b.healthScore - a.healthScore),
    summary: {
      totalTeams: validStats.length,
      avgCompletionRate,
      avgPunctualityRate,
      avgChatActivity,
      avgHealthScore
    }
  };
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

    // Admin Stats
    if (action === 'admin-stats') {
      if (user.role !== 'admin') {
        res.status(403).json({ error: 'Admin huquqi talab etiladi.' });
        return;
      }
      const stats = await getAdminStats(db, decoded);
      res.status(200).json({ timestamp: new Date().toISOString(), ...stats });
      return;
    }

    // Manager Stats
    if (action === 'manager-stats') {
      if (user.role !== 'manager') {
        res.status(403).json({ error: 'Manager huquqi talab etiladi.' });
        return;
      }
      const stats = await getManagerStats(db, decoded, user);
      res.status(200).json({ timestamp: new Date().toISOString(), ...stats });
      return;
    }

    res.status(400).json({ error: 'Noto\'g\'ri action parametri.' });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Statistika olishda xatolik.' });
  }
};
