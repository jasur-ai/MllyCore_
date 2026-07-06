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
  const isManager = profile.role === 'manager';
  const teamLinks = (!isAdmin && !isManager) && teams.map((team) => `
        <a href="team.html?id=${team.id}" class="nav-item">
          <div class="team-logo ${team.color || 'tl-1'}" style="width:26px;height:26px;border-radius:8px;font-size:11px">${team.logo || 'W'}</div>
          <span style="font-size:13px">${team.name}</span>
        </a>
      `).join('') || '<div class="text-xs muted" style="padding:8px 10px">Workspace yoq</div>';

  let navItems = '';
  if (isAdmin) {
    navItems = `
      <a href="dashboard.html" class="nav-item ${active === 'dashboard' ? 'active' : ''}">Statistika</a>
      <a href="admin.html" class="nav-item ${active === 'admin' ? 'active' : ''}">Admin paneli</a>
      <a href="reports.html" class="nav-item ${active === 'reports' ? 'active' : ''}">Barcha Hisobotlar</a>
      <a href="profile.html" class="nav-item ${active === 'profile' ? 'active' : ''}">Profil sozlamalari</a>
    `;
  } else if (isManager) {
    navItems = `
      <a href="reports.html" class="nav-item ${active === 'reports' ? 'active' : ''}">Team Hisobotlari</a>
      <a href="profile.html" class="nav-item ${active === 'profile' ? 'active' : ''}">Profil sozlamalari</a>
    `;
  } else {
    const hasTeam = teams && teams.length > 0;
    navItems = `
      <a href="dashboard.html" class="nav-item ${active === 'dashboard' ? 'active' : ''}">Dashboard</a>
      ${hasTeam ? `<a href="reports.html" class="nav-item ${active === 'reports' ? 'active' : ''}">Hisobotlar paneli</a>` : ''}
      <a href="my-ideas.html" class="nav-item ${active === 'ideas' ? 'active' : ''}">G'oyalarim</a>
      <a href="notifications.html" class="nav-item ${active === 'notif' ? 'active' : ''}">
        Bildirishnomalar
        ${unread ? `<span class="count">${unread}</span>` : ''}
      </a>
      <a href="profile.html" class="nav-item ${active === 'profile' ? 'active' : ''}">Profil sozlamalari</a>

      <div class="nav-section">Workspace'larim</div>
      ${teamLinks}
    `;
  }

  return `
  <header class="mobile-header">
    <a href="dashboard.html" class="brand mobile-brand">
      <div class="brand-logo">M</div>
      <div>
        <div class="brand-name">MllyCore</div>
        <div class="text-xs muted">Boshqaruv paneli</div>
      </div>
    </a>
    <div class="flex items-center gap-2">
      <button class="btn btn-ghost btn-sm" onclick="document.body.classList.toggle('nav-open')" aria-label="Menyuni ochish">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
    </div>
  </header>
  <div class="sidebar-backdrop" onclick="document.body.classList.remove('nav-open')"></div>
  <aside class="sidebar">
    <a href="dashboard.html" class="brand">
      <div class="brand-logo">M</div>
      <div>
        <div class="brand-name">MllyCore</div>
        <div class="text-xs muted">${isAdmin ? 'Admin boshqaruvi' : isManager ? 'Manager boshqaruvi' : "G'oyalar platformasi"}</div>
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
  <button type="button" class="btn btn-ghost btn-sm theme-toggle-btn app-theme-toggle" data-theme-toggle onclick="window.MllyCoreTheme?.toggle?.()">
    <span class="theme-glyph theme-sun" aria-hidden="true">&#9728;</span>
    <span class="theme-glyph theme-moon" aria-hidden="true">&#9790;</span>
  </button>
  `;
};

window.mountLayout = function(active, context) {
  if (context) window.APP_CONTEXT = context;
  const root = document.getElementById('app');
  if (!root) return;
  if (root.classList.contains('app')) {
    const temp = document.createElement('div');
    temp.innerHTML = renderLayout(active, context);
    const newHeader = temp.querySelector('.mobile-header');
    const newSidebar = temp.querySelector('.sidebar');
    const curHeader = root.querySelector('.mobile-header');
    const curSidebar = root.querySelector('.sidebar');
    if (newHeader && curHeader) curHeader.replaceWith(newHeader);
    if (newSidebar && curSidebar) curSidebar.replaceWith(newSidebar);
    return;
  }
  const main = root.innerHTML;
  root.outerHTML = `<div class="app" id="app">${renderLayout(active, context)}<main class="main">${main}</main></div>`;
  const theme = document.documentElement.dataset.theme || localStorage.getItem('mllycore-theme') || 'dark';
  window.MllyCoreTheme?.apply?.(theme);
  document.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;
    const prefetch = () => window.MllyCore?.prefetchRouteData?.(href);
    link.addEventListener('mouseenter', prefetch, { once: true });
    link.addEventListener('focus', prefetch, { once: true });
    link.addEventListener('touchstart', prefetch, { once: true, passive: true });
  });
};
