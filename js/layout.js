// Sidebar va sahifa karkasini render qilish
window.renderLayout = function(active) {
  const u = MOCK.currentUser;
  const teams = MOCK.teams.filter(t => t.members.includes(u.id));
  const unread = MOCK.notifications.filter(n => n.unread).length;
  const isAdmin = u.role === 'admin' || MOCK.users.find(x => x.id===u.id)?.role === 'admin';

  return `
  <aside class="sidebar">
    <a href="dashboard.html" class="brand">
      <div class="brand-logo">S</div>
      <div>
        <div class="brand-name">Startap Hub</div>
        <div class="text-xs muted">G'oyalar platformasi</div>
      </div>
    </a>

    <div class="nav">
      <a href="dashboard.html" class="nav-item ${active==='dashboard'?'active':''}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
        Dashboard
      </a>
      <a href="my-ideas.html" class="nav-item ${active==='ideas'?'active':''}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-1.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/></svg>
        G'oyalarim
      </a>
      <a href="notifications.html" class="nav-item ${active==='notif'?'active':''}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0"/></svg>
        Bildirishnomalar
        ${unread ? `<span class="count">${unread}</span>` : ''}
      </a>
      <a href="profile.html" class="nav-item ${active==='profile'?'active':''}">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
        Profil sozlamalari
      </a>

      <div class="nav-section">Mening jamoalarim</div>
      ${teams.map(t => `
        <a href="team.html?id=${t.id}" class="nav-item">
          <div class="team-logo ${t.color}" style="width:26px;height:26px;border-radius:8px;font-size:11px">${t.logo}</div>
          <span style="font-size:13px">${t.name}</span>
        </a>
      `).join('')}

      ${isAdmin ? `
        <div class="nav-section">Admin</div>
        <a href="admin.html" class="nav-item ${active==='admin'?'active':''}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l9 4v6c0 5-4 9-9 10-5-1-9-5-9-10V6l9-4z"/></svg>
          Admin paneli
        </a>
      ` : ''}
    </div>

    <div class="sidebar-user">
      <div class="avatar">${u.avatar}</div>
      <div style="flex:1;min-width:0">
        <div class="text-sm font-semibold" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.name}</div>
        <div class="text-xs muted">@${u.username}</div>
      </div>
      <a href="login.html" title="Chiqish" class="btn btn-ghost btn-sm" style="padding:6px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></svg>
      </a>
    </div>
  </aside>
  `;
};

window.mountLayout = function(active) {
  const root = document.getElementById('app');
  const main = root.innerHTML;
  root.outerHTML = `<div class="app" id="app">${renderLayout(active)}<main class="main">${main}</main></div>`;
};