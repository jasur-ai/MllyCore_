const { requireUser, cleanText, serverNow, notifyUsers, formatName } = require('./_lib/firebase-admin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { db, decoded } = await requireUser(req);
    const { teamId, email } = req.body || {};
    const cleanEmail = cleanText(email).toLowerCase();
    if (!teamId) throw new Error('Workspace topilmadi.');
    if (!cleanEmail) throw new Error('Email kiriting.');

    const memberRef = db.collection('teamMembers').doc(`${teamId}_${decoded.uid}`);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists || memberSnap.data().role !== 'team_lead') {
      res.status(403).json({ error: "A'zo taklif qilish faqat team lead uchun." });
      return;
    }

    const [teamSnap, targetUserSnap] = await Promise.all([
      db.collection('teams').doc(teamId).get(),
      db.collection('users').where('email', '==', cleanEmail).limit(1).get()
    ]);

    if (!teamSnap.exists) throw new Error('Workspace topilmadi.');
    if (targetUserSnap.empty) throw new Error('Bu email bilan foydalanuvchi topilmadi.');

    const targetUserDoc = targetUserSnap.docs[0];
    const targetUserId = targetUserDoc.id;
    const existingMember = await db.collection('teamMembers').doc(`${teamId}_${targetUserId}`).get();
    if (existingMember.exists) throw new Error('Bu foydalanuvchi allaqachon workspace a\'zosi.');

    const inviteRef = db.collection('workspaceInvites').doc(`${teamId}_${targetUserId}`);
    const existingInviteSnap = await inviteRef.get();
    if (existingInviteSnap.exists && existingInviteSnap.data().status === 'pending') {
      throw new Error('Bu foydalanuvchiga taklif allaqachon yuborilgan.');
    }

    const team = teamSnap.data();
    const targetProfile = targetUserDoc.data();
    const now = serverNow();
    await inviteRef.set({
      teamId,
      teamName: team.name,
      inviteeUserId: targetUserId,
      inviteeEmail: cleanEmail,
      createdByUserId: decoded.uid,
      status: 'pending',
      createdAt: now,
      updatedAt: now
    });

    await notifyUsers(db, [targetUserId], (userId) => ({
      userId,
      teamId,
      type: 'team_invite',
      text: `Siz ${team.name} workspace'ga taklif qilindingiz. Secret key kiriting va qo'shiling.`,
      relatedEntityId: inviteRef.id,
      unread: true,
      isRead: false,
      inviteStatus: 'pending',
      inviteeName: formatName(targetProfile, cleanEmail),
      createdAt: now
    }));

    res.status(200).json({
      inviteId: inviteRef.id,
      inviteeEmail: cleanEmail
    });
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message || 'Taklif yuborilmadi.' });
  }
};
