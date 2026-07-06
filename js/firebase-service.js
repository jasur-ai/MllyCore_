const firebaseState = {
  app: null,
  auth: null,
  db: null,
  modules: null,
  ready: false
};

const cacheStore = new Map();
const inflightRequests = new Map();
const CACHE_VERSION = 'v4';
const CACHE_PREFIX = `mllycore:${CACHE_VERSION}:`;
const CACHE_TTL = {
  username: 60 * 1000,
  profile: 90 * 1000,
  dashboard: 20 * 1000,
  team: 12 * 1000,
  collection: 20 * 1000,
  idea: 20 * 1000
};
const teamSyncState = new Map();

window.MllyCore = {
  async init() {
    if (!window.MLLYCORE_FIREBASE_ENABLED) return null;
    if (firebaseState.ready) return firebaseState;

    const appMod = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js');
    const dbMod = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');

    firebaseState.app = appMod.initializeApp(window.MLLYCORE_FIREBASE_CONFIG);
    firebaseState.auth = authMod.getAuth(firebaseState.app);
    await authMod.setPersistence(firebaseState.auth, authMod.browserSessionPersistence);
    firebaseState.db = dbMod.getFirestore(firebaseState.app);
    firebaseState.modules = { authMod, dbMod };
    firebaseState.ready = true;
    return firebaseState;
  },

  async getUserByUsername(username) {
    const state = await this.init();
    if (!state) return null;
    const { collection, getDocs, query, where } = state.modules.dbMod;
    const clean = normalizeUsername(username);
    if (!clean) return null;
    const cacheKey = getCacheKey('username', clean);
    const cached = readCache(cacheKey, CACHE_TTL.username);
    if (cached) return cached;
    return rememberInflight(cacheKey, async () => {
      const snap = await getDocs(query(collection(state.db, 'users'), where('username', '==', clean)));
      if (snap.empty) {
        writeCache(cacheKey, null);
        return null;
      }
      const result = { id: snap.docs[0].id, ...snap.docs[0].data() };
      writeCache(cacheKey, result);
      return result;
    });
  },

  async ensureUniqueUsername(username, excludeUserId = '') {
    const existing = await this.getUserByUsername(username);
    if (existing && existing.id !== excludeUserId) {
      throw new Error('Bu username band. Boshqa username kiriting.');
    }
  },

  async register({ firstName, lastName, username, email, password }) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan. js/firebase-config.js faylini toldiring.');

    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanUsername = normalizeUsername(username);
    if (!cleanUsername) throw new Error('Username kiriting.');
    await this.ensureUniqueUsername(cleanUsername);

    const { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } = state.modules.authMod;
    const { doc, serverTimestamp, setDoc } = state.modules.dbMod;
    const cred = await createUserWithEmailAndPassword(state.auth, cleanEmail, password);
    const displayName = `${String(firstName || '').trim()} ${String(lastName || '').trim()}`.trim();

    await updateProfile(cred.user, { displayName });
    await setDoc(doc(state.db, 'users', cred.user.uid), {
      firstName: String(firstName || '').trim(),
      lastName: String(lastName || '').trim(),
      name: displayName,
      username: cleanUsername,
      email: cleanEmail,
      role: 'member',
      avatar: initials(displayName || cleanUsername),
      verified: false,
      blocked: false,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    sendEmailVerification(cred.user).catch(() => {});
    return cred.user;
  },

  async login(identifier, password) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');

    const { signInWithEmailAndPassword } = state.modules.authMod;
    const cleanIdentifier = String(identifier || '').trim().toLowerCase();
    let email = cleanIdentifier;
    if (!cleanIdentifier.includes('@')) {
      const user = await this.getUserByUsername(cleanIdentifier);
      if (!user?.email) {
        const error = new Error("Username yoki parol noto'g'ri.");
        error.code = 'auth/invalid-credential';
        throw error;
      }
      email = user.email;
    }
    return signInWithEmailAndPassword(state.auth, email, password);
  },

  async logout() {
    const state = await this.init();
    if (!state) return;
    window.MLLYCORE_AUTH_USER = null;
    window.MLLYCORE_PROFILE = null;
    clearRuntimeCache();
    return state.modules.authMod.signOut(state.auth);
  },

  async getUserProfile(uid) {
    const state = await this.init();
    if (!state) return null;
    const { doc, getDoc } = state.modules.dbMod;
    const cacheKey = getCacheKey('profile', uid);
    const cached = readCache(cacheKey, CACHE_TTL.profile);
    if (cached) return cached;
    return rememberInflight(cacheKey, async () => {
      const snap = await getDoc(doc(state.db, 'users', uid));
      const profile = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      writeCache(cacheKey, profile);
      if (profile?.username) {
        writeCache(getCacheKey('username', profile.username), profile);
      }
      return profile;
    });
  },

  async getDashboardData(uid, { forceFresh = false, includeIdeas = false } = {}) {
    const state = await this.init();
    if (!state) return { teams: [], ideas: [], notifications: [], pendingInvites: [] };
    const role = window.MLLYCORE_PROFILE?.role || 'member';
    const cacheKey = getCacheKey('dashboard', `${role}:${uid}:${includeIdeas ? 'full' : 'lite'}`);
    if (!forceFresh) {
      const cached = readCache(cacheKey, CACHE_TTL.dashboard);
      if (cached) return cached;
    }

    try {
      return await rememberInflight(cacheKey, async () => {
        const { collection, doc, getDoc, getDocs, query, where } = state.modules.dbMod;
        let payload;
        if (window.MLLYCORE_PROFILE?.role === 'admin') {
          const teamsSnap = await getDocs(collection(state.db, 'teams'));
          const teams = teamsSnap.docs.map((item) => ({ id: item.id, membershipRole: 'admin', ...item.data() }));
          payload = { teams, ideas: [], notifications: [], pendingInvites: [] };
        } else if (window.MLLYCORE_PROFILE?.role === 'manager') {
          const assignedIds = Array.isArray(window.MLLYCORE_PROFILE.assignedTeams) ? window.MLLYCORE_PROFILE.assignedTeams : [];
          const teamDocs = await Promise.all(assignedIds.map((id) => getDoc(doc(state.db, 'teams', id))));
          const teams = teamDocs
            .map((teamDoc) => (teamDoc.exists() ? { id: teamDoc.id, membershipRole: 'manager', ...teamDoc.data() } : null))
            .filter(Boolean);
          payload = { teams, ideas: [], notifications: [], pendingInvites: [] };
        } else {
          const [memberSnap, notificationSnap, inviteSnap] = await Promise.all([
            getDocs(query(collection(state.db, 'teamMembers'), where('userId', '==', uid))),
            getDocs(query(collection(state.db, 'notifications'), where('userId', '==', uid))),
            getDocs(query(collection(state.db, 'workspaceInvites'), where('inviteeUserId', '==', uid)))
          ]);

          const memberships = memberSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
          const teamDocs = await Promise.all(memberships.map((membership) => getDoc(doc(state.db, 'teams', membership.teamId))));
          const teams = teamDocs
            .map((teamDoc, index) => (teamDoc.exists()
              ? { id: teamDoc.id, membershipRole: memberships[index].role, ...teamDoc.data() }
              : null))
            .filter(Boolean);

          let ideas = [];
          if (includeIdeas) {
            const ideaSnaps = await Promise.all(
              teams.map((team) => getDocs(query(collection(state.db, 'ideas'), where('teamId', '==', team.id))))
            );
            ideas = ideaSnaps.flatMap((snap) => snap.docs.map((item) => ({ id: item.id, ...item.data() })));
          } else {
            ideas = teams
              .flatMap((team) => (Array.isArray(team.recentIdeas) ? team.recentIdeas.map((idea) => ({
                ...idea,
                teamId: idea.teamId || team.id,
                createdAt: idea.createdAt || idea.createdAtMs || 0,
                updatedAt: idea.updatedAt || idea.updatedAtMs || idea.createdAtMs || 0
              })) : []))
              .sort(sortByCreatedAtDesc)
              .slice(0, 12);
            if (!ideas.length && teams.length) {
              const ideaSnaps = await Promise.all(
                teams.map((team) => getDocs(query(collection(state.db, 'ideas'), where('teamId', '==', team.id))))
              );
              ideas = ideaSnaps
                .flatMap((snap) => snap.docs.map((item) => ({ id: item.id, ...item.data() })))
                .sort(sortByCreatedAtDesc)
                .slice(0, 12);
            }
          }
          const notifications = notificationSnap.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .sort(sortByCreatedAtDesc);
          const pendingInvites = inviteSnap.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .filter((item) => item.status !== 'accepted')
            .sort(sortByCreatedAtDesc);

          payload = { teams, ideas, notifications, pendingInvites };
        }
        writeCache(cacheKey, payload);
        return payload;
      });
    } catch (error) {
      const stale = readCache(cacheKey, Number.POSITIVE_INFINITY);
      if (stale) return stale;
      throw error;
    }
  },

  async getCollection(name, { forceFresh = false } = {}) {
    const state = await this.init();
    if (!state) return [];
    const cacheKey = getCacheKey('collection', name);
    if (!forceFresh) {
      const cached = readCache(cacheKey, CACHE_TTL.collection);
      if (cached) return cached;
    }
    const { collection, getDocs } = state.modules.dbMod;
    const snap = await getDocs(collection(state.db, name));
    const result = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
    writeCache(cacheKey, result);
    return result;
  },

  async getTeamData(teamId, { forceFresh = false } = {}) {
    const state = await this.init();
    if (!state) return null;
    const cacheKey = getCacheKey('team', teamId);
    if (!forceFresh) {
      const cached = readCache(cacheKey, CACHE_TTL.team);
      if (cached) return cached;
    }

    try {
      return await rememberInflight(cacheKey, async () => {
        const { collection, doc, getDoc, getDocs, query, where } = state.modules.dbMod;
        const teamSnap = await getDoc(doc(state.db, 'teams', teamId));
        if (!teamSnap.exists()) {
          writeCache(cacheKey, null);
          return null;
        }
        const team = { id: teamSnap.id, ...teamSnap.data() };

        const [memberSnap, ideaSnap, messageSnap, taskSnap, taskSubmissionSnap] = await Promise.all([
          getDocs(query(collection(state.db, 'teamMembers'), where('teamId', '==', teamId))),
          getDocs(query(collection(state.db, 'ideas'), where('teamId', '==', teamId))),
          getDocs(query(collection(state.db, 'chatMessages'), where('teamId', '==', teamId))),
          getDocs(query(collection(state.db, 'tasks'), where('teamId', '==', teamId))),
          getDocs(query(collection(state.db, 'taskSubmissions'), where('teamId', '==', teamId)))
        ]);

        const memberships = memberSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
        const userProfiles = await Promise.all(memberships.map((membership) => this.getUserProfile(membership.userId)));
        const members = memberships.map((membership, index) => ({
          ...membership,
          user: userProfiles[index] || null
        }));

        const ideas = ideaSnap.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .sort(sortByCreatedAtDesc);
        const messages = messageSnap.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .sort(sortByChatAscending);
        const tasks = taskSnap.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .sort(sortByCreatedAtDesc);
        const taskSubmissions = taskSubmissionSnap.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .sort(sortByCreatedAtDesc);

        const payload = { team, members, ideas, messages, tasks, taskSubmissions };
        writeCache(cacheKey, payload);
        return payload;
      });
    } catch (error) {
      const stale = readCache(cacheKey, Number.POSITIVE_INFINITY);
      if (stale) return stale;
      throw error;
    }
  },

  async getPersonalIdeas() {
    const state = await this.init();
    if (!state) return [];
    const authUser = window.MLLYCORE_AUTH_USER;
    if (!authUser) return [];
    const { collection, getDocs, query, where } = state.modules.dbMod;
    const snap = await getDocs(query(collection(state.db, 'personalIdeas'), where('userId', '==', authUser.uid)));
    return snap.docs.map((item) => ({ id: item.id, ...item.data() })).sort(sortByCreatedAtDesc);
  },

  async getIdeaById(ideaId) {
    const state = await this.init();
    if (!state || !ideaId) return null;
    const cacheKey = getCacheKey('idea', ideaId);
    const cached = readCache(cacheKey, CACHE_TTL.idea);
    if (cached) return cached;
    const cachedIdea = findIdeaInCaches(ideaId);
    if (cachedIdea) {
      writeCache(cacheKey, cachedIdea);
      return cachedIdea;
    }
    const { doc, getDoc } = state.modules.dbMod;
    const snap = await getDoc(doc(state.db, 'ideas', ideaId));
    const idea = snap.exists() ? { id: snap.id, ...snap.data() } : null;
    writeCache(cacheKey, idea);
    return idea;
  },

  async markNotificationsRead({ ids = [], teamId = '', relatedEntityId = '', relatedEntityIds = [], types = [] } = {}) {
    const state = await this.init();
    if (!state) return 0;
    const authUser = await this.ensureAuthed();
    const { collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch } = state.modules.dbMod;
    const idSet = new Set((ids || []).filter(Boolean));
    const relatedSet = new Set((relatedEntityIds || []).filter(Boolean));
    const typeSet = new Set((types || []).filter(Boolean));
    let matched = [];

    if (idSet.size && !teamId && !relatedEntityId && !relatedSet.size && !typeSet.size) {
      const docs = await Promise.all([...idSet].map((id) => getDoc(doc(state.db, 'notifications', id))));
      matched = docs
        .filter((item) => item.exists())
        .filter((item) => {
          const data = item.data() || {};
          const unread = data.unread || data.isRead === false;
          return unread && data.userId === authUser.uid;
        });
    } else {
      const snap = await getDocs(query(collection(state.db, 'notifications'), where('userId', '==', authUser.uid)));
      matched = snap.docs.filter((item) => {
        const data = item.data() || {};
        const unread = data.unread || data.isRead === false;
        if (!unread) return false;
        if (idSet.size && !idSet.has(item.id)) return false;
        if (teamId && data.teamId !== teamId) return false;
        if (relatedEntityId && data.relatedEntityId !== relatedEntityId) return false;
        if (relatedSet.size && !relatedSet.has(data.relatedEntityId)) return false;
        if (typeSet.size && !typeSet.has(data.type)) return false;
        return true;
      });
    }

    if (!matched.length) return 0;

    const batch = writeBatch(state.db);
    matched.forEach((item) => {
      batch.update(item.ref, {
        unread: false,
        isRead: true,
        readAt: serverTimestamp()
      });
    });
    await batch.commit();

    if (window.APP_CONTEXT?.notifications?.length) {
      const matchedIds = new Set(matched.map((item) => item.id));
      window.APP_CONTEXT.notifications = window.APP_CONTEXT.notifications.map((item) => (
        matchedIds.has(item.id)
          ? { ...item, unread: false, isRead: true }
          : item
      ));
      updateDashboardNotificationCaches(authUser.uid, window.APP_CONTEXT.notifications);
    }

    return matched.length;
  },

  async createWorkspaceEntry({ teamId, title, description, type = 'idea', ownerUserId = '' }) {
    const authUser = await this.ensureAuthed();
    const cleanTitle = String(title || '').trim();
    const cleanDescription = String(description || '').trim();
    const cleanType = String(type || 'idea').trim().toLowerCase();
    if (!cleanTitle) throw new Error(cleanType === 'startup' ? 'Startup nomini kiriting.' : "G'oya nomini kiriting.");
    const result = await apiPost('/api/create-entry', authUser, {
      teamId,
      title: cleanTitle,
      description: cleanDescription,
      type: cleanType,
      ownerUserId: ownerUserId || ''
    });
    invalidateTeamCache(teamId);
    invalidateDashboardCache(authUser.uid);
    return result;
  },

  async updateStartupOwner({ teamId, ideaId, ownerUserId }) {
    const authUser = await this.ensureAuthed();
    const result = await apiPost('/api/update-entry-owner', authUser, { teamId, ideaId, ownerUserId });
    invalidateTeamCache(teamId);
    return result;
  },

  async createPersonalIdea({ title, description }) {
    const authUser = await this.ensureAuthed();
    const result = await apiPost('/api/create-personal-idea', authUser, {
      title: String(title || '').trim(),
      description: String(description || '').trim()
    });
    invalidateDashboardCache(authUser.uid);
    return result;
  },

  async importPersonalIdea({ personalIdeaId, teamId }) {
    const authUser = await this.ensureAuthed();
    const result = await apiPost('/api/import-personal-idea', authUser, { personalIdeaId, teamId });
    invalidateTeamCache(teamId);
    invalidateDashboardCache(authUser.uid);
    return result;
  },

  async sendChatMessage({ teamId, text }) {
    const authUser = await this.ensureAuthed();
    const cleanText = String(text || '').trim();
    if (!cleanText) throw new Error('Xabar matnini kiriting.');
    const result = await apiPost('/api/send-chat', authUser, { teamId, text: cleanText });
    invalidateTeamCache(teamId);
    return result;
  },

  async markTeamChatSeen(teamId) {
    const authUser = await this.ensureAuthed();
    if (!teamId) throw new Error('Workspace topilmadi.');
    const result = await apiPost('/api/send-chat', authUser, { teamId, markSeen: true });
    patchTeamCache(teamId, (teamData) => ({
      ...teamData,
      messages: (teamData.messages || []).map((message) => {
        if (message.senderUserId === authUser.uid) return message;
        const seenBy = Array.isArray(message.seenBy) ? message.seenBy : [];
        if (seenBy.includes(authUser.uid)) return message;
        return { ...message, seenBy: [...seenBy, authUser.uid] };
      })
    }));
    return result;
  },

  async subscribeTeamChat(teamId, onChange) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    if (!teamId) throw new Error('Workspace topilmadi.');
    const { collection, onSnapshot, query, where } = state.modules.dbMod;
    return onSnapshot(
      query(collection(state.db, 'chatMessages'), where('teamId', '==', teamId)),
      (snapshot) => {
        const messages = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .sort(sortByChatAscending);
        patchTeamCache(teamId, (teamData) => ({ ...teamData, messages }));
        onChange(messages);
      }
    );
  },

  async subscribeUserNotifications(uid, onChange) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    if (!uid) throw new Error('Foydalanuvchi topilmadi.');
    const { collection, onSnapshot, query, where } = state.modules.dbMod;
    return onSnapshot(
      query(collection(state.db, 'notifications'), where('userId', '==', uid)),
      (snapshot) => {
        const notifications = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .sort(sortByCreatedAtDesc);
        if (window.APP_CONTEXT) {
          window.APP_CONTEXT.notifications = notifications;
        }
        updateDashboardNotificationCaches(uid, notifications);
        onChange(notifications);
      }
    );
  },

  async createWorkspace({ name, description, leadEmail }) {
    const profile = window.MLLYCORE_PROFILE;
    const authUser = await this.ensureAuthed();
    if (profile?.role !== 'admin') throw new Error('Workspace yaratish faqat admin uchun.');
    if (!name?.trim()) throw new Error('Workspace nomini kiriting.');
    if (!leadEmail?.trim()) throw new Error('Team lead emailini kiriting.');
    const result = await apiPost('/api/create-workspace', authUser, {
      name: name.trim(),
      description: description?.trim() || '',
      leadEmail: leadEmail.trim()
    });
    invalidateDashboardCache(authUser.uid);
    invalidateCacheByPrefix(getCacheKey('team', ''));
    return result;
  },

  async inviteWorkspaceMember({ teamId, email }) {
    const authUser = await this.ensureAuthed();
    if (!teamId) throw new Error('Workspace topilmadi.');
    if (!email?.trim()) throw new Error('Email kiriting.');
    const result = await apiPost('/api/invite-member', authUser, {
      teamId,
      email: email.trim().toLowerCase()
    });
    invalidateTeamCache(teamId);
    return result;
  },

  async acceptWorkspaceInvite({ inviteId, secretKey }) {
    const authUser = await this.ensureAuthed();
    if (!inviteId) throw new Error('Taklif topilmadi.');
    if (!secretKey?.trim()) throw new Error('Secret key kiriting.');
    const result = await apiPost('/api/accept-invite', authUser, {
      inviteId,
      secretKey: secretKey.trim().toUpperCase()
    });
    invalidateDashboardCache(authUser.uid);
    invalidateCacheByPrefix(getCacheKey('team', ''));
    return result;
  },

  async resetWorkspaceSecret(teamId) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    if (!teamId) throw new Error('Workspace topilmadi.');
    const { doc, serverTimestamp, updateDoc } = state.modules.dbMod;
    const secretKey = generateSecretKey();
    await updateDoc(doc(state.db, 'teams', teamId), {
      secretKey,
      invitationCode: secretKey,
      updatedAt: serverTimestamp()
    });
    invalidateTeamCache(teamId);
    invalidateCacheByPrefix(getCacheKey('dashboard', ''));
    return secretKey;
  },

  async updateUserProfile({ name, username }) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    const authUser = window.MLLYCORE_AUTH_USER;
    if (!authUser) throw new Error('Avval tizimga kiring.');
    const cleanUsername = normalizeUsername(username);
    if (!cleanUsername) throw new Error('Username kiriting.');
    await this.ensureUniqueUsername(cleanUsername, authUser.uid);
    const { doc, serverTimestamp, updateDoc } = state.modules.dbMod;
    const cleanName = String(name || '').trim();
    await updateDoc(doc(state.db, 'users', authUser.uid), {
      name: cleanName || cleanUsername,
      username: cleanUsername,
      avatar: initials(cleanName || cleanUsername || authUser.email || 'U'),
      updatedAt: serverTimestamp()
    });
    window.MLLYCORE_PROFILE = {
      ...(window.MLLYCORE_PROFILE || {}),
      name: cleanName || cleanUsername,
      username: cleanUsername,
      avatar: initials(cleanName || cleanUsername || authUser.email || 'U')
    };
    invalidateProfileCache(authUser.uid, cleanUsername);
  },

  async sendPasswordReset() {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    const user = window.MLLYCORE_AUTH_USER;
    if (!user?.email) throw new Error('Email topilmadi.');
    const { sendPasswordResetEmail } = state.modules.authMod;
    await sendPasswordResetEmail(state.auth, user.email);
  },

  async sendEmailVerificationLink() {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    const user = state.auth.currentUser;
    if (!user?.email) throw new Error('Email topilmadi.');
    if (user.emailVerified) return true;
    const { sendEmailVerification } = state.modules.authMod;
    await sendEmailVerification(user);
    return true;
  },

  async reloadCurrentUser() {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    const user = state.auth.currentUser;
    if (!user) throw new Error('Avval tizimga kiring.');
    await user.reload();
    return state.auth.currentUser;
  },

  async changePassword({ currentPassword, newPassword }) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    const user = state.auth.currentUser;
    if (!user?.email) throw new Error('Akkaunt topilmadi.');
    if (!currentPassword) throw new Error('Hozirgi parolni kiriting.');
    if (!newPassword || newPassword.length < 6) throw new Error("Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak.");

    const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = state.modules.authMod;
    const { doc, serverTimestamp, updateDoc } = state.modules.dbMod;
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
    await updateDoc(doc(state.db, 'users', user.uid), {
      passwordResetRequired: false,
      updatedAt: serverTimestamp()
    });
  },

  async reauthenticate(password) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    const user = state.auth.currentUser;
    if (!user?.email) throw new Error('Admin sessiyasi topilmadi.');
    if (!password) throw new Error('Admin parolini kiriting.');
    const { EmailAuthProvider, reauthenticateWithCredential } = state.modules.authMod;
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
  },

  async createTask(payload) {
    const authUser = await this.ensureAuthed();
    const result = await apiPost('/api/create-task', authUser, payload);
    invalidateTeamCache(payload?.teamId);
    return result;
  },

  async claimOpenTask(taskId) {
    const authUser = await this.ensureAuthed();
    const result = await apiPost('/api/task-action', authUser, { taskId, action: 'claim' });
    invalidateCacheByPrefix(getCacheKey('team', ''));
    return result;
  },

  async submitTaskResult({ taskId, resultText, resultLink = '' }) {
    const authUser = await this.ensureAuthed();
    const result = await apiPost('/api/task-action', authUser, {
      taskId,
      action: 'submit',
      resultText: String(resultText || '').trim(),
      resultLink: String(resultLink || '').trim()
    });
    invalidateCacheByPrefix(getCacheKey('team', ''));
    return result;
  },

  async syncTeamTasks(teamId) {
    const authUser = await this.ensureAuthed();
    const lastRun = teamSyncState.get(teamId) || 0;
    if (Date.now() - lastRun < 15000) {
      return { ok: true, throttled: true };
    }
    teamSyncState.set(teamId, Date.now());
    const result = await apiPost('/api/sync-tasks', authUser, { teamId });
    invalidateTeamCache(teamId);
    return result;
  },

  async prefetchRouteData(href = '') {
    try {
      const authUser = await this.ensureAuthed();
      const target = new URL(href, location.href);
      const page = (target.pathname.split('/').pop() || 'dashboard.html').toLowerCase();
      const teamId = target.searchParams.get('id');
      const ideaId = target.searchParams.get('id');

      if (page === 'dashboard.html' || page === 'notifications.html') {
        await this.getDashboardData(authUser.uid);
        return;
      }
      if (page === 'my-ideas.html') {
        await this.getDashboardData(authUser.uid, { includeIdeas: true });
        return;
      }
      if (page === 'team.html' && teamId) {
        await Promise.all([
          this.getDashboardData(authUser.uid),
          this.getTeamData(teamId)
        ]);
        return;
      }
      if (page === 'idea.html' && ideaId) {
        await Promise.all([
          this.getDashboardData(authUser.uid),
          this.getIdeaById(ideaId)
        ]);
        return;
      }
      if (page === 'admin.html' && window.MLLYCORE_PROFILE?.role === 'admin') {
        await Promise.all([
          this.getCollection('users'),
          this.getCollection('teams')
        ]);
      }
    } catch (_) {}
  },

  async getReports({ teamId = '', type = '', userId = '', targetRole = '' } = {}, { forceFresh = false } = {}) {
    const state = await this.init();
    if (!state) return [];
    const cacheKey = getCacheKey('reports', `${teamId}:${type}:${userId}:${targetRole}`);
    if (!forceFresh) {
      const cached = readCache(cacheKey, 1000 * 30);
      if (cached) return cached;
    }
    const { collection, getDocs, query, where } = state.modules.dbMod;
    let constraints = [];
    if (teamId) constraints.push(where('teamId', '==', teamId));
    if (type) constraints.push(where('type', '==', type));
    if (userId) constraints.push(where('userId', '==', userId));
    if (targetRole) constraints.push(where('targetRole', '==', targetRole));
    const q = constraints.length ? query(collection(state.db, 'reports'), ...constraints) : collection(state.db, 'reports');
    const snap = await getDocs(q);
    const results = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort(sortByCreatedAtDesc);
    writeCache(cacheKey, results);
    return results;
  },

  async createReport({ type, teamId = '', teamName = '', link, description, targetRole = 'team_lead' }) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    const authUser = await this.ensureAuthed();
    const profile = window.MLLYCORE_PROFILE || {};
    const { addDoc, collection } = state.modules.dbMod;
    const now = Date.now();
    const docRef = await addDoc(collection(state.db, 'reports'), {
      type,
      teamId,
      teamName,
      userId: authUser.uid,
      userName: profile.name || authUser.email,
      userRole: profile.role || 'member',
      link: String(link || '').trim(),
      description: String(description || '').trim(),
      status: 'pending',
      feedback: '',
      targetRole,
      createdAt: now,
      updatedAt: now
    });
    invalidateCacheByPrefix(getCacheKey('reports', ''));
    return { id: docRef.id, type, teamId, link, description, status: 'pending' };
  },

  async updateReportStatus({ reportId, status, feedback = '' }) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    await this.ensureAuthed();
    const { doc, updateDoc } = state.modules.dbMod;
    await updateDoc(doc(state.db, 'reports', reportId), {
      status,
      feedback: String(feedback || '').trim(),
      updatedAt: Date.now()
    });
    invalidateCacheByPrefix(getCacheKey('reports', ''));
    return { success: true };
  },

  async createOrPromoteManager({ email, name }) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    await this.ensureAuthed();
    if (window.MLLYCORE_PROFILE?.role !== 'admin') throw new Error('Faqat admin manager qo\'sha oladi.');
    const { collection, getDocs, query, where, doc, setDoc } = state.modules.dbMod;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const q = query(collection(state.db, 'users'), where('email', '==', cleanEmail));
    const snap = await getDocs(q);
    const now = Date.now();
    if (!snap.empty) {
      const userDoc = snap.docs[0];
      await setDoc(doc(state.db, 'users', userDoc.id), {
        role: 'manager',
        name: name || userDoc.data().name,
        updatedAt: now
      }, { merge: true });
      invalidateCacheByPrefix(getCacheKey('dashboard', ''));
      return { id: userDoc.id, email: cleanEmail, name: name || userDoc.data().name, role: 'manager' };
    } else {
      const fakeId = 'mgr_' + Math.random().toString(36).slice(2, 11);
      await setDoc(doc(state.db, 'users', fakeId), {
        email: cleanEmail,
        name: name || cleanEmail.split('@')[0],
        username: cleanEmail.split('@')[0],
        role: 'manager',
        assignedTeams: [],
        assignedTeamNames: [],
        verified: true,
        createdAt: now,
        updatedAt: now
      });
      invalidateCacheByPrefix(getCacheKey('dashboard', ''));
      return { id: fakeId, email: cleanEmail, name: name || cleanEmail.split('@')[0], role: 'manager' };
    }
  },

  async assignTeamToManager({ managerUserId, teamId, teamName }) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    if (window.MLLYCORE_PROFILE?.role !== 'admin') throw new Error('Faqat admin tayinlay oladi.');
    const { doc, getDoc, updateDoc } = state.modules.dbMod;
    const userRef = doc(state.db, 'users', managerUserId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error('Manager topilmadi.');
    const data = userSnap.data();
    const assignedTeams = Array.isArray(data.assignedTeams) ? [...data.assignedTeams] : [];
    const assignedTeamNames = Array.isArray(data.assignedTeamNames) ? [...data.assignedTeamNames] : [];
    if (!assignedTeams.includes(teamId)) {
      assignedTeams.push(teamId);
      assignedTeamNames.push(teamName);
      await updateDoc(userRef, { assignedTeams, assignedTeamNames, updatedAt: Date.now() });
    }
    const teamRef = doc(state.db, 'teams', teamId);
    const teamSnap = await getDoc(teamRef);
    if (teamSnap.exists()) {
      await updateDoc(teamRef, { managerUserId, updatedAt: Date.now() });
    }
    invalidateCacheByPrefix(getCacheKey('dashboard', ''));
    return { success: true, assignedTeams, assignedTeamNames };
  },

  async removeTeamFromManager({ managerUserId, teamId }) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    if (window.MLLYCORE_PROFILE?.role !== 'admin') throw new Error('Faqat admin olib tashlay oladi.');
    const { doc, getDoc, updateDoc } = state.modules.dbMod;
    const userRef = doc(state.db, 'users', managerUserId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error('Manager topilmadi.');
    const data = userSnap.data();
    const assignedTeams = Array.isArray(data.assignedTeams) ? data.assignedTeams.filter(id => id !== teamId) : [];
    const assignedTeamNames = Array.isArray(data.assignedTeamNames) ? data.assignedTeamNames.filter((name, idx) => (data.assignedTeams || [])[idx] !== teamId) : [];
    await updateDoc(userRef, { assignedTeams, assignedTeamNames, updatedAt: Date.now() });
    const teamRef = doc(state.db, 'teams', teamId);
    const teamSnap = await getDoc(teamRef);
    if (teamSnap.exists() && teamSnap.data().managerUserId === managerUserId) {
      await updateDoc(teamRef, { managerUserId: '', updatedAt: Date.now() });
    }
    invalidateCacheByPrefix(getCacheKey('dashboard', ''));
    return { success: true };
  },

  async deleteWorkspace(teamId, adminPassword) {
    await this.reauthenticate(adminPassword);
    const authUser = window.MLLYCORE_AUTH_USER;
    const result = await apiPost('/api/delete-workspace', authUser, { teamId }, true);
    invalidateTeamCache(teamId);
    invalidateDashboardCache(authUser?.uid);
    return result;
  },

  async ensureAuthed() {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    const authUser = window.MLLYCORE_AUTH_USER || state.auth.currentUser;
    if (!authUser) throw new Error('Avval tizimga kiring.');
    return authUser;
  },

  async requireAuth() {
    const state = await this.init();
    if (!state) {
      location.href = 'login.html';
      return null;
    }

    const { onAuthStateChanged } = state.modules.authMod;
    return new Promise((resolve) => {
      onAuthStateChanged(state.auth, async (user) => {
        if (!user) {
          location.href = 'login.html';
          resolve(null);
          return;
        }

        const currentPage = location.pathname.split('/').pop() || 'index.html';
        if (!user.emailVerified && currentPage !== 'verify-email.html') {
          location.href = 'verify-email.html';
          resolve(null);
          return;
        }

        let profile = await this.getUserProfile(user.uid);
        if (!profile) {
          profile = {
            id: user.uid,
            name: user.displayName || user.email,
            username: (user.email || 'user').split('@')[0],
            email: user.email,
            role: 'member',
            avatar: initials(user.displayName || user.email || 'U')
          };
        }
        const requiredRole = document.documentElement.dataset.requiredRole;
        if (requiredRole && profile?.role !== requiredRole) {
          location.href = 'dashboard.html';
          resolve(null);
          return;
        }

        window.MLLYCORE_AUTH_USER = user;
        window.MLLYCORE_PROFILE = profile;
        document.documentElement.classList.add('auth-ready');
        resolve(user);
      });
    });
  }
};

async function apiPost(url, authUser, body, forceRefreshToken = false) {
  const idToken = await authUser.getIdToken(forceRefreshToken);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body || {})
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'So\'rov bajarilmadi.');
  return payload;
}

function normalizeUsername(username) {
  return String(username || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function initials(name) {
  return String(name || 'U')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function generateSecretKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const parts = [];
  for (let p = 0; p < 4; p += 1) {
    let part = '';
    for (let i = 0; i < 4; i += 1) {
      part += chars[Math.floor(Math.random() * chars.length)];
    }
    parts.push(part);
  }
  return parts.join('-');
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value.toMillis) return value.toMillis();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function sortByCreatedAtDesc(a, b) {
  return toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt);
}

function sortByChatAscending(a, b) {
  return toMillis(a.createdAt) - toMillis(b.createdAt) || toMillis(a.clientCreatedAt) - toMillis(b.clientCreatedAt);
}

function getCacheKey(type, id) {
  return `${CACHE_PREFIX}${type}:${id}`;
}

function rememberInflight(key, loader) {
  if (inflightRequests.has(key)) return inflightRequests.get(key);
  const request = Promise.resolve()
    .then(loader)
    .finally(() => {
      inflightRequests.delete(key);
    });
  inflightRequests.set(key, request);
  return request;
}

function readCache(key, maxAge = 0) {
  const now = Date.now();
  const runtimeEntry = cacheStore.get(key);
  if (runtimeEntry && now - runtimeEntry.cachedAt <= maxAge) {
    return cloneForUse(runtimeEntry.value);
  }

  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    cacheStore.set(key, parsed);
    if (now - parsed.cachedAt > maxAge) return null;
    return cloneForUse(parsed.value);
  } catch {
    return null;
  }
}

function writeCache(key, value) {
  const entry = {
    cachedAt: Date.now(),
    value: dehydrateForCache(value)
  };
  cacheStore.set(key, entry);
  try {
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {}
}

function invalidateDashboardCache(uid = '') {
  if (uid) {
    invalidateCacheByPrefix(getCacheKey('dashboard', `admin:${uid}`));
    invalidateCacheByPrefix(getCacheKey('dashboard', `member:${uid}`));
    return;
  }
  invalidateCacheByPrefix(getCacheKey('dashboard', ''));
}

function invalidateTeamCache(teamId = '') {
  if (!teamId) {
    invalidateCacheByPrefix(getCacheKey('team', ''));
    return;
  }
  invalidateCacheByPrefix(getCacheKey('team', teamId));
}

function invalidateProfileCache(uid = '', username = '') {
  if (uid) invalidateCacheByPrefix(getCacheKey('profile', uid));
  if (username) invalidateCacheByPrefix(getCacheKey('username', normalizeUsername(username)));
}

function invalidateCacheByPrefix(prefix) {
  [...cacheStore.keys()].forEach((key) => {
    if (key.startsWith(prefix)) cacheStore.delete(key);
  });
  try {
    const keysToDelete = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(prefix)) keysToDelete.push(key);
    }
    keysToDelete.forEach((key) => sessionStorage.removeItem(key));
  } catch {}
}

function clearRuntimeCache() {
  cacheStore.clear();
  inflightRequests.clear();
  invalidateCacheByPrefix(CACHE_PREFIX);
}

function dehydrateForCache(value) {
  if (value == null) return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (Array.isArray(value)) return value.map((item) => dehydrateForCache(item));
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object') {
    const output = {};
    Object.entries(value).forEach(([key, item]) => {
      output[key] = dehydrateForCache(item);
    });
    return output;
  }
  return value;
}

function cloneForUse(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((item) => cloneForUse(item));
  if (typeof value === 'object') {
    const output = {};
    Object.entries(value).forEach(([key, item]) => {
      output[key] = cloneForUse(item);
    });
    return output;
  }
  return value;
}

function patchTeamCache(teamId, updater) {
  if (!teamId || typeof updater !== 'function') return;
  const cacheKey = getCacheKey('team', teamId);
  const current = readCache(cacheKey, Number.POSITIVE_INFINITY);
  if (!current) return;
  const next = updater(current);
  if (!next) return;
  writeCache(cacheKey, next);
}

function updateDashboardNotificationCaches(uid, notifications) {
  ['admin', 'manager', 'team_lead', 'member'].forEach((role) => {
    ['lite', 'full'].forEach((mode) => {
      const cacheKey = getCacheKey('dashboard', `${role}:${uid}:${mode}`);
      const cached = readCache(cacheKey, Number.POSITIVE_INFINITY);
      if (!cached) return;
      writeCache(cacheKey, { ...cached, notifications });
    });
  });
}

function findIdeaInCaches(ideaId) {
  for (const [key, value] of cacheStore.entries()) {
    if (!key.includes(':dashboard:') && !key.includes(':team:')) continue;
    const payload = value?.value;
    if (Array.isArray(payload?.ideas)) {
      const match = payload.ideas.find((item) => item.id === ideaId);
      if (match) return cloneForUse(match);
    }
  }
  return null;
}
