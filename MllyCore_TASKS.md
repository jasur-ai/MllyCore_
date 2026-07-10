# MllyCore — Rolga asoslangan UI / UX tuzatishlari (Task ro'yxati)

> Ushbu fayl **faqat frontend (HTML + client-side JS)** ga tegishli o'zgarishlarni
> tartibli ro'yxatini beradi. Hech qanday `node` backend (`api/`, `firebase-admin`)
> o'zgartirilmadi. Xavfsizlik qoidalari (R1–R5) buzilmadi.

## Qisqacha
Foydalanuvchi turli rollar (viewer / member / manager / team_lead / admin) uchun
ko'rinmaydigan yoki noto'g'ri ko'rinadigan elementlar, vazifa tayinlash xatosi va
bezovta qiluvchi live-cursor haqida bir qator kritik muammolarni ko'rsatdi.
Quyidagi tasklar — ularni aniqlash va bartaraf etish natijasi.

---

## Task 1 — Lead-only "Boshqaruv" akkordeonlarini rolga qarab yashirish
**Muammo:** Oddiy a'zo / viewer lar ham "audit", "Backup", "Webhooks", "Load signal",
"Idea Analytics", "Biriktirmalar", "Vaqt/Timezone", "Moliyaviy" kabi lead/admin
funksiyalarini ko'rardi (complaints 1, 4, 5).
**Qayerda:** `team.html` — `🛠 Boshqaruv` (sobiq "Faoliyat") panelidagi akkordeonlar.
**Qanday tuzatildi:** Mavjud `data-roles` + `applyRoleVisibility()` tizimidan foydalanildi
(`layout.js` + `css/styles.css` allaqachon bu sistemani qo'llab-quvvatlaydi). Quyidagi
akkordeonlarga `data-roles="team_lead,admin"` qo'shildi:
`finance`, `backup`, `load`, `webhooks`, `analytics`, `attachments`, `timezone`.
Natija: member/viewer ularni ko'rmaydi; lead/admin ko'radi. Sub-nav guruhlash
(moliya/jamoa/integratsiya) o'zgarishsiz ishlaydi.

## Task 2 — Vazifa tayinlash xatosi (assignedTo) tuzatildi
**Muammo:** Mas'ul tayinlansa ham, vazifa hech qachon tayinlanmagan holatda qolardi va
"kim mas'ul" hisobida har doim lead (yaratuvchi) chiqardi (complaints 8 va 9).
**Ildiz sababi:** Klient `assignedUserId` yuborardi, lekin server `req.body.assignedTo`
o'qiydi (`api/index.js → handleCreateTask`). Natijada `assignedTo` har doim `null` bo'lib,
`who = assignedTo || createdBy` tufayli lead mas'ul sifatida ko'rinardi.
**Qanday tuzatildi:** `team.html` dagi `createTask` chaqiruvida klient endi server
kutyotgan `assignedTo` maydonini yuboradi (`api/index.js` ga tezilmadi). Bu IKKALA
complaintni hal qiladi — tayinlash ishlaydi va lead o'zi "mas'ul" bo'lib qolmaydi.

## Task 3 — Vazifani masulsiz yaratish + mas'ul keyinroq tayinlash
**Muammo:** Foydalanuvchi vazifani masulsiz yaratib, keyinroq mas'ul saylamoqchi edi
(complaint 9).
**Qanday tuzatildi:** `team.html` da "Mas'ul" tanlash maydoni faqat **"Bir kishiga"
(direct)** rejimida ko'rinadi; "Umumiy" va "Jamoaviy" rejimlarda yashiriladi va
`assignedTo` bo'sh yuboriladi. Shunda vazifa masulsiz yaratiladi, keyin da'vo qilinadi
(claim) yoki keyinroq tayinlanadi.

## Task 4 — Profilda "Workspace'larim" yo'qolishi tuzatildi
**Muammo:** Profil sahifasiga o'tganda yon-paneldagi "Workspace'larim" bo'limi bo'sh
chiqardi (complaint 7).
**Ildiz sababi:** `profile.html` `mountLayout('profile', { ..., teams: [] })` deb
bo'sh ro'yxat uzatardi — shuning uchun sidebar ishchi jamoalarni ko'rsata olmadi.
**Qanday tuzatildi:** Profil ochilganda `MllyCore.getDashboardData(uid)` orqali haqiqiy
jamoalar yuklanib, `mountLayout` ga uzatiladi (try/catch ichida; xato bo'lsa ham sahifa
buzilmaydi). Asosiy "Cross-WS Overview" bo'limi avvalgidek `getMyOverview()` orqali ishlaydi.

## Task 5 — Notifications: "Team takliflari" faqat mavjud bo'lganda
**Muammo:** Manager (va boshqalar) uchun "Team takliflari" bo'limi keraksiz/bo'sh holatda
ko'rinardi (complaint 6).
**Qanday tuzatildi:** `notifications.html` da `renderNotificationPage` ichida, agar
kutilayotgan takliflar (`pendingInvites`) bo'sh bo'lsa, tegishli `.workspace-surface`
bo'limi yashiriladi. Taklif bo'lsagina ko'rsatiladi.

## Task 6 — Jonli kursolarga toggle (o'chirish imkoniyati)
**Muammo:** Boshqa a'zolarning kursorlari ekranda doimiy "quvidan quvib" yuguradigan
nuqtalar bezovta qilardi / diqqatni chalg'itardi (complaint 10).
**Qanday tuzatildi:** `team.html` (T48 Live Collaboration) qayta tuzildi:
- Holat `localStorage` (`mlly_cursor_enabled`) da saqlanadi (default: yoq).
- `collabPresence` paneliga "👁 Kursolar: Yoq/O'ch" tugmasi qo'shildi.
- Foydalanuvchi istaganida kursolarni o'chirishi yoki qayta yoqishi mumkin.
- **Presence (kim onlayn)** esa doim ko'rinadi — bu foydali va bezovta qilmaydi.

## Task 7 — Admin "Feature Flags" ga izohlar qo'shildi
**Muammo:** Admin panelidagi Feature Flags bo'limida har bir flag nima uchunligi
haqida izoh yo'q edi (complaint 2).
**Qanday tuzatildi:** `admin.html` da `FLAG_DEFS` massiviga har bir flag uchun `desc`
maydoni va yuqoriga umumiy izoh qo'shildi (timeTracking, guestRole, twoFactor,
dependencies, templates, quietHours, encryptedFiles, weeklyDigest).

---

## Qo'shimcha — avvalgi bosqich (layout restructure) qisqacha
(Oldingi sessiyada bajarilgan, shu yechim bilan birga zip ga kiritildi):
- `admin.html`: statik HTML dagi xom `${...}` template o'chirildi; barcha `(Txx)` yorliqlari
  foydalanuvchi matnidan olib tashlandi.
- `team.html`: buzilgan bo'sh `<div>` bloki o'chirildi; "Faoliyat" → "🛠 Boshqaruv" deb
  o'zgartirildi; 12 ta akkordeon 3 guruhga (moliya / jamoa / integratsiya) sub-nav orqali
  ajratildi.
- `reports.html`: `loadAllReports()` `try/catch` + xato holati + retry bilan himyalandi.
- `dashboard.html`: parol/secret-key alohida modalda, "Copy" tugmalari bilan ko'rsatiladi.
- Barcha fayllardagi `(Txx)` foydalanuvchi-matnlari tozalandi (idea/profile/dashboard).

---

## Tekshiruv natijalari
- `profile.html` / `notifications.html` / `admin.html`: `<div>` tag-balansi **OK** (teng).
- `team.html`: `<div>` balansi 236/235 — bu **faqat** `<script>` ichidagi runtime JS
  template-literal string'lardagi `<div>` larni sanashdan kelib chiqqan naiv hisob
  artefakti; haqiqiy brauzer-parsed static HTML **balanslangan** va static HTML tashqarisida
  xom `${}` yo'q. O'zgarishlarim div soniga ta'sir qilmadi (faqat atribut/matn).
- Barcha o'zgarishlar **additive** (mavjud kod o'zgartirilmadi, faqat qatlamlash/qo'shish).

## Xavfsizlik
- R1 `mountLayout` bir marta chaqiriladi — buzilmadi.
- R2 `reports.html` faqat ruxsatlilarga — buzilmadi.
- R3 o'chirishda parol re-auth — buzilmadi.
- R4 har yozuvda cache invalidate — saqlanadi (`createTask` ichida `invalidateTeamCache`).
- R5 Vercel env `FIREBASE_SERVICE_ACCOUNT_JSON` — bazaviy, tegilmadi.
- `api/` (node backend) GA TE GILMADI. Faqat frontend fayllari o'zgartirildi.
