// MllyCore Analytics Widgets - Reusable UI Components for Statistics
// Field names match the real API responses in api/index.js.

window.AnalyticsWidgets = {
  // Health Score Badge (0-100 range)
  renderHealthScoreBadge: (score) => {
    const s = Number(score) || 0;
    const status = s >= 70 ? 'healthy' : s >= 50 ? 'warning' : 'critical';
    const statusText = s >= 70 ? 'Yaxshi' : s >= 50 ? 'Ogohlantirish' : 'Kritik';
    const color = s >= 70 ? '#10b981' : s >= 50 ? '#f59e0b' : '#ef4444';

    return `
      <div class="health-badge" style="border-color:${color};color:${color}">
        <div class="health-score">${s}</div>
        <div class="health-status">${statusText}</div>
        <div class="health-label">Jamoa salomatlik</div>
      </div>`;
  },

  // Leaderboard Table
  // members: [{ userId, name, email, role, score, rank }]
  renderLeaderboard: (members, currentUserId) => {
    if (!members || members.length === 0) {
      return '<div class="empty-state">Hozircha a\'zolar yo\'q</div>';
    }

    return `
      <table class="leaderboard-table">
        <thead>
          <tr><th>#</th><th>A'zo</th><th>Ball</th></tr>
        </thead>
        <tbody>
          ${members.map((m) => {
            const name = m.name || m.email || m.userId || 'A\'zo';
            const avatar = (name[0] || 'U').toUpperCase();
            const rank = m.rank || 0;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
            return `<tr class="${m.userId === currentUserId ? 'current-user' : ''}">
              <td>${medal}</td>
              <td><span class="avatar">${avatar}</span> ${name} <small>(${m.role || ''})</small></td>
              <td>${m.score || 0}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  },

  // Statistics Card
  renderStatCard: (label, value, note, icon) => {
    return `
      <div class="stat-card">
        ${icon ? `<div class="stat-icon">${icon}</div>` : ''}
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
        ${note ? `<div class="stat-note">${note}</div>` : ''}
      </div>`;
  },

  // Progress Bar
  renderProgressBar: (current, total, label) => {
    const t = Number(total) || 0;
    const c = Number(current) || 0;
    const percent = t > 0 ? Math.round((c / t) * 100) : 0;
    const color = percent >= 80 ? '#10b981' : percent >= 60 ? '#f59e0b' : '#ef4444';

    return `
      <div class="progress-block">
        <div class="progress-label">${label} ${percent}%</div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${percent}%;background:${color}"></div>
        </div>
      </div>`;
  },

  // Team Comparison Table
  // teams: [{ teamId, teamName, membersCount, completionRate, healthScore, status }]
  renderTeamComparison: (teams) => {
    if (!teams || teams.length === 0) {
      return '<div class="empty-state">Hozircha teamlar yo\'q</div>';
    }

    return `
      <table class="team-compare-table">
        <thead>
          <tr><th>Team</th><th>A'zolar</th><th>Bajarilish %</th><th>Health</th></tr>
        </thead>
        <tbody>
          ${teams.map((team) => {
            const health = Number(team.healthScore) || 0;
            const hColor = health >= 70 ? '#10b981' : health >= 50 ? '#f59e0b' : '#ef4444';
            return `<tr>
              <td>${team.teamName || team.name || '—'}</td>
              <td>${team.membersCount || 0}</td>
              <td>${team.completionRate || 0}%</td>
              <td style="color:${hColor}">${health}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  },

  // Member Performance Card
  // member: { name, email, role, score, tasksCompleted, totalTasks }
  renderMemberPerformance: (member) => {
    if (!member) return '<div class="empty-state">Ma\'lumot yo\'q</div>';
    const name = member.name || member.email || 'A\'zo';
    const avatar = (name[0] || 'U').toUpperCase();
    const completed = member.tasksCompleted || 0;
    const total = member.totalTasks || 0;

    return `
      <div class="member-card">
        <div class="member-avatar">${avatar}</div>
        <div class="member-name">${name}</div>
        <div class="member-role">${member.role || ''}</div>
        <div class="member-score">${member.score || 0} <small>Ball</small></div>
        <div class="member-stats">
          <span>Bajarilgan: ${completed}/${total}</span>
        </div>
      </div>`;
  },

  // Personal Statistics Card
  // data: { score, personalStats: { completedTasks, totalTasks, ideasCreated } }
  renderPersonalStats: (data) => {
    if (!data) return '<div class="empty-state">Statistika yo\'q</div>';
    const ps = data.personalStats || {};
    return `
      <div class="personal-stats">
        <div class="stat-card"><div class="stat-value">${data.score || 0}</div><div class="stat-label">Ball</div></div>
        <div class="stat-card"><div class="stat-value">${ps.completedTasks || 0}/${ps.totalTasks || 0}</div><div class="stat-label">Vazifalar</div></div>
        <div class="stat-card"><div class="stat-value">${ps.ideasCreated || 0}</div><div class="stat-label">G'oyalar</div></div>
      </div>`;
  },

  // Overdue Tasks Alert
  renderOverdueAlert: (overdueCount, daysOverdue) => {
    const d = Number(daysOverdue) || 0;
    const severity = d > 7 ? 'critical' : d > 3 ? 'warning' : 'minor';
    const bgColor = severity === 'critical' ? '#fecaca' : severity === 'warning' ? '#fef3c7' : '#dbeafe';
    const borderColor = severity === 'critical' ? '#ef4444' : severity === 'warning' ? '#f59e0b' : '#3b82f6';
    const icon = severity === 'critical' ? '⚠️' : '📌';

    return `
      <div class="overdue-alert" style="background:${bgColor};border-color:${borderColor}">
        ${icon} <strong>${overdueCount}</strong> ta kechikkan vazifa
        ${d > 0 ? `<span>${d} kundan ortiq kechikgan</span>` : ''}
      </div>`;
  },
};
