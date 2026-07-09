# MllyCore - Startup Ideas Platform

MllyCore startap g'oyalarini jamoa bilan boshqarish, muhokama qilish va rivojlantirish uchun qurilgan web platforma. Frontend statik HTML/CSS/JS asosida, backend esa Firebase Auth va Firestore orqali ishlaydi.

## Loyiha holati — T1–T17 bajarilganligi

Barcha kengaytma funksiyalar (T1–T17) backend (`api/index.js`), frontend (`js/firebase-service.js` + tegishli sahifalar) va `firestore.rules` darajasida to'liq integratsiyalangan.

| # | Funksiya | Holati | Qayerda | Qisqacha |
|---|----------|--------|---------|----------|
| T1 | Workspace arxivlash | ✅ | `admin.html` | `archive-workspace` (soft delete, tiklash) |
| T2 | Viewer roli | ✅ | `team.html` | `invite-member` `role='viewer'`; yozish bloklangan |
| T3 | Admin 2FA | ✅ | `profile.html` | `enable/verify/disable-2fa` (TOTP); delete'da kod |
| T4 | Vaqt kuzatuvi | ✅ | `team.html` | `log-time` + `timeLogs` |
| T6 | Feature Flags | ✅ | `admin.html` | `feature-flags` / `set-feature-flags` |
| T7 | Export My Data | ✅ | `profile.html` | `export-my-data` |
| T8 | Vazifa bog'liqligi | ✅ | `team.html` | `create-task` `dependsOn` + complete'da unblock |
| T9 | Presence (onlayn holat) | ✅ | `team.html` | `presence` + `subscribePresence` nuqta |
| T10 | AI klasterlash / dublikat | ✅ | `admin.html`, `idea.html` | `analyze-ideas` + `ideas.similarTo` |
| T11 | Permission Override | ✅ | `admin.html` | `member-permissions` |
| T12 | Rollback (audit) | ✅ | `admin.html` | `rollback` + `auditLogs.previousState` |
| T13 | Shablonlar | ✅ | `admin.html`, `dashboard.html` | `get/create-template` + `create-workspace?templateId` |
| T14 | Quiet Hours | ✅ | `profile.html` | `notify` + `users.workingHours/timezone` |
| T15 | Cross-WS Overview | ✅ | `profile.html` | `my-overview` |
| T16 | Shifrlangan fayllar (E2E) | ✅ | `team.html` | AES-GCM + Storage + `create-attachment` |
| T17 | Haftalik Digest (cron) | ✅ | `api/weekly-digest.js`, `vercel.json` | `weekly-digest` + `scripts/generate-weekly-digest.js` |

> Batafsil tizimli xarita: `MllyCore_SYSTEM_ARCHITECTURE.md`

**T18–T37** (Idea Scoring, Pitch, Public Showcase, Roadmap, Telegram, Financial Runway, Decision Log, Skill Tagging, Idea Health, @Mentions, Reputation, Custom Stages, Meeting Notes, GitHub Sync, Onboarding, i18n, Voting, Risk Register, Activity Feed, Workspace Clone) ham to'liq amalga oshirilgan (`api/index.js` + `js/firebase-service.js` + tegishli sahifalar + `firestore.rules`). Barcha T1–T37 birgalikda tizimga kiritildi.

## Firebase loyihasi

- Project name: MllyCore
- Project ID: `mllycore`
- Project number: `357782161297`

## Ishga tushirish

1. Paketlarni o'rnating:
   ```bash
   npm install
   ```
2. Lokal server:
   ```bash
   python3 -m http.server 8000
   ```
3. Brauzerda oching:
   ```text
   http://localhost:8000
   ```

## Firestore production reset

1. Firebase Console > Project settings > Service accounts orqali private key JSON yuklab oling.
2. Faylni loyiha ildiziga `serviceAccountKey.json` nomi bilan qo'ying.
3. Kerak bo'lsa production bazani faqat admin bilan qayta boshlang:
   ```bash
   node scripts/reset-production-data.js
   ```

`serviceAccountKey.json` `.gitignore` ichida, repoga qo'shilmaydi.

## Deploy

Vercel serverless API workspace yaratish va team lead parolini boshqarish uchun Firebase Admin kalitini env orqali oladi. Vercel Project Settings > Environment Variables ichiga qo'shing:

```text
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

JSON Vercel inputida buzilsa, shu service account faylini base64 qilib env qiymatiga qo'yish ham ishlaydi. Env bo'lmasa workspace yaratish/o'chirish API ishlamaydi.

Admin workspace yaratganda team lead emailini kiritadi. Team lead uchun boshlang'ich parol email bilan bir xil bo'ladi, profil kirgandan keyin parolni yangilash eslatiladi.

Email tasdiqlash majburiy: ro'yxatdan o'tgan yoki admin yaratgan foydalanuvchi emailini tasdiqlamaguncha dashboard va workspace sahifalariga kira olmaydi. Tasdiqlash xatini Firebase Authentication yuboradi; Firebase Console > Authentication > Templates va Authorized domains sozlamalari to'g'ri bo'lishi kerak.

Firestore rules va indexes:

```bash
npm run deploy:rules -- --project mllycore
```

Firebase Hosting:

```bash
npm run deploy:hosting -- --project mllycore
```

Firebase CLI login kerak bo'lsa:

```bash
npx firebase login
```

## Sahifalar

| Sahifa | Tavsif |
|---|---|
| `index.html` | Landing |
| `login.html` | Firebase Auth orqali kirish |
| `register.html` | Ro'yxatdan o'tish va email verification |
| `verify-email.html` | Email tasdiqlash majburiy sahifasi |
| `dashboard.html` | Boshqaruv paneli |
| `team.html?id=t1` | Jamoa sahifasi |
| `idea.html?id=i1` | G'oya sahifasi |
| `my-ideas.html` | Mening g'oyalarim |
| `notifications.html` | Bildirishnomalar |
| `profile.html` | Profil sozlamalari |
| `admin.html` | Admin paneli |

## Backend tuzilmasi

- Firebase Auth: email/parol, email tasdiqlash
- Firestore collections: `users`, `teams`, `teamMembers`, `ideas`, `ideaComments`, `chatMessages`, `notifications`, `auditLogs`, `settings`
- Security rules: `firestore.rules`
- Indexes: `firestore.indexes.json`
- Production reset script: `scripts/reset-production-data.js`
