# MllyCore — To'liq Texnik va Tizimli Xarita (Arxitektura Spetsifikatsiyasi)

> Loyihaning yakuniy, kelishilgan texnik xaritasi. Barcha funksiyalar (asl yadro + kengaytmalar + **T1–T17** takliflari) tizimning ajralmas qismi sifatida belgilangan. Kelajakdagi har qanday ish shu hujjatga asoslanadi.

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
- `my-ideas.html`, `profile.html` (**T15 overview, T7 export, T3 Admin 2FA, T14 working hours**), `notifications.html`, `idea.html` (**T10 similar ideas**)

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

| # | Qoida | Holati | Qayerda ta'minlangan |
|---|--------|--------|----------------------|
| R1 | `mountLayout` faqat bir marta | ✅ | `*.html` da ma'lumot kelgandan keyin; ikkinchi chaqiruv header/sidebar ni almashtiradi |
| R2 | `reports.html` faqat ruxsatlilarga | ✅ | `js/auth-guard.js` + `layout.js` |
| R3 | O'chirishda parol re-auth | ✅ | `deleteWorkspace` → `reauthenticate`; + **T3 2FA kod** (agar yoqilgan bo'lsa) |
| R4 | Kesh invalidsiyasi | ✅ | `invalidateTeamCache`/`invalidateDashboardCache` barcha yozuv handler'larida |
| R5 | Vercel env to'g'ri JSON | ✅ | `FIREBASE_SERVICE_ACCOUNT_JSON` buzilmagan PKCS#8 |

**Qabul qoidasi:** Har bir PR oldidan R1–R5 + "additive" (mavjudga zid emas) tekshiruvi o'tkaziladi.

---

## V. Asosiy (Core) Funksiyalar

| Funktsiya | Endpoint / Action | Fayl |
|-----------|------------------|------|
| Workspace yaratish | `create-workspace` (+ `templateId` T13) | `api/index.js`, `dashboard.html` |
| A'zo takifi | `invite-member` (+ `role` T2) | `api/index.js`, `team.html` |
| Takif qabul | `accept-invite` (rolni saqlaydi) | `api/index.js` |
| Workspace o'chirish | `delete-workspace` (R3 + T3 2FA) | `api/index.js`, `admin.html` |
| G'oya/entry yaratish | `create-entry`, `update-entry-owner` | `api/index.js` (viewer bloklangan) |
| Shaxsiy g'oya | `create-personal-idea`, `import-personal-idea` | `api/index.js` |
| Vazifa | `create-task` (+`dependsOn` T8), `task-action`, `sync-tasks` | `api/index.js`, `team.html` |
| Chat | `send-chat` (real-time `onSnapshot`) | `api/index.js`, `team.html` (viewer bloklangan) |

---

## VI. Kengaytirilgan Funksiyalar (T1–T17) — INTEGRATSIYALANGAN

| # | Nomi | API Action | Yangi kolleksiya / maydon | UI joyi | Xavfsizlik |
|---|------|-----------|------------------|---------|-------------|
| T1 | Archive (soft delete) | `archive-workspace` | `teams.status` | `admin.html` | admin/team_lead |
| T2 | Viewer roli | `invite-member` `role` | `teamMembers.role='viewer'` | `team.html` (invite) | yozish handler'larida `isReadOnlyMember` blok |
| T3 | Admin 2FA | `enable-2fa` / `verify-2fa` / `disable-2fa` | `users.twoFactorSecret/Enabled` | `profile.html` | TOTP (HMAC-SHA1); R3 delete'da kod talab |
| T4 | Time Logging | `log-time` | `timeLogs` | `team.html` (⏱ tugma) | `invalidateTeamCache` |
| T6 | Feature Flags | `feature-flags` / `set-feature-flags` | `featureFlags` | `admin.html` | faqat admin |
| T7 | Export My Data | `export-my-data` | — (o'qish) | `profile.html` | faqat o'z uid'i |
| T8 | Task Dependencies | `create-task` `dependsOn` + complete'da unblock | `tasks.dependsOn/blocked` | `team.html` (select + badge) | R4 |
| T9 | Presence | `presence` (GET) + client Firestore | `presence` | `team.html` (nuqta) | faqat a'zolar |
| T10 | AI klasterlash / dublikat | `analyze-ideas` | `ideas.similarTo` | `admin.html` (Tahlil) + `idea.html` (o'xshash) | admin/lead |
| T11 | Permission Override | `member-permissions` | `teamMembers.permissionsOverride` | `admin.html` | `hasPerm` fallback |
| T12 | Rollback | `rollback` | `auditLogs.previousState` | `admin.html` | admin; 24 soat; R3 |
| T13 | Templates | `get-templates` / `create-template` + `create-workspace?templateId` (seed) | `templates` | `admin.html` (boshqaruvi) + `dashboard.html` (tanlash) | faqat admin yozadi |
| T14 | Quiet Hours | `notify` (+ `update-preferences` workingHours) | `users.workingHours/timezone`, `notifications.quietHoursSuppressed` | `profile.html` | flag yoqilganda, urgent bo'lmasa bostiriladi |
| T15 | Cross-WS Overview | `my-overview` | — (agregat) | `profile.html` | `decoded.uid` filtri |
| T16 | E2E Encrypted Files | `create-attachment` + Storage upload | `attachments` (`iv`) | `team.html` (🔒 tugma, AES-GCM) | client-side shifr; server ochiq fayl ko'rmaydi |
| T17 | Weekly Digest | `weekly-digest` (cron + admin trigger) | `digests` | Vercel Cron `vercel.json` | `scripts/generate-weekly-digest.js` |

**Barcha T1–T17:** backend (`api/index.js`) + service (`js/firebase-service.js`) + `firestore.rules` + tegishli UI — to'liq integratsiyalangan.

---

## VII. To'liq API Endpoint Ro'yxati

```
CORE
  POST /api/create-workspace        (admin)        + templateId (T13)
  POST /api/invite-member           (admin/lead)   + role (T2)
  POST /api/accept-invite           (rolni saqlaydi)
  POST /api/delete-workspace        (admin, R3 + T3 2FA)
  POST /api/create-entry            (member/lead/admin, viewer blok)
  POST /api/update-entry-owner      (lead/admin)  + previousState (T12)
  POST /api/create-personal-idea
  POST /api/import-personal-idea
  POST /api/sync-tasks
  POST /api/create-task             (member/lead) + dependsOn (T8, viewer blok)
  POST /api/send-chat               (member, viewer blok)
  POST /api/task-action             (assignee/lead/admin; complete'da unblock)

STATS / UTILS
  GET  /api/admin-stats | manager-stats
  GET  /api/member-stats
  GET  /api/health-score | audit-logs | search
  POST /api/convert-idea | update-preferences | overdue-tasks
  GET  /api/export-stats

NEW (T1–T17)
  POST /api/archive-workspace       (T1)
  POST /api/member-permissions      (T11, admin)
  POST /api/rollback                (T12, admin)
  GET  /api/feature-flags           (T6)
  POST /api/set-feature-flags       (T6, admin)
  GET  /api/my-overview             (T15)
  POST /api/log-time                (T4)
  GET  /api/export-my-data          (T7)
  POST /api/create-attachment       (T16)
  POST /api/enable-2fa              (T3, admin)
  POST /api/verify-2fa              (T3, admin)
  POST /api/disable-2fa             (T3, admin)
  GET  /api/presence                (T9)
  POST /api/analyze-ideas           (T10)
  GET  /api/get-templates           (T13)
  POST /api/create-template         (T13, admin)
  POST /api/notify                  (T14)
  POST /api/weekly-digest           (T17, cron + admin trigger)
```

---

## VIII. Firestore Ma'lumotlar Modeli va Qoidalari

**Asosiy kolleksiyalar:** `users`, `teams`, `teamMembers`, `ideas`, `ideaComments`, `chatMessages`, `tasks`, `taskSubmissions`, `reports`, `notifications`, `workspaceInvites`, `personalIdeas`, `auditLogs`, `settings`.

**Yangi kolleksiyalar / maydonlar (T1–T17):**
- `featureFlags/{global | teamId}` — faqat admin yozadi.
- `timeLogs` — `teamId`, `taskId`, `userId`, `durationMs`; o'qish a'zolar/Admin.
- `templates/{templateId}` — `seedTasks[]`; faqat admin yozadi, barcha o'qiydi.
- `presence/{uid}` — `status`, `lastSeen`; yozish faqat o'z uid'i.
- `attachments/{attachmentId}` — `iv` (shifr IV); server ochiq fayl ko'rmaydi.
- `digests/{digestId}` — haftalik umumlashma; faqat admin yozadi, barcha o'qiydi.
- `users.twoFactorSecret/Enabled` (T3), `users.workingHours/timezone` (T14), `ideas.similarTo` (T10), `teamMembers.role='viewer'` (T2).
- `tasks.dependsOn[]` + `tasks.blocked` (T8) — `firestore.indexes.json` da `(teamId, dependsOn CONTAINS)` composite index.

`firestore.rules` da barcha yangi kolleksiyalar uchun `isAdmin`/`isTeamMember` asosidagi qoidalar mavjud.

---

## IX. Frontend Integratsiya Nuqtalari

| Fayl | Qo'shilgan UI | Taklif |
|------|---------------|--------|
| `admin.html` | Feature Flags, Archive/Tiklash, Permissions modal, Audit Logs "Qaytarish", **G'oyalar tahlili (T10), Shablonlar boshqaruvi (T13)** | T6, T1, T11, T12, T10, T13 |
| `profile.html` | "Barcha Workspace'larim" (T15), "Export My Data" (T7), **Admin 2FA paneli (T3)**, Ish vaqti/Quiet Hours (T14) | T15, T7, T3, T14 |
| `team.html` | **T4** (⏱ Vaqt qo'shish), **T8** (dependsOn select + 🔒 Bloklangan badge), **T9** (presence nuqtasi), **T13** (shablon badge), **T16** (🔒 Fayl shifrlab yuklash), **T2** (viewer rol bilan invite) | T2, T4, T8, T9, T13, T16 |
| `dashboard.html` | **T13** shablon tanlash (create-workspace modal) | T13 |
| `idea.html` | **T10** o'xshash g'oyalar ro'yxati | T10 |
| `js/firebase-service.js` | `uploadEncryptedFile` (T16), `getTemplates`/`createTemplate` (T13), `analyzeIdeas` (T10), `enable2FA`/`verify2FA`/`disable2FA` (T3), `getTeamPresence`/`subscribePresence` (T9), `notify` (T14), `generateWeeklyDigest` (T17) | hamma |

---

## X. Holat

**Barcha T1–T17 funksiyalari tizimga integratsiyalangan** (backend + frontend + qoidalar). Barcha JS fayllar `node --check` dan o'tgan; barcha HTML inline script'lar ham sintaksis jihatdan to'g'ri.

---

## XI. Deploy va Muhit

1. Vercel → Settings → Environment Variables → `FIREBASE_SERVICE_ACCOUNT_JSON` (to'g'ri JSON, buzilmagan). Ixtiyoriy: `CRON_SECRET`.
2. `vercel.json`: `/api/*` → `/api/index` rewrite + `crons: [{ path: "/api/weekly-digest", schedule: "0 9 * * 1" }]`.
3. `firebase deploy --only firestore:rules,firestore:indexes`.
4. Firebase Storage yoqilganligini tekshirish (T16 uchun).
5. Har bir yangi funksiya uchun R1–R5 va "additive" tekshiruvi.

---

*Bu hujjat — kelajakdagi barcha o'zgarishlar uchun yakuniy manba (single source of truth). Barcha T1–T17 funksiyalari tizimga integratsiyalangan.*
