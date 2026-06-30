const { initAdmin } = require('../api/_lib/firebase-admin');

initAdmin();

const admin = require('firebase-admin');
const db = admin.firestore();

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function sortDesc(a, b) {
  return toMillis(b.updatedAtMs || b.updatedAt || b.createdAtMs || b.createdAt) - toMillis(a.updatedAtMs || a.updatedAt || a.createdAtMs || a.createdAt);
}

async function main() {
  const teamsSnap = await db.collection('teams').get();
  console.log(`Teamlar soni: ${teamsSnap.size}`);

  for (const teamDoc of teamsSnap.docs) {
    const teamId = teamDoc.id;
    const [membersSnap, ideasSnap, tasksSnap, messagesSnap] = await Promise.all([
      db.collection('teamMembers').where('teamId', '==', teamId).get(),
      db.collection('ideas').where('teamId', '==', teamId).get(),
      db.collection('tasks').where('teamId', '==', teamId).get(),
      db.collection('chatMessages').where('teamId', '==', teamId).get()
    ]);

    const ideas = ideasSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort(sortDesc);
    const tasks = tasksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort(sortDesc);
    const messages = messagesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort(sortDesc);

    const recentIdeas = ideas.slice(0, 10).map((idea) => ({
      id: idea.id,
      teamId,
      title: idea.title || '',
      description: idea.description || '',
      status: idea.status || idea.category || '',
      category: idea.category || '',
      entryType: idea.entryType || 'idea',
      ownerName: idea.ownerName || '',
      createdByName: idea.createdByName || '',
      createdAtMs: toMillis(idea.createdAtMs || idea.createdAt),
      updatedAtMs: toMillis(idea.updatedAtMs || idea.updatedAt || idea.createdAtMs || idea.createdAt)
    }));

    const recentTasks = tasks.slice(0, 10).map((task) => ({
      id: task.id,
      teamId,
      title: task.title || '',
      status: task.status || 'open',
      assignmentMode: task.assignmentMode || 'open',
      assignedUserName: task.assignedUserName || '',
      createdByName: task.createdByName || '',
      deadlineAt: task.deadlineAt || '',
      progressCount: task.progressCount || 0,
      requiredCount: task.requiredCount || 1,
      createdAtMs: toMillis(task.createdAtMs || task.createdAt),
      updatedAtMs: toMillis(task.updatedAtMs || task.updatedAt || task.createdAtMs || task.createdAt)
    }));

    const recentMessages = messages.slice(0, 10).map((message) => ({
      id: message.id,
      teamId,
      senderUserId: message.senderUserId || '',
      senderName: message.senderName || '',
      text: String(message.text || '').slice(0, 140),
      createdAtMs: toMillis(message.createdAtMs || message.createdAt || message.clientCreatedAt),
      updatedAtMs: toMillis(message.updatedAtMs || message.updatedAt || message.createdAtMs || message.createdAt || message.clientCreatedAt)
    }));

    const lastActivityAtMs = Math.max(
      toMillis(teamDoc.data().updatedAt),
      recentIdeas[0]?.updatedAtMs || 0,
      recentTasks[0]?.updatedAtMs || 0,
      recentMessages[0]?.updatedAtMs || 0
    );

    await teamDoc.ref.set({
      membersCount: membersSnap.size,
      ideasCount: ideas.filter((idea) => idea.entryType !== 'startup').length,
      startupsCount: ideas.filter((idea) => idea.entryType === 'startup').length,
      tasksCount: tasks.length,
      chatCount: messages.length,
      recentIdeas,
      recentTasks,
      recentMessages,
      lastIdea: recentIdeas[0] || null,
      lastTask: recentTasks[0] || null,
      lastMessage: recentMessages[0] || null,
      lastActivityAtMs
    }, { merge: true });

    console.log(`Backfill: ${teamDoc.data().name || teamId}`);
  }

  console.log('Team summary backfill tugadi.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
