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

// Convert Idea to Task
async function convertIdeaToTask(db, decoded, ideaId, teamId, title, description, assignedTo) {
  const ideaDoc = await db.collection('ideas').doc(ideaId).get();
  if (!ideaDoc.exists) {
    throw new Error('Idea topilmadi.');
  }

  const idea = ideaDoc.data();

  const memberDoc = await db.collection('teamMembers').doc(`${teamId}_${decoded.uid}`).get();
  const userDoc = await db.collection('users').doc(decoded.uid).get();
  const user = userDoc.exists ? userDoc.data() : {};

  const isAdmin = user.role === 'admin';
  const isManager = user.role === 'manager' && Array.isArray(user.assignedTeams) && user.assignedTeams.includes(teamId);
  const isTeamLead = memberDoc.exists && memberDoc.data().role === 'team_lead';
  const isCreator = idea.createdBy === decoded.uid;

  if (!isAdmin && !isManager && !isTeamLead && !isCreator) {
    throw new Error('Siz bu amalni bajara olmaysiz.');
  }

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
    ideaSourceId: ideaId,
    tags: Array.isArray(idea.tags) ? idea.tags : []
  });

  await db.collection('ideas').doc(ideaId).update({
    convertedToTaskId: taskRef.id,
    convertedAt: now,
    convertedBy: decoded.uid,
    status: 'converted'
  });

  await db.collection('auditLogs').add({
    action: 'idea_converted_to_task',
    userId: decoded.uid,
    ideaId,
    taskId: taskRef.id,
    teamId,
    timestamp: now,
    details: { ideaTitle: idea.title, taskTitle: title || idea.title }
  });

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

  return {
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
  };
}

// Update User Preferences
async function updateUserPreferences(db, decoded, workingHours, timezone, notificationPreferences, telegramUsername, emailDigestFrequency) {
  if (workingHours) {
    if (!workingHours.start || !workingHours.end) {
      throw new Error('workingHours uchun start va end vaqti talab etiladi.');
    }
    if (!/^\d{2}:\d{2}$/.test(workingHours.start) || !/^\d{2}:\d{2}$/.test(workingHours.end)) {
      throw new Error('Vaqt formati noto\'g\'ri. HH:MM formatida kiriting.');
    }
  }

  if (timezone && typeof timezone !== 'string') {
    throw new Error('timezone string bo\'lishi kerak.');
  }

  if (emailDigestFrequency && !['never', 'daily', 'weekly', 'immediately'].includes(emailDigestFrequency)) {
    throw new Error('emailDigestFrequency noto\'g\'ri qiymat.');
  }

  const updateData = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (workingHours) updateData.workingHours = workingHours;
  if (timezone) updateData.timezone = timezone;
  if (notificationPreferences) updateData.notificationPreferences = notificationPreferences;
  if (telegramUsername) updateData.telegramUsername = telegramUsername;
  if (emailDigestFrequency) updateData.emailDigestFrequency = emailDigestFrequency;

  await db.collection('users').doc(decoded.uid).update(updateData);

  await db.collection('auditLogs').add({
    action: 'user_preferences_updated',
    userId: decoded.uid,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    details: { changedFields: Object.keys(updateData).filter(k => k !== 'updatedAt') }
  });

  return {
    success: true,
    message: 'Sozlamalar muvaffaqiyatli yangilandi.',
    preferences: {
      workingHours: workingHours || null,
      timezone: timezone || null,
      notificationPreferences: notificationPreferences || null,
      telegramUsername: telegramUsername || null,
      emailDigestFrequency: emailDigestFrequency || null
    }
  };
}

// Get Overdue Tasks
async function getOverdueTasks(db, decoded, teamId, userId, user) {
  let query = db.collection('tasks');
  query = query.where('status', '!=', 'done');

  if (teamId) {
    const memberDoc = await db.collection('teamMembers').doc(`${teamId}_${decoded.uid}`).get();
    const isAdmin = user.role === 'admin';
    const isManager = user.role === 'manager' && Array.isArray(user.assignedTeams) && user.assignedTeams.includes(teamId);
    const isMember = memberDoc.exists;

    if (!isAdmin && !isManager && !isMember) {
      throw new Error('Siz bu teamga kira olmaysiz.');
    }

    query = query.where('teamId', '==', teamId);
  }

  if (userId && userId !== decoded.uid) {
    if (user.role !== 'admin' && user.role !== 'manager') {
      throw new Error('Siz boshqa userning vazifalarini ko\'ra olmaysiz.');
    }
    query = query.where('assignedTo', '==', userId);
  } else if (userId === decoded.uid) {
    query = query.where('assignedTo', '==', decoded.uid);
  }

  const snapshot = await query.get();
  const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const now = Date.now();
  const overdueTasks = tasks.filter(t => {
    const dueDate = t.dueDate?.toMillis?.() || t.dueDateMs || 0;
    return dueDate > 0 && dueDate < now;
  });

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

  enrichedTasks.sort((a, b) => b.hoursOverdue - a.hoursOverdue);

  const stats = {
    totalOverdue: enrichedTasks.length,
    byCritical: enrichedTasks.filter(t => t.daysOverdue > 7).length,
    byWarning: enrichedTasks.filter(t => t.daysOverdue > 3 && t.daysOverdue <= 7).length,
    byMinor: enrichedTasks.filter(t => t.daysOverdue <= 3).length
  };

  return { tasks: enrichedTasks, stats, filters: { teamId: teamId || null, userId: userId || null } };
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

    // Convert Idea to Task (POST)
    if (req.method === 'POST' && action === 'convert-idea') {
      const { ideaId, teamId, title, description, assignedTo } = req.body || {};
      if (!ideaId || !teamId) {
        res.status(400).json({ error: 'ideaId va teamId talab etiladi.' });
        return;
      }
      const data = await convertIdeaToTask(db, decoded, ideaId, teamId, title, description, assignedTo);
      res.status(200).json(data);
      return;
    }

    // Update User Preferences (POST)
    if (req.method === 'POST' && action === 'update-preferences') {
      const { workingHours, timezone, notificationPreferences, telegramUsername, emailDigestFrequency } = req.body || {};
      const data = await updateUserPreferences(db, decoded, workingHours, timezone, notificationPreferences, telegramUsername, emailDigestFrequency);
      res.status(200).json(data);
      return;
    }

    // Get Overdue Tasks (GET)
    if (req.method === 'GET' && action === 'overdue-tasks') {
      const { teamId, userId } = req.query;
      const data = await getOverdueTasks(db, decoded, teamId, userId, user);
      res.status(200).json({ timestamp: new Date().toISOString(), ...data });
      return;
    }

    res.status(400).json({ error: 'Noto\'g\'ri action parametri yoki method.' });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Amal bajarishda xatolik.' });
  }
};
