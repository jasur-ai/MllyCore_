const { requireUser, cleanText, serverNow, notifyUsers, mergeRecentItems, updateTeamSummary } = require('./_lib/firebase-admin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { db, decoded, caller, admin } = await requireUser(req);
    const { teamId, text, markSeen = false } = req.body || {};
    const cleanMessage = cleanText(text);
    if (!teamId) throw new Error('Workspace topilmadi.');

    const memberRef = db.collection('teamMembers').doc(`${teamId}_${decoded.uid}`);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) {
      res.status(403).json({ error: 'Siz bu workspace a\'zosi emassiz.' });
      return;
    }

    if (markSeen) {
      const messagesSnap = await db.collection('chatMessages').where('teamId', '==', teamId).get();
      const pending = messagesSnap.docs.filter((doc) => {
        const data = doc.data() || {};
        const seenBy = Array.isArray(data.seenBy) ? data.seenBy : [];
        return data.senderUserId !== decoded.uid && !seenBy.includes(decoded.uid);
      });

      if (!pending.length) {
        res.status(200).json({ ok: true, updated: 0 });
        return;
      }

      const batch = db.batch();
      const now = serverNow();
      pending.forEach((messageDoc) => {
        batch.update(messageDoc.ref, {
          seenBy: admin.firestore.FieldValue.arrayUnion(decoded.uid),
          updatedAt: now
        });
      });
      await batch.commit();
      res.status(200).json({ ok: true, updated: pending.length });
      return;
    }

    if (!cleanMessage) throw new Error('Xabar matnini kiriting.');

    const teamSnap = await db.collection('teams').doc(teamId).get();
    if (!teamSnap.exists) throw new Error('Workspace topilmadi.');

    const now = serverNow();
    const nowMs = Date.now();
    const profileName = caller?.name || caller?.email || 'User';
    const messageRef = await db.collection('chatMessages').add({
      teamId,
      senderUserId: decoded.uid,
      senderName: profileName,
      senderAvatar: caller?.avatar || profileName.slice(0, 2).toUpperCase(),
      text: cleanMessage,
      seenBy: [decoded.uid],
      clientCreatedAt: Date.now(),
      createdAtMs: nowMs,
      createdAt: now
    });

    await updateTeamSummary(db, teamId, (team) => {
      const recentMessage = {
        id: messageRef.id,
        teamId,
        senderUserId: decoded.uid,
        senderName: profileName,
        text: cleanMessage.slice(0, 140),
        createdAtMs: nowMs,
        updatedAtMs: nowMs
      };
      return {
        chatCount: Math.max((team.chatCount || 0) + 1, 1),
        recentMessages: mergeRecentItems(team.recentMessages, recentMessage, 10),
        lastMessage: recentMessage,
        lastActivityAtMs: nowMs
      };
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
