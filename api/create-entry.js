const { requireUser, cleanText, serverNow, notifyUsers, mergeRecentItems, updateTeamSummary } = require('./_lib/firebase-admin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { db, decoded } = await requireUser(req);
    const { teamId, title, description = '', type = 'idea', ownerUserId = '' } = req.body || {};
    const cleanType = cleanText(type || 'idea').toLowerCase();
    const cleanTitle = cleanText(title);
    const cleanDescription = cleanText(description);
    const cleanOwnerUserId = cleanText(ownerUserId);

    if (!teamId) throw new Error('Workspace topilmadi.');
    if (!cleanTitle) throw new Error(cleanType === 'startup' ? 'Startup nomini kiriting.' : "G'oya nomini kiriting.");
    if (!['idea', 'startup'].includes(cleanType)) throw new Error('Noto\'g\'ri entry turi.');

    const memberRef = db.collection('teamMembers').doc(`${teamId}_${decoded.uid}`);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) {
      res.status(403).json({ error: 'Siz bu workspace a\'zosi emassiz.' });
      return;
    }

    const member = memberSnap.data();
    if (cleanType === 'startup' && member.role !== 'team_lead') {
      res.status(403).json({ error: 'Startup faqat team lead tomonidan qo\'shiladi.' });
      return;
    }

    let ownerProfile = null;
    if (cleanType === 'startup' && cleanOwnerUserId) {
      const ownerMemberSnap = await db.collection('teamMembers').doc(`${teamId}_${cleanOwnerUserId}`).get();
      if (!ownerMemberSnap.exists) {
        res.status(400).json({ error: 'Mas\'ul foydalanuvchi workspace a\'zosi emas.' });
        return;
      }
      const ownerUserSnap = await db.collection('users').doc(cleanOwnerUserId).get();
      ownerProfile = ownerUserSnap.exists ? ownerUserSnap.data() : null;
    }

    const userSnap = await db.collection('users').doc(decoded.uid).get();
    const profile = userSnap.exists ? userSnap.data() : {};
    const now = serverNow();

    const nowMs = Date.now();
    const ideaPayload = {
      teamId,
      title: cleanTitle,
      description: cleanDescription,
      status: cleanType === 'startup' ? 'Startup' : 'Raw',
      category: cleanType === 'startup' ? 'startup' : 'idea',
      entryType: cleanType,
      createdByUserId: decoded.uid,
      createdByName: profile.name || decoded.email || 'User',
      ownerUserId: cleanType === 'startup' ? (cleanOwnerUserId || '') : decoded.uid,
      ownerName: cleanType === 'startup'
        ? (ownerProfile?.name || ownerProfile?.email || '')
        : (profile.name || decoded.email || 'User'),
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
      createdAt: now,
      updatedAt: now
    };
    const ideaRef = await db.collection('ideas').add(ideaPayload);

    await updateTeamSummary(db, teamId, (team) => {
      const recentIdea = {
        id: ideaRef.id,
        teamId,
        title: cleanTitle,
        description: cleanDescription,
        status: ideaPayload.status,
        category: ideaPayload.category,
        entryType: cleanType,
        ownerName: ideaPayload.ownerName,
        createdByName: ideaPayload.createdByName,
        createdAtMs: nowMs,
        updatedAtMs: nowMs
      };
      return {
        ideasCount: (team.ideasCount || 0) + (cleanType === 'idea' ? 1 : 0),
        startupsCount: (team.startupsCount || 0) + (cleanType === 'startup' ? 1 : 0),
        recentIdeas: mergeRecentItems(team.recentIdeas, recentIdea, 10),
        lastIdea: recentIdea,
        lastActivityAtMs: nowMs
      };
    });

    const memberSnaps = await db.collection('teamMembers').where('teamId', '==', teamId).get();
    const targetUsers = memberSnaps.docs.map((doc) => doc.data().userId);
    await notifyUsers(db, targetUsers, (targetUserId) => ({
        userId: targetUserId,
        teamId,
        type: cleanType === 'startup' ? 'startup_created' : 'idea_created',
        text: cleanType === 'startup'
          ? `Yangi startup qo'shildi: ${cleanTitle}`
          : `Yangi g'oya qo'shildi: ${cleanTitle}`,
        relatedEntityId: ideaRef.id,
        unread: targetUserId !== decoded.uid,
        isRead: targetUserId === decoded.uid,
        createdAt: now
    }));

    res.status(200).json({
      id: ideaRef.id,
      type: cleanType
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Entry yaratilmadi.' });
  }
};
