const { requireUser, cleanText, serverNow, notifyUsers, updateTeamSummary } = require('./_lib/firebase-admin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { db, decoded, caller } = await requireUser(req);
    const { inviteId, secretKey } = req.body || {};
    const cleanSecretKey = cleanText(secretKey).toUpperCase();
    if (!inviteId) throw new Error('Taklif topilmadi.');
    if (!cleanSecretKey) throw new Error('Secret key kiriting.');

    const inviteRef = db.collection('workspaceInvites').doc(inviteId);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) throw new Error('Taklif topilmadi.');
    const invite = inviteSnap.data();
    if (invite.inviteeUserId !== decoded.uid) {
      res.status(403).json({ error: 'Bu taklif sizga tegishli emas.' });
      return;
    }
    if (invite.status === 'accepted') throw new Error('Bu taklif allaqachon qabul qilingan.');

    const teamRef = db.collection('teams').doc(invite.teamId);
    const teamSnap = await teamRef.get();
    if (!teamSnap.exists) throw new Error('Workspace topilmadi.');
    const team = teamSnap.data();
    if (cleanText(team.secretKey).toUpperCase() !== cleanSecretKey) {
      res.status(400).json({ error: 'Secret key noto\'g\'ri. Qayta tekshirib kiriting.' });
      return;
    }

    const membershipRef = db.collection('teamMembers').doc(`${invite.teamId}_${decoded.uid}`);
    const membershipSnap = await membershipRef.get();
    const batch = db.batch();
    const now = serverNow();
    const nowMs = Date.now();

    if (!membershipSnap.exists) {
      batch.set(membershipRef, {
        teamId: invite.teamId,
        userId: decoded.uid,
        role: 'member',
        joinedAt: now,
        updatedAt: now
      });
      batch.update(teamRef, {
        membersCount: (team.membersCount || 0) + 1,
        updatedAt: now
      });
    }

    batch.update(inviteRef, {
      status: 'accepted',
      acceptedAt: now,
      updatedAt: now
    });

    await batch.commit();

    if (!membershipSnap.exists) {
      await updateTeamSummary(db, invite.teamId, (current) => ({
        membersCount: Math.max(current.membersCount || 0, (team.membersCount || 0) + 1),
        lastActivityAtMs: nowMs
      }));
    }

    const recipients = [decoded.uid];
    if (team.leadUserId) recipients.push(team.leadUserId);
    await notifyUsers(db, recipients, (userId) => ({
      userId,
      teamId: invite.teamId,
      type: userId === decoded.uid ? 'team_joined' : 'team_invite_accepted',
      text: userId === decoded.uid
        ? `Siz ${team.name} workspace'ga muvaffaqiyatli qo'shildingiz.`
        : `${caller?.name || caller?.email || 'User'} ${team.name} workspace'ga qo'shildi.`,
      relatedEntityId: invite.teamId,
      unread: true,
      isRead: false,
      createdAt: now
    }));

    res.status(200).json({ ok: true, teamId: invite.teamId });
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message || 'Taklif qabul qilinmadi.' });
  }
};
