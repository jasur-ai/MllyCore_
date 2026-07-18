const fs = require('fs');
let c = fs.readFileSync('admin.html', 'utf8');

const old = `      // 30 soniyalik avtomatik yangilash
      const _autoRefreshId = MllyCore.startAutoRefresh(async () => {
        document.getElementById("refreshWorkspaceBtn")?.click();
      }, 30000);`;

const newCode = `      // 30 soniyalik avtomatik yangilash — visibility check va loading indicator bilan
      const _autoRefreshId = MllyCore.startAutoRefresh(async () => {
        if (document.visibilityState !== 'visible') return;
        const refreshBtn = document.getElementById("refreshWorkspaceBtn");
        refreshBtn?.classList.add('refreshing');
        document.getElementById("refreshWorkspaceBtn")?.click();
        setTimeout(() => refreshBtn?.classList.remove('refreshing'), 1200);
      }, 30000);`;

if (c.includes(old)) {
  c = c.replace(old, newCode);
  fs.writeFileSync('admin.html', c);
  console.log('OK: admin.html updated');
} else {
  console.log('ERROR: old string not found in admin.html');
  // Try to find what's actually there
  const searchFor = 'startAutoRefresh';
  const idx = c.indexOf(searchFor);
  if (idx >= 0) {
    console.log('Found startAutoRefresh at index', idx);
    console.log('Context:', c.substring(idx - 60, idx + 120));
  }
}
