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

function matchesQuery(text, query) {
  return text.toLowerCase().includes(query.toLowerCase());
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
    const { q = '', type = 'all', limit = 20 } = req.query;

    if (!q || q.trim().length < 2) {
      res.status(400).json({ error: 'Qidiruv so\'zi kamida 2 ta belgi bo\'lishi kerak.' });
      return;
    }

    const query = q.trim().toLowerCase();
    const pageLimit = Math.min(parseInt(limit) || 20, 100);
    const db = admin.firestore();

    // Foydalanuvchi qaysi teamlarga kirish huquqiga ega ekanligini aniqlash
    const memberSnap = await db.collection('teamMembers').where('userId', '==', decoded.uid).get();
    const memberTeams = memberSnap.docs.map(doc => doc.data().teamId);

    const userDoc = await db.collection('users').doc(decoded.uid).get();
    const user = userDoc.exists ? userDoc.data() : {};
    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'manager';

    let results = {
      tasks: [],
      ideas: [],
      messages: [],
      teams: []
    };

    // Vazifalar qidiruvi
    if (type === 'all' || type === 'tasks') {
      let tasksQuery = db.collection('tasks');

      if (!isAdmin) {
        tasksQuery = tasksQuery.where('teamId', 'in', memberTeams.length > 0 ? memberTeams : ['__none__']);
      }

      const tasksSnap = await tasksQuery.limit(pageLimit * 2).get();
      const tasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      results.tasks = tasks
        .filter(t => matchesQuery(t.title || '', query) || matchesQuery(t.description || '', query))
        .slice(0, pageLimit)
        .map(t => ({
          id: t.id,
          type: 'task',
          title: t.title,
          description: t.description?.substring(0, 100),
          teamId: t.teamId,
          status: t.status,
          priority: t.priority,
          createdAt: t.createdAt?.toMillis?.() || t.createdAtMs || 0
        }));
    }

    // G'oyalar qidiruvi
    if (type === 'all' || type === 'ideas') {
      let ideasQuery = db.collection('ideas');

      if (!isAdmin) {
        ideasQuery = ideasQuery.where('teamId', 'in', memberTeams.length > 0 ? memberTeams : ['__none__']);
      }

      const ideasSnap = await ideasQuery.limit(pageLimit * 2).get();
      const ideas = ideasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      results.ideas = ideas
        .filter(i => matchesQuery(i.title || '', query) || matchesQuery(i.description || '', query))
        .slice(0, pageLimit)
        .map(i => ({
          id: i.id,
          type: 'idea',
          title: i.title,
          description: i.description?.substring(0, 100),
          teamId: i.teamId,
          createdBy: i.createdBy,
          createdAt: i.createdAt?.toMillis?.() || i.createdAtMs || 0,
          convertedToTaskId: i.convertedToTaskId || null
        }));
    }

    // Chat xabarlari qidiruvi
    if (type === 'all' || type === 'messages') {
      let messagesQuery = db.collection('chatMessages');

      if (!isAdmin) {
        messagesQuery = messagesQuery.where('teamId', 'in', memberTeams.length > 0 ? memberTeams : ['__none__']);
      }

      const messagesSnap = await messagesQuery.limit(pageLimit * 2).get();
      const messages = messagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      results.messages = messages
        .filter(m => matchesQuery(m.text || '', query))
        .slice(0, pageLimit)
        .map(m => ({
          id: m.id,
          type: 'message',
          text: m.text?.substring(0, 100),
          teamId: m.teamId,
          userId: m.userId,
          createdAt: m.createdAt?.toMillis?.() || m.createdAtMs || 0
        }));
    }

    // Teamlar qidiruvi (faqat admin va manager uchun)
    if ((type === 'all' || type === 'teams') && (isAdmin || isManager)) {
      const teamsSnap = await db.collection('teams').limit(pageLimit * 2).get();
      const teams = teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      results.teams = teams
        .filter(t => matchesQuery(t.name || '', query) || matchesQuery(t.description || '', query))
        .slice(0, pageLimit)
        .map(t => ({
          id: t.id,
          type: 'team',
          name: t.name,
          description: t.description?.substring(0, 100),
          membersCount: t.membersCount || 0,
          createdAt: t.createdAt?.toMillis?.() || t.createdAtMs || 0
        }));
    }

    // Jami natijalar
    const totalResults = Object.values(results).reduce((sum, arr) => sum + arr.length, 0);

    res.status(200).json({
      timestamp: new Date().toISOString(),
      query,
      totalResults,
      results,
      filters: {
        type: type || 'all',
        limit: pageLimit
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Qidiruv xatosi.' });
  }
};
