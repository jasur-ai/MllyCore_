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

async function calculateHealthScore(db, teamId) {
  const teamDoc = await db.collection('teams').doc(teamId).get();
  if (!teamDoc.exists) return null;

  const team = teamDoc.data();

  // 1. Task Completion Rate (40%)
  const tasksSnap = await db.collection('tasks').where('teamId', '==', teamId).get();
  const tasks = tasksSnap.docs.map(doc => doc.data());
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const taskCompletionRate = tasks.length > 0 ? (completedTasks / tasks.length) : 0;

  // 2. Report Punctuality (30%)
  const reportsSnap = await db.collection('reports').where('teamId', '==', teamId).get();
  const reports = reportsSnap.docs.map(doc => doc.data());
  const onTimeReports = reports.filter(r => !r.isLate && r.status === 'approved').length;
  const reportPunctuality = reports.length > 0 ? (onTimeReports / reports.length) : 0;

  // 3. Chat Activity (20%)
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const messagesSnap = await db.collection('chatMessages').where('teamId', '==', teamId).get();
  const messages = messagesSnap.docs.map(doc => doc.data());
  const weeklyMessages = messages.filter(m => {
    const createdAt = m.createdAt?.toMillis?.() || m.createdAtMs || 0;
    return createdAt > oneWeekAgo;
  }).length;

  // Normalize chat activity (0-1 scale, assuming 50+ messages/week is "active")
  const chatActivityNormalized = Math.min(weeklyMessages / 50, 1);

  // 4. Member Retention (10%)
  // Hisoblash: oxirgi 30 kunida a'zolar qo'shilgan vs o'chirilgan
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const membersSnap = await db.collection('teamMembers').where('teamId', '==', teamId).get();
  const members = membersSnap.docs.map(doc => doc.data());
  const currentMembers = members.length;
  const newMembers = members.filter(m => {
    const joinedAt = m.joinedAt?.toMillis?.() || m.joinedAtMs || 0;
    return joinedAt > thirtyDaysAgo;
  }).length;

  // Agar team yangi bo'lsa, retention 1 deb hisoblash
  const memberRetention = currentMembers > 0 ? Math.min(newMembers / Math.max(currentMembers, 1), 1) : 0;

  // Health Score formula (0-100)
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
    const { teamId } = req.query;
    const db = admin.firestore();

    if (!teamId) {
      res.status(400).json({ error: 'teamId query parametri talab etiladi.' });
      return;
    }

    // Foydalanuvchi shu teamga kirish huquqiga ega ekanligini tekshirish
    const memberDoc = await db.collection('teamMembers').doc(`${teamId}_${decoded.uid}`).get();
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    const user = userDoc.exists ? userDoc.data() : {};

    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'manager' && Array.isArray(user.assignedTeams) && user.assignedTeams.includes(teamId);
    const isMember = memberDoc.exists;

    if (!isAdmin && !isManager && !isMember) {
      res.status(403).json({ error: 'Siz bu teamga kira olmaysiz.' });
      return;
    }

    const healthScoreData = await calculateHealthScore(db, teamId);

    if (!healthScoreData) {
      res.status(404).json({ error: 'Team topilmadi.' });
      return;
    }

    // Health score'ni teams kolleksiyasiga ham saqlash
    await db.collection('teams').doc(teamId).update({
      healthScore: healthScoreData.healthScore,
      healthScoreUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({
      timestamp: new Date().toISOString(),
      ...healthScoreData
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Health score hisoblab chiqishda xatolik.' });
  }
};
