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
    const db = admin.firestore();

    // Foydalanuvchi profili
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    const user = userDoc.exists ? userDoc.data() : {};

    let memberStats = {
      userId: decoded.uid,
      name: user.name || user.email,
      email: user.email,
      avatar: user.avatar || 'U',
      score: user.score || 0,
      personalStats: {
        completedTasks: 0,
        inProgressTasks: 0,
        overdueTasks: 0,
        totalTasks: 0,
        avgLeadTimeHours: 0,
        onTimeReports: 0,
        lateReports: 0,
        totalReports: 0,
        ideasCreated: 0,
        comments: 0,
        messages: 0
      },
      teamComparison: {}
    };

    if (teamId) {
      // Agar teamId berilgan bo'lsa, faqat shu teamda statistika
      const tasksSnap = await db.collection('tasks')
        .where('teamId', '==', teamId)
        .where('assignedTo', '==', decoded.uid)
        .get();
      const tasks = tasksSnap.docs.map(doc => doc.data());
      const completedTasks = tasks.filter(t => t.status === 'done').length;
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
      const overdueTasks = tasks.filter(t => {
        const dueDate = t.dueDate?.toMillis?.() || t.dueDateMs || 0;
        return dueDate < Date.now() && t.status !== 'done';
      }).length;

      let avgLeadTime = 0;
      const completedWithTime = tasks.filter(t => t.status === 'done' && t.createdAt && t.completedAt);
      if (completedWithTime.length > 0) {
        const totalTime = completedWithTime.reduce((sum, t) => {
          const created = t.createdAt?.toMillis?.() || t.createdAtMs || 0;
          const completed = t.completedAt?.toMillis?.() || t.completedAtMs || 0;
          return sum + (completed - created);
        }, 0);
        avgLeadTime = Math.round(totalTime / completedWithTime.length / (1000 * 60 * 60));
      }

      const reportsSnap = await db.collection('reports')
        .where('teamId', '==', teamId)
        .where('submittedBy', '==', decoded.uid)
        .get();
      const reports = reportsSnap.docs.map(doc => doc.data());
      const onTimeReports = reports.filter(r => !r.isLate && r.status === 'approved').length;
      const lateReports = reports.filter(r => r.isLate).length;

      const ideasSnap = await db.collection('ideas')
        .where('teamId', '==', teamId)
        .where('createdBy', '==', decoded.uid)
        .get();

      const commentsSnap = await db.collection('ideaComments')
        .where('teamId', '==', teamId)
        .where('userId', '==', decoded.uid)
        .get();

      const messagesSnap = await db.collection('chatMessages')
        .where('teamId', '==', teamId)
        .where('userId', '==', decoded.uid)
        .get();

      memberStats.personalStats = {
        completedTasks,
        inProgressTasks,
        overdueTasks,
        totalTasks: tasks.length,
        avgLeadTimeHours: avgLeadTime,
        onTimeReports,
        lateReports,
        totalReports: reports.length,
        ideasCreated: ideasSnap.size,
        comments: commentsSnap.size,
        messages: messagesSnap.size
      };

      // Team o'rtachasi bilan taqqoslash
      const allMembersSnap = await db.collection('teamMembers').where('teamId', '==', teamId).get();
      const allMembers = allMembersSnap.docs.map(doc => doc.data());

      let teamAvgCompletion = 0;
      let teamAvgLeadTime = 0;
      let teamAvgMessages = 0;

      for (const member of allMembers) {
        const mTasksSnap = await db.collection('tasks')
          .where('teamId', '==', teamId)
          .where('assignedTo', '==', member.userId)
          .get();
        const mTasks = mTasksSnap.docs.map(doc => doc.data());
        const mCompleted = mTasks.filter(t => t.status === 'done').length;
        teamAvgCompletion += mTasks.length > 0 ? (mCompleted / mTasks.length) * 100 : 0;

        const mCompletedWithTime = mTasks.filter(t => t.status === 'done' && t.createdAt && t.completedAt);
        if (mCompletedWithTime.length > 0) {
          const totalTime = mCompletedWithTime.reduce((sum, t) => {
            const created = t.createdAt?.toMillis?.() || t.createdAtMs || 0;
            const completed = t.completedAt?.toMillis?.() || t.completedAtMs || 0;
            return sum + (completed - created);
          }, 0);
          teamAvgLeadTime += Math.round(totalTime / mCompletedWithTime.length / (1000 * 60 * 60));
        }

        const mMessagesSnap = await db.collection('chatMessages')
          .where('teamId', '==', teamId)
          .where('userId', '==', member.userId)
          .get();
        teamAvgMessages += mMessagesSnap.size;
      }

      teamAvgCompletion = Math.round(teamAvgCompletion / allMembers.length);
      teamAvgLeadTime = Math.round(teamAvgLeadTime / allMembers.length);
      teamAvgMessages = Math.round(teamAvgMessages / allMembers.length);

      const myCompletion = memberStats.personalStats.totalTasks > 0
        ? Math.round((memberStats.personalStats.completedTasks / memberStats.personalStats.totalTasks) * 100)
        : 0;

      memberStats.teamComparison = {
        myCompletionRate: myCompletion,
        teamAvgCompletionRate: teamAvgCompletion,
        completionDiff: myCompletion - teamAvgCompletion,
        myAvgLeadTime: memberStats.personalStats.avgLeadTimeHours,
        teamAvgLeadTime,
        leadTimeDiff: teamAvgLeadTime - memberStats.personalStats.avgLeadTimeHours,
        myMessages: memberStats.personalStats.messages,
        teamAvgMessages,
        messageDiff: memberStats.personalStats.messages - teamAvgMessages
      };
    } else {
      // Barcha teamlardagi statistika
      const allTasksSnap = await db.collection('tasks')
        .where('assignedTo', '==', decoded.uid)
        .get();
      const allTasks = allTasksSnap.docs.map(doc => doc.data());
      const completedTasks = allTasks.filter(t => t.status === 'done').length;
      const inProgressTasks = allTasks.filter(t => t.status === 'in_progress').length;
      const overdueTasks = allTasks.filter(t => {
        const dueDate = t.dueDate?.toMillis?.() || t.dueDateMs || 0;
        return dueDate < Date.now() && t.status !== 'done';
      }).length;

      let avgLeadTime = 0;
      const completedWithTime = allTasks.filter(t => t.status === 'done' && t.createdAt && t.completedAt);
      if (completedWithTime.length > 0) {
        const totalTime = completedWithTime.reduce((sum, t) => {
          const created = t.createdAt?.toMillis?.() || t.createdAtMs || 0;
          const completed = t.completedAt?.toMillis?.() || t.completedAtMs || 0;
          return sum + (completed - created);
        }, 0);
        avgLeadTime = Math.round(totalTime / completedWithTime.length / (1000 * 60 * 60));
      }

      const allReportsSnap = await db.collection('reports')
        .where('submittedBy', '==', decoded.uid)
        .get();
      const allReports = allReportsSnap.docs.map(doc => doc.data());
      const onTimeReports = allReports.filter(r => !r.isLate && r.status === 'approved').length;
      const lateReports = allReports.filter(r => r.isLate).length;

      const allIdeasSnap = await db.collection('ideas')
        .where('createdBy', '==', decoded.uid)
        .get();

      const allCommentsSnap = await db.collection('ideaComments')
        .where('userId', '==', decoded.uid)
        .get();

      const allMessagesSnap = await db.collection('chatMessages')
        .where('userId', '==', decoded.uid)
        .get();

      memberStats.personalStats = {
        completedTasks,
        inProgressTasks,
        overdueTasks,
        totalTasks: allTasks.length,
        avgLeadTimeHours: avgLeadTime,
        onTimeReports,
        lateReports,
        totalReports: allReports.length,
        ideasCreated: allIdeasSnap.size,
        comments: allCommentsSnap.size,
        messages: allMessagesSnap.size
      };
    }

    res.status(200).json({
      timestamp: new Date().toISOString(),
      ...memberStats
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Member statistika olishda xatolik.' });
  }
};
