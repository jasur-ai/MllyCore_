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

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    initAdmin();
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) throw new Error('Token yoq.');

    const decoded = await admin.auth().verifyIdToken(token);
    const db = admin.firestore();
    const caller = await db.collection('users').doc(decoded.uid).get();
    
    if (!caller.exists || caller.data().role !== 'admin') {
      res.status(403).json({ error: 'Admin huquqi talab etiladi.' });
      return;
    }

    // Jami foydalanuvchilar va emailVerified statistikasi
    const usersSnap = await db.collection('users').get();
    const users = usersSnap.docs.map(doc => doc.data());
    const totalUsers = users.length;
    const verifiedUsers = users.filter(u => u.verified || u.emailVerified).length;
    const unverifiedPercent = totalUsers > 0 ? Math.round((1 - verifiedUsers / totalUsers) * 100) : 0;

    // Jami teamlar va oxirgi 30 kunlik yangi teamlar
    const teamsSnap = await db.collection('teams').get();
    const teams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const totalTeams = teams.length;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const newTeamsInMonth = teams.filter(t => {
      const createdAt = t.createdAt?.toMillis?.() || t.createdAtMs || 0;
      return createdAt > thirtyDaysAgo;
    }).length;

    // Managerlar reytingi
    const managers = users.filter(u => u.role === 'manager');
    const managerStats = await Promise.all(managers.map(async (mgr) => {
      const assignedIds = Array.isArray(mgr.assignedTeams) ? mgr.assignedTeams : [];
      const assignedTeams = assignedIds.map(tid => teams.find(t => t.id === tid)).filter(Boolean);
      
      // Har bir manager uchun o'z teamlarining statistikasi
      let totalTasks = 0;
      let completedTasks = 0;
      let totalReports = 0;
      let onTimeReports = 0;

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

    // Tizim faolligi (DAU, yangi g'oyalar, vazifalar)
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

    // Audit logs asosida eng faol userlar
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

    // Health score o'rtachasi
    const healthScores = teams.map(t => t.healthScore || 0);
    const avgHealthScore = healthScores.length > 0 
      ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length)
      : 0;

    res.status(200).json({
      timestamp: new Date().toISOString(),
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
        estimatedDAU: Math.round(totalUsers * 0.3) // Taxminiy DAU
      },
      managers: managerStats.sort((a, b) => b.score - a.score),
      topActors
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Admin statistika olishda xatolik.' });
  }
};
