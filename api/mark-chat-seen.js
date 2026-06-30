const { requireUser, serverNow } = require('./_lib/firebase-admin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { db, decoded, admin } = await requireUser(req);
    const { teamId } = req.body || {};
    if (!teamId) throw new Error('Workspace topilmadi.');

    const memberSnap = await db.collection('teamMembers').doc(`${teamId}_${decoded.uid}`).get();
    if (!memberSnap.exists) {
      res.status(403).json({ error: 'Siz bu workspace a\'zosi emassiz.' });
      return;
    }

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
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message || 'Chat seen yangilanmadi.' });
  }
};
