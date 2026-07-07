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
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    initAdmin();
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) throw new Error('Token yoq.');

    const decoded = await admin.auth().verifyIdToken(token);
    const { ideaId, teamId, title, description, assignedTo = null } = req.body || {};

    if (!ideaId || !teamId) {
      res.status(400).json({ error: 'ideaId va teamId talab etiladi.' });
      return;
    }

    const db = admin.firestore();

    // Idea'ni olish
    const ideaDoc = await db.collection('ideas').doc(ideaId).get();
    if (!ideaDoc.exists) {
      res.status(404).json({ error: 'Idea topilmadi.' });
      return;
    }

    const idea = ideaDoc.data();

    // Foydalanuvchi shu teamga kirish huquqiga ega ekanligini tekshirish
    const memberDoc = await db.collection('teamMembers').doc(`${teamId}_${decoded.uid}`).get();
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    const user = userDoc.exists ? userDoc.data() : {};

    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'manager' && Array.isArray(user.assignedTeams) && user.assignedTeams.includes(teamId);
    const isTeamLead = memberDoc.exists && memberDoc.data().role === 'team_lead';
    const isCreator = idea.createdBy === decoded.uid;

    if (!isAdmin && !isManager && !isTeamLead && !isCreator) {
      res.status(403).json({ error: 'Siz bu amalni bajara olmaysiz.' });
      return;
    }

    // Yangi task yaratish
    const now = admin.firestore.FieldValue.serverTimestamp();
    const taskRef = await db.collection('tasks').add({
      teamId,
      title: title || idea.title || 'Yangi vazifa',
      description: description || idea.description || '',
      status: 'todo',
      priority: 'medium',
      createdBy: decoded.uid,
      assignedTo: assignedTo || null,
      createdAt: now,
      updatedAt: now,
      dueDate: null,
      completedAt: null,
      ideaSourceId: ideaId, // Qaysi idea'dan yaratilganligini kuzatish
      tags: Array.isArray(idea.tags) ? idea.tags : []
    });

    // Idea'ni update qilish (convertedToTaskId qo'shish)
    await db.collection('ideas').doc(ideaId).update({
      convertedToTaskId: taskRef.id,
      convertedAt: now,
      convertedBy: decoded.uid,
      status: 'converted'
    });

    // Audit log qo'shish
    await db.collection('auditLogs').add({
      action: 'idea_converted_to_task',
      userId: decoded.uid,
      ideaId,
      taskId: taskRef.id,
      teamId,
      timestamp: now,
      details: {
        ideaTitle: idea.title,
        taskTitle: title || idea.title
      }
    });

    // Notification yuborish (idea muallifi va team lead'ga)
    const notificationPromises = [];

    if (idea.createdBy !== decoded.uid) {
      notificationPromises.push(
        db.collection('notifications').add({
          userId: idea.createdBy,
          type: 'idea_converted',
          title: 'Sizning g\'oyangiz vazifaga aylandi',
          message: `"${title || idea.title}" g\'oyangiz vazifaga aylantirilib, Kanban doskasiga qo\'shildi.`,
          relatedEntityId: taskRef.id,
          relatedEntityType: 'task',
          teamId,
          unread: true,
          createdAt: now
        })
      );
    }

    if (isTeamLead && idea.createdBy !== decoded.uid) {
      const teamDoc = await db.collection('teams').doc(teamId).get();
      const team = teamDoc.exists ? teamDoc.data() : {};
      if (team.leadUserId && team.leadUserId !== decoded.uid) {
        notificationPromises.push(
          db.collection('notifications').add({
            userId: team.leadUserId,
            type: 'task_created',
            title: 'Yangi vazifa yaratildi',
            message: `"${title || idea.title}" nomli yangi vazifa yaratildi.`,
            relatedEntityId: taskRef.id,
            relatedEntityType: 'task',
            teamId,
            unread: true,
            createdAt: now
          })
        );
      }
    }

    await Promise.all(notificationPromises);

    res.status(200).json({
      success: true,
      taskId: taskRef.id,
      message: 'Idea vazifaga muvaffaqiyatli aylantirilib, Kanban doskasiga qo\'shildi.',
      task: {
        id: taskRef.id,
        title: title || idea.title,
        description: description || idea.description,
        teamId,
        status: 'todo'
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Idea vazifaga aylantirish xatosi.' });
  }
};
