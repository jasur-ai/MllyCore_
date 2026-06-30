const { requireUser, serverNow, notifyUsers } = require('./_lib/firebase-admin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { db, decoded, caller } = await requireUser(req);
    const { personalIdeaId, teamId } = req.body || {};
    if (!personalIdeaId || !teamId) throw new Error('G\'oya yoki workspace topilmadi.');

    const [ideaSnap, memberSnap] = await Promise.all([
      db.collection('personalIdeas').doc(personalIdeaId).get(),
      db.collection('teamMembers').doc(`${teamId}_${decoded.uid}`).get()
    ]);

    if (!ideaSnap.exists) throw new Error('Shaxsiy g\'oya topilmadi.');
    if (!memberSnap.exists) {
      res.status(403).json({ error: 'Siz bu workspace a\'zosi emassiz.' });
      return;
    }

    const personalIdea = ideaSnap.data();
    if (personalIdea.userId !== decoded.uid) {
      res.status(403).json({ error: 'Bu g\'oya sizga tegishli emas.' });
      return;
    }

    const now = serverNow();
    const importedRef = await db.collection('ideas').add({
      teamId,
      title: personalIdea.title,
      description: personalIdea.description || '',
      status: 'Imported',
      category: 'idea',
      entryType: 'idea',
      createdByUserId: decoded.uid,
      createdByName: caller?.name || caller?.email || 'User',
      ownerUserId: decoded.uid,
      ownerName: caller?.name || caller?.email || 'User',
      sourcePersonalIdeaId: personalIdeaId,
      createdAt: now,
      updatedAt: now
    });

    await db.collection('personalIdeas').doc(personalIdeaId).update({
      importedCount: (personalIdea.importedCount || 0) + 1,
      updatedAt: now
    });

    const memberDocs = await db.collection('teamMembers').where('teamId', '==', teamId).get();
    const targetUsers = memberDocs.docs.map((doc) => doc.data().userId);
    await notifyUsers(db, targetUsers, (userId) => ({
      userId,
      teamId,
      type: 'idea_imported',
      text: `${caller?.name || caller?.email || 'User'} shaxsiy g'oyani teamga import qildi: ${personalIdea.title}`,
      relatedEntityId: importedRef.id,
      unread: userId !== decoded.uid,
      isRead: userId === decoded.uid,
      createdAt: now
    }));

    res.status(200).json({ id: importedRef.id });
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message || 'G\'oya import qilinmadi.' });
  }
};
