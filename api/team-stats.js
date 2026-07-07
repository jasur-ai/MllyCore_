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

// Get Team Member Stats
async function getTeamMemberStats(db, decoded, teamId) {
  const memberDoc = await db.collection('teamMembers').doc(`${teamId}_${decoded.uid}`).get();
  if (!memberDoc.exists || memberDoc.data().role !== 'team_lead') {
    throw new Error('Siz bu teamning team lead\'i emassiz.');
  }

  const membersSnap = await db.collection('teamMembers').where('teamId', '==', teamId).get();
  const members = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const memberStats = await Promise.all(members.map(async (member) => {
    const userId = member.userId;
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.exists ? userDoc.data() : {};

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
      .where('submittedBy', '==', userId)
      .get();
    const reports = reportsSnap.docs.map(doc => doc.data());
    const onTimeReports = reports.filter(r => !r.isLate && r.status === 'approved').length;
    const lateReports = reports.filter(r => r.isLate).length;

    const ideasSnap = await db.collection('ideas')
      .where('teamId', '==', teamId)
      .where('createdBy', '==', userId)
      .get();
    const createdIdeas = ideasSnap.size;

    const commentsSnap = await db.collection('ideaComments')
      .where('teamId', '==', teamId)
      .where('userId', '==', userId)
      .get();
    const commentCount = commentsSnap.size;

    const messagesSnap = await db.collection('chatMessages')
      .where('teamId', '==', teamId)
      .where('userId', '==', userId)
      .get();
    const messageCount = messagesSnap.size;

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

  memberStats.sort((a, b) => b.score - a.score);

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

  return { teamId, members: memberStats, teamStats };
}

// Get Leaderboard
async function getLeaderboard(db, decoded, teamId) {
  const memberDoc = await db.collection('teamMembers').doc(`${teamId}_${decoded.uid}`).get();
  const userDoc = await db.collection('users').doc(decoded.uid).get();
  const user = userDoc.exists ? userDoc.data() : {};

  const isAdmin = user.role === 'admin';
  const isManager = user.role === 'manager' && Array.isArray(user.assignedTeams) && user.assignedTeams.includes(teamId);
  const isMember = memberDoc.exists;

  if (!isAdmin && !isManager && !isMember) {
    throw new Error('Siz bu teamga kira olmaysiz.');
  }

  const membersSnap = await db.collection('teamMembers').where('teamId', '==', teamId).get();
  const members = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const leaderboard = await Promise.all(members.map(async (member) => {
    const userDoc = await db.collection('users').doc(member.userId).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    const score = member.score || userData.score || 0;

    const tasksSnap = await db.collection('tasks')
      .where('teamId', '==', teamId)
      .where('assignedTo', '==', member.userId)
      .get();
    const tasks = tasksSnap.docs.map(doc => doc.data());
    const completedTasks = tasks.filter(t => t.status === 'done').length;

    const reportsSnap = await db.collection('reports')
      .where('teamId', '==', teamId)
      .where('submittedBy', '==', member.userId)
      .get();
    const onTimeReports = reportsSnap.docs
      .map(doc => doc.data())
      .filter(r => !r.isLate && r.status === 'approved').length;

    return {
      userId: member.userId,
      name: userData.name || userData.email || 'Unknown',
      email: userData.email,
      avatar: userData.avatar || 'U',
      role: member.role,
      score,
      completedTasks,
      onTimeReports,
      joinedAt: member.joinedAt?.toMillis?.() || member.joinedAtMs || 0
    };
  }));

  leaderboard.sort((a, b) => b.score - a.score);

  const rankedLeaderboard = leaderboard.map((member, index) => ({
    ...member,
    rank: index + 1
  }));

  const currentUserRank = rankedLeaderboard.find(m => m.userId === decoded.uid);

  return {
    teamId,
    leaderboard: rankedLeaderboard,
    currentUserRank: currentUserRank || null,
    summary: {
      totalMembers: rankedLeaderboard.length,
      topScore: rankedLeaderboard[0]?.score || 0,
      avgScore: rankedLeaderboard.length > 0
        ? Math.round(rankedLeaderboard.reduce((sum, m) => sum + m.score, 0) / rankedLeaderboard.length)
        : 0
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
    const { action, teamId } = req.query;

    if (!teamId) {
      res.status(400).json({ error: 'teamId query parametri talab etiladi.' });
      return;
    }

    // Team Member Stats
    if (action === 'member-stats') {
      const data = await getTeamMemberStats(db, decoded, teamId);
      res.status(200).json({ timestamp: new Date().toISOString(), ...data });
      return;
    }

    // Leaderboard
    if (action === 'leaderboard') {
      const data = await getLeaderboard(db, decoded, teamId);
      res.status(200).json({ timestamp: new Date().toISOString(), ...data });
      return;
    }

    res.status(400).json({ error: 'Noto\'g\'ri action parametri.' });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Team statistika olishda xatolik.' });
  }
};
