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
  team: 12 * 1000
};

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

  async getDashboardData(uid, { forceFresh = false } = {}) {
    const state = await this.init();
    if (!state) return { teams: [], ideas: [], notifications: [], pendingInvites: [] };
    const role = window.MLLYCORE_PROFILE?.role === 'admin' ? 'admin' : 'member';
    const cacheKey = getCacheKey('dashboard', `${role}:${uid}`);
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

          const ideaSnaps = await Promise.all(
            teams.map((team) => getDocs(query(collection(state.db, 'ideas'), where('teamId', '==', team.id))))
          );
          const ideas = ideaSnaps.flatMap((snap) => snap.docs.map((item) => ({ id: item.id, ...item.data() })));
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

  async getCollection(name) {
    const state = await this.init();
    if (!state) return [];
    const { collection, getDocs } = state.modules.dbMod;
    const snap = await getDocs(collection(state.db, name));
    return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
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
    const { doc, getDoc } = state.modules.dbMod;
    const snap = await getDoc(doc(state.db, 'ideas', ideaId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  async markNotificationsRead({ ids = [], teamId = '', relatedEntityId = '', relatedEntityIds = [], types = [] } = {}) {
    const state = await this.init();
    if (!state) return 0;
    const authUser = await this.ensureAuthed();
    const { collection, getDocs, query, serverTimestamp, where, writeBatch } = state.modules.dbMod;
    const idSet = new Set((ids || []).filter(Boolean));
    const relatedSet = new Set((relatedEntityIds || []).filter(Boolean));
    const typeSet = new Set((types || []).filter(Boolean));

    const snap = await getDocs(query(collection(state.db, 'notifications'), where('userId', '==', authUser.uid)));
    const matched = snap.docs.filter((item) => {
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
    return apiPost('/api/send-chat', authUser, { teamId, text: cleanText });
  },

  async markTeamChatSeen(teamId) {
    const authUser = await this.ensureAuthed();
    if (!teamId) throw new Error('Workspace topilmadi.');
    return apiPost('/api/send-chat', authUser, { teamId, markSeen: true });
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
    const result = await apiPost('/api/sync-tasks', authUser, { teamId });
    invalidateTeamCache(teamId);
    return result;
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
