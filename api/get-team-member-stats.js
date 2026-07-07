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
    const { teamId } = req.query;

    if (!teamId) {
      res.status(400).json({ error: 'teamId query parametri talab etiladi.' });
      return;
    }

    const db = admin.firestore();
    
    // Foydalanuvchi shu teamda team_lead ekanligini tekshirish
    const memberDoc = await db.collection('teamMembers').doc(`${teamId}_${decoded.uid}`).get();
    if (!memberDoc.exists || memberDoc.data().role !== 'team_lead') {
      res.status(403).json({ error: 'Siz bu teamning team lead\'i emassiz.' });
      return;
    }

    // Teamning barcha a'zolarini olish
    const membersSnap = await db.collection('teamMembers').where('teamId', '==', teamId).get();
    const members = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Har bir a'zo uchun statistika
    const memberStats = await Promise.all(members.map(async (member) => {
      const userId = member.userId;
      const userDoc = await db.collection('users').doc(userId).get();
      const user = userDoc.exists ? userDoc.data() : {};

      // Vazifalar statistikasi
      const tasksSnap = await db.collection('tasks')
        .where('teamId', '==', teamId)
        .where('assignedTo', '==', userId)
        .get();
      const tasks = tasksSnap.docs.map(doc => doc.data());
      const completedTasks = tasks.filter(t => t.status === 'done').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
      const overdueCount = tasks.filter(t => {
        const dueDate = t.dueDate?.toMillis?.() || t.dueDateMs || 0;
        return dueDate < Date.now() && t.status !== 'done';
      }).length;

      // O'rtacha bajarish vaqti (Lead Time)
      let avgLeadTime = 0;
      const completedWithTime = tasks.filter(t => t.status === 'done' && t.createdAt && t.completedAt);
      if (completedWithTime.length > 0) {
        const totalTime = completedWithTime.reduce((sum, t) => {
          const created = t.createdAt?.toMillis?.() || t.createdAtMs || 0;
          const completed = t.completedAt?.toMillis?.() || t.completedAtMs || 0;
          return sum + (completed - created);
        }, 0);
        avgLeadTime = Math.round(totalTime / completedWithTime.length / (1000 * 60 * 60)); // soatda
      }

      // Hisobotlar statistikasi
      const reportsSnap = await db.collection('reports')
        .where('teamId', '==', teamId)
        .where('submittedBy', '==', userId)
        .get();
      const reports = reportsSnap.docs.map(doc => doc.data());
      const onTimeReports = reports.filter(r => !r.isLate && r.status === 'approved').length;
      const lateReports = reports.filter(r => r.isLate).length;

      // G'oyalarga hissasi
      const ideasSnap = await db.collection('ideas')
        .where('teamId', '==', teamId)
        .where('createdBy', '==', userId)
        .get();
      const createdIdeas = ideasSnap.size;

      // Kommentlar soni
      const commentsSnap = await db.collection('ideaComments')
        .where('teamId', '==', teamId)
        .where('userId', '==', userId)
        .get();
      const commentCount = commentsSnap.size;

      // Chat faolligi (xabarlar soni)
      const messagesSnap = await db.collection('chatMessages')
        .where('teamId', '==', teamId)
        .where('userId', '==', userId)
        .get();
      const messageCount = messagesSnap.size;

      // Contribution score
      const score = (member.score || 0);

      return {
        userId,
        name: user.name || user.email || 'Unknown',
        email: user.email,
        role: member.role,
        avatar: user.avatar || 'U',
        tasks: {
          completed: completedTasks,
          inProgress: inProgressTasks,
          overdue: overdueCount,
          total: tasks.length,
          avgLeadTimeHours: avgLeadTime
        },
        reports: {
          onTime: onTimeReports,
          late: lateReports,
          total: reports.length
        },
        contributions: {
          ideasCreated: createdIdeas,
          comments: commentCount,
          messages: messageCount
        },
        score,
        joinedAt: member.joinedAt?.toMillis?.() || member.joinedAtMs || 0
      };
    }));

    // Reytingga ko'ra saralash
    memberStats.sort((a, b) => b.score - a.score);

    // Umumiy statistika
    const teamStats = {
      totalMembers: memberStats.length,
      avgTaskCompletion: memberStats.length > 0
        ? Math.round(memberStats.reduce((sum, m) => sum + (m.tasks.total > 0 ? (m.tasks.completed / m.tasks.total) * 100 : 0), 0) / memberStats.length)
        : 0,
      avgReportPunctuality: memberStats.length > 0
        ? Math.round(memberStats.reduce((sum, m) => sum + (m.reports.total > 0 ? (m.reports.onTime / m.reports.total) * 100 : 0), 0) / memberStats.length)
        : 0,
      totalMessages: memberStats.reduce((sum, m) => sum + m.contributions.messages, 0),
      totalIdeas: memberStats.reduce((sum, m) => sum + m.contributions.ideasCreated, 0)
    };

    res.status(200).json({
      teamId,
      timestamp: new Date().toISOString(),
      members: memberStats,
      teamStats
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Team a\'zolar statistikasi olishda xatolik.' });
  }
};
