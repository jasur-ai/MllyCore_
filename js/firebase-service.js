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

    if (window.__mlly_init_promise) return window.__mlly_init_promise;

    window.__mlly_init_promise = (async () => {
      try {
        console.log('[MllyCore] init: Loading Firebase SDK...');

        const [appMod, authMod, dbMod] = await Promise.all([
          import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
          import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),
          import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js')
        ]);

        console.log('[MllyCore] init: SDK loaded, initializing...');

        firebaseState.app = appMod.initializeApp(window.MLLYCORE_FIREBASE_CONFIG);
        firebaseState.auth = authMod.getAuth(firebaseState.app);

        var isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

        if (isLocal) {
          try {
            authMod.connectAuthEmulator(firebaseState.auth, 'http://localhost:9099', { disableWarnings: true });
          } catch (e) {
            console.warn('[MllyCore] init: Auth emulator connection failed:', e);
          }
        }

        await authMod.setPersistence(firebaseState.auth, authMod.browserSessionPersistence);

        let db;
        try {
          if (dbMod.initializeFirestore && dbMod.persistentLocalCache) {
            db = dbMod.initializeFirestore(firebaseState.app, {
              localCache: dbMod.persistentLocalCache({ tabManager: dbMod.persistentMultipleTabManager() }),
            });
          } else {
            db = dbMod.getFirestore(firebaseState.app);
          }
        } catch (e) {
          db = dbMod.getFirestore(firebaseState.app);
        }

        if (isLocal) {
          try {
            dbMod.connectFirestoreEmulator(db, 'localhost', 8081);
          } catch (e) {
            console.warn('[MllyCore] init: Firestore emulator connection failed:', e);
          }
        }

        firebaseState.db = db;
        firebaseState.modules = { authMod, dbMod };
        firebaseState.ready = true;
        console.log('[MllyCore] init: READY');
        return firebaseState;
      } catch (e) {
        console.error('[MllyCore] init() xatosi:', e.message);
        firebaseState.ready = false;
        window.__mlly_init_promise = null;
        throw e;
      }
    })();

    return window.__mlly_init_promise;
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
      try {
        const snap = await getDocs(query(collection(state.db, 'users'), where('username', '==', clean)));
        if (snap.empty) {
          writeCache(cacheKey, null);
          return null;
        }
        const result = { id: snap.docs[0].id, ...snap.docs[0].data() };
        writeCache(cacheKey, result);
        return result;
      } catch (err) {
        if (err?.code === 'permission-denied' || String(err?.message || '').toLowerCase().includes('permission')) {
          return null;
        }
        throw err;
      }
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
          const teamDocs = await Promise.all(assignedIds.map((id) => getDoc(doc(state.db, 'teams', id)).catch(() => ({ exists: () => false }))));
          const teams = teamDocs
            .map((teamDoc) => (teamDoc.exists() ? { id: teamDoc.id, membershipRole: 'manager', ...teamDoc.data() } : null))
            .filter(Boolean);
          // Managerlar ham bildirishnomalarni ko'rishi kerak!
          const notificationSnap = await getDocs(query(collection(state.db, 'notifications'), where('userId', '==', uid))).catch(() => ({ docs: [] }));
          const notifications = notificationSnap.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .sort(sortByCreatedAtDesc);
          payload = { teams, ideas: [], notifications, pendingInvites: [] };
        } else {
          const [memberSnap, notificationSnap, inviteSnap] = await Promise.all([
            getDocs(query(collection(state.db, 'teamMembers'), where('userId', '==', uid))).catch(() => ({ docs: [] })),
            getDocs(query(collection(state.db, 'notifications'), where('userId', '==', uid))).catch(() => ({ docs: [] })),
            getDocs(query(collection(state.db, 'workspaceInvites'), where('inviteeUserId', '==', uid))).catch(() => ({ docs: [] }))
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

        // FIX: Har bir so'rovga individual error handling va default qiymatlar
        const safeGet = async (query) => {
          try { return await getDocs(query); } catch (e) { console.warn('Firestore fetch xatosi:', e.message); return { docs: [] }; }
        };

        const [memberSnap, ideaSnap, messageSnap, taskSnap, taskSubmissionSnap] = await Promise.all([
          safeGet(query(collection(state.db, 'teamMembers'), where('teamId', '==', teamId))),
          safeGet(query(collection(state.db, 'ideas'), where('teamId', '==', teamId))),
          safeGet(query(collection(state.db, 'chatMessages'), where('teamId', '==', teamId))),
          safeGet(query(collection(state.db, 'tasks'), where('teamId', '==', teamId))),
          safeGet(query(collection(state.db, 'taskSubmissions'), where('teamId', '==', teamId)))
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

  async createWorkspace({ name, description, leadEmail, templateId = '' } = {}) {
    const profile = window.MLLYCORE_PROFILE;
    const authUser = await this.ensureAuthed();
    if (profile?.role !== 'admin') throw new Error('Workspace yaratish faqat admin uchun.');
    if (!name?.trim()) throw new Error('Workspace nomini kiriting.');
    if (!leadEmail?.trim()) throw new Error('Team lead emailini kiriting.');
    const result = await apiPost('/api/create-workspace', authUser, {
      name: name.trim(),
      description: description?.trim() || '',
      leadEmail: leadEmail.trim(),
      templateId
    });
    invalidateDashboardCache(authUser.uid);
    invalidateCacheByPrefix(getCacheKey('team', ''));
    return result;
  },

  // ===== T6 Feature Flags =====
  async getFeatureFlags({ teamId = '' } = {}) {
    const authUser = await this.ensureAuthed();
    const params = teamId ? '?teamId=' + encodeURIComponent(teamId) : '';
    return apiGet('/api/feature-flags' + params, authUser);
  },
  async setFeatureFlags({ flags = {}, target = 'global' } = {}) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/set-feature-flags', authUser, { flags, target });
  },

  // ===== T1 Archive / Restore (soft delete) =====
  async archiveWorkspace(teamId, restore = false) {
    const authUser = await this.ensureAuthed();
    const result = await apiPost('/api/archive-workspace', authUser, { teamId, restore });
    invalidateTeamCache(teamId);
    invalidateDashboardCache(authUser.uid);
    return result;
  },

  // ===== T11 Member permission override =====
  async updateMemberPermissions({ teamId, userId, permissionsOverride }) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/member-permissions', authUser, { teamId, userId, permissionsOverride });
  },

  // ===== T12 Rollback (audit previousState) =====
  async rollbackAction(auditId) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/rollback', authUser, { auditId });
  },

  // ===== T15 Cross-workspace overview =====
  async getMyOverview() {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/my-overview', authUser, {});
  },

  // ===== T4 Time logging =====
  async logTime({ teamId, taskId, durationMs }) {
    const authUser = await this.ensureAuthed();
    const result = await apiPost('/api/log-time', authUser, { teamId, taskId, durationMs });
    invalidateTeamCache(teamId);
    return result;
  },

  // ===== T7 Export my data =====
  async exportMyData() {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/export-my-data', authUser, {});
  },

  // ===== T9 Presence (client-side Firestore) — professional heartbeat + visibility =====
  // UPDATED FIX: 
  // 1. Heartbeat har 60 soniyada ishlaydi — `lastSeen` yangilanib turadi
  // 2. Sahifa yashirin (hidden) bo'lsa → 'away', ko'rinsa → 'online'
  // 3. `pagehide` va `beforeunload` → 'offline' (oldin `beforeunload` yetarli emas edi)
  // 4. Eski `beforeunload` lista o'rniga reliable event'lar ishlatiladi
  _presenceCleanup: null,
  async updatePresence(status = 'online') {
    const state = await this.init();
    if (!state) return;
    const authUser = await this.ensureAuthed();
    const { doc, setDoc, serverTimestamp } = state.modules.dbMod;
    const uid = authUser.uid;
    const ref = doc(state.db, 'presence', uid);
    const write = (s) => setDoc(ref, { status: s, lastSeen: serverTimestamp(), updatedAt: Date.now() }, { merge: true });
    await write(status);

    // Avvalgi cleanup (agar oldin call bo'lgan bo'lsa)
    if (this._presenceCleanup) {
      this._presenceCleanup();
      this._presenceCleanup = null;
    }

    // Heartbeat interval — har 60 soniyada `lastSeen` ni yangilab turadi
    // Agar foydalanuvchi o'chirib qo'ysa, `lastSeen` eski bo'lib qoladi va offline hisoblanadi
    const beatInterval = setInterval(async () => {
      try {
        // lastSeen ni updateServerTimestamp bilan yangilash (firestore-server vaqt)
        await setDoc(ref, { lastSeen: serverTimestamp(), updatedAt: Date.now() }, { merge: true });
      } catch (_) {}
    }, 120000); // har 2 daqiqada — 5 daqiqalik stale threshold yetarli

    // Visibility change — tab yashirin bo'lsa 'away', ko'rinsa 'online'
    const visHandler = () => {
      if (document.visibilityState === 'hidden') {
        write('away');
      } else {
        write('online');
      }
    };
    document.addEventListener('visibilitychange', visHandler);

    // Pagehide (reliable: mobile Safari, bfcache, close tab) → 'offline'
    const pageHideHandler = () => write('offline');
    window.addEventListener('pagehide', pageHideHandler);

    // beforeunload (fallback)
    const unloadHandler = () => write('offline');
    window.addEventListener('beforeunload', unloadHandler);

    // Focus/blur — fokus yo'qolsa 'away', qaytsa 'online'
    const focusHandler = () => {
      if (document.visibilityState !== 'hidden') write('online');
    };
    const blurHandler = () => write('away');
    window.addEventListener('focus', focusHandler);
    window.addEventListener('blur', blurHandler);

    // Cleanup function — barcha listenerlarni tozalaydi
    this._presenceCleanup = () => {
      clearInterval(beatInterval);
      document.removeEventListener('visibilitychange', visHandler);
      window.removeEventListener('pagehide', pageHideHandler);
      window.removeEventListener('beforeunload', unloadHandler);
      window.removeEventListener('focus', focusHandler);
      window.removeEventListener('blur', blurHandler);
    };
  },
  async subscribePresence(uid, onChange) {
    const state = await this.init();
    if (!state || !state.modules) return () => {};
    const { doc, onSnapshot } = state.modules.dbMod;
    return onSnapshot(doc(state.db, 'presence', uid), (snap) => onChange(snap.exists() ? snap.data() : null));
  },

  // ===== T16 Encrypted attachment metadata =====
  async createAttachmentMeta({ teamId, taskId = '', ideaId = '', fileName, size = 0, iv = null }) {
    const authUser = await this.ensureAuthed();
    const result = await apiPost('/api/create-attachment', authUser, { teamId, taskId, ideaId, fileName, size, iv });
    invalidateTeamCache(teamId);
    return result;
  },

  async inviteWorkspaceMember({ teamId, email, role = 'member' }) {
    const authUser = await this.ensureAuthed();
    if (!teamId) throw new Error('Workspace topilmadi.');
    if (!email?.trim()) throw new Error('Email kiriting.');
    const result = await apiPost('/api/invite-member', authUser, {
      teamId,
      email: email.trim().toLowerCase(),
      role
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

  // Parolni unutish (faqat admin bo'lmaganlar) — login sahifasidagi "Parolni unutdim"
  async requestPasswordReset(rawEmail) {
    const email = String(rawEmail || '').trim().toLowerCase();
    if (!email.includes('@')) throw new Error('Email kiriting.');
    const resp = await fetch('/api/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || 'So\'rov bajarilmadi.');
    if (data.admin) throw new Error(data.message || 'Admin parolini Firebase Console orqali tiklang.');
    if (!data.ok) return { message: data.message || "Agar account mavjud bo'lsa, parol tiklash xati yuborildi." };
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    const { sendPasswordResetEmail } = state.modules.authMod;
    await sendPasswordResetEmail(state.auth, email);
    return { message: 'Parol tiklash xati yuborildi. Emailingizni tekshiring.' };
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

  async setTaskStatus({ taskId, status }) {
    const authUser = await this.ensureAuthed();
    const result = await apiPost('/api/task-action', authUser, {
      taskId,
      action: 'set-status',
      status: String(status || '').trim()
    });
    invalidateCacheByPrefix(getCacheKey('team', ''));
    return result;
  },

  // T-UI — Mas'ulni o'zgartirish: team lead tomonidan vazifaning assignedTo'sini
  // yangilash. Bu client-side Firestore update (api/ ga tegmaydi); Firestore qoidasi
  // team lead'ga task'ni yangilashga ruxsat beradi (firestore.rules: /tasks write -> isTeamLead).
  async reassignTask({ teamId, taskId, assignedTo = null }) {
    const state = await this.init();
    if (!state) return { success: false };
    const { doc, updateDoc } = state.modules.dbMod;
    await updateDoc(doc(state.db, 'tasks', taskId), { assignedTo: assignedTo || null });
    invalidateTeamCache(teamId);
    return { success: true };
  },

  // T-UI — A'zo rolini o'zgartirish (team lead: member <-> viewer).
  // Client-side Firestore update; Firestore qoidasi team lead'ga teamMembers
  // hujjatini yangilashga ruxsat beradi (firestore.rules: /teamMembers update -> isTeamLead).
  async updateMemberRole({ teamId, userId, role }) {
    const state = await this.init();
    if (!state) return { success: false };
    const { doc, updateDoc } = state.modules.dbMod;
    await updateDoc(doc(state.db, 'teamMembers', teamId + '_' + userId), { role });
    invalidateTeamCache(teamId);
    return { success: true };
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
    const profile = window.MLLYCORE_PROFILE || {};
    let constraints = [];
    if (teamId) {
      constraints.push(where('teamId', '==', teamId));
    } else if (profile.role !== 'admin' && profile.role !== 'manager') {
      // Non-admin/manager users must query by their accessible teams or they'll
      // get 'Missing or insufficient permissions' from Firestore rules.
      // Fetch user's team memberships to find accessible team IDs.
      const uid = (window.MLLYCORE_AUTH_USER || {}).uid;
      if (uid) {
        try {
          const membersSnap = await getDocs(query(collection(state.db, 'teamMembers'), where('userId', '==', uid)));
          const teamIds = [...new Set(membersSnap.docs.map(d => d.data().teamId).filter(Boolean))];
          if (teamIds.length > 0) {
            constraints.push(where('teamId', 'in', teamIds.slice(0, 10))); // Firestore 'in' max 10 values
          } else {
            // No teams → return empty array immediately
            writeCache(cacheKey, []);
            return [];
          }
        } catch (_) {
          // If memberships query fails, restrict to own reports only
          constraints.push(where('userId', '==', uid));
        }
      }
    }
    if (type) constraints.push(where('type', '==', type));
    if (userId) constraints.push(where('userId', '==', userId));
    if (targetRole) constraints.push(where('targetRole', '==', targetRole));
    const q = constraints.length ? query(collection(state.db, 'reports'), ...constraints) : collection(state.db, 'reports');
    const snap = await getDocs(q);
    const results = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort(sortByCreatedAtDesc);
    writeCache(cacheKey, results);
    return results;
  },

  async getReportPeriodMode() {
    const state = await this.init();
    if (!state) return 'daily';
    const { doc, getDoc } = state.modules.dbMod;
    try {
      const snap = await getDoc(doc(state.db, 'settings', 'reportPeriodMode'));
      return snap.exists() ? (snap.data().activeMode || 'daily') : 'daily';
    } catch (_) {
      return localStorage.getItem('mllycore_report_mode') || 'daily';
    }
  },

  async setReportPeriodMode(mode) {
    const state = await this.init();
    if (!state) return;
    localStorage.setItem('mllycore_report_mode', mode);
    const { doc, setDoc } = state.modules.dbMod;
    try {
      await setDoc(doc(state.db, 'settings', 'reportPeriodMode'), { activeMode: mode, updatedAt: Date.now() }, { merge: true });
    } catch (_) {}
  },

  async createReport({ type, teamId = '', teamName = '', link, description, targetRole = 'team_lead', periodType = 'daily' }) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    const authUser = await this.ensureAuthed();
    const profile = window.MLLYCORE_PROFILE || {};
    const { addDoc, collection } = state.modules.dbMod;
    const now = Date.now();
    const d = new Date(now);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');
    const typeLabel = periodType === 'daily' ? 'kunlik' : periodType === 'weekly' ? 'haftalik' : 'oylik';
    const formattedDate = `${day}/${month}/${year} ${hours}:${mins}:${secs} ${typeLabel}`;

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
      periodType,
      formattedDate,
      createdAt: now,
      updatedAt: now
    });
    invalidateCacheByPrefix(getCacheKey('reports', ''));
    return { id: docRef.id, type, teamId, link, description, status: 'pending', periodType, formattedDate };
  },

  async updateReportStatus({ reportId, status, feedback = '' }) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    await this.ensureAuthed();
    const { doc, getDoc, updateDoc } = state.modules.dbMod;
    const now = Date.now();
    const d = new Date(now);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    const secs = String(d.getSeconds()).padStart(2, '0');

    let updateData = {
      status,
      feedback: String(feedback || '').trim(),
      updatedAt: now
    };

    if (status === 'approved') {
      const repSnap = await getDoc(doc(state.db, 'reports', reportId));
      if (repSnap.exists()) {
        const repData = repSnap.data();
        const pType = repData.periodType || 'daily';
        const typeLabel = pType === 'daily' ? 'kunlik' : pType === 'weekly' ? 'haftalik' : 'oylik';
        updateData.formattedDate = `${day}/${month}/${year} ${hours}:${mins}:${secs} ${typeLabel}`;
        updateData.approvedAtFormatted = updateData.formattedDate;
      }
    }

    await updateDoc(doc(state.db, 'reports', reportId), updateData);
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
      if (userDoc.data().role === 'manager') {
        throw new Error('Bu foydalanuvchi allaqachon manager qilib tayinlangan!');
      }
      await setDoc(doc(state.db, 'users', userDoc.id), {
        role: 'manager',
        name: name || userDoc.data().name,
        updatedAt: now
      }, { merge: true });
      invalidateCacheByPrefix(getCacheKey('dashboard', ''));
      return { id: userDoc.id, email: cleanEmail, name: name || userDoc.data().name, role: 'manager' };
    } else {
      // Do NOT create an orphan Firestore doc without a matching Auth account
      // (it could never log in). The user must register first.
      throw new Error('Bu email bilan foydalanuvchi topilmadi. Avval ro\'yxatdan o\'tsin.');
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

  async revokeManagerRole(managerUserId, adminPassword) {
    await this.reauthenticate(adminPassword);
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    if (window.MLLYCORE_PROFILE?.role !== 'admin') throw new Error('Faqat admin olib tashlay oladi.');
    const { doc, getDoc, updateDoc } = state.modules.dbMod;
    const userRef = doc(state.db, 'users', managerUserId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error('Manager topilmadi.');
    const data = userSnap.data();
    const assignedTeams = Array.isArray(data.assignedTeams) ? data.assignedTeams : [];
    for (const tId of assignedTeams) {
      const teamRef = doc(state.db, 'teams', tId);
      const teamSnap = await getDoc(teamRef);
      if (teamSnap.exists() && teamSnap.data().managerUserId === managerUserId) {
        await updateDoc(teamRef, { managerUserId: '', updatedAt: Date.now() });
      }
    }
    await updateDoc(userRef, { role: 'member', assignedTeams: [], assignedTeamNames: [], updatedAt: Date.now() });
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

  async assignTeamLead({ teamId, userId }) {
    const authUser = await this.ensureAuthed();
    const result = await apiPost('/api/assign-team-lead', authUser, { teamId, userId });
    invalidateTeamCache(teamId);
    invalidateDashboardCache(authUser.uid);
    return result;
  },

  async restoreWorkspace(teamId) {
    const authUser = await this.ensureAuthed();
    const result = await apiPost('/api/restore-workspace', authUser, { teamId });
    invalidateTeamCache(teamId);
    invalidateDashboardCache(authUser.uid);
    invalidateCacheByPrefix(getCacheKey('plugin:stats'));
    return result;
  },

  async ensureAuthed() {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    // FIX (auth race): Avval `MLLYCORE_AUTH_USER` (auth-guard tomonidan o'rnatiladi),
    // keyin `state.auth.currentUser` (Firebase Auth holati).
    // Agar ikkalasi ham null bo'lsa, login.html ga yo'naltirish shart emas —
    // chaqiruvchi funksiya exception'ni ushlab, kerakli joyga redirect qiladi.
    const authUser = window.MLLYCORE_AUTH_USER || state.auth.currentUser;
    if (!authUser) {
      const err = new Error('Avval tizimga kiring.');
      err.code = 'auth/not-authenticated';
      throw err;
    }
    return authUser;
  },

  // ===== T3 Admin 2FA =====
  async enable2FA() {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/enable-2fa', authUser, {});
  },
  async verify2FA(code) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/verify-2fa', authUser, { code });
  },
  async disable2FA(code) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/disable-2fa', authUser, { code });
  },

  // ===== T9 Presence (server orqali o'qish) =====
  async getTeamPresence(teamId) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/presence', authUser, { teamId });
  },

  // ===== T10 AI klasterlash =====
  async analyzeIdeas(teamId) {
    const authUser = await this.ensureAuthed();
    const result = await apiPost('/api/analyze-ideas', authUser, { teamId });
    invalidateTeamCache(teamId);
    return result;
  },

  // ===== T13 Shablonlar =====
  async getTemplates() {
    const authUser = await this.ensureAuthed();
    const result = await apiPost('/api/get-templates', authUser, {});
    return result.templates || [];
  },
  async createTemplate(payload) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/create-template', authUser, payload);
  },

  // ===== T14 Quiet Hours notify =====
  async notify(payload) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/notify', authUser, payload);
  },

  // ===== T16 Shifrlangan fayl yuklash (client-side AES-GCM + Storage) =====
  async uploadEncryptedFile({ filePath, data, contentType = 'application/octet-stream' }) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    const authUser = await this.ensureAuthed();
    const storageMod = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js');
    const storage = storageMod.getStorage(state.app);
    const { ref, uploadBytes, getDownloadURL } = storageMod;
    const storageRef = ref(storage, filePath);
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(JSON.stringify(data));
    await uploadBytes(storageRef, bytes, { contentType });
    const url = await getDownloadURL(storageRef);
    return { url };
  },

  // ===== T17 Weekly Digest =====
  async generateWeeklyDigest() {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/weekly-digest', authUser, {});
  },

  // ===== T18 Idea Scoring =====
  async scoreIdea(ideaId, { impact = 0, confidence = 0, ease = 0 } = {}) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/score-idea', authUser, { ideaId, impact, confidence, ease });
  },
  // ===== T19 Pitch One-Pager =====
  async generatePitch(ideaId) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/generate-pitch', authUser, { ideaId });
  },
  // ===== T20 Public Showcase =====
  async setPublic(ideaId, isPublic) {
    const authUser = await this.ensureAuthed();
    const r = await apiPost('/api/set-public', authUser, { ideaId, isPublic });
    invalidateTeamCache(ideaId ? '' : '');
    return r;
  },
  async getPublicIdea(token) {
    const res = await fetch(`/api/public-idea?token=${encodeURIComponent(token)}`);
    return res.json();
  },
  // ===== T21 Roadmap =====
  async getRoadmap(teamId) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/roadmap', authUser, { teamId });
  },
  // ===== T22 Telegram =====
  async linkTelegram(chatId) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/link-telegram', authUser, { chatId });
  },
  // ===== T23 Finances =====
  async saveFinances({ teamId, monthlyBudget, burnRate, currency }) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/finances', authUser, { teamId, monthlyBudget, burnRate, currency });
  },
  async getRunway(teamId) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/runway', authUser, { teamId });
  },
  // ===== T24 Decision Log =====
  async addDecision({ teamId, title, rationale, decision }) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/decision-log', authUser, { teamId, title, rationale, decision });
  },
  // ===== T25 Skills =====
  async updateSkills(skills) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/update-skills', authUser, { skills });
  },
  // ===== T26 Stale Ideas =====
  async getStaleIdeas(days = 14) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/stale-ideas', authUser, { days });
  },
  // ===== T27 Comment + @mention =====
  async addComment({ ideaId, text, mentions }) {
    const authUser = await this.ensureAuthed();
    const r = await apiPost('/api/comment', authUser, { ideaId, text, mentions });
    invalidateTeamCache('');
    return r;
  },
  // ===== T28 Reputation =====
  async getReputation(teamId) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/reputation', authUser, { teamId });
  },
  // ===== T29 Idea Stage =====
  async setStage(ideaId, stage) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/set-stage', authUser, { ideaId, stage });
  },
  // ===== T30 Meeting Notes =====
  async saveMeetingNotes({ teamId, title, notes, actionItems, decisions }) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/meeting-notes', authUser, { teamId, title, notes, actionItems, decisions });
  },
  // ===== T31 GitHub Sync =====
  async syncGithubIssue({ taskId, repo, token }) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/sync-github', authUser, { taskId, repo, token });
  },
  // ===== T32 Onboarding =====
  async getOnboardingStatus(teamId) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/onboarding-status', authUser, { teamId });
  },
  // ===== T33 Locale =====
  async updateLocale(locale) {
    const authUser = await this.ensureAuthed();
    const r = await apiPost('/api/update-preferences', authUser, { locale });
    return r;
  },
  // ===== T34 Voting =====
  async voteIdea(ideaId) {
    const authUser = await this.ensureAuthed();
    const r = await apiPost('/api/vote-idea', authUser, { ideaId });
    invalidateTeamCache('');
    return r;
  },
  // ===== T35 Risk Register =====
  async addRisk({ teamId, ideaId, title, likelihood, impact, mitigation }) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/risk', authUser, { teamId, ideaId, title, likelihood, impact, mitigation });
  },
  // ===== T36 Activity Feed =====
  async getDecisions(teamId) {
    const state = await this.init();
    if (!state) return [];
    const { collection, getDocs, query, where } = state.modules.dbMod;
    const snap = await getDocs(query(collection(state.db, 'decisions'), where('teamId', '==', teamId)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async getActivityFeed(teamId) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/activity-feed', authUser, { teamId });
  },
  // ===== T37 Clone Workspace =====
  async cloneWorkspace({ teamId, name, leadEmail }) {
    const authUser = await this.ensureAuthed();
    const r = await apiPost('/api/clone-workspace', authUser, { teamId, name, leadEmail });
    invalidateDashboardCache(authUser.uid);
    invalidateCacheByPrefix(getCacheKey('team', ''));
    return r;
  },
  // ===== T41 Workspace Backup / Export / Import =====
  async exportWorkspace(teamId) {
    const authUser = await this.ensureAuthed();
    const r = await apiPost('/api/export-workspace?teamId=' + encodeURIComponent(teamId), authUser, {});
    return r && r.workspace;
  },
  async importWorkspace(teamId, data) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/import-workspace', authUser, { teamId, data });
  },
  // ===== T42 AI Idea → Task Auto-Breakdown =====
  async breakdownIdea(ideaId, create = false) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/breakdown-idea', authUser, { ideaId, create });
  },
  // ===== T43 Investor CRM / Pipeline =====
  async getInvestorPipeline(teamId, ideaId) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/investor-pipeline', authUser, { teamId, ideaId });
  },
  async addInvestor({ teamId, ideaId, name, email, note }) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/add-investor', authUser, { teamId, ideaId, name, email, note });
  },
  async updateInvestorStage({ investorId, stage }) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/investor-stage', authUser, { investorId, stage });
  },
  // ===== T44 Team Burnout / Load Signal =====
  async getTeamLoad(teamId) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/team-load', authUser, { teamId });
  },
  // ===== T45 Command Palette search =====
  async search(q, type) {
    const authUser = await this.ensureAuthed();
    const qs = '?q=' + encodeURIComponent(q) + (type ? '&type=' + encodeURIComponent(type) : '');
    return apiPost('/api/search' + qs, authUser, {});
  },
  // ===== T46 Generic Outgoing Webhooks (Zapier / Make / Notion) =====
  async getWebhookList(teamId) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/webhook-list', authUser, { teamId });
  },
  async addWebhook({ teamId, url, events }) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/webhook-add', authUser, { teamId, url, events });
  },
  async deleteWebhook(webhookId) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/webhook-delete', authUser, { webhookId });
  },
  async testWebhook(webhookId) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/webhook-test', authUser, { webhookId });
  },

  // ===== T47 Idea Lifecycle Analytics Dashboard =====
  async getIdeaAnalytics(teamId) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/idea-analytics', authUser, { teamId });
  },

  // ===== T48 Live Collaboration (real-time cursors) =====
  async updateCursor({ teamId, x, y, name, color }) {
    const state = await this.init();
    if (!state) return;
    const authUser = await this.ensureAuthed();
    const { doc, setDoc, serverTimestamp } = state.modules.dbMod;
    await setDoc(
      doc(state.db, 'cursors', teamId + '_' + authUser.uid),
      {
        teamId,
        userId: authUser.uid,
        name: name || authUser.email || 'User',
        color: color || '#7dd3fc',
        x: Number(x) || 0,
        y: Number(y) || 0,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },
  async subscribeCursors(teamId, onUpdate) {
    const state = await this.init();
    if (!state) return () => {};
    const { collection, onSnapshot, query, where } = state.modules.dbMod;
    try {
      return onSnapshot(
        query(collection(state.db, 'cursors'), where('teamId', '==', teamId)),
        (snap) => {
          const cursors = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          onUpdate(cursors);
        },
        (err) => console.warn('Cursors snapshot xatosi:', err.message)
      );
    } catch (_) { return () => {}; }
  },

  // ===== T49 Smart Notification Batching =====
  async getNotificationDigest() {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/notification-digest', authUser, {});
  },

  // ===== T51 Role-based Dashboard Personalization =====
  async getDashboardPrefs() {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/dashboard-prefs', authUser, {});
  },
  async saveDashboardPrefs({ hiddenWidgets = [], pinnedTeamId = '' } = {}) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/save-dashboard-prefs', authUser, { hiddenWidgets, pinnedTeamId });
  },

  // ===== T52 Idea Battle / Voting Tournament =====
  async getIdeaBattle(teamId) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/idea-battle', authUser, { teamId });
  },
  async voteIdeaBattle({ teamId, winnerId, loserId }) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/idea-battle-vote', authUser, { teamId, winnerId, loserId });
  },
  async getIdeaBattleStandings(teamId) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/idea-battle-standings', authUser, { teamId });
  },

  // ===== T53 Automated Weekly Report (email/Telegram) =====
  async sendWeeklyReport({ teamId }) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/send-weekly-report', authUser, { teamId });
  },

  // ===== T54 Attachment Versioning =====
  async listAttachments({ teamId, taskId = '', ideaId = '' } = {}) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/list-attachments', authUser, { teamId, taskId, ideaId });
  },

  // ===== T55 Timezone-aware Scheduling =====
  async getTimezone() {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/get-timezone', authUser, {});
  },
  async saveTimezone({ timezone, workingHours = null, teamId = '' } = {}) {
    const authUser = await this.ensureAuthed();
    const result = await apiPost('/api/save-timezone', authUser, { timezone, workingHours, teamId });
    invalidateDashboardCache(authUser.uid); // R4 — foydalanuvchi sozlamasi o'zgardi
    return result;
  },
  async convertTime({ iso, fromTz = 'UTC', toTz = 'UTC' } = {}) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/convert-time', authUser, { iso, fromTz, toTz });
  },
  async checkWorkingHours({ iso, tz = 'UTC', start = '09:00', end = '18:00' } = {}) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/working-hours-check', authUser, { iso, tz, start, end });
  },
  async createSchedule({ teamId, title, iso, tz = 'UTC' } = {}) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/create-schedule', authUser, { teamId, title, iso, tz });
  },
  async listSchedules({ teamId } = {}) {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/list-schedules', authUser, { teamId });
  },

  // ===== Paginated Collection — katta kolleksiyalar uchun cursor-based pagination =====
  async getPaginatedCollection(name, { limit: pageSize = 50, orderByField = 'createdAt', startAfter = null, forceFresh = false } = {}) {
    const state = await this.init();
    if (!state) return { items: [], hasMore: false, lastDoc: null };
    const { collection, getDocs, query, orderBy, limit, startAfter: sa } = state.modules.dbMod;
    try {
      let q = query(collection(state.db, name), orderBy(orderByField, 'desc'), limit(pageSize));
      if (startAfter) q = query(q, sa(startAfter));
      const snap = await getDocs(q);
      const items = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      const hasMore = snap.docs.length === pageSize;
      const lastDoc = snap.docs[snap.docs.length - 1] || null;
      return { items, hasMore, lastDoc };
    } catch (err) {
      console.warn(`getPaginatedCollection(${name}) error:`, err.message);
      return { items: [], hasMore: false, lastDoc: null };
    }
  },

  // ===== getUsersByRole — role bo'yicha foydalanuvchilarni samarali olish (getCollection('users') o'rniga) =====
  // DIQQAT: Bu funksiya `where('role')` so'rovidan foydalanadi.
  // Firestore'da composite index talab qilmaydi (orderBy ishlatilmaydi).
  async getUsersByRole(role, { pageSize = 100, startAfter = null } = {}) {
    const state = await this.init();
    if (!state) return { items: [], hasMore: false, lastDoc: null };
    const { collection, getDocs, query, where, limit, startAfter: sa } = state.modules.dbMod;
    try {
      // Role filter + limit — oddiy query, composite index talab qilmaydi
      let q = query(
        collection(state.db, 'users'),
        where('role', '==', role),
        limit(pageSize)
      );
      if (startAfter) q = query(q, sa(startAfter));
      const snap = await getDocs(q);
      const items = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      const hasMore = snap.docs.length === pageSize;
      const lastDoc = snap.docs[snap.docs.length - 1] || null;
      // Agar orderBy kerak bo'lsa, client-side sort (index talab qilmaydi)
      items.sort((a, b) => {
        const ta = a.joinedAt?.toMillis?.() || a.createdAt || 0;
        const tb = b.joinedAt?.toMillis?.() || b.createdAt || 0;
        return tb - ta;
      });
      return { items, hasMore, lastDoc };
    } catch (err) {
      console.warn(`getUsersByRole(${role}) error:`, err.message);
      return { items: [], hasMore: false, lastDoc: null };
    }
  },

  // ===== getTeamsBatch — ID lar bo'yicha team'larni batch olish (getCollection('teams') o'rniga) =====
  async getTeamsBatch(teamIds = []) {
    if (!teamIds.length) return [];
    const state = await this.init();
    if (!state) return [];
    const { doc, getDoc } = state.modules.dbMod;
    // Firestore 'in' query max 30 values, shuning uchun batch'larga bo'lib olamiz
    const results = [];
    for (let i = 0; i < teamIds.length; i += 30) {
      const batch = teamIds.slice(i, i + 30);
      const snapshots = await Promise.all(batch.map((id) => getDoc(doc(state.db, 'teams', id))));
      snapshots.forEach((s) => {
        if (s.exists()) results.push({ id: s.id, ...s.data() });
      });
    }
    return results;
  },

  // ===== Auto-refresh utility =====
  _refreshIntervals: [],
  startAutoRefresh(fn, intervalMs = 30000) {
    if (typeof fn !== 'function') return;
    const id = setInterval(() => {
      try { fn(); } catch (_) { /* auto-refresh xatoligi — jim qoladi */ }
    }, intervalMs);
    this._refreshIntervals.push(id);
    return id;
  },
  stopAutoRefresh(id) {
    if (id) {
      const idx = this._refreshIntervals.indexOf(id);
      if (idx > -1) this._refreshIntervals.splice(idx, 1);
      clearInterval(id);
    }
  },
  stopAllAutoRefresh() {
    this._refreshIntervals.forEach(id => clearInterval(id));
    this._refreshIntervals = [];
  },

  // Alias: clearAutoRefreshIntervals -> stopAllAutoRefresh
  // Sahifadan chiqishda yoki komponent unmount bo'lganda chaqiriladi.
  clearAutoRefreshIntervals() {
    this.stopAllAutoRefresh();
  },

  // ===== getManagerDashboard — Manager uchun alohida dashboard (cache muammosini hal qiladi) =====
  // getDashboardData() managerlar uchun cache'ni admin/member bilan aralashtirib yuborishi mumkin.
  // Bu funksiya faqat managerlar uchun mo'ljallangan, cache kaliti ham farqli.
  async getManagerDashboard(uid, { forceFresh = false } = {}) {
    const state = await this.init();
    if (!state) return { teams: [], notifications: [] };
    const cacheKey = getCacheKey('mgrdash', uid);
    if (!forceFresh) {
      const cached = readCache(cacheKey, CACHE_TTL.dashboard);
      if (cached) return cached;
    }
    try {
      return await rememberInflight(cacheKey, async () => {
        const { getDocs, query, where, collection } = state.modules.dbMod;
        const assignedIds = Array.isArray(window.MLLYCORE_PROFILE?.assignedTeams) ? window.MLLYCORE_PROFILE.assignedTeams : [];
        // Team'larni batch bo'lib olish (getTeamsBatch orqali)
        const rawTeams = await this.getTeamsBatch(assignedIds);
        const teams = rawTeams.map((t) => ({ ...t, membershipRole: 'manager' }));
        // Bildirishnomalar
        const notifSnap = await getDocs(query(collection(state.db, 'notifications'), where('userId', '==', uid)));
        const notifications = notifSnap.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .sort(sortByCreatedAtDesc);
        const payload = { teams, notifications };
        writeCache(cacheKey, payload);
        return payload;
      });
    } catch (err) {
      const stale = readCache(cacheKey, Number.POSITIVE_INFINITY);
      if (stale) return stale;
      return { teams: [], notifications: [] };
    }
  },

  // ===== getUsersCount — foydalanuvchilar sonini olish (butun kolleksiyani yuklamasdan) =====
  async getUsersCount() {
    const state = await this.init();
    if (!state) return 0;
    const { collection, getCountFromServer } = state.modules.dbMod;
    if (typeof getCountFromServer !== 'function') {
      // Fallback: agar getCountFromServer mavjud bo'lmasa (eski SDK), aggregate query ishlatamiz
      try {
        const snap = await state.modules.dbMod.getDocs(collection(state.db, 'users'));
        return snap.size;
      } catch (_) { return 0; }
    }
    try {
      const snap = await getCountFromServer(collection(state.db, 'users'));
      return snap.data().count || 0;
    } catch (_) { return 0; }
  },

  // ===== T57 API Health / Error Tracking =====
  async getHealth() {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/health', authUser, {});
  },
  async logError({ level = 'error', message, stack = null, context = null } = {}) {
    try {
      const authUser = await this.ensureAuthed().catch(() => null);
      if (!authUser) return { skipped: true };
      return await apiPost('/api/error-log', authUser, {
        level: ['error', 'warn', 'info'].includes(level) ? level : 'error',
        message: String(message || '').slice(0, 2000),
        stack: stack ? String(stack).slice(0, 4000) : null,
        context: context ? String(context).slice(0, 1000) : null,
      });
    } catch (_) { return { skipped: true }; }
  },
  async getErrorLogs() {
    const authUser = await this.ensureAuthed();
    return apiPost('/api/error-logs', authUser, {});
  },

  async requireAuth() {
    const state = await this.init();
    if (!state) {
      location.href = 'login.html';
      return null;
    }

    const { onAuthStateChanged } = state.modules.authMod;
    return new Promise((resolve) => {
      // FIX (hang protection): 12 soniya ichida Firebase javob bermasa, 
      // yuklanishdan to'xtatamiz va login'ga qaytaramiz (yuklanmoqda qolib ketmasligi uchun).
      const authTimeout = setTimeout(() => {
        if (typeof unsub === 'function') unsub();
        console.warn('Auth timeout: Firebase 12s ichida javob bermadi.');
        const currentPage = location.pathname.split('/').pop() || 'index.html';
        if (currentPage !== 'login.html' && currentPage !== 'register.html') {
          location.href = 'login.html';
        }
        resolve(null);
      }, 12000);

      const unsub = onAuthStateChanged(state.auth, async (user) => {
        clearTimeout(authTimeout);
        unsub();
        try {
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

          let profile = null;
          try {
            profile = await this.getUserProfile(user.uid);
          } catch (_) {
            // getUserProfile xatosi — jim qoladi, default profile ishlatiladi
          }
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
        } catch (e) {
          console.error('requireAuth() xatosi:', e);
          // Agar har qanday xato bo'lsa ham promise resolve bo'lishi kerak
          // aks holda workspace abadiy Yuklanmoqda da qotib qoladi
          window.MLLYCORE_AUTH_USER = user || null;
          window.MLLYCORE_PROFILE = null;
          document.documentElement.classList.add('auth-ready');
          resolve(user || null);
        }
      });
    });
  }
};

async function apiGet(url, authUser, forceRefreshToken = false) {
  let finalUrl = url;
  if (!/[?&]action=/.test(url)) {
    const seg = url.split('?')[0].split('/').filter(Boolean).pop() || '';
    const sep = url.includes('?') ? '&' : '?';
    finalUrl = url + sep + 'action=' + encodeURIComponent(seg);
  }
  const idToken = await authUser.getIdToken(forceRefreshToken);
  const response = await fetch(finalUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'So\'rov bajarilmadi.');
  return payload;
}

async function apiPost(url, authUser, body, forceRefreshToken = false) {
  // Hosting rewrite (/api/(.*) -> /api/index) ba'zan asl pathni o'chirib yuboradi,
  // natijada backend action ni aniqlay olmay "Action xato." qaytaradi.
  // Shuning uchun har doim ?action=<oxirgi-segment> qo'shamiz — backend
  // `req.query.action || pathname.pop()` qoidasiga ko'ra action ni to'g'ri topadi.
  let finalUrl = url;
  if (!/[?&]action=/.test(url)) {
    const seg = url.split('?')[0].split('/').filter(Boolean).pop() || '';
    const sep = url.includes('?') ? '&' : '?';
    finalUrl = url + sep + 'action=' + encodeURIComponent(seg);
  }
  const idToken = await authUser.getIdToken(forceRefreshToken);
  const response = await fetch(finalUrl, {
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
  // FIX (updatedAt 0 bug): updatedAt firestore serverTimestamp bo'lib, 0/null/undefined
  // bo'lishi mumkin, shuning uchun updatedAt ni tekshirib, agar mavjud bo'lmasa createdAt ga tayanamiz.
  // number, Timestamp, Date, string hammasini toMillis() to'g'ri ishlaydi.
  const aTime = (a.updatedAt != null && a.updatedAt !== 0) ? a.updatedAt : (a.createdAt || 0);
  const bTime = (b.updatedAt != null && b.updatedAt !== 0) ? b.updatedAt : (b.createdAt || 0);
  return toMillis(bTime) - toMillis(aTime);
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
    invalidateCacheByPrefix(getCacheKey('dashboard', `manager:${uid}`));
    invalidateCacheByPrefix(getCacheKey('dashboard', `team_lead:${uid}`));
    invalidateCacheByPrefix(getCacheKey('dashboard', `member:${uid}`));
    invalidateCacheByPrefix(getCacheKey('dashboard', `viewer:${uid}`));
    invalidateCacheByPrefix(getCacheKey('mgrdash', uid));
    return;
  }
  invalidateCacheByPrefix(getCacheKey('dashboard', ''));
  invalidateCacheByPrefix(getCacheKey('mgrdash', ''));
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
