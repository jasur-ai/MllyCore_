// MllyCore Analytics Widgets - Reusable UI Components for Statistics

window.AnalyticsWidgets = {
  // Health Score Badge (0-100 range)
  renderHealthScoreBadge: (score) => {
    const status = score >= 70 ? 'healthy' : score >= 50 ? 'warning' : 'critical';
    const statusText = score >= 70 ? 'Yaxshi' : score >= 50 ? 'Ogohlantirish' : 'Kritik';
    const color = score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
    
    return `
      <div class="health-score-badge" style="display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;background:${color}15;border:1px solid ${color}40;">
        <div style="width:32px;height:32px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:14px;">${score}</div>
        <div>
          <div style="font-size:12px;font-weight:600;color:${color};">${statusText}</div>
          <div style="font-size:11px;color:#666;">Jamoa salomatlik</div>
        </div>
      </div>
    `;
  },

  // Leaderboard Table
  renderLeaderboard: (members, currentUserId) => {
    if (!members || members.length === 0) {
      return '<div class="workspace-empty" style="padding:20px;text-align:center;"><p class="muted">Hozircha a\'zolar yo\'q</p></div>';
    }

    return `
      <div class="leaderboard-table" style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:2px solid var(--line);">
              <th style="padding:12px;text-align:left;font-size:12px;font-weight:600;color:var(--text-muted);">Rank</th>
              <th style="padding:12px;text-align:left;font-size:12px;font-weight:600;color:var(--text-muted);">A'zo</th>
              <th style="padding:12px;text-align:center;font-size:12px;font-weight:600;color:var(--text-muted);">Ball</th>
              <th style="padding:12px;text-align:center;font-size:12px;font-weight:600;color:var(--text-muted);">Vazifalar</th>
              <th style="padding:12px;text-align:center;font-size:12px;font-weight:600;color:var(--text-muted);">Hisobotlar</th>
            </tr>
          </thead>
          <tbody>
            ${members.map((member, idx) => `
              <tr style="border-bottom:1px solid var(--line);background:${member.userId === currentUserId ? 'var(--surface-sub)' : 'transparent'};">
                <td style="padding:12px;font-weight:600;color:${idx === 0 ? '#f59e0b' : idx === 1 ? '#a8a8a8' : idx === 2 ? '#cd7f32' : 'var(--text)'};">
                  ${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                </td>
                <td style="padding:12px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <div style="width:32px;height:32px;border-radius:50%;background:var(--surface-sub);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;">${member.avatar || 'U'}</div>
                    <div>
                      <div style="font-weight:500;font-size:13px;">${member.name}</div>
                      <div style="font-size:11px;color:var(--text-muted);">${member.role}</div>
                    </div>
                  </div>
                </td>
                <td style="padding:12px;text-align:center;font-weight:600;font-size:14px;color:#10b981;">${member.score}</td>
                <td style="padding:12px;text-align:center;font-size:13px;">${member.completedTasks || 0}</td>
                <td style="padding:12px;text-align:center;font-size:13px;">${member.onTimeReports || 0}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // Statistics Card
  renderStatCard: (label, value, note, icon) => {
    return `
      <div class="stat-card" style="padding:16px;border:1px solid var(--line);border-radius:12px;background:var(--surface);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
          <div style="font-size:13px;font-weight:600;color:var(--text-muted);">${label}</div>
          ${icon ? `<div style="font-size:20px;">${icon}</div>` : ''}
        </div>
        <div style="font-size:28px;font-weight:700;color:var(--text);margin-bottom:4px;">${value}</div>
        ${note ? `<div style="font-size:12px;color:var(--text-muted);">${note}</div>` : ''}
      </div>
    `;
  },

  // Progress Bar
  renderProgressBar: (current, total, label) => {
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    const color = percent >= 80 ? '#10b981' : percent >= 60 ? '#f59e0b' : '#ef4444';
    
    return `
      <div class="progress-bar" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-size:13px;font-weight:500;">${label}</span>
          <span style="font-size:12px;font-weight:600;color:${color};">${percent}%</span>
        </div>
        <div style="width:100%;height:8px;background:var(--surface-sub);border-radius:4px;overflow:hidden;">
          <div style="width:${percent}%;height:100%;background:${color};transition:width 0.3s ease;"></div>
        </div>
      </div>
    `;
  },

  // Team Comparison Table
  renderTeamComparison: (teams) => {
    if (!teams || teams.length === 0) {
      return '<div class="workspace-empty" style="padding:20px;text-align:center;"><p class="muted">Hozircha teamlar yo\'q</p></div>';
    }

    return `
      <div class="team-comparison-table" style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="border-bottom:2px solid var(--line);">
              <th style="padding:12px;text-align:left;font-size:12px;font-weight:600;color:var(--text-muted);">Team Nomi</th>
              <th style="padding:12px;text-align:center;font-size:12px;font-weight:600;color:var(--text-muted);">A'zolar</th>
              <th style="padding:12px;text-align:center;font-size:12px;font-weight:600;color:var(--text-muted);">Bajarilish %</th>
              <th style="padding:12px;text-align:center;font-size:12px;font-weight:600;color:var(--text-muted);">Hisobot Intizomi %</th>
              <th style="padding:12px;text-align:center;font-size:12px;font-weight:600;color:var(--text-muted);">Chat Faolligi</th>
              <th style="padding:12px;text-align:center;font-size:12px;font-weight:600;color:var(--text-muted);">Health</th>
            </tr>
          </thead>
          <tbody>
            ${teams.map(team => {
              const healthColor = team.healthScore >= 70 ? '#10b981' : team.healthScore >= 50 ? '#f59e0b' : '#ef4444';
              return `
                <tr style="border-bottom:1px solid var(--line);">
                  <td style="padding:12px;font-weight:500;">${team.teamName}</td>
                  <td style="padding:12px;text-align:center;font-size:13px;">${team.membersCount}</td>
                  <td style="padding:12px;text-align:center;font-size:13px;font-weight:600;color:${team.completionRate >= 80 ? '#10b981' : team.completionRate >= 60 ? '#f59e0b' : '#ef4444'};">${team.completionRate}%</td>
                  <td style="padding:12px;text-align:center;font-size:13px;font-weight:600;color:${team.punctualityRate >= 80 ? '#10b981' : team.punctualityRate >= 60 ? '#f59e0b' : '#ef4444'};">${team.punctualityRate}%</td>
                  <td style="padding:12px;text-align:center;font-size:13px;">${team.weeklyMessages} xabar</td>
                  <td style="padding:12px;text-align:center;">
                    <div style="display:inline-block;padding:4px 8px;border-radius:6px;background:${healthColor}20;color:${healthColor};font-weight:600;font-size:12px;">${team.healthScore}</div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // Member Performance Card
  renderMemberPerformance: (member) => {
    return `
      <div class="member-performance-card" style="padding:16px;border:1px solid var(--line);border-radius:12px;background:var(--surface);margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:40px;height:40px;border-radius:50%;background:var(--surface-sub);display:flex;align-items:center;justify-content:center;font-weight:600;">${member.avatar || 'U'}</div>
            <div>
              <div style="font-weight:600;font-size:14px;">${member.name}</div>
              <div style="font-size:12px;color:var(--text-muted);">${member.email}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:20px;font-weight:700;color:#10b981;">${member.score || 0}</div>
            <div style="font-size:11px;color:var(--text-muted);">Ball</div>
          </div>
        </div>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div style="padding:8px;background:var(--surface-sub);border-radius:8px;text-align:center;">
            <div style="font-size:16px;font-weight:700;">${member.tasks?.completed || 0}</div>
            <div style="font-size:11px;color:var(--text-muted);">Bajarilgan vazifalar</div>
          </div>
          <div style="padding:8px;background:var(--surface-sub);border-radius:8px;text-align:center;">
            <div style="font-size:16px;font-weight:700;">${member.reports?.onTime || 0}</div>
            <div style="font-size:11px;color:var(--text-muted);">O'z vaqtida hisobotlar</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div style="font-size:12px;">
            <div style="color:var(--text-muted);margin-bottom:2px;">G'oyalar</div>
            <div style="font-weight:600;">${member.contributions?.ideasCreated || 0}</div>
          </div>
          <div style="font-size:12px;">
            <div style="color:var(--text-muted);margin-bottom:2px;">Kommentlar</div>
            <div style="font-weight:600;">${member.contributions?.comments || 0}</div>
          </div>
        </div>
      </div>
    `;
  },

  // Overdue Tasks Alert
  renderOverdueAlert: (overdueCount, daysOverdue) => {
    const severity = daysOverdue > 7 ? 'critical' : daysOverdue > 3 ? 'warning' : 'minor';
    const bgColor = severity === 'critical' ? '#fecaca' : severity === 'warning' ? '#fef3c7' : '#dbeafe';
    const borderColor = severity === 'critical' ? '#ef4444' : severity === 'warning' ? '#f59e0b' : '#3b82f6';
    const icon = severity === 'critical' ? '⚠️' : '📌';

    return `
      <div class="overdue-alert" style="padding:12px 16px;border-radius:8px;background:${bgColor};border-left:4px solid ${borderColor};display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div style="font-size:20px;">${icon}</div>
        <div>
          <div style="font-weight:600;font-size:13px;color:${borderColor};">${overdueCount} ta kechikkan vazifa</div>
          <div style="font-size:12px;color:var(--text-muted);">${daysOverdue} kundan ortiq kechikgan</div>
        </div>
      </div>
    `;
  }
};
