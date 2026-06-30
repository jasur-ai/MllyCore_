const { requireUser, cleanText, serverNow, notifyUsers, mergeRecentItems, updateTeamSummary } = require('./_lib/firebase-admin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { db, decoded, caller } = await requireUser(req);
    const { taskId, action, resultText = '', resultLink = '' } = req.body || {};
    const cleanAction = cleanText(action).toLowerCase();
    const cleanResultText = cleanText(resultText);
    const cleanResultLink = cleanText(resultLink);
    if (!taskId) throw new Error('Topshiriq topilmadi.');
    if (!['claim', 'submit'].includes(cleanAction)) throw new Error('Amal noto\'g\'ri.');

    const taskRef = db.collection('tasks').doc(taskId);
    const taskSnap = await taskRef.get();
    if (!taskSnap.exists) throw new Error('Topshiriq topilmadi.');
    const task = taskSnap.data();

    const memberSnap = await db.collection('teamMembers').doc(`${task.teamId}_${decoded.uid}`).get();
    if (!memberSnap.exists) {
      res.status(403).json({ error: 'Siz bu workspace a\'zosi emassiz.' });
      return;
    }
    const membership = memberSnap.data();
    const now = serverNow();

    if (cleanAction === 'claim') {
      const nowMs = Date.now();
      if (task.assignmentMode !== 'open') throw new Error('Faqat umumiy topshiriq olinadi.');
      if (task.assignedUserId) throw new Error('Bu topshiriq allaqachon band qilingan.');
      await taskRef.update({
        assignedUserId: decoded.uid,
        assignedUserName: caller?.name || caller?.email || 'User',
        status: 'assigned',
        claimedAt: now,
        updatedAtMs: nowMs,
        updatedAt: now
      });
      await updateTeamSummary(db, task.teamId, (team) => {
        const recentTask = {
          id: taskId,
          teamId: task.teamId,
          title: task.title,
          status: 'assigned',
          assignmentMode: task.assignmentMode,
          assignedUserName: caller?.name || caller?.email || 'User',
          createdByName: task.createdByName || '',
          deadlineAt: task.deadlineAt || '',
          progressCount: task.progressCount || 0,
          requiredCount: task.requiredCount || 1,
          createdAtMs: Number(task.createdAtMs || nowMs),
          updatedAtMs: nowMs
        };
        return {
          recentTasks: mergeRecentItems(team.recentTasks, recentTask, 10),
          lastTask: recentTask,
          lastActivityAtMs: nowMs
        };
      });
      if (task.createdByUserId) {
        await notifyUsers(db, [task.createdByUserId], (userId) => ({
          userId,
          teamId: task.teamId,
          type: 'task_claimed',
          text: `${caller?.name || caller?.email || 'User'} topshiriqni oldi: ${task.title}`,
          relatedEntityId: taskId,
          unread: true,
          isRead: false,
          createdAt: now
        }));
      }
      res.status(200).json({ ok: true });
      return;
    }

    if (!cleanResultText) throw new Error('Natija yozilmaguncha tugatdim bosilmaydi.');
    const nowMs = Date.now();

    const submissionRef = db.collection('taskSubmissions').doc(`${taskId}_${decoded.uid}`);
    const existingSubmission = await submissionRef.get();
    if (existingSubmission.exists) throw new Error('Siz bu topshiriq uchun natija yuborgansiz.');

    if (task.assignmentMode === 'direct' && task.assignedUserId !== decoded.uid) {
      res.status(403).json({ error: 'Bu topshiriq sizga biriktirilmagan.' });
      return;
    }

    if (task.assignmentMode === 'open' && task.assignedUserId !== decoded.uid) {
      res.status(403).json({ error: 'Avval topshiriqni oling.' });
      return;
    }

    if (task.assignmentMode === 'team' && !memberSnap.exists) {
      res.status(403).json({ error: 'Jamoaviy topshiriq uchun ruxsat yo\'q.' });
      return;
    }

    await submissionRef.set({
      taskId,
      teamId: task.teamId,
      userId: decoded.uid,
      userName: caller?.name || caller?.email || 'User',
      role: membership.role,
      resultText: cleanResultText,
      resultLink: cleanResultLink,
      createdAtMs: nowMs,
      createdAt: now
    });

    const submissionDocs = await db.collection('taskSubmissions').where('taskId', '==', taskId).get();
    const progressCount = submissionDocs.size;
    const teamMembers = await db.collection('teamMembers').where('teamId', '==', task.teamId).get();
    const memberCount = teamMembers.size || 1;
    const requiredCount = task.assignmentMode === 'team'
      ? Math.max(1, Math.ceil(memberCount * 0.65))
      : 1;
    const status = progressCount >= requiredCount ? 'completed' : (task.assignmentMode === 'team' ? 'in_progress' : 'assigned');

    await taskRef.update({
      progressCount,
      requiredCount,
      status,
      completedAt: status === 'completed' ? now : task.completedAt || null,
      updatedAtMs: nowMs,
      updatedAt: now
    });

    await updateTeamSummary(db, task.teamId, (team) => {
      const recentTask = {
        id: taskId,
        teamId: task.teamId,
        title: task.title,
        status,
        assignmentMode: task.assignmentMode,
        assignedUserName: task.assignedUserName || '',
        createdByName: task.createdByName || '',
        deadlineAt: task.deadlineAt || '',
        progressCount,
        requiredCount,
        createdAtMs: Number(task.createdAtMs || nowMs),
        updatedAtMs: nowMs
      };
      return {
        recentTasks: mergeRecentItems(team.recentTasks, recentTask, 10),
        lastTask: recentTask,
        lastActivityAtMs: nowMs
      };
    });

    const recipients = teamMembers.docs.map((doc) => doc.data().userId);
    await notifyUsers(db, recipients, (userId) => ({
      userId,
      teamId: task.teamId,
      type: status === 'completed' ? 'task_completed' : 'task_progress',
      text: status === 'completed'
        ? `Topshiriq bajarildi: ${task.title}`
        : `${caller?.name || caller?.email || 'User'} natija yukladi: ${task.title}`,
      relatedEntityId: taskId,
      unread: userId !== decoded.uid,
      isRead: userId === decoded.uid,
      createdAt: now
    }));

    res.status(200).json({ ok: true, status, progressCount, requiredCount });
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message || 'Topshiriq yangilanmadi.' });
  }
};
