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
      // CSV'da qo'shtirnoq ichida qo'shtirnoq bo'lsa, ikki marta yozish
      const escaped = String(value || '').replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
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
    const { type = 'admin', teamId = null, format = 'csv', period = 'month' } = req.query;
    const db = admin.firestore();

    const caller = await db.collection('users').doc(decoded.uid).get();
    if (!caller.exists) {
      res.status(403).json({ error: 'Foydalanuvchi topilmadi.' });
      return;
    }

    const user = caller.data();
    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'manager';

    if (!isAdmin && !isManager) {
      res.status(403).json({ error: 'Admin yoki Manager huquqi talab etiladi.' });
      return;
    }

    // Davr hisoblash
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
      // Admin uchun global statistika
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
      // Manager uchun o'ziga biriktirilgan teamlar statistikasi
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
      res.status(400).json({ error: 'Noto\'g\'ri type yoki ruxsat yo\'q.' });
      return;
    }

    // Format bo'yicha export
    let fileContent, contentType, fileName;

    if (format === 'csv') {
      fileContent = generateCSV(exportData);
      contentType = 'text/csv';
      fileName = `mllycore-stats-${period}-${Date.now()}.csv`;
    } else {
      // JSON format
      fileContent = JSON.stringify({
        exportedAt: new Date().toISOString(),
        period,
        type,
        data: exportData
      }, null, 2);
      contentType = 'application/json';
      fileName = `mllycore-stats-${period}-${Date.now()}.json`;
    }

    // Faylni temp papkasiga saqlash
    const tempPath = path.join('/tmp', fileName);
    fs.writeFileSync(tempPath, fileContent);

    // Base64 da kodlash va qaytarish (client yuklab olishi uchun)
    const fileBuffer = fs.readFileSync(tempPath);
    const base64File = fileBuffer.toString('base64');

    // Temp faylni o'chirish
    fs.unlinkSync(tempPath);

    res.status(200).json({
      success: true,
      fileName,
      contentType,
      data: base64File,
      recordCount: exportData.length,
      exportedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Statistika eksport qilishda xatolik.' });
  }
};
