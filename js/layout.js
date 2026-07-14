// ===== Loading bar — sahifa navigatsiyasida yuqorida progress chizig'i =====
(function setupLoadingBar() {
  if (window.__mllyLoadingBar) return;
  window.__mllyLoadingBar = true;
  const bar = document.createElement('div');
  bar.id = 'mlly-loading-bar';
  bar.style.cssText = 'position:fixed;top:0;left:0;height:2px;background:linear-gradient(90deg,#2f81f7,#7c5cfc,#58a6ff);z-index:9999;width:0;border-radius:0 2px 2px 0;transition:none;';
  document.documentElement.appendChild(bar);
  let timer = null;
  const start = () => {
    if (timer) clearTimeout(timer);
    bar.style.width = '0';
    bar.style.opacity = '1';
    // Boshlang'ich sakrash (0 → 25%)
    requestAnimationFrame(() => { bar.style.transition = 'width 0.6s cubic-bezier(0.22, 1, 0.36, 1)'; bar.style.width = '25%'; });
    // 2. bosqich (25% → 70%)
    timer = setTimeout(() => {
      bar.style.transition = 'width 1.2s cubic-bezier(0.22, 1, 0.36, 1)';
      bar.style.width = '70%';
    }, 400);
  };
  const finish = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    bar.style.transition = 'width 0.3s cubic-bezier(0.22, 1, 0.36, 1)';
    bar.style.width = '100%';
    setTimeout(() => {
      bar.style.transition = 'opacity 0.3s ease';
      bar.style.opacity = '0';
      setTimeout(() => { bar.style.width = '0'; }, 350);
    }, 200);
  };
  // Link click'da ishga tushirish (faqat internal navigation)
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;
    start();
  });
  // Sahifa to'liq yuklanganda tugatish
  window.addEventListener('load', finish);
  // Xavfsizlik: agar 8 soniya ichida yuklanmasa, barni avtomatik tugatish
  setTimeout(finish, 8000);
  // Agar sahifa allaqachon yuklangan bo'lsa, barni ko'rsatmaymiz (tayyor holat)
  if (document.readyState === 'complete') {
    bar.style.display = 'none';
    return;
  }
  // Sahifa yangi yuklanayotgan bo'lsa, DOMContentLoaded da boshlaymiz
  document.addEventListener('DOMContentLoaded', () => {
    start();
  });
})();

// ===== Global connection status monitor (Firestore + browser) =====
(function setupConnectionMonitor() {
  if (window.__mllyConnMonitorReady) return;
  window.__mllyConnMonitorReady = true;

  const CHECK_INTERVAL = 30000; // 30 soniya
  let _timer = null;
  let _online = navigator.onLine;

  const setStatus = (online) => {
    if (_online === online) return;
    _online = online;
    window.__mllyOnline = online;
    // Layout indicator ni yangilash
    const bar = document.getElementById('connStatusBar');
    if (bar) {
      bar.className = 'conn-bar ' + (online ? 'conn-ok' : 'conn-err');
      bar.querySelector('.conn-dot').style.background = online ? '#22c55e' : '#ef4444';
      bar.querySelector('.conn-text').textContent = online ? 'Firestore: ulangan' : 'Firestore: uzilgan';
    }
  };

  const checkFirestore = async () => {
    try {
      // 1. Direct Firestore v9 tekshirish (eng tez, auth talab qilmaydi)
      if (window.MllyCore && window.MllyCore.init) {
        try {
          const state = await window.MllyCore.init();
          if (state && state.db && state.modules) {
            const { collection, getDocs, limit, query } = state.modules.dbMod;
            await getDocs(query(collection(state.db, 'settings'), limit(1)));
            setStatus(true);
            return;
          }
        } catch (_) { /* fall through to next method */ }
      }

      // 2. API /health endpoint (server orqali verify)
      if (window.MllyCore && typeof window.MllyCore.getHealth === 'function') {
        try {
          const h = await window.MllyCore.getHealth();
          setStatus(h && (h.firebase || h.status === 'healthy'));
          return;
        } catch (_) { /* fall through */ }
      }

      // 3. Fallback: brauzer online status
      setStatus(navigator.onLine);
    } catch (_) {
      setStatus(false);
    }
  };

  const onOnline = () => { setStatus(true); setTimeout(checkFirestore, 500); };
  const onOffline = () => { setStatus(false); };

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  window.__mllyOnline = navigator.onLine;

  // Dastlabki tekshiruv
  setTimeout(checkFirestore, 1000);
  _timer = setInterval(checkFirestore, CHECK_INTERVAL);

  // Cleanup
  window.addEventListener('pagehide', () => {
    if (_timer) { clearInterval(_timer); _timer = null; }
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  });
})();

// T57 — Global klient tomoni xatolik kuzatuvi (faqat bir marta o'rnatiladi).
(function setupErrorTracking() {
  if (window.__mllyErrorTracking) return;
  window.__mllyErrorTracking = true;
  let lastFlush = 0;
  const FLUSH_MS = 5000;
  const send = (level, message, extra) => {
    try {
      const now = Date.now();
      if (now - lastFlush < FLUSH_MS) return; // throttle: spam bo'lmasin
      lastFlush = now;
      if (window.MllyCore && typeof window.MllyCore.logError === 'function') {
        window.MllyCore.logError({
          level,
          message: String(message || 'Unknown error').slice(0, 2000),
          stack: extra && extra.stack ? extra.stack : null,
          context: extra && extra.context ? extra.context : (location.pathname || ''),
        });
      }
    } catch (_) { /* non-fatal */ }
  };
  window.addEventListener('error', (e) => {
    send('error', e.message || 'Unknown error', { stack: e.error && e.error.stack, context: (e.filename || '') + ':' + (e.lineno || '') });
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason || {};
    send('error', reason.message || String(reason), { stack: reason.stack, context: 'unhandledrejection' });
  });
})();

// ===================== Faza 5: Rol asosida UI yashirish =====================
// .role-<role> sinfi <html> ga qo'shiladi va [data-roles]/[data-roles-exclude]
// belgilangan elementlar ko'rsatilgan rolga qarab ko'rinadi/yashiriladi.
// Bu — defense-in-depth; asosiy tekshiruv serverda (R2) va data-required-role (admin).
window.applyRoleVisibility = function applyRoleVisibility() {
  const profile = window.MLLYCORE_PROFILE || (window.APP_CONTEXT && window.APP_CONTEXT.profile) || {};
  const KNOWN = ['admin', 'team_lead', 'manager', 'member', 'viewer'];
  const known = KNOWN.includes(profile.role);
  // Roli hali aniqlanmagan bo'lsa (auth boshlanishi), HECH NARSANI yashirmaymiz —
  // shu bilan sahifa bo'sh ko'rinishining oldini olamiz. Faqat aniq rol ma'lum bo'lganda gated qilamiz.
  const role = known ? profile.role : '';
  const html = document.documentElement;
  html.setAttribute('data-role', role || 'member');
  html.classList.remove('role-admin', 'role-team_lead', 'role-manager', 'role-member', 'role-viewer');
  if (role) html.classList.add('role-' + role);
  document.querySelectorAll('[data-roles], [data-roles-exclude]').forEach((el) => {
    const allowed = (el.getAttribute('data-roles') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const excluded = (el.getAttribute('data-roles-exclude') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const show = !known || ((allowed.length === 0 || allowed.includes(role)) && !excluded.includes(role));
    el.toggleAttribute('data-roles-on', show);
  });
};
(function setupRoleVisibility() {
  if (window.__mllyRoleObserver) return;
  // Dinamik render qilingan elementlar (masalan team.html Lead panel) ham
  // avtomatik gated bo'lsin deb kuzatamiz.
  window.__mllyRoleObserver = new MutationObserver(() => { try { window.applyRoleVisibility(); } catch (_) {} });
  window.__mllyRoleObserver.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => { try { window.applyRoleVisibility(); } catch (_) {} });
})();

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
  // FIX (manager sidebar): Manager o'ziga biriktirilgan jamoalarni sidebar'da ko'rishi kere.
  // Eski logika: `(!isAdmin && !isManager)` — manager butunlay chetlatilgan edi.
  // Yangi: isAdmin bo'lmasa, hamma ko'radi (member + team_lead + manager).
  const teamLinks = (!isAdmin) && teams.map((team) => `
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
      <a href="notifications.html" class="nav-item ${active === 'notif' ? 'active' : ''}">
        Bildirishnomalar
        ${unread ? `<span class="count">${unread}</span>` : ''}
      </a>
      <a href="profile.html" class="nav-item ${active === 'profile' ? 'active' : ''}">Profil sozlamalari</a>
    `;
  } else if (isManager) {
    navItems = `
      <a href="reports.html" class="nav-item ${active === 'reports' ? 'active' : ''}">Team Hisobotlari</a>
      <a href="notifications.html" class="nav-item ${active === 'notif' ? 'active' : ''}">
        Bildirishnomalar
        ${unread ? `<span class="count">${unread}</span>` : ''}
      </a>
      <a href="profile.html" class="nav-item ${active === 'profile' ? 'active' : ''}">Profil sozlamalari</a>
    `;
  } else {
    // FAQAT TEAM LEAD bo'lsa yoki jamoasi bo'lsa hisobotlar panelini ko'rsatish
    // Agar foydalanuvchi jamoada oddiy a'zo (member) bo'lsa, "Hisobotlar paneli" chiqmaydi
    const isTeamLead = teams.some(t => t.membershipRole === 'team_lead');
    const hasTeam = teams && teams.length > 0;
    
    navItems = `
      <a href="dashboard.html" class="nav-item ${active === 'dashboard' ? 'active' : ''}">Dashboard</a>
      ${(hasTeam && isTeamLead) ? `<a href="reports.html" class="nav-item ${active === 'reports' ? 'active' : ''}">Hisobotlar paneli</a>` : ''}
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
      <div class="brand-logo"><img src="images/logo-icon-small.svg" alt="M" width="23" height="24"></div>
      <div>
        <div class="brand-name"><img src="images/logo-text-small.svg" alt="MllyCore" height="22" style="vertical-align:middle"></div>
        <div class="text-xs muted">Boshqaruv paneli</div>
      </div>
    </a>
    <div class="flex items-center gap-2">
      <button class="btn btn-secondary btn-sm" onclick="document.body.classList.toggle('nav-open')" aria-label="Menyuni ochish">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
      </button>
    </div>
  </header>
  <div class="sidebar-backdrop" onclick="document.body.classList.remove('nav-open')"></div>
  <aside class="sidebar">
    <a href="dashboard.html" class="brand">
      <div class="brand-logo"><img src="images/logo-icon.svg" alt="M" width="32" height="34"></div>
      <div>
        <div class="brand-name"><img src="images/logo-text.svg" alt="MllyCore" height="31" style="vertical-align:middle"></div>
        <div class="text-xs muted">${isAdmin ? 'Admin boshqaruvi' : isManager ? 'Manager boshqaruvi' : "G'oyalar platformasi"}</div>
      </div>
    </a>

    <div class="nav">
      ${navItems}
    </div>

    <div id="connStatusBar" class="conn-bar conn-ok">
      <span class="conn-dot" style="background:#22c55e"></span>
      <span class="conn-text">Firestore: ulangan</span>
    </div>
    <div class="sidebar-user">
      <div class="avatar">${profile.avatar || 'U'}</div>
      <div style="flex:1;min-width:0">
        <div class="text-sm font-semibold" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${profile.name || profile.email}</div>
        <div class="text-xs muted">@${profile.username || 'user'}</div>
      </div>
      <a href="login.html" title="Chiqish" class="btn btn-tertiary btn-sm" style="padding:6px" onclick="event.preventDefault(); window.MllyCore?.logout?.().finally(()=>location.href='login.html')">
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

// FIX (mountLayout re-render): Sidebar/header faqat context o'zgarganda rebuild qilinadi.
// Oldin: har bir mountLayout chaqiruvida butun sidebar HTML qayta yaratilardi,
// keyin replaceWith bilan almashtirilardi. Bu DOM da qisqa muddatli flash berardi.
// Yangi: renderLayout faqat haqiqatda o'zgarish bo'lsa chaqiriladi.
window.__cachedLayoutKey = '';
window.__cachedNavHTML = '';

function layoutNeedsUpdate(active, context) {
  if (!context) return true;
  var profile = context.profile || window.MLLYCORE_PROFILE || {};
  var teams = context.teams || [];
  var notifications = context.notifications || [];
  var unread = notifications.filter(function(n) { return n.unread || n.isRead === false; }).length;    var key = [
      active || '',
      profile.role || '',
      profile.name || '',
      profile.username || '',
      profile.avatar || '',
    teams.length,
    unread,
    teams.slice().sort(function(a,b){return a.id<b.id?-1:1}).map(function(t) { return t.id + ':' + t.name; }).join(',')
  ].join('|');
  if (key === window.__cachedLayoutKey && window.__cachedNavHTML) return false;
  window.__cachedLayoutKey = key;
  return true;
}

window.mountLayout = function(active, context) {
  if (context) window.APP_CONTEXT = context;
  try {
  var root = document.getElementById('app');
  if (!root) return;
  
  // First call: app is NOT yet wrapped → build layout WITHOUT destroying root
  if (!root.classList.contains('app')) {
    var main = root.innerHTML;
    root.innerHTML = renderLayout(active, context) + '<main class="main">' + main + '</main>';
    root.classList.add('app');
    window.__cachedNavHTML = renderLayout(active, context);
    // Emoji → SVG: fresh DOM scan (SPA navda yangi emoji'lar ikonga aylanadi)
    window.Icon?.restart?.();
    // Apply saved theme after layout is built
    var theme = document.documentElement.dataset.theme || localStorage.getItem('mllycore-theme') || 'dark';
    window.MllyCoreTheme?.apply?.(theme);
  } else {
    // Subsequent call: faqat sidebar/header context o'zgarganda yangilanadi
    if (!layoutNeedsUpdate(active, context)) return;
    
    var temp = document.createElement('div');
    var newHtml = renderLayout(active, context);
    window.__cachedNavHTML = newHtml;
    temp.innerHTML = newHtml;
    var newHeader = temp.querySelector('.mobile-header');
    var newSidebar = temp.querySelector('.sidebar');
    var curHeader = root.querySelector('.mobile-header');
    var curSidebar = root.querySelector('.sidebar');
    // Batch replace: ikkalasini bir vaqtda almashtirish
    if (newHeader && curHeader) curHeader.replaceWith(newHeader);
    if (newSidebar && curSidebar) curSidebar.replaceWith(newSidebar);
    // FIX (nav active): proper filename comparison
    var activePage = String(active || '').replace(/^\//, '');
    root.querySelectorAll('.nav-item').forEach(function(item) {
      var href = item.getAttribute('href') || '';
      var hrefFile = href.split('/').pop().split('?')[0].split('#')[0];
      item.classList.toggle('active', hrefFile === activePage || hrefFile.startsWith(activePage));
    });
    // Emoji → SVG: sidebar/header almashtirilganidan keyin DOM ni qayta skanerlash
    window.Icon?.restart?.();
  }

  // T45 — Cmd+K Command Palette (global, faqat bir marta qo'shiladi)
  if (!window.__cmdPaletteReady) {
    window.__cmdPaletteReady = true;
    const palette = document.createElement('div');
    palette.id = 'cmdPalette';
    palette.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;align-items:center;justify-content:flex-start;padding-top:12vh;';
    palette.innerHTML = '<div style="background:var(--surface);width:min(640px,92%);border-radius:12px;padding:12px;box-shadow:0 10px 40px rgba(0,0,0,.4);"><input id="cmdInput" placeholder="Qidiruv: g‘oya, vazifa, a’zo yoki sahifa..." style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--text);font-size:14px;"><div id="cmdResults" style="margin-top:8px;max-height:50vh;overflow:auto;"></div><div class="muted" style="font-size:11px;margin-top:6px;">↑↓ tanlash · Enter ochish · Esc yopish</div></div>';
    document.body.appendChild(palette);
    const input = palette.querySelector('#cmdInput');
    const results = palette.querySelector('#cmdResults');
    const closePalette = () => { palette.style.display = 'none'; input.value = ''; results.innerHTML = ''; };
    const openPalette = () => { palette.style.display = 'flex'; input.focus(); };
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); if (palette.style.display === 'flex') closePalette(); else openPalette(); }
      if (e.key === 'Escape' && palette.style.display === 'flex') closePalette();
    });
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) { results.innerHTML = ''; return; }
      timer = setTimeout(async () => {
        try {
          const r = await window.MllyCore.search(q);
          const items = [];
          (r.results && r.results.tasks || []).forEach((x) => items.push({ label: '✓ ' + (x.title || ''), sub: 'Vazifa', url: 'team.html?id=' + (x.teamId || '') }));
          (r.results && r.results.ideas || []).forEach((x) => items.push({ label: '💡 ' + (x.title || ''), sub: 'G‘oya', url: 'idea.html?id=' + (x.id || '') }));
          (r.results && r.results.teams || []).forEach((x) => items.push({ label: '🏢 ' + (x.name || ''), sub: 'Workspace', url: 'team.html?id=' + (x.id || '') }));
          (r.results && r.results.messages || []).forEach((x) => items.push({ label: '💬 ' + ((x.text || '').slice(0, 40)), sub: 'Xabar', url: 'team.html?id=' + (x.teamId || '') }));
          results.innerHTML = items.length ? items.map((it, i) => '<div class="cmd-item" data-url="' + it.url + '" style="padding:8px;border-radius:6px;cursor:pointer;' + (i === 0 ? 'background:var(--bg);' : '') + '"><strong>' + it.label + '</strong> <span class="muted">' + it.sub + '</span></div>').join('') : '<div class="muted">Topilmadi</div>';
          results.querySelectorAll('.cmd-item').forEach((el) => el.addEventListener('click', () => { location.href = el.dataset.url; }));
        } catch (err) { results.innerHTML = '<div class="muted">Xato: ' + err.message + '</div>'; }
      }, 250);
    });
  }

  document.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) return;
    const prefetch = () => window.MllyCore?.prefetchRouteData?.(href);
    link.addEventListener('mouseenter', prefetch, { once: true });
    link.addEventListener('focus', prefetch, { once: true });
    link.addEventListener('touchstart', prefetch, { once: true, passive: true });
  });

  // Faza 5 — rolga qarab UI ni yangilash (dinamik renderdan keyin ham).
  try { window.applyRoleVisibility(); } catch (_) {}
  } catch (_) { /* mountLayout jim qoladi — hech qachon throw qilmaydi */ }
};
