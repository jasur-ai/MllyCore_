window.renderLayout = function(active, context = window.APP_CONTEXT || {}) {
  const profile = context.profile || window.MLLYCORE_PROFILE || {
    name: 'Foydalanuvchi',
    username: 'user',
    role: 'member',
    avatar: 'U'
  };
  const teams = context.teams || [];
  const notifications = context.notifications || [];
  const unread = notifications.filter((n) => n.unread || n.isRead === false).length;
  const isAdmin = profile.role === 'admin';
  const teamLinks = !isAdmin && teams.map((team) => `
        <a href="team.html?id=${team.id}" class="nav-item">
          <div class="team-logo ${team.color || 'tl-1'}" style="width:26px;height:26px;border-radius:8px;font-size:11px">${team.logo || 'W'}</div>
          <span style="font-size:13px">${team.name}</span>
        </a>
      `).join('') || '<div class="text-xs muted" style="padding:8px 10px">Workspace yoq</div>';
  const navItems = isAdmin ? `
      <a href="dashboard.html" class="nav-item ${active==='dashboard'?'active':''}">Statistika</a>
      <a href="admin.html" class="nav-item ${active==='admin'?'active':''}">Admin paneli</a>
      <a href="profile.html" class="nav-item ${active==='profile'?'active':''}">Profil sozlamalari</a>
    ` : `
      <a href="dashboard.html" class="nav-item ${active==='dashboard'?'active':''}">Dashboard</a>
      <a href="my-ideas.html" class="nav-item ${active==='ideas'?'active':''}">G'oyalarim</a>
      <a href="notifications.html" class="nav-item ${active==='notif'?'active':''}">
        Bildirishnomalar
        ${unread ? `<span class="count">${unread}</span>` : ''}
      </a>
      <a href="profile.html" class="nav-item ${active==='profile'?'active':''}">Profil sozlamalari</a>

      <div class="nav-section">Workspace'larim</div>
      ${teamLinks}
    `;

  return `
  <header class="mobile-header">
    <a href="dashboard.html" class="brand mobile-brand">
      <div class="brand-logo">M</div>
      <div>
        <div class="brand-name">MllyCore</div>
        <div class="text-xs muted">Boshqaruv paneli</div>
      </div>
    </a>
    <button class="btn btn-ghost btn-sm" onclick="document.body.classList.toggle('nav-open')" aria-label="Menyuni ochish">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
    </button>
  </header>
  <div class="sidebar-backdrop" onclick="document.body.classList.remove('nav-open')"></div>
  <aside class="sidebar">
    <a href="dashboard.html" class="brand">
      <div class="brand-logo">M</div>
      <div>
        <div class="brand-name">MllyCore</div>
        <div class="text-xs muted">${isAdmin ? 'Admin boshqaruvi' : "G'oyalar platformasi"}</div>
      </div>
    </a>

    <div class="nav">
      ${navItems}
    </div>

    <div class="sidebar-user">
      <div class="avatar">${profile.avatar || 'U'}</div>
      <div style="flex:1;min-width:0">
        <div class="text-sm font-semibold" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${profile.name || profile.email}</div>
        <div class="text-xs muted">@${profile.username || 'user'}</div>
      </div>
      <a href="login.html" title="Chiqish" class="btn btn-ghost btn-sm" style="padding:6px" onclick="event.preventDefault(); window.MllyCore?.logout?.().finally(()=>location.href='login.html')">
        Chiqish
      </a>
    </div>
  </aside>
  `;
};

window.mountLayout = function(active, context) {
  if (context) window.APP_CONTEXT = context;
  const root = document.getElementById('app');
  const main = root.innerHTML;
  root.outerHTML = `<div class="app" id="app">${renderLayout(active, context)}<main class="main">${main}</main></div>`;
};
