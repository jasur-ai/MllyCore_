const { requireUser, cleanText, serverNow, notifyUsers } = require('./_lib/firebase-admin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { db, decoded, caller } = await requireUser(req);
    const {
      teamId,
      title,
      description = '',
      assignmentMode = 'open',
      assignedUserId = '',
      deadline = ''
    } = req.body || {};

    const cleanTitle = cleanText(title);
    const cleanDescription = cleanText(description);
    const cleanMode = cleanText(assignmentMode || 'open').toLowerCase();
    const cleanAssignedUserId = cleanText(assignedUserId);
    if (!teamId) throw new Error('Workspace topilmadi.');
    if (!cleanTitle) throw new Error('Topshiriq nomini kiriting.');
    if (!['open', 'direct', 'team'].includes(cleanMode)) throw new Error('Topshiriq turi noto\'g\'ri.');

    const creatorSnap = await db.collection('teamMembers').doc(`${teamId}_${decoded.uid}`).get();
    if (!creatorSnap.exists) {
      res.status(403).json({ error: 'Siz bu workspace a\'zosi emassiz.' });
      return;
    }
    const creatorMembership = creatorSnap.data();
    if (creatorMembership.role !== 'team_lead' && cleanMode !== 'team') {
      res.status(403).json({ error: 'Direct yoki umumiy topshiriqni faqat team lead yaratadi.' });
      return;
    }

    let assignedProfile = null;
    if (cleanMode === 'direct' && cleanAssignedUserId) {
      const assignedMemberSnap = await db.collection('teamMembers').doc(`${teamId}_${cleanAssignedUserId}`).get();
      if (!assignedMemberSnap.exists) throw new Error('Tanlangan mas\'ul workspace a\'zosi emas.');
      const assignedUserSnap = await db.collection('users').doc(cleanAssignedUserId).get();
      assignedProfile = assignedUserSnap.exists ? assignedUserSnap.data() : null;
    }

    const now = serverNow();
    const deadlineAt = deadline ? new Date(deadline).toISOString() : '';
    const taskRef = await db.collection('tasks').add({
      teamId,
      title: cleanTitle,
      description: cleanDescription,
      assignmentMode: cleanMode,
      assignedUserId: cleanMode === 'direct' ? cleanAssignedUserId : '',
      assignedUserName: cleanMode === 'direct' ? (assignedProfile?.name || assignedProfile?.email || '') : '',
      createdByUserId: decoded.uid,
      createdByName: caller?.name || caller?.email || 'User',
      deadlineAt,
      requiresResult: true,
      status: cleanMode === 'direct' ? 'assigned' : 'open',
      progressCount: 0,
      requiredPercent: cleanMode === 'team' ? 65 : 100,
      createdAt: now,
      updatedAt: now
    });

    const memberDocs = await db.collection('teamMembers').where('teamId', '==', teamId).get();
    const targetUsers = cleanMode === 'direct' && cleanAssignedUserId
      ? [cleanAssignedUserId]
      : memberDocs.docs.map((doc) => doc.data().userId);

    await notifyUsers(db, targetUsers, (userId) => ({
      userId,
      teamId,
      type: 'task_assigned',
      text: cleanMode === 'team'
        ? `Jamoaviy topshiriq yaratildi: ${cleanTitle}`
        : cleanMode === 'direct'
          ? `Sizga topshiriq berildi: ${cleanTitle}`
          : `Umumiy topshiriq ochildi: ${cleanTitle}`,
      relatedEntityId: taskRef.id,
      unread: userId !== decoded.uid || cleanMode === 'direct',
      isRead: userId === decoded.uid && cleanMode !== 'direct',
      createdAt: now
    }));

    res.status(200).json({ id: taskRef.id });
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message || 'Topshiriq yaratilmadi.' });
  }
};
