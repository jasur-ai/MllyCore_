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

function generateCSV(data) {
  const headers = Object.keys(data[0] || {});
  const rows = data.map(item =>
    headers.map(header => {
      const value = item[header];
      const escaped = String(value || '').replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

// Export Stats
async function exportStats(db, decoded, type, teamId, format, period, user) {
  const isAdmin = user.role === 'admin';
  const isManager = user.role === 'manager';

  if (!isAdmin && !isManager) {
    throw new Error('Admin yoki Manager huquqi talab etiladi.');
  }

  let startDate, endDate;
  const now = new Date();
  endDate = new Date(now);

  if (period === 'week') {
    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === 'month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === 'quarter') {
    const quarter = Math.floor(now.getMonth() / 3);
    startDate = new Date(now.getFullYear(), quarter * 3, 1);
  } else if (period === 'year') {
    startDate = new Date(now.getFullYear(), 0, 1);
  } else {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  let exportData = [];

  if (type === 'admin' && isAdmin) {
    const teamsSnap = await db.collection('teams').get();
    const teams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    exportData = await Promise.all(teams.map(async (team) => {
      const tasksSnap = await db.collection('tasks').where('teamId', '==', team.id).get();
      const tasks = tasksSnap.docs.map(doc => doc.data());
      const completedTasks = tasks.filter(t => t.status === 'done').length;

      const reportsSnap = await db.collection('reports').where('teamId', '==', team.id).get();
      const reports = reportsSnap.docs.map(doc => doc.data());
      const onTimeReports = reports.filter(r => !r.isLate && r.status === 'approved').length;

      const membersSnap = await db.collection('teamMembers').where('teamId', '==', team.id).get();

      return {
        'Workspace Nomi': team.name,
        'A\'zolar Soni': membersSnap.size,
        'Jami Vazifalar': tasks.length,
        'Bajarilgan Vazifalar': completedTasks,
        'Bajarilish %': tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0,
        'Jami Hisobotlar': reports.length,
        'O\'z Vaqtida Hisobotlar': onTimeReports,
        'Hisobot Intizomi %': reports.length > 0 ? Math.round((onTimeReports / reports.length) * 100) : 0,
        'Health Score': team.healthScore || 0
      };
    }));
  } else if (type === 'manager' && (isAdmin || isManager)) {
    const assignedIds = isAdmin ? [] : (Array.isArray(user.assignedTeams) ? user.assignedTeams : []);
    const teamsSnap = isAdmin
      ? await db.collection('teams').get()
      : await Promise.all(assignedIds.map(id => db.collection('teams').doc(id).get()));

    const teams = teamsSnap
      .map(doc => doc.exists ? { id: doc.id, ...doc.data() } : null)
      .filter(Boolean);

    exportData = await Promise.all(teams.map(async (team) => {
      const tasksSnap = await db.collection('tasks').where('teamId', '==', team.id).get();
      const tasks = tasksSnap.docs.map(doc => doc.data());
      const completedTasks = tasks.filter(t => t.status === 'done').length;

      const reportsSnap = await db.collection('reports').where('teamId', '==', team.id).get();
      const reports = reportsSnap.docs.map(doc => doc.data());
      const onTimeReports = reports.filter(r => !r.isLate && r.status === 'approved').length;

      const membersSnap = await db.collection('teamMembers').where('teamId', '==', team.id).get();

      return {
        'Workspace Nomi': team.name,
        'A\'zolar Soni': membersSnap.size,
        'Jami Vazifalar': tasks.length,
        'Bajarilgan Vazifalar': completedTasks,
        'Bajarilish %': tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0,
        'Jami Hisobotlar': reports.length,
        'O\'z Vaqtida Hisobotlar': onTimeReports,
        'Hisobot Intizomi %': reports.length > 0 ? Math.round((onTimeReports / reports.length) * 100) : 0,
        'Health Score': team.healthScore || 0
      };
    }));
  } else {
    throw new Error('Noto\'g\'ri type yoki ruxsat yo\'q.');
  }

  let fileContent, contentType, fileName;

  if (format === 'csv') {
    fileContent = generateCSV(exportData);
    contentType = 'text/csv';
    fileName = `mllycore-stats-${period}-${Date.now()}.csv`;
  } else {
    fileContent = JSON.stringify({
      exportedAt: new Date().toISOString(),
      period,
      type,
      data: exportData
    }, null, 2);
    contentType = 'application/json';
    fileName = `mllycore-stats-${period}-${Date.now()}.json`;
  }

  const tempPath = path.join('/tmp', fileName);
  fs.writeFileSync(tempPath, fileContent);

  const fileBuffer = fs.readFileSync(tempPath);
  const base64File = fileBuffer.toString('base64');

  fs.unlinkSync(tempPath);

  return {
    success: true,
    fileName,
    contentType,
    data: base64File,
    recordCount: exportData.length,
    exportedAt: new Date().toISOString()
  };
}

// Get Member Stats
async function getMemberStats(db, decoded, teamId) {
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

  return memberStats;
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

    // Export Stats
    if (action === 'export-stats') {
      const { type, format, period } = req.query;
      const data = await exportStats(db, decoded, type, null, format, period, user);
      res.status(200).json(data);
      return;
    }

    // Member Stats
    if (action === 'member-stats') {
      const { teamId } = req.query;
      const data = await getMemberStats(db, decoded, teamId);
      res.status(200).json({ timestamp: new Date().toISOString(), ...data });
      return;
    }

    res.status(400).json({ error: 'Noto\'g\'ri action parametri.' });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Xatolik yuz berdi.' });
  }
};
