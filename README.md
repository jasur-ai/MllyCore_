# MllyCore - Startup Ideas Platform

Bu loyiha `startup_platform_master_plan.md` asosidagi MVP: frontend statik HTML/CSS/JS, backend sifatida Firebase Auth va Firestore ishlatiladi. Firebase sozlanmaguncha sahifalar mock data bilan demo rejimda ochiladi.

## Firebase loyihasi

- Project name: MllyCore
- Project ID: `mllycore`
- Project number: `357782161297`

## Ishga tushirish

1. Paketlarni o'rnating:
   ```bash
   npm install
   ```
2. Firebase Console > Project settings > General > Your apps bo'limida Web app yarating.
3. Web app konfiguratsiyasidagi `apiKey` va `appId` qiymatlarini `js/firebase-config.js` fayliga qo'ying.
4. Lokal hosting/emulator:
   ```bash
   npm run dev
   ```
5. Oddiy statik ko'rish uchun `index.html` faylini brauzerda ochish ham mumkin.

## Firestore seed

Mock ma'lumotlarni Firestore'ga yuklash uchun:

1. Firebase Console > Project settings > Service accounts orqali private key JSON yuklab oling.
2. Faylni loyiha ildiziga `serviceAccountKey.json` nomi bilan qo'ying.
3. Seed skriptni ishga tushiring:
   ```bash
   npm run seed
   ```

`serviceAccountKey.json` `.gitignore` ichida, repoga qo'shilmaydi.

## Deploy

```bash
npm run deploy:rules
npm run deploy:hosting
```

Firebase CLI login kerak bo'lsa:

```bash
npx firebase login
```

## Sahifalar

| Sahifa | Tavsif |
|---|---|
| `index.html` | Landing |
| `login.html` | Kirish, Firebase Auth yoki demo fallback |
| `register.html` | Ro'yxatdan o'tish, email verification |
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
- Seed script: `scripts/seed-firestore.js`
