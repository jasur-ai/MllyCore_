const { requireUser, cleanText, serverNow, notifyUsers } = require('./_lib/firebase-admin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { db, decoded } = await requireUser(req);
    const { teamId, ideaId, ownerUserId } = req.body || {};
    const cleanOwnerUserId = cleanText(ownerUserId);
    if (!teamId || !ideaId) throw new Error('Yozuv topilmadi.');
    if (!cleanOwnerUserId) throw new Error('Mas\'ul foydalanuvchini tanlang.');

    const leadSnap = await db.collection('teamMembers').doc(`${teamId}_${decoded.uid}`).get();
    if (!leadSnap.exists || leadSnap.data().role !== 'team_lead') {
      res.status(403).json({ error: 'Mas\'ul belgilash faqat team lead uchun.' });
      return;
    }

    const [ideaSnap, ownerMemberSnap, ownerUserSnap] = await Promise.all([
      db.collection('ideas').doc(ideaId).get(),
      db.collection('teamMembers').doc(`${teamId}_${cleanOwnerUserId}`).get(),
      db.collection('users').doc(cleanOwnerUserId).get()
    ]);

    if (!ideaSnap.exists) throw new Error('Yozuv topilmadi.');
    if (!ownerMemberSnap.exists) throw new Error('Tanlangan foydalanuvchi workspace a\'zosi emas.');
    const idea = ideaSnap.data();
    if (idea.teamId !== teamId || idea.entryType !== 'startup') throw new Error('Faqat startup uchun mas\'ul belgilanadi.');

    const owner = ownerUserSnap.exists ? ownerUserSnap.data() : {};
    const now = serverNow();
    await db.collection('ideas').doc(ideaId).update({
      ownerUserId: cleanOwnerUserId,
      ownerName: owner.name || owner.email || '',
      updatedAt: now
    });

    await notifyUsers(db, [cleanOwnerUserId], (userId) => ({
      userId,
      teamId,
      type: 'startup_owner_changed',
      text: `${idea.title} startupi uchun siz mas'ul etib belgilandingiz.`,
      relatedEntityId: ideaId,
      unread: true,
      isRead: false,
      createdAt: now
    }));

    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message || 'Mas\'ul yangilanmadi.' });
  }
};
