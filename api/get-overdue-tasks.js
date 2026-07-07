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
    const { teamId = null, userId = null } = req.query;
    const db = admin.firestore();

    let query = db.collection('tasks');

    // Filtrlash: faqat bajarilmagan vazifalar
    query = query.where('status', '!=', 'done');

    // Agar teamId berilgan bo'lsa
    if (teamId) {
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

      query = query.where('teamId', '==', teamId);
    }

    // Agar userId berilgan bo'lsa (faqat o'z vazifalarini ko'rish)
    if (userId && userId !== decoded.uid) {
      // Faqat admin yoki manager o'zga userning vazifalarini ko'ra oladi
      const userDoc = await db.collection('users').doc(decoded.uid).get();
      const user = userDoc.exists ? userDoc.data() : {};
      if (user.role !== 'admin' && user.role !== 'manager') {
        res.status(403).json({ error: 'Siz boshqa userning vazifalarini ko\'ra olmaysiz.' });
        return;
      }
      query = query.where('assignedTo', '==', userId);
    } else if (userId === decoded.uid) {
      query = query.where('assignedTo', '==', decoded.uid);
    }

    const snapshot = await query.get();
    const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Kechikkan vazifalarni filtrlash
    const now = Date.now();
    const overdueTasks = tasks.filter(t => {
      const dueDate = t.dueDate?.toMillis?.() || t.dueDateMs || 0;
      return dueDate > 0 && dueDate < now;
    });

    // Qo'shimcha ma'lumotlarni qo'shish
    const enrichedTasks = await Promise.all(overdueTasks.map(async (task) => {
      const creatorDoc = await db.collection('users').doc(task.createdBy).get();
      const creator = creatorDoc.exists ? creatorDoc.data() : {};

      const assigneeDoc = task.assignedTo ? await db.collection('users').doc(task.assignedTo).get() : null;
      const assignee = assigneeDoc?.exists ? assigneeDoc.data() : null;

      const teamDoc = await db.collection('teams').doc(task.teamId).get();
      const team = teamDoc.exists ? teamDoc.data() : {};

      const dueDate = task.dueDate?.toMillis?.() || task.dueDateMs || 0;
      const hoursOverdue = Math.round((now - dueDate) / (1000 * 60 * 60));

      return {
        ...task,
        creator: { name: creator.name || creator.email, email: creator.email },
        assignee: assignee ? { name: assignee.name || assignee.email, email: assignee.email } : null,
        teamName: team.name,
        hoursOverdue,
        daysOverdue: Math.round(hoursOverdue / 24)
      };
    }));

    // Kechikish davriga ko'ra saralash (eng ko'p kechikkan birinchi)
    enrichedTasks.sort((a, b) => b.hoursOverdue - a.hoursOverdue);

    // Statistika
    const stats = {
      totalOverdue: enrichedTasks.length,
      byCritical: enrichedTasks.filter(t => t.daysOverdue > 7).length,
      byWarning: enrichedTasks.filter(t => t.daysOverdue > 3 && t.daysOverdue <= 7).length,
      byMinor: enrichedTasks.filter(t => t.daysOverdue <= 3).length
    };

    res.status(200).json({
      timestamp: new Date().toISOString(),
      tasks: enrichedTasks,
      stats,
      filters: {
        teamId: teamId || null,
        userId: userId || null
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Kechikkan vazifalar olishda xatolik.' });
  }
};
