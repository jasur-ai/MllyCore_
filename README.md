# MllyCore - Startup Ideas Platform

MllyCore startap g'oyalarini jamoa bilan boshqarish, muhokama qilish va rivojlantirish uchun qurilgan web platforma. Frontend statik HTML/CSS/JS asosida, backend esa Firebase Auth va Firestore orqali ishlaydi.

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

## Firestore boshlang'ich ma'lumotlari

Boshlang'ich ma'lumotlarni Firestore'ga yozish uchun:

1. Firebase Console > Project settings > Service accounts orqali private key JSON yuklab oling.
2. Faylni loyiha ildiziga `serviceAccountKey.json` nomi bilan qo'ying.
3. Seed skriptni ishga tushiring:
   ```bash
   npm run seed
   ```

`serviceAccountKey.json` `.gitignore` ichida, repoga qo'shilmaydi.

## Deploy

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
