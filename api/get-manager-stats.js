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
    
    if (!caller.exists || caller.data().role !== 'manager') {
      res.status(403).json({ error: 'Manager huquqi talab etiladi.' });
      return;
    }

    const managerData = caller.data();
    const assignedIds = Array.isArray(managerData.assignedTeams) ? managerData.assignedTeams : [];

    if (assignedIds.length === 0) {
      return res.status(200).json({
        managerId: decoded.uid,
        managerName: managerData.name || managerData.email,
        teams: [],
        summary: {
          totalTeams: 0,
          avgCompletionRate: 0,
          avgPunctualityRate: 0,
          avgChatActivity: 0,
          avgHealthScore: 0
        }
      });
    }

    // Manager uchun biriktirilgan har bir teamning statistikasi
    const teamStats = await Promise.all(assignedIds.map(async (teamId) => {
      const teamDoc = await db.collection('teams').doc(teamId).get();
      if (!teamDoc.exists) return null;

      const team = { id: teamDoc.id, ...teamDoc.data() };

      // Vazifalar statistikasi
      const tasksSnap = await db.collection('tasks').where('teamId', '==', teamId).get();
      const tasks = tasksSnap.docs.map(doc => doc.data());
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'done').length;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Hisobotlar statistikasi
      const reportsSnap = await db.collection('reports').where('teamId', '==', teamId).get();
      const reports = reportsSnap.docs.map(doc => doc.data());
      const totalReports = reports.length;
      const onTimeReports = reports.filter(r => !r.isLate && r.status === 'approved').length;
      const punctualityRate = totalReports > 0 ? Math.round((onTimeReports / totalReports) * 100) : 0;

      // Chat faolligi (haftalik xabarlar soni)
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const messagesSnap = await db.collection('chatMessages').where('teamId', '==', teamId).get();
      const messages = messagesSnap.docs.map(doc => doc.data());
      const weeklyMessages = messages.filter(m => {
        const createdAt = m.createdAt?.toMillis?.() || m.createdAtMs || 0;
        return createdAt > oneWeekAgo;
      }).length;

      // Kechikkan vazifalar
      const overdueCount = tasks.filter(t => {
        const dueDate = t.dueDate?.toMillis?.() || t.dueDateMs || 0;
        return dueDate < Date.now() && t.status !== 'done';
      }).length;

      // A'zolar soni
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

    // Umumiy statistika
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

    res.status(200).json({
      managerId: decoded.uid,
      managerName: managerData.name || managerData.email,
      timestamp: new Date().toISOString(),
      teams: validStats.sort((a, b) => b.healthScore - a.healthScore),
      summary: {
        totalTeams: validStats.length,
        avgCompletionRate,
        avgPunctualityRate,
        avgChatActivity,
        avgHealthScore
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Manager statistika olishda xatolik.' });
  }
};
