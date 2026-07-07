# MllyCore Yangi Funksiyalar — Integratsiya va Amalga Oshirish Qo'llanmasi

Ushbu hujjat MllyCore loyihasiga qo'shilgan 13 ta yangi funksiyaning frontend va backend integratsiyasini bosqichma-bosqich bayon etadi.

---

## I. Backend API Endpointlari

Barcha yangi API endpointlari `/api` papkasida joylashgan va Vercel serverless funksiyalari sifatida ishlaydigan:

### 1. Admin Statistika (`api/get-admin-stats.js`)

**Maqsad:** Platformaning global statistikasini olish (faqat admin uchun)

**So'rov:**
```javascript
const response = await fetch('/api/get-admin-stats', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${idToken}` }
});
const data = await response.json();
```

**Qaytarish:**
```json
{
  "platform": {
    "totalUsers": 150,
    "verifiedUsers": 120,
    "unverifiedPercent": 20,
    "totalTeams": 12,
    "newTeamsInMonth": 3,
    "avgHealthScore": 72
  },
  "dailyActivity": {
    "newIdeasInDay": 5,
    "newTasksInDay": 12,
    "estimatedDAU": 45
  },
  "managers": [
    {
      "managerId": "uid1",
      "name": "Manager Nomi",
      "email": "manager@example.com",
      "assignedTeamsCount": 3,
      "completionRate": 85,
      "punctualityRate": 90,
      "score": 87.5
    }
  ],
  "topActors": [...]
}
```

### 2. Manager Statistika (`api/get-manager-stats.js`)

**Maqsad:** Manager uchun o'ziga biriktirilgan teamlar taqqoslovi

**So'rov:**
```javascript
const response = await fetch('/api/get-manager-stats', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${idToken}` }
});
```

**Qaytarish:**
```json
{
  "managerId": "uid2",
  "managerName": "Manager Ismi",
  "teams": [
    {
      "teamId": "team1",
      "teamName": "Team A",
      "membersCount": 5,
      "completionRate": 75,
      "punctualityRate": 85,
      "weeklyMessages": 45,
      "overdueCount": 2,
      "healthScore": 78,
      "status": "healthy"
    }
  ],
  "summary": {
    "totalTeams": 3,
    "avgCompletionRate": 78,
    "avgPunctualityRate": 87,
    "avgChatActivity": 42,
    "avgHealthScore": 76
  }
}
```

### 3. Team A'zolari Statistikasi (`api/get-team-member-stats.js`)

**Maqsad:** Team lead uchun har bir a'zoning individual statistikasi

**So'rov:**
```javascript
const response = await fetch('/api/get-team-member-stats?teamId=team1', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${idToken}` }
});
```

**Qaytarish:**
```json
{
  "teamId": "team1",
  "members": [
    {
      "userId": "user1",
      "name": "A'zo Ismi",
      "email": "user@example.com",
      "role": "member",
      "score": 125,
      "tasks": {
        "completed": 8,
        "inProgress": 2,
        "overdue": 1,
        "total": 11,
        "avgLeadTimeHours": 24
      },
      "reports": {
        "onTime": 4,
        "late": 0,
        "total": 4
      },
      "contributions": {
        "ideasCreated": 3,
        "comments": 12,
        "messages": 45
      }
    }
  ],
  "teamStats": {
    "totalMembers": 5,
    "avgTaskCompletion": 72,
    "avgReportPunctuality": 90,
    "totalMessages": 234,
    "totalIdeas": 15
  }
}
```

### 4. Shaxsiy Statistika (`api/get-member-stats.js`)

**Maqsad:** Member o'zining shaxsiy statistikasini ko'rish

**So'rov:**
```javascript
// Faqat o'z statistikasi
const response = await fetch('/api/get-member-stats', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${idToken}` }
});

// Yoki biror team'da
const response = await fetch('/api/get-member-stats?teamId=team1', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${idToken}` }
});
```

### 5. Health Score (`api/get-health-score.js`)

**Maqsad:** Team'ning salomatlik indeksini hisoblash (0-100)

**So'rov:**
```javascript
const response = await fetch('/api/get-health-score?teamId=team1', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${idToken}` }
});
```

**Qaytarish:**
```json
{
  "teamId": "team1",
  "teamName": "Team A",
  "healthScore": 78,
  "components": {
    "taskCompletionRate": 75,
    "reportPunctuality": 85,
    "chatActivityScore": 65,
    "memberRetention": 90
  },
  "status": "healthy",
  "metrics": {
    "totalTasks": 20,
    "completedTasks": 15,
    "totalReports": 10,
    "onTimeReports": 9,
    "weeklyMessages": 120,
    "currentMembers": 5,
    "newMembersInMonth": 1
  }
}
```

### 6. Audit Logs (`api/get-audit-logs.js`)

**Maqsad:** Admin uchun tizimdagi barcha muhim o'zgarishlarni ko'rish

**So'rov:**
```javascript
const response = await fetch('/api/get-audit-logs?limit=50&actionType=workspace_deleted', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${idToken}` }
});
```

**Filtrlash parametrlari:**
- `limit` (default: 50, max: 200)
- `actionType` - amal turi (masalan: `workspace_deleted`, `manager_assigned`)
- `userId` - foydalanuvchi ID
- `startDate` - boshlanish sanasi (ISO format)
- `endDate` - tugash sanasi (ISO format)
- `startAfter` - sahifalash uchun cursor

### 7. Leaderboard (`api/get-leaderboard.js`)

**Maqsad:** Team'dagi gamifikatsiya reytingi

**So'rov:**
```javascript
const response = await fetch('/api/get-leaderboard?teamId=team1', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${idToken}` }
});
```

### 8. G'oyadan Vazifaga (`api/convert-idea-to-task.js`)

**Maqsad:** Shaxsiy g'oyani jamoaviy vazifaga aylantirish

**So'rov:**
```javascript
const response = await fetch('/api/convert-idea-to-task', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ideaId: 'idea1',
    teamId: 'team1',
    title: 'Yangi vazifa sarlavhasi',
    description: 'Tavsif',
    assignedTo: 'user1' // Optional
  })
});
```

### 9. Kechikkan Vazifalar (`api/get-overdue-tasks.js`)

**Maqsad:** Muddatidan o'tgan vazifalarni ko'rish

**So'rov:**
```javascript
const response = await fetch('/api/get-overdue-tasks?teamId=team1', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${idToken}` }
});
```

### 10. Statistika Eksport (`api/export-stats.js`)

**Maqsad:** Statistikani CSV yoki JSON formatda yuklab olish

**So'rov:**
```javascript
const response = await fetch('/api/export-stats?type=manager&period=month&format=csv', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${idToken}` }
});
const data = await response.json();
// data.data - Base64 kodlangan fayl
// data.fileName - Fayl nomi
```

**Parametrlar:**
- `type` - `admin` yoki `manager`
- `period` - `week`, `month`, `quarter`, `year`
- `format` - `csv` yoki `json`

### 11. Foydalanuvchi Sozlamalari (`api/update-user-preferences.js`)

**Maqsad:** Ish vaqti, timezone va bildirishnoma sozlamalarini yangilash

**So'rov:**
```javascript
const response = await fetch('/api/update-user-preferences', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    workingHours: { start: '09:00', end: '18:00' },
    timezone: 'Asia/Tashkent',
    emailDigestFrequency: 'daily',
    telegramUsername: '@username'
  })
});
```

### 12. Global Qidiruv (`api/get-search-results.js`)

**Maqsad:** Barcha teamlardagi vazifalar, g'oyalar va xabarlarni qidirish

**So'rov:**
```javascript
const response = await fetch('/api/get-search-results?q=qidiruv&type=all&limit=20', {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${idToken}` }
});
```

**Parametrlar:**
- `q` - qidiruv so'zi (kamida 2 belgi)
- `type` - `all`, `tasks`, `ideas`, `messages`, `teams`
- `limit` - natijalar soni (max: 100)

---

## II. Frontend Integratsiya

### Admin Dashboard Kengaytmasi (`admin.html`)

`admin.html` sahifasiga yangi "Analytics" tabi qo'shish:

```html
<!-- admin.html ichida -->
<div class="workspace-surface">
  <div class="workspace-surface-head">
    <h2>Global Statistika</h2>
  </div>
  <div id="adminStats"></div>
</div>

<script>
(async () => {
  const user = await window.MLLYCORE_AUTH_READY;
  if (!user) return;

  try {
    const idToken = await user.getIdToken();
    const response = await fetch('/api/get-admin-stats', {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    const stats = await response.json();
    
    // Statistika ko'rsatish
    document.getElementById('adminStats').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;">
        ${window.AnalyticsWidgets.renderStatCard('Jami Foydalanuvchilar', stats.platform.totalUsers, `${stats.platform.verifiedPercent}% tasdiqlangan`, '👥')}
        ${window.AnalyticsWidgets.renderStatCard('Jami Teamlar', stats.platform.totalTeams, `${stats.platform.newTeamsInMonth} yangi bu oy`, '🏢')}
        ${window.AnalyticsWidgets.renderStatCard('O\'rtacha Health Score', stats.platform.avgHealthScore, 'Barcha teamlar', '📊')}
      </div>
      
      <h3 style="margin-top:24px;">Managerlar Reytingi</h3>
      ${window.AnalyticsWidgets.renderTeamComparison(stats.managers)}
    `;
  } catch (error) {
    console.error('Admin statistika olishda xatolik:', error);
  }
})();
</script>
```

### Team Dashboard Kengaytmasi (`team.html`)

Team Lead uchun a'zolar statistikasi tabi:

```html
<!-- team.html ichida -->
<div id="memberStatsTab">
  <div class="workspace-surface">
    <div class="workspace-surface-head">
      <h2>A'zolar Statistikasi</h2>
    </div>
    <div id="memberStats"></div>
  </div>
</div>

<script>
(async () => {
  const teamId = new URLSearchParams(location.search).get('id');
  const user = await window.MLLYCORE_AUTH_READY;
  if (!user || !teamId) return;

  try {
    const idToken = await user.getIdToken();
    const response = await fetch(`/api/get-team-member-stats?teamId=${teamId}`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    const data = await response.json();
    
    document.getElementById('memberStats').innerHTML = `
      <div style="margin-bottom:24px;">
        <h3>Oylik Leaderboard</h3>
        ${window.AnalyticsWidgets.renderLeaderboard(data.members, user.uid)}
      </div>
      
      <div>
        <h3>A'zolar Detallari</h3>
        ${data.members.map(member => window.AnalyticsWidgets.renderMemberPerformance(member)).join('')}
      </div>
    `;
  } catch (error) {
    console.error('Team statistika olishda xatolik:', error);
  }
})();
</script>
```

### Profile Dashboard Kengaytmasi (`profile.html`)

Member shaxsiy statistikasi:

```html
<!-- profile.html ichida -->
<div class="workspace-surface">
  <div class="workspace-surface-head">
    <h2>Mening Statistikam</h2>
  </div>
  <div id="personalStats"></div>
</div>

<script>
(async () => {
  const user = await window.MLLYCORE_AUTH_READY;
  if (!user) return;

  try {
    const idToken = await user.getIdToken();
    const response = await fetch('/api/get-member-stats', {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    const stats = await response.json();
    
    document.getElementById('personalStats').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;">
        ${window.AnalyticsWidgets.renderStatCard('Bajarilgan Vazifalar', stats.personalStats.completedTasks, 'Bu oy', '✅')}
        ${window.AnalyticsWidgets.renderStatCard('O\'z Vaqtida Hisobotlar', stats.personalStats.onTimeReports, 'Bu oy', '📋')}
        ${window.AnalyticsWidgets.renderStatCard('Yaratilgan G\'oyalar', stats.personalStats.ideasCreated, 'Jami', '💡')}
        ${window.AnalyticsWidgets.renderStatCard('Ball', stats.score, 'Gamifikatsiya', '⭐')}
      </div>
      
      ${stats.teamComparison ? `
        <div style="padding:16px;background:var(--surface-sub);border-radius:12px;">
          <h3>Team Taqqoslovi</h3>
          <p>Siz bu oy jamoa o\'rtachasidan <strong>${stats.teamComparison.completionDiff > 0 ? '+' : ''}${stats.teamComparison.completionDiff}%</strong> tezroq vazifa bajardingiz.</p>
        </div>
      ` : ''}
    `;
  } catch (error) {
    console.error('Personal statistika olishda xatolik:', error);
  }
})();
</script>
```

---

## III. Firestore Xavfsizlik Qoidalari

`firestore.rules` faylini yangilash:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Yangi stats kolleksiyasi - faqat admin o'qiy oladi
    match /stats/{document=**} {
      allow read: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      allow write: if false; // Faqat Cloud Functions orqali
    }

    // Audit logs - faqat admin o'qiy oladi
    match /auditLogs/{document=**} {
      allow read: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      allow write: if false; // Faqat Cloud Functions orqali
    }

    // Gamifikatsiya scores - team a'zolari o'qiy oladi
    match /teamMembers/{document=**} {
      allow read: if request.auth != null;
      allow write: if false; // Faqat Cloud Functions orqali
    }
  }
}
```

---

## IV. Frontend JS Integratsiya

`js/analytics-widgets.js` faylini `admin.html`, `team.html` va `profile.html` sahifalarida yuklash:

```html
<script src="js/analytics-widgets.js"></script>
```

---

## V. Cron Jobs va Scheduled Functions

Health Score va Audit Log'larni kuniga bir marta yangilash uchun Cloud Function scheduler qo'shish:

```javascript
// Cloud Functions - Scheduled Function
const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.syncHealthScores = functions.pubsub
  .schedule('0 2 * * *') // Har kuni 02:00 UTC'da
  .onRun(async (context) => {
    const db = admin.firestore();
    const teamsSnap = await db.collection('teams').get();
    
    for (const teamDoc of teamsSnap.docs) {
      // Health score hisoblash va yangilash
      // ... (get-health-score.js ichidagi logika)
    }
  });
```

---

## VI. Testing va Deployment

1. **Local Testing:**
   - Vercel emulator yordamida API'larni test qilish
   - Firebase emulator suite'da Firestore rules'larni test qilish

2. **Deployment:**
   - `git add .` va `git commit`
   - `git push` orqali GitHub'ga push qilish
   - Vercel avtomatik deploy qiladi

3. **Monitoring:**
   - Vercel dashboard'da API logs'larni kuzatish
   - Firebase Console'da Firestore o'qish/yozish operatsiyalarini kuzatish

---

Ushbu qo'llanma to'liq integratsiya uchun zaruriy barcha ma'lumotlarni o'z ichiga oladi. Savollar bo'lsa, texnik hujjatga murojaat qiling.
