const { requireUser, serverNow, notifyUsers } = require('./_lib/firebase-admin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { db, decoded } = await requireUser(req);
    const { teamId } = req.body || {};
    if (!teamId) throw new Error('Workspace topilmadi.');

    const memberSnap = await db.collection('teamMembers').doc(`${teamId}_${decoded.uid}`).get();
    if (!memberSnap.exists) {
      res.status(403).json({ error: 'Siz bu workspace a\'zosi emassiz.' });
      return;
    }

    const nowMs = Date.now();
    const tasksSnap = await db.collection('tasks').where('teamId', '==', teamId).get();
    const openTasks = tasksSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((task) => task.assignmentMode === 'open' && !task.assignedUserId && getMs(task.createdAt) && nowMs - getMs(task.createdAt) >= 12 * 60 * 60 * 1000);

    if (!openTasks.length) {
      res.status(200).json({ ok: true, autoAssigned: 0 });
      return;
    }

    const teamMembersSnap = await db.collection('teamMembers').where('teamId', '==', teamId).get();
    const eligibleMemberIds = teamMembersSnap.docs
      .map((doc) => doc.data())
      .filter((member) => member.role !== 'team_lead')
      .map((member) => member.userId);

    if (!eligibleMemberIds.length) {
      res.status(200).json({ ok: true, autoAssigned: 0 });
      return;
    }

    const users = await Promise.all(eligibleMemberIds.map((userId) => db.collection('users').doc(userId).get()));
    const userMap = users.reduce((acc, userSnap) => {
      if (userSnap.exists) acc[userSnap.id] = userSnap.data();
      return acc;
    }, {});

    let autoAssigned = 0;
    for (const task of openTasks) {
      const randomUserId = eligibleMemberIds[Math.floor(Math.random() * eligibleMemberIds.length)];
      const profile = userMap[randomUserId] || {};
      await db.collection('tasks').doc(task.id).update({
        assignedUserId: randomUserId,
        assignedUserName: profile.name || profile.email || '',
        status: 'assigned',
        autoAssignedAt: serverNow(),
        updatedAt: serverNow()
      });
      await notifyUsers(db, eligibleMemberIds.concat(task.createdByUserId || []).filter(Boolean), (userId) => ({
        userId,
        teamId,
        type: 'task_auto_assigned',
        text: `${task.title} topshirig'i 12 soat ichida olinmagani uchun avtomatik biriktirildi.`,
        relatedEntityId: task.id,
        unread: true,
        isRead: false,
        createdAt: serverNow()
      }));
      autoAssigned += 1;
    }

    res.status(200).json({ ok: true, autoAssigned });
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message || 'Task sync bajarilmadi.' });
  }
};

function getMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
