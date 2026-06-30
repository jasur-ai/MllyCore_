const { requireUser, cleanText, serverNow, notifyUsers } = require('./_lib/firebase-admin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { db, decoded, caller } = await requireUser(req);
    const { teamId, text } = req.body || {};
    const cleanMessage = cleanText(text);
    if (!teamId) throw new Error('Workspace topilmadi.');
    if (!cleanMessage) throw new Error('Xabar matnini kiriting.');

    const memberRef = db.collection('teamMembers').doc(`${teamId}_${decoded.uid}`);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) {
      res.status(403).json({ error: 'Siz bu workspace a\'zosi emassiz.' });
      return;
    }

    const teamSnap = await db.collection('teams').doc(teamId).get();
    if (!teamSnap.exists) throw new Error('Workspace topilmadi.');

    const now = serverNow();
    const profileName = caller?.name || caller?.email || 'User';
    const messageRef = await db.collection('chatMessages').add({
      teamId,
      senderUserId: decoded.uid,
      senderName: profileName,
      senderAvatar: caller?.avatar || profileName.slice(0, 2).toUpperCase(),
      text: cleanMessage,
      clientCreatedAt: Date.now(),
      createdAt: now
    });

    const memberDocs = await db.collection('teamMembers').where('teamId', '==', teamId).get();
    const recipientIds = memberDocs.docs
      .map((doc) => doc.data().userId)
      .filter((userId) => userId !== decoded.uid);

    if (recipientIds.length) {
      await notifyUsers(db, recipientIds, (userId) => ({
        userId,
        teamId,
        type: 'team_message',
        text: `${profileName} chatga yozdi: ${cleanMessage.slice(0, 90)}`,
        relatedEntityId: messageRef.id,
        unread: true,
        isRead: false,
        createdAt: now
      }));
    }

    res.status(200).json({ ok: true, id: messageRef.id });
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message || 'Xabar yuborilmadi.' });
  }
};
