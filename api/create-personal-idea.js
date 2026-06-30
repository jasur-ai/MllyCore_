const { requireUser, cleanText, serverNow } = require('./_lib/firebase-admin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { db, decoded, caller } = await requireUser(req);
    const { title, description = '' } = req.body || {};
    const cleanTitle = cleanText(title);
    const cleanDescription = cleanText(description);
    if (!cleanTitle) throw new Error("G'oya nomini kiriting.");

    const now = serverNow();
    const ref = await db.collection('personalIdeas').add({
      userId: decoded.uid,
      title: cleanTitle,
      description: cleanDescription,
      createdByName: caller?.name || caller?.email || 'User',
      importedCount: 0,
      createdAt: now,
      updatedAt: now
    });

    res.status(200).json({ id: ref.id });
  } catch (error) {
    res.status(error.statusCode || 400).json({ error: error.message || 'Shaxsiy g\'oya saqlanmadi.' });
  }
};
