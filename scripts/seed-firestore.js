const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const serviceAccountPath = path.join(root, 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath) && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("serviceAccountKey.json topilmadi. Firebase Console > Project settings > Service accounts dan JSON kalitni yuklab, loyiha ildiziga shu nom bilan qo'ying.");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: fs.existsSync(serviceAccountPath)
      ? admin.credential.cert(require(serviceAccountPath))
      : admin.credential.applicationDefault(),
    projectId: 'mllycore'
  });
}

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'js', 'app-data.js'), 'utf8'), context);

const data = context.window.MOCK;
const db = admin.firestore();
const now = admin.firestore.FieldValue.serverTimestamp();

async function set(collection, id, value) {
  await db.collection(collection).doc(id).set(value, { merge: true });
}

async function seed() {
  const batchSize = [];

  for (const user of data.users) {
    batchSize.push(set('users', user.id, {
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      verified: user.verified,
      blocked: user.blocked,
      joinedAt: user.joined,
      updatedAt: now
    }));
  }

  for (const team of data.teams) {
    batchSize.push(set('teams', team.id, {
      name: team.name,
      logo: team.logo,
      color: team.color,
      description: team.description,
      createdByUserId: team.lead,
      invitationCode: team.code,
      createdAt: team.created,
      updatedAt: now,
      archived: false
    }));

    for (const userId of team.members) {
      batchSize.push(set('teamMembers', `${team.id}_${userId}`, {
        teamId: team.id,
        userId,
        role: userId === team.lead ? 'team_lead' : 'member',
        joinedAt: team.created,
        updatedAt: now
      }));
    }
  }

  for (const idea of data.ideas) {
    batchSize.push(set('ideas', idea.id, {
      teamId: idea.teamId,
      title: idea.title,
      description: idea.desc || '',
      problem: idea.problem || '',
      solution: idea.solution || '',
      market: idea.market || '',
      category: idea.category,
      status: idea.status,
      createdByUserId: idea.author,
      commentsCount: idea.comments || 0,
      createdAt: idea.created,
      updatedAt: idea.updated
    }));
  }

  for (const [ideaId, comments] of Object.entries(data.comments || {})) {
    for (const comment of comments) {
      batchSize.push(set('ideaComments', comment.id, {
        ideaId,
        userId: comment.user,
        text: comment.text,
        createdAt: comment.date,
        updatedAt: comment.date
      }));
    }
  }

  for (const [teamId, messages] of Object.entries(data.messages || {})) {
    for (const message of messages) {
      batchSize.push(set('chatMessages', message.id, {
        teamId,
        senderUserId: message.user,
        text: message.text,
        createdAt: message.time,
        updatedAt: message.time
      }));
    }
  }

  for (const notification of data.notifications) {
    batchSize.push(set('notifications', notification.id, {
      userId: data.currentUser.id,
      type: notification.type,
      content: notification.text,
      isRead: !notification.unread,
      createdAt: notification.time,
      updatedAt: now
    }));
  }

  for (const log of data.logs) {
    const id = Buffer.from(`${log.time}-${log.user}-${log.action}`).toString('base64url').slice(0, 20);
    batchSize.push(set('auditLogs', id, {
      time: log.time,
      user: log.user,
      action: log.action,
      target: log.target,
      createdAt: now
    }));
  }

  await Promise.all(batchSize);
  console.log(`MllyCore Firestore seed tugadi: ${batchSize.length} hujjat yozildi.`);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
