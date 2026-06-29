const firebaseState = {
  app: null,
  auth: null,
  db: null,
  modules: null,
  ready: false
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
    firebaseState.db = dbMod.getFirestore(firebaseState.app);
    firebaseState.modules = { authMod, dbMod };
    firebaseState.ready = true;
    return firebaseState;
  },

  async register({ firstName, lastName, username, email, password }) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan. js/firebase-config.js faylini toldiring.');

    const { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } = state.modules.authMod;
    const { doc, serverTimestamp, setDoc } = state.modules.dbMod;
    const cred = await createUserWithEmailAndPassword(state.auth, email, password);
    const displayName = `${firstName} ${lastName}`.trim();

    await updateProfile(cred.user, { displayName });
    await setDoc(doc(state.db, 'users', cred.user.uid), {
      name: displayName,
      username,
      email,
      role: 'member',
      avatar: initials(displayName),
      verified: false,
      blocked: false,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    sendEmailVerification(cred.user).catch(() => {});
    return cred.user;
  },

  async login(email, password) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');

    const { signInWithEmailAndPassword } = state.modules.authMod;
    return signInWithEmailAndPassword(state.auth, email, password);
  },

  async logout() {
    const state = await this.init();
    if (!state) return;
    return state.modules.authMod.signOut(state.auth);
  },

  async getUserProfile(uid) {
    const state = await this.init();
    if (!state) return null;

    const { doc, getDoc } = state.modules.dbMod;
    const snap = await getDoc(doc(state.db, 'users', uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  },

  async getDashboardData(uid) {
    const state = await this.init();
    if (!state) return { teams: [], ideas: [], notifications: [] };

    const { collection, doc, getDoc, getDocs, query, where } = state.modules.dbMod;
    const memberSnap = await getDocs(query(collection(state.db, 'teamMembers'), where('userId', '==', uid)));
    const memberships = memberSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
    const teams = [];

    for (const membership of memberships) {
      const teamDoc = await getDoc(doc(state.db, 'teams', membership.teamId));
      if (teamDoc.exists()) {
        teams.push({ id: teamDoc.id, membershipRole: membership.role, ...teamDoc.data() });
      }
    }

    const ideas = [];
    for (const team of teams) {
      const ideaSnap = await getDocs(query(collection(state.db, 'ideas'), where('teamId', '==', team.id)));
      ideaSnap.docs.forEach((item) => ideas.push({ id: item.id, ...item.data() }));
    }

    const notificationSnap = await getDocs(query(collection(state.db, 'notifications'), where('userId', '==', uid)));
    const notifications = notificationSnap.docs.map((item) => ({ id: item.id, ...item.data() }));

    return { teams, ideas, notifications };
  },

  async getCollection(name) {
    const state = await this.init();
    if (!state) return [];
    const { collection, getDocs } = state.modules.dbMod;
    const snap = await getDocs(collection(state.db, name));
    return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  },

  async getTeamData(teamId) {
    const state = await this.init();
    if (!state) return null;
    const { collection, doc, getDoc, getDocs, query, where } = state.modules.dbMod;
    const teamSnap = await getDoc(doc(state.db, 'teams', teamId));
    if (!teamSnap.exists()) return null;
    const team = { id: teamSnap.id, ...teamSnap.data() };
    const memberSnap = await getDocs(query(collection(state.db, 'teamMembers'), where('teamId', '==', teamId)));
    const memberships = memberSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
    const members = [];
    for (const membership of memberships) {
      const userSnap = await getDoc(doc(state.db, 'users', membership.userId));
      members.push({ ...membership, user: userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null });
    }
    const ideaSnap = await getDocs(query(collection(state.db, 'ideas'), where('teamId', '==', teamId)));
    const ideas = ideaSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
    const messageSnap = await getDocs(query(collection(state.db, 'chatMessages'), where('teamId', '==', teamId)));
    const messages = messageSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
    return { team, members, ideas, messages };
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

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
