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
    if (window.MLLYCORE_PROFILE?.role === 'admin') {
      const teamsSnap = await getDocs(collection(state.db, 'teams'));
      const teams = teamsSnap.docs.map((item) => ({ id: item.id, membershipRole: 'admin', ...item.data() }));
      return { teams, ideas: [], notifications: [] };
    }

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

  async createWorkspaceEntry({ teamId, title, description, type = 'idea' }) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    if (!teamId) throw new Error('Workspace topilmadi.');

    const authUser = window.MLLYCORE_AUTH_USER;
    if (!authUser) throw new Error('Avval tizimga kiring.');

    const cleanTitle = String(title || '').trim();
    const cleanDescription = String(description || '').trim();
    const cleanType = String(type || 'idea').trim().toLowerCase();
    if (!cleanTitle) throw new Error(cleanType === 'startup' ? 'Startup nomini kiriting.' : "G'oya nomini kiriting.");

    const idToken = await authUser.getIdToken();
    const response = await fetch('/api/create-entry', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        teamId,
        title: cleanTitle,
        description: cleanDescription,
        type: cleanType
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Yozuv yaratishda xatolik yuz berdi.');
    }
    return payload;
  },

  async sendChatMessage({ teamId, text }) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    if (!teamId) throw new Error('Workspace topilmadi.');
    const cleanText = String(text || '').trim();
    if (!cleanText) throw new Error('Xabar matnini kiriting.');

    const user = window.MLLYCORE_AUTH_USER;
    const profile = window.MLLYCORE_PROFILE;
    if (!user) throw new Error('Avval tizimga kiring.');

    const { addDoc, collection, serverTimestamp } = state.modules.dbMod;
    await addDoc(collection(state.db, 'chatMessages'), {
      teamId,
      senderUserId: user.uid,
      senderName: profile?.name || user.email,
      senderAvatar: profile?.avatar || initials(profile?.name || user.email || 'U'),
      text: cleanText,
      createdAt: serverTimestamp()
    });
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
          .sort((a, b) => {
            const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return aTime - bTime;
          });
        onChange(messages);
      }
    );
  },

  async createWorkspace({ name, description, leadEmail }) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');

    const profile = window.MLLYCORE_PROFILE;
    const authUser = window.MLLYCORE_AUTH_USER;
    if (profile?.role !== 'admin') throw new Error('Workspace yaratish faqat admin uchun.');
    if (!name?.trim()) throw new Error('Workspace nomini kiriting.');
    if (!leadEmail?.trim()) throw new Error('Team lead emailini kiriting.');

    const idToken = await authUser.getIdToken();
    const response = await fetch('/api/create-workspace', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name.trim(),
        description: description?.trim() || '',
        leadEmail: leadEmail.trim()
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Workspace yaratishda xatolik yuz berdi.');
    }
    return payload;
  },

  async addWorkspaceMember({ teamId, email }) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    if (!teamId) throw new Error('Workspace topilmadi.');
    if (!email?.trim()) throw new Error('Email kiriting.');

    const {
      collection,
      doc,
      getDocs,
      increment,
      query,
      serverTimestamp,
      setDoc,
      updateDoc,
      where
    } = state.modules.dbMod;

    const users = await getDocs(query(collection(state.db, 'users'), where('email', '==', email.trim())));
    if (users.empty) throw new Error('Bu email bilan foydalanuvchi topilmadi.');
    const userId = users.docs[0].id;

    await setDoc(doc(state.db, 'teamMembers', `${teamId}_${userId}`), {
      teamId,
      userId,
      role: 'member',
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await updateDoc(doc(state.db, 'teams', teamId), {
      membersCount: increment(1),
      updatedAt: serverTimestamp()
    });
    return userId;
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
    return secretKey;
  },

  async updateUserProfile({ name, username }) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    const authUser = window.MLLYCORE_AUTH_USER;
    if (!authUser) throw new Error('Avval tizimga kiring.');
    const { doc, serverTimestamp, updateDoc } = state.modules.dbMod;
    await updateDoc(doc(state.db, 'users', authUser.uid), {
      name: name?.trim() || '',
      username: username?.trim() || '',
      avatar: initials(name || username || authUser.email || 'U'),
      updatedAt: serverTimestamp()
    });
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

  async deleteWorkspace(teamId, adminPassword) {
    const state = await this.init();
    if (!state) throw new Error('Firebase sozlanmagan.');
    await this.reauthenticate(adminPassword);
    const authUser = window.MLLYCORE_AUTH_USER;
    const idToken = await authUser.getIdToken(true);
    const response = await fetch('/api/delete-workspace', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ teamId })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Workspace o'chirilmadi.");
    return payload;
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

function initials(name) {
  return name
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
