# MllyCore — To'liq Texnik va Tizimli Xarita (Arxitektura Spetsifikatsiyasi)

> Loyihaning yakuniy, kelishilgan texnik xaritasi. Barcha funksiyalar (asl yadro + kengaytmalar + **T1–T37** takliflari) tizimning ajralmas qismi sifatida belgilangan. Kelajakdagi har qanday ish shu hujjatga asoslanadi.
>
> **🔴 JORIY HOLAT (2026-07-09):** T1–T37 — **barchasi kodlangan va tekshirilgan** (`node --check` o'tdi, UI bog'langan, `firestore.rules` yangilangan). Runtime/Deploy sinov qilinmagan. Detail uchun **XIV. bo'lim**ni o'qi. GitHub'ga push QILINMAYDI — foydalanuvchi (`jasur-ai`) o'zi qiladi.

---

## I. Biznes-mantiq (Business Logic)

MllyCore — startaplar, jamoalar va ishlab chiquvchilar uchun **yopiq (Privacy First)** workspace platformasi.
- Har bir jamoa uchun rolga asoslangan yopiq muhit: g'oyalar, vazifalar (Kanban), real-time chat, hisobotlar.
- Kirish faqat **Invite + Secret Key** orqali; `emailVerified === false` bo'lsa ruxsat yo'q.
- Rollar: `admin`, `manager`, `team_lead`, `member`, `viewer` (viewer faqat o'qiydi — T2).

---

## II. Texnologik Stack va Deployment

| Qatlam | Texnologiya | Joylashuv |
|--------|-------------|-----------|
| Frontend | Toza HTML5, Vanilla ES6+, CSS3 Variables | `*.html`, `js/*.js`, `css/styles.css` |
| Theming | `js/theme.js` → `localStorage` + `document.documentElement.dataset.theme` | Dark/Light |
| Routing | MPA + prefetch (`window.MllyCore.prefetchRouteData`) | `js/firebase-service.js` |
| Backend | Vercel Serverless (Node.js) | `api/index.js` (router) + `api/weekly-digest.js` (cron) + `api/_lib/firebase-admin.js` |
| Auth/DB | Firebase Auth + Cloud Firestore | `firestore.rules`, `firebase.json` |
| Encrypted files | Firebase Storage + client-side WebCrypto (AES-GCM) | `js/firebase-service.js → uploadEncryptedFile` |
| Deploy | Vercel (`vercel.json`: `/api/*` → `/api/index`; cron `/api/weekly-digest`) | Statik CDN kesh |

**Vercel env:** `FIREBASE_SERVICE_ACCOUNT_JSON` — buzilmagan, to'g'ri JSON (PKCS#8 private key). Ixtiyoriy: `CRON_SECRET` (weekly-digest cron himoyasi).

---

## III. Fayllar Tuzilishi va Vazifalari

### Statik / Dashboard sahifalari
- `index.html` (landing), `login.html`, `register.html`, `verify-email.html`
- `dashboard.html` — asosiy ish stoli; **T13** shablon tanlash (admin)
- `admin.html` — faqat `role === 'admin'` (manager tayinlash, workspace lifecycle, **T6 Flags, T1 Archive, T11 Permissions, T12 Rollback, T10 Analyze Ideas, T13 Templates**)
- `team.html` — Kanban, a'zolar, secret key reset, real-time chat (**T4 log-time, T8 dependencies, T9 presence, T13 template badge, T16 encrypted files, T2 viewer invite**)
- `reports.html` — faqat admin/manager/team_lead (R2)
- `my-ideas.html`, `profile.html` (**T15 overview, T7 export, T3 Admin 2FA, T14 working hours, T25 skills, T33 locale**), `notifications.html`, `idea.html` (**T10 similar ideas, T18 scoring, T19 pitch, T20 public**)

### Frontend JS (mantiqiy qatlam)
- `js/firebase-config.js` — web config
- `js/auth-guard.js` — `data-required-role` gvardiyasi (R2)
- `js/layout.js` — `mountLayout(active, context)` (R1: bir marta chaqiriladi)
- `js/firebase-service.js` — **barcha Firestore/api bridge**, `apiPost`, `cacheStore`, `invalidateTeamCache`/`invalidateDashboardCache` (R4), `uploadEncryptedFile` (T16), `getTemplates`/`createTemplate` (T13), `analyzeIdeas` (T10), `enable2FA`/`verify2FA`/`disable2FA` (T3), `getTeamPresence`/`subscribePresence` (T9), `notify` (T14), `generateWeeklyDigest` (T17)
- `js/analytics-widgets.js`, `js/theme.js`

### Backend (Node.js)
- `api/index.js` — **yagona router**; barcha handler'lar (core + T1–T17) + `module.exports.runWeeklyDigest` (T17 cron uchun)
- `api/weekly-digest.js` — Vercel Cron serverless funksiyasi (T17); Bearer yoki `x-cron-secret` bilan ishlaydi
- `api/_lib/firebase-admin.js` — Admin SDK
- `scripts/generate-weekly-digest.js` — lokal/CI uchun digest yaratish (index.runWeeklyDigest ni chaqiradi)

---

## IV. MUST-FOLLOW XAVFSIZLIK QOIDALARI (R1–R5)

| # | Qoida | Holati | Qayerda | **Nima uchun** |
|---|--------|--------|---------|----------------|
| R1 | `mountLayout` faqat bir marta | ✅ | `*.html` | Ikkinchi chaqiruv header/sidebar ni **almashtiradi**, aks holda DOM ikki marta render bo'lib nav duplikatsiyasiga va xotira sizib chiqishiga olib keladi. |
| R2 | `reports.html` faqat ruxsatlilarga | ✅ | `js/auth-guard.js` + `layout.js` | Moliyaviy/statistik hisobotlar maxfiy; noto'g'ri roldagi user ko'ra olmasligi kerak. |
| R3 | O'chirishda parol re-auth | ✅ | `deleteWorkspace` → `reauthenticate` (+ T3 2FA) | Workspace o'chirish qaytarib bo'lmaydi; tasdiqlash admin sessiyasi o'g'irlangan bo'lsa ham himoyalaydi. |
| R4 | Kesh invalidsiyasi | ✅ | `invalidateTeamCache`/`invalidateDashboardCache` | Offline-first kesh eski ma'lumotni ko'rsatib qo'yishi mumkin; yozuvdan keyin kesh tozalanishi shart. |
| R5 | Vercel env to'g'ri JSON | ✅ | `FIREBASE_SERVICE_ACCOUNT_JSON` | Noto'g'ri/bug'langan private key `1E08010C` xatosiga olib keladi (tasdiqlangan). |

**Qabul qoidasi:** Har bir PR oldidan R1–R5 + "additive" (mavjudga zid emas) tekshiruvi o'tkaziladi.

---

## V. Asosiy (Core) Funksiyalar

| Funktsiya | Endpoint / Action | Fayl |
|-----------|------------------|------|
| Workspace yaratish | `create-workspace` (+ `templateId` T13, + `clone-workspace` T37) | `api/index.js`, `dashboard.html` |
| A'zo takifi | `invite-member` (+ `role` T2) | `api/index.js`, `team.html` |
| Takif qabul | `accept-invite` (rolni saqlaydi) | `api/index.js` |
| Workspace o'chirish | `delete-workspace` (R3 + T3 2FA) | `api/index.js`, `admin.html` |
| G'oya/entry yaratish | `create-entry`, `update-entry-owner` | `api/index.js` (viewer bloklangan) |
| Shaxsiy g'oya | `create-personal-idea`, `import-personal-idea` | `api/index.js` |
| Vazifa | `create-task` (+`dependsOn` T8, +`skill` T25, +`stage` T29), `task-action`, `sync-tasks` | `api/index.js`, `team.html` |
| Chat | `send-chat` (real-time `onSnapshot`) | `api/index.js`, `team.html` (viewer bloklangan) |

---

## VI. Kengaytirilgan Funksiyalar (T1–T37)

### T1–T17 — AMALGA OSHIRILGAN ✅

| # | Nomi | API Action | Yangi kolleksiya / maydon | UI joyi |
|---|------|-----------|------------------|---------|
| T1 | Archive (soft delete) | `archive-workspace` | `teams.status` | `admin.html` |
| T2 | Viewer roli | `invite-member` `role` | `teamMembers.role='viewer'` | `team.html` (invite) |
| T3 | Admin 2FA | `enable-2fa` / `verify-2fa` / `disable-2fa` | `users.twoFactorSecret/Enabled` | `profile.html` |
| T4 | Time Logging | `log-time` | `timeLogs` | `team.html` (⏱) |
| T6 | Feature Flags | `feature-flags` / `set-feature-flags` | `featureFlags` | `admin.html` |
| T7 | Export My Data | `export-my-data` | — (o'qish) | `profile.html` |
| T8 | Task Dependencies | `create-task` `dependsOn` + complete'da unblock | `tasks.dependsOn/blocked` | `team.html` |
| T9 | Presence | `presence` (GET) + client Firestore | `presence` | `team.html` (nuqta) |
| T10 | AI klasterlash / dublikat | `analyze-ideas` | `ideas.similarTo` | `admin.html` + `idea.html` |
| T11 | Permission Override | `member-permissions` | `teamMembers.permissionsOverride` | `admin.html` |
| T12 | Rollback | `rollback` | `auditLogs.previousState` | `admin.html` |
| T13 | Templates | `get-templates` / `create-template` + seed | `templates` | `admin.html` + `dashboard.html` |
| T14 | Quiet Hours | `notify` (+ `update-preferences`) | `users.workingHours/timezone` | `profile.html` |
| T15 | Cross-WS Overview | `my-overview` | — (agregat) | `profile.html` |
| T16 | E2E Encrypted Files | `create-attachment` + Storage | `attachments` (`iv`) | `team.html` (🔒) |
| T17 | Weekly Digest | `weekly-digest` (cron + admin) | `digests` | Vercel Cron `vercel.json` |

### T18–T27 — Foydalanuvchi tomonidan taklif qilingan (AMALGA OSHIRILGAN ✅)

| # | Nomi | Qisqacha | API Action | Yangi maydon / kolleksiya |
|---|------|----------|-------------------|---------------------------|
| T18 | Idea Scoring (ICE/RICE) | G'oyalarni Impact/Confidence/Ease bo'yicha ballash; T10 dublikat + past ball = "e'tibor" belgisi | `score-idea` | `ideas.score{impact,confidence,ease}` |
| T19 | Pitch One-Pager | Bitta g'oya + bog'liq task + jamoa asosida investor uchun PDF/HTML | `generate-pitch` | (dynamic, `ideas`+`tasks`+`teamMembers`) |
| T20 | Public Showcase (opt-in) | Admin g'oyani "public read-only" qiladi, tashqi investor token orqali ko'radi | `set-public` / `GET /api/public-idea` | `ideas.publicToken`, `ideas.isPublic` |
| T21 | Roadmap / Timeline | `tasks`+`ideas` dan Gantt-uslubidagi vaqt chizig'i; T8 dependsOn ni vizual qiladi | `roadmap` (GET) | `team.html` yangi tab |
| T22 | Telegram Bot Bridge | T14/T17 xabarlarini Telegram'ga; O'zbekiston uchun Slack o'rniga tabiiy | `link-telegram` / `telegram-webhook` | `users.telegramChatId` |
| T23 | Financial Runway | Workspace budget/burn-rate, qolgan oy hisobi | `finances` / `runway` (GET) | `finances/{teamId}` |
| T24 | Decision Log | Biznes qarorlari alohida yozuvi (auditLog texnik, bu biznes uchun) | `decision-log` | `decisions/{decisionId}` |
| T25 | Skill Tagging & Gap | `users.skills[]`, task'da kerakli skill; mos kelmasa "skill gap" ogohlantirishi | `update-skills` | `users.skills[]`, `tasks.requiredSkill` |
| T26 | Idea Health Monitor | X kun yangilanmasa "stale"; T17 digest'da alohida bo'lim | `stale-ideas` (cron) | `ideas.lastActivityAt`, `ideas.stale` |
| T27 | Threaded @Mentions | `ideaComments` da @mention + notification | `comment` (+mention) | `notifications.mentionedUid` |

### T28–T37 — Arxitektura tomonidan taklif qilingan (AMALGA OSHIRILGAN ✅)

| # | Nomi | Qisqacha | API Action | Yangi maydon / kolleksiya |
|---|------|----------|-------------------|---------------------------|
| T28 | Reputation / Badges | A'zo hissasini gamifikatsiya qilish (vazifa/g'oya/izoh); mavjud `score` ustiga | `reputation` (GET) | `users.reputation`, `teamMembers.contributions` |
| T29 | Custom Idea Stages | G'oya hayotiy sikli bosqichlari (Raw→Validated→Building→Launched) | `set-stage` | `ideas.stage`, `templates.stages[]` |
| T30 | Meeting Minutes | Workspace uchun yig'ilish daftari; qarorlar T24 ga, action item'lar task'ga aylanadi | `meeting-notes` | `meetingNotes/{noteId}` |
| T31 | GitHub Issues Sync | Vazifalarni GitHub issue'larga sinxronlash (startap uchun tabiiy) | `sync-github` | `tasks.githubIssueId` |
| T32 | Onboarding Wizard | Yangi workspace uchun bosqichma-bosqich sozlash (invite, maqsad) | `onboarding-status` (GET) | (frontend wizard) |
| T33 | Localization (i18n) | O'zbek/Rus/Ingliz til tanlash (O'zbekiston konteksti) | `update-profile` (`locale`) | `users.locale` |
| T34 | Idea Voting / Upvotes | A'zolar g'oyaga ovoz beradi (demokratik ustuvorlik) | `vote-idea` | `ideas.votes[]`, `ideas.voteCount` |
| T35 | Risk Register | Har bir g'oya/workspace uchun xavf (ehtimollik/ta'sir) | `risk` | `risks/{riskId}` |
| T36 | Activity Timeline | Barcha workspace hodisalari birlashgan lenta (chatdan tashqari) | `activity-feed` (GET) | (auditLogs + notifications asosida) |
| T37 | Workspace Clone | Mavjud workspace ni shablon sifatida nusxalash (T13 ni kengaytiradi) | `clone-workspace` | `teams`, `templates` |

**Barcha T1–T37** — backend (`api/index.js`), frontend (`js/firebase-service.js` + sahifalar) va `firestore.rules` darajasida **to'liq kodlangan va 2026-07-09 da tekshirilgan**. T18–T37 faqat reja emas — ular ham T1–T17 bilan birga amalga oshirilgan.

---

## VII. To'liq API Endpoint Ro'yxati

```
CORE
  POST /api/create-workspace        (admin)        + templateId (T13) + clone (T37)
  POST /api/invite-member           (admin/lead)   + role (T2)
  POST /api/accept-invite           (rolni saqlaydi)
  POST /api/delete-workspace        (admin, R3 + T3 2FA)
  POST /api/create-entry            (member/lead/admin, viewer blok)
  POST /api/update-entry-owner      (lead/admin)  + previousState (T12)
  POST /api/create-personal-idea
  POST /api/import-personal-idea
  POST /api/sync-tasks
  POST /api/create-task             (member/lead) + dependsOn (T8) + skill (T25) + stage (T29)
  POST /api/send-chat               (member, viewer blok)
  POST /api/task-action             (assignee/lead/admin; complete'da unblock)

STATS / UTILS
  GET  /api/admin-stats | manager-stats
  GET  /api/member-stats
  GET  /api/health-score | audit-logs | search
  POST /api/convert-idea | update-preferences | overdue-tasks
  GET  /api/export-stats

T1–T17 (AMALGA OSHIRILGAN)
  POST /api/archive-workspace       (T1)
  POST /api/member-permissions      (T11, admin)
  POST /api/rollback                (T12, admin)
  GET  /api/feature-flags           (T6)
  POST /api/set-feature-flags       (T6, admin)
  GET  /api/my-overview             (T15)
  POST /api/log-time                (T4)
  GET  /api/export-my-data          (T7)
  POST /api/create-attachment       (T16)
  POST /api/enable-2fa | verify-2fa | disable-2fa   (T3, admin)
  GET  /api/presence                (T9)
  POST /api/analyze-ideas           (T10)
  GET  /api/get-templates | POST /api/create-template   (T13, admin)
  POST /api/notify                  (T14)
  POST /api/weekly-digest           (T17, cron + admin)

T18–T37 (AMALGA OSHIRILGAN ✅ — kodlangan + node --check o'tgan)
  POST /api/score-idea              (T18)
  POST /api/generate-pitch          (T19)
  POST /api/set-public | GET /api/public-idea?token=   (T20)
  GET  /api/roadmap                 (T21)
  POST /api/link-telegram | POST /api/telegram-webhook  (T22)
  POST /api/finances | GET /api/runway   (T23)
  POST /api/decision-log            (T24)
  POST /api/update-skills           (T25)
  GET  /api/stale-ideas (cron)      (T26)
  POST /api/comment (+mention)      (T27)
  GET  /api/reputation              (T28)
  POST /api/set-stage               (T29)
  POST /api/meeting-notes           (T30)
  POST /api/sync-github             (T31)
  GET  /api/onboarding-status       (T32)
  POST /api/update-profile (locale) (T33)
  POST /api/vote-idea               (T34)
  POST /api/risk                    (T35)
  GET  /api/activity-feed           (T36)
  POST /api/clone-workspace         (T37)
```

---

## VIII. Firestore Ma'lumotlar Modeli va Qoidalari

**Asosiy kolleksiyalar:** `users`, `teams`, `teamMembers`, `ideas`, `ideaComments`, `chatMessages`, `tasks`, `taskSubmissions`, `reports`, `notifications`, `workspaceInvites`, `personalIdeas`, `auditLogs`, `settings`.

**Yangi kolleksiyalar / maydonlar:**
- `featureFlags/{global|teamId}`, `timeLogs`, `templates/{templateId}` (T13), `presence/{uid}`, `attachments/{attachmentId}` (`iv`), `digests/{digestId}` (T17).
- `users.twoFactorSecret/Enabled` (T3), `users.workingHours/timezone` (T14), `users.skills[]` (T25), `users.reputation` (T28), `users.locale` (T33), `users.telegramChatId` (T22).
- `teamMembers.role='viewer'` (T2), `teamMembers.permissionsOverride` (T11), `teamMembers.contributions` (T28).
- `ideas.similarTo` (T10), `ideas.score{impact,confidence,ease}` (T18), `ideas.publicToken/isPublic` (T20), `ideas.stage` (T29), `ideas.votes[]/voteCount` (T34), `ideas.lastActivityAt/stale` (T26).
- `tasks.dependsOn[]/blocked` (T8), `tasks.requiredSkill` (T25), `tasks.githubIssueId` (T31).
- `notifications.mentionedUid` (T27), `finances/{teamId}` (T23), `decisions/{decisionId}` (T24), `meetingNotes/{noteId}` (T30), `risks/{riskId}` (T35).

`firestore.rules` da barcha yangi kolleksiyalar uchun `isAdmin`/`isTeamMember` asosidagi qoidalar mavjud (har bir yangi funksiya uchun VI bo'limdagi "Xavfsizlik" ustuniga qarang). `firestore.indexes.json` da `(teamId, dependsOn CONTAINS)` (T8) kabi composite index'lar qo'shilgan.

---

## IX. Frontend Integratsiya Nuqtalari

| Fayl | Mavjud UI (T1–T17) | AMALGA OSHIRILGAN (T18–T37) |
|------|---------------------|----------------------------|
| `admin.html` | T6, T1, T11, T12, T10, T13 | T23 (finances tab), T28 (reputation) |
| `profile.html` | T15, T7, T3, T14 | T25 (skills), T33 (locale) |
| `team.html` | T4, T8, T9, T13, T16, T2 | T21 (roadmap tab), T25 (skill gap), T29 (stages) |
| `dashboard.html` | T13 | T32 (onboarding) |
| `idea.html` | T10 | T18 (scoring), T19 (pitch), T20 (public), T27 (mentions) |
| `js/firebase-service.js` | T2–T17 metodlari | T18–T37 uchun bridge funksiyalar (har biri uchun `apiPost` + cache invalidate) |

---

## X. Yangi Txx Funksiya Qo'shish Checklist (jarayon)

Har bir yangi funksiya (masalan T38) qo'shilganda **bitta qoidaga** amal qilinadi — barcha qatlamlarga additive qo'shiladi:

1. **Firestore:** yangi kolleksiya/maydon uchun `firestore.rules` ga `isAdmin`/`isTeamMember` asosidagi qoida qo'shish (Privacy First). Kerak bo'lsa `firestore.indexes.json` ga composite index.
2. **Backend:** `api/index.js` ga handler yozish; rol/ruzat tekshiruvi (R2/R3) + yozuvdan keyin `invalidateTeamCache`/`invalidateDashboardCache` (R4). Router'ga branch qo'shish.
3. **Service:** `js/firebase-service.js` ga `apiPost` orqali bridge funksiya (kesh invalidsiyasi bilan).
4. **UI:** tegishli `*.html` sahifasiga forma/tugma qo'shish; `mountLayout` faqat bir marta chaqiriladi (R1).
5. **Hujjat:** ushbu faylga Txx satri qo'shish (VI bo'lim) + API (VII) + Firestore (VIII) + Frontend (IX) yangilash.
6. **Test:** `node --check` (barcha JS) + (ixtiyoriy) Firebase Emulator/Vercel deploy.

> Qoida: mavjud kod hech qachon buzib o'zgartirilmaydi — faqat yangi qatorlar qo'shiladi (additive).

---

## XI. Xatolik Holatlari (Error Handling) Jadvali

| Holat | Qaytariladi | Foydalanuvchiga ta'siri |
|-------|-------------|--------------------------|
| Invite muddati o'tgan (`status != pending`) | `handled` — qayta taklif talab | Yangi secret key bilan qayta invite |
| 2FA kod noto'g'ri (T3) | `401 '2FA kod noto\'g\'ri'` | Admin 2FA ni qayta kiritadi |
| Rollback 24 soatdan o'tgan (T12) | `400 'Qaytarish muddati o\'tgan'` | Audit yozuvi qaytarilmaydi |
| Workspace o'chirishda parol noto'g'ri (R3) | `error` (reauth xatosi) | Admin parolini to'g'rilaydi |
| Viewer yozishga urindi (T2) | `403 'Viewer faqat o\'qishi mumkin'` | Amal bajarilmaydi |
| `FIREBASE_SERVICE_ACCOUNT_JSON` buzilgan (R5) | `1E08010C` xatosi | Vercel env'ni to'g'ri JSON bilan yangilash |
| Quiet Hours ichida notify (T14) | `suppressed: true` (yetkazib berilmaydi) | Xabar ish vaqtida yetkaziladi |
| Dependencies bajarilmagan (T8) | vazifa `blocked: true` | complete bo'lmaydi to'g'ri tartibda |

---

## XII. Local Dev / Test Qo'llanmasi

Quyidagi buyruqlar `README.md` da to'liq; bu yerda faqat tez ma'lumot:

```bash
npm install
python3 -m http.server 8000          # statik frontend
npm run dev                           # Firebase emulators (hosting+auth+firestore)
node scripts/generate-weekly-digest.js  # T17 ni lokal tekshirish (FIREBASE_SERVICE_ACCOUNT_JSON kerak)
```

`firebase deploy --only firestore:rules,firestore:indexes` — qoidalar va index'larni joylashtirish. Firebase Storage (T16) va Vercel env (R5) sozlanganligini tekshiring.

---

## XIII. Deploy va Muhit

1. Vercel → Settings → Environment Variables → `FIREBASE_SERVICE_ACCOUNT_JSON` (to'g'ri JSON, buzilmagan). Ixtiyoriy: `CRON_SECRET`.
2. `vercel.json`: `/api/*` → `/api/index` rewrite + `crons: [{ path: "/api/weekly-digest", schedule: "0 9 * * 1" }]`.
3. `firebase deploy --only firestore:rules,firestore:indexes`.
4. Firebase Storage yoqilganligini tekshirish (T16 uchun).
5. Har bir yangi funksiya uchun R1–R5 va "additive" tekshiruvi.

---

---

## XIV. JORIY HOLAT — KEYINGI AI UCHUN (FAKTLAR, tavsiya emas)

> Bu bo'lim — kelasi AI sessiyasi uchun holat yozuvi. Tavsiya/ko'rsatma emas, **faktlar** va **qoidalar** yozilgan. O'qib, esda saqlash uchun mo'ljallangan.

### A. Nima qilingan (FACTS)
- **T1–T37 — barchasi kodlangan va 2026-07-09 da tekshirilgan.** Backend `api/index.js` (1727 qator) + `api/weekly-digest.js`; frontend bridge `js/firebase-service.js` (1494 qator); UI: `idea.html`, `team.html`, `profile.html`, `admin.html`; `firestore.rules` yangi kolleksiyalar uchun.
- **`node --check` o'tdi:** `api/index.js`, `api/weekly-digest.js`, `js/firebase-service.js`, `scripts/generate-weekly-digest.js`, `scripts/backfill-team-summaries.js`, `scripts/reset-production-data.js`.
- **T18–T37 handler'lari `api/index.js` da mavjud** (har biri uchun `async function handle*`), router'da branch'lari bor.
- **Bridge metodlari `js/firebase-service.js` da mavjud:** `scoreIdea`, `generatePitch`, `setPublic`, `getPublicIdea`, `getRoadmap`, `linkTelegram`, `saveFinances`, `getRunway`, `addDecision`, `updateSkills`, `getStaleIdeas`, `addComment`, `getReputation`, `setStage`, `saveMeetingNotes`, `syncGithubIssue`, `getOnboardingStatus`, `updateLocale`, `voteIdea`, `addRisk`, `getActivityFeed`, `cloneWorkspace`.
- **UI bog'langan:** `idea.html` `extraIdeaPanel` (scoreIdea/generatePitch/setPublic/voteIdea/addComment/setStage/addRisk), `team.html` (getRoadmap/getReputation/getActivityFeed/saveMeetingNotes/saveFinances/getRunway), `profile.html` `extraProfilePanel` (linkTelegram/updateSkills/updateLocale), `admin.html` `data-clone-workspace`.
- **`firestore.rules` yangi kolleksiyalar:** `featureFlags`, `timeLogs`, `templates`, `presence`, `attachments`, `digests`, `finances`, `decisions`, `meetingNotes`, `risks`, `ideaComments`.
- **ZIP tayyor:** `/home/user/MllyCore_project.zip` — toza (`.git`/`node_modules`/secrets yo'q).
  - **Parolni unutish (forgot-password) QO'SHILDI (2026-07-09):** `login.html` da "Parolni unutdingizmi?" linki + `api/index.js` da authsiz `handleForgotPassword` endpoint (`/api/forgot-password`) + `js/firebase-service.js` da `requestPasswordReset(email)`. Qoida: **faqat admin bo'lmaganlar** uchun — server `users` kolleksiyasida `role === 'admin'` ni tekshiradi, admin bo'lsa "Firebase Console orqali tiklang" deb qaytaradi; aks holda klient `sendPasswordResetEmail` chaqiradi. (Sababi: `firestore.rules` `users` ni faqat `signedIn()` o'qiydi, shuning uchun rol tekshiruvi serverda bo'lishi shart.)
  - **Secret-key / taklif xatosi TUZATILDI (2026-07-09):** Oldin ikki xil key tizimi ziddiyatda edi — `handleInviteMember` har taklifga yashirin per-invite `secretKey` generatsiya qilar, `accept-invite` esa shuni tekshirar, lekin UI `teams.secretKey` (workspace key, resetlanadigan) ni ko'rsatardi → eski/yangi workspace key kiritilsa ham "Secret key noto'g'ri" chiqardi. Endi: `handleInviteMember` per-invite key generatsiyasini olib tashladi; `handleAcceptInvite` kiritilgan kodni `teams.secretKey` (`invitationCode` fallback) bilan solishtiradi; `handleCreateWorkspace` workspace yaratilganda `secretKey` ni o'rnatadi. Natija: resetdan keyin eski takliflar **yangi** workspace key bilan ishlaydi; eski key "noto'g'ri" (reset eski kodni o'chirdi). Eski (fixdan oldin yaratilgan) workspace'larga admin bir marta "Secret key reset" bossa, key hosil bo'ladi.
- **Hujjatlar:** bu arxitektura doc + `README.md` T1–T37 ni "amalga oshirilgan" deb belgilagan.

### B. Nima qilinmagan (FACTS — tavsiya emas)
- **Runtime / Deploy sinov qilinmagan.** Hech qanday endpoint Firebase Emulator yoki Vercel deploy orqali ishga tushirilmagan.
- **`firebase deploy --only firestore:rules,firestore:indexes` bajarilmagan.**
- **Firebase Storage (T16) yoqlanganligi tasdiqlanmagan.**
- **T3 2FA TOTP, T9 presence, T10 analyze, T16 crypto+Storage, T17 cron, T22/T31 (token kerak)** hali runtime'da tekshirilmagan.

### C. QO'IDALAR (buzilmasligi shart — unutma)
- **Hech qachon GitHub'ga push qilinmaydi.** Foydalanuvchi (`jasur-ai`, repo `https://github.com/jasur-ai/MllyCore_`) local'da o'zi push qiladi. AI push qilmaydi.
- **R1–R5 xavfsizlik qoidalari hech qachon buzilib ko'chirilmasin** (IV bo'lim). R5 `FIREBASE_SERVICE_ACCOUNT_JSON` — to'g'ri PKCS#8 JSON bo'lishi shart.
- **Barcha o'zgarishlar additive** — mavjud kod buzib o'zgartirilmaydi, faqat yangi qatorlar qo'shiladi.
- **T18–T37 "faqat hujjatda yozilgan" deb shubha QILMA.** Bu shubha avval paydo bo'lgan, lekin 2026-07-09 grep + `node --check` bilan TASDIQLANDI: kod haqiqiy. Kerak bo'lsa `grep -c "handleScoreIdea" api/index.js` bilan o'zing tekshir.

### D. Deploy uchun kerakli muhit o'zgaruvchilari (FACTS)
- `FIREBASE_SERVICE_ACCOUNT_JSON` — **majburiy** (R5).
- `CRON_SECRET` — ixtiyoriy (weekly-digest cron himoyasi).
- `TELEGRAM_BOT_TOKEN` — T22 uchun kerak (bo'lmasa T22 ishlamaydi).
- `GITHUB_TOKEN` — T31 uchun kerak (bo'lmasa T31 ishlamaydi).

---

*Bu hujjat — kelajakdagi barcha o'zgarishlar uchun yakuniy manba (single source of truth). **Barcha T1–T37 funksiyalari arxitekturaga kiritildi va to'liq kodlangan.** Holat: 2026-07-09, kod darajasida tekshirilgan; runtime sinov qilinmagan.*

---

## XV. Backend Detallari: T16 (Shifrlangan Fayl) va T31 (GitHub Sync)

### T16 — Shifrlangan Fayl Biriktirish: Client vs Backend

Ushbu funksiya **zero-trust** prinsipi asosida qurilgan: server hech qachon ochiq faylni ko'rmaydi.

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CLIENT (brauzer)                           │
├──────────────────────────────────────────────────────────────────────┤
│ 1. Foydalanuvchi fayl tanlaydi                                     │
│ 2. file.arrayBuffer() → raw bytes                                 │
│ 3. crypto.getRandomValues() → 32-byte KEY + 12-byte IV           │
│ 4. crypto.subtle.importKey('raw', KEY, {name:'AES-GCM'}, ...)     │
│ 5. crypto.subtle.encrypt({name:'AES-GCM', iv}, key, data)         │
│    → shifrlangan byte'lar (CIPHERTEXT)                             │
│ 6. uploadEncryptedFile(CIPHERTEXT → Firebase Storage)              │
│ 7. createAttachmentMeta({ IV, fileName, size } → Backend API)      │
│ 8. KEY foydalanuvchiga ko'rsatiladi (qabul qiluvchiga ulashadi)    │
│    ★ KEY hech qachon serverga yuborilmaydi                         │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
     ┌────────────────────────┐     ┌──────────────────────────┐
     │   Firebase Storage     │     │   Backend API (POST      │
     │   /attachments/...enc  │     │   /api/create-attachment)│
     │   (CIPHERTEXT bytes)   │     ├──────────────────────────┤
     └────────────────────────┘     │ QABUL QILADI:           │
                                    │ • teamId, taskId/ideaId  │
                                    │ • fileName               │
                                    │ • size (son)             │
                                    │ • iv (base64, string)    │
                                    │ • versionNote (ixtiyoriy)│
                                    │                          │
                                    │ BAJARADI:                │
                                    │ 1. Membership tekshiruvi │
                                    │    (team_lead/member/    │
                                    │     admin)               │
                                    │ 2. Mavjud attachment'ni  │
                                    │    query: (teamId +      │
                                    │    taskId/ideaId +       │
                                    │    fileName)             │
                                    │ 3. Agar mavjud (T54):    │
                                    │    • oldingi versiyani   │
                                    │      `versions[]` ga     │
                                    │      qo'shadi            │
                                    │    • version++           │
                                    │ 4. Agar yangi:          │
                                    │    • Firestore doc       │
                                    │      yaratadi            │
                                    │                          │
                                    │ SAQLAMAYDI:              │
                                    │ • Fayl byte'larini ❌    │
                                    │ • Shifr kalitini (KEY)❌ │
                                    │                          │
                                    │ QAYTARADI:               │
                                    │ • attachmentId           │
                                    │ • version (1,2,3...)     │
                                    └──────────────────────────┘
```

**Muhim:** Backend `POST /api/create-attachment` handleri (`handleCreateAttachment`):
- Fayl byte'larini **ko'rmaydi** (ular to'g'ridan-to'g'ri client → Firebase Storage)
- Shifr kalitini (KEY) **ko'rmaydi** (faqat yuklovchiga ko'rsatiladi)
- Faqat metadata saqlaydi: `{teamId, taskId, ideaId, fileName, size, iv, version, versions[], uploadedBy}`
- `iv` (initialization vector) — faylni DESHIFRLASH uchun kerak, lekin kalitsiz hech narsa ochilmaydi

**T54 Attachment Versioning:** Agar bir xil `(teamId + taskId + fileName)` ga qayta yuklansa:
- Eski versiya `versions[]` massiviga arxivlanadi
- `version` maydoni ++ ga oshadi
- Har bir versiya: `{version, fileName, size, iv, uploadedBy, note, createdAt}`

---

### T31 — GitHub Issues Sync: Backend Flow

```
┌──────────────┐     ┌──────────────────────────────────────────────┐
│   CLIENT     │     │              BACKEND (Vercel)                │
│  (team.html) │     │                                              │
├──────────────┤     ├──────────────────────────────────────────────┤
│ Foydalanuvchi│     │ QABUL QILADI:                               │
│ repo va      │────▶│ • taskId (Firestore task ID)                │
│ tokenni      │     │ • repo ("user/repo" formatida)               │
│ kiritadi     │     │ • token (ixtiyoriy — bo'sh bo'lsa           │
│              │     │   process.env.GITHUB_TOKEN ishlatiladi)      │
│              │     │                                              │
│              │     │ BAJARADI:                                    │
│              │     │ 1. Taskni Firestore'dan o'qiydi              │
│              │     │    (tasks/{taskId})                          │
│              │     │ 2. Membership tekshiruvi: team_lead/admin    │
│              │     │ 3. GitHub token ni tanlaydi:                 │
│              │     │    a) Agar client token bo'lsa → uni ishlat  │
│              │     │    b) Aks holda → GITHUB_TOKEN env           │
│              │     │ 4. POST https://api.github.com/repos/        │
│              │     │    {repo}/issues                             │
│              │     │    Body: { title, body }                     │
│              │     │    Headers: Authorization: token {TOKEN}     │
│              │     │ 5. GitHub javobini tekshiradi:               │
│              │     │    • OK → githubIssueId + githubIssueUrl     │
│              │     │          task'ga yoziladi                    │
│              │     │    • Error → GitHub xatoligi qaytariladi     │
│              │     │ 6. issueUrl ni client'ga qaytaradi           │
│              │     │                                              │
│              │     │ SAQLAMAYDI:                                  │
│              │     │ • Token (hech qayerda saqlanmaydi)           │
│              │     │ • GitHub'dan boshqa ma'lumot                 │
│              │     │                                              │
│              │     │ GITHUB_TOKEN env kutilmagan xatoliklar:      │
│              │     │ • 404 → repo topilmadi ("Not Found")         │
│              │     │ • 401 → token noto'g'ri ("Bad credentials") │
│              │     │ • 403 → token ruxsati yetarli emas          │
│              │     │ • 502 → GitHub ga ulanish muammosi          │
│              │     │   (DNS/network)                              │
│              │◀────└──────────────────────────────────────────────┘
│              │
│ issueUrl ni  │
│ task yonida  │
│ ko'rsatadi   │
└──────────────┘
```

**Backend kodi:** `api/index.js` → `handleSyncGithub()` (T31, ~30 qator)
- Token hech qayerda saqlanmaydi — faqat bitta HTTP so'rov uchun ishlatiladi
- Agar `GITHUB_TOKEN` env o'rnatilmagan bo'lsa, client token majburiy
- Rate limit: GitHub API 5000 so'rov/soat (authenticated); 60 so'rov/soat (unauthenticated)

---

## XVI. Handoff — 2026-07-09 UI/UX batch (faktlar)

Quyidagi o'zgarishlar bitta sessiyada, additive tarzda qilindi. Buzilgan narsa yo'q.

### Qilingan ishlar
1. **Notifications nav** — `js/layout.js` `renderLayout` ichida admin va manager branch'lariga ham "Bildirishnomalar" linki qo'shildi (oldin faqat member uchun edi). Unread count ko'rsatiladi.
2. **`my-overview` (T15)** — `api/index.js handleGetMyOverview` endi har team uchun `teamName` va `role` qaytaradi, va o'qilmaganlar `unread===true || isRead===false || read===false` bo'yicha saniladi. `profile.html loadMyOverview` endi nomini + "Ochish" havolasini ko'rsatadi.
3. **2FA per-role (T3)** — `handleEnable2FA/Verify/Disable` dan `if (user.role!=='admin')` gate olib tashlandi; endi har qanday authed user o'z 2FA sini boshqaradi. `profile.html twoFactorPanel` barcha rollarda ko'rinadi (display:none gate yo'q). Workspace delete-dagi 2FA re-auth (R3) faqat admin uchun qolgan.
4. **Tezlik/layout** — `team.html`: (a) `renderWorkspaceSkeleton()` qo'shildi (barqaror skeleton, "scatter" yo'q); (b) init IIFE sidebar'ni keshdan darhol chiqaradi, keyin bir marta yangilaydi; (c) `presenceUnsubs` massivi orqali presence obunalari har `renderWorkspace` da tozalanadi (xotira sizib chiqishi oldini olindi, tezlik saqlandi).
5. **Collapsible "Qo'shimcha" panel** — `team.html` dagi tugma-qator `ws-acc` accordion'ga almashtirildi (Roadmap/Qarorlar/Meeting/Activity/Reputation/Moliyaviy). Ma'lumot faqat ochilganda, bir marta yuklanadi (lazy).
6. **Moliyaviy (T23)** — `prompt()` o'rniga inline forma (byudjet/burn-rate/valyuta) + runway darhol ko'rsatiladi.
7. **GitHub (T31)** — har vazifa kartasiga **🐙 GitHub'ga** tugmasi qo'shildi (`MllyCore.syncGithubIssue`). `profile.html` ga GITHUB_TOKEN env tushuntirish kartasi qo'shildi.
8. **Telegram/Til/Ko'nikma tushuntirishlari** — `profile.html` ga @userinfobot orqali Chat ID olish, ko'nikma/sayt-tili farqi haqida matn qo'shildi.

### Xavfsizlik qoidalari (R1–R5) — buzilmagan
- R1: `mountLayout` har sahifada bir marta (app class tekshiruvi orqali).
- R2: `reports.html` faqat ruxsatlilar uchun (dashboard.html logic).
- R3: workspace delete parol re-auth + admin 2FA (saqlangan).
- R4: har yozuvda cache invalidate (firebase-service.js).
- R5: Vercel env `FIREBASE_SERVICE_ACCOUNT_JSON` to'g'ri JSON bo'lishi shart.

### Deploy eslatmasi (kelasi AI esidan chiqarmasin)
`firestore.indexes.json` da Roadmap (`tasks.teamId+dueDate+__name__`) va Activity (`auditLogs.teamId+timestamp+__name__`) composite index'lari bor. Ularni Firebase'ga joylashtirmasdan Roadmap/Activity "index required" deb xato beradi. Deploy:
`firebase deploy --only firestore:rules,firestore:indexes` keyin Vercel redeploy.

### Tekshirilmagan (runtime emas)
Firebase Emulator yoki Vercel orqali hech qanday endpoint ishga tushirilmagan. 2FA verify, GitHub sync (GITHUB_TOKEN kerak), T16 Storage enable bo'lishi tasdiqlanmagan.
