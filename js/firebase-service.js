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
    await sendEmailVerification(cred.user);
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

        const profile = await this.getUserProfile(user.uid);
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
