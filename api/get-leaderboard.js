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

    // Team a'zolarini score'ga ko'ra saralash
    const membersSnap = await db.collection('teamMembers').where('teamId', '==', teamId).get();
    const members = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const leaderboard = await Promise.all(members.map(async (member) => {
      const userDoc = await db.collection('users').doc(member.userId).get();
      const userData = userDoc.exists ? userDoc.data() : {};

      // Score'ni hisoblash (agar member.score bo'lsa, uni ishlatish)
      const score = member.score || userData.score || 0;

      // Qo'shimcha ma'lumotlar
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

    // Score'ga ko'ra saralash
    leaderboard.sort((a, b) => b.score - a.score);

    // Rank qo'shish
    const rankedLeaderboard = leaderboard.map((member, index) => ({
      ...member,
      rank: index + 1
    }));

    // Foydalanuvchining o'z ranki topish
    const currentUserRank = rankedLeaderboard.find(m => m.userId === decoded.uid);

    res.status(200).json({
      timestamp: new Date().toISOString(),
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
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Leaderboard olishda xatolik.' });
  }
};
