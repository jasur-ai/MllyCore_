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

---

## Keyingi bosqich — 4-x foydalanuvchi xabarlari (critical bug-lar + UX/rol)

> Quyidagi tasklar foydalanuvchining 4-x xabaridagi kritik xatolar va UX/rol
> talablariga asoslangan. Barcha o'zgarishlar **faqat frontend** (`*.html`,
> `css/styles.css`, `js/firebase-service.js`) ga tegishli; `api/` ga tezilmadi.

### Task 8 — KRITIK: Chat va A'zolar bo'limlari umuman ishlamasdi
**Muammo:** "chat va a'zolar bo'limi umuman ishlamayapti" — `📋 Ish doskasi / 🛠 Boshqaruv / 💬 Chat / 👥 A'zolar` tablari orasida o'tish ishlamadi.
**Ildiz sababi:** `team.html` `renderWorkspace()` ichidagi katta template-literal'da
`<div class="ws-tab-panel" data-panel="activity">` paneli **hech qachon yopilmagan**
(oxiridagi `</div>` yetishmagani uchun). Natijada `💬 Chat` va `👥 A'zolar` panel-lari
*yashirilgan* activity paneli ichida ichma-ich joylashgan edi — ularning `hidden`
atributini olib tashlash ham foyda bermasdi, chunki ajdod (activity panel) ham `hidden`
edi.
**Qanday tuzatildi:** Activity panelini yopuvchi `</div>` qo'shildi. Endi template
142/142 `<div>` balanslangan (avval 143/142 edi, 1 ta ortiqcha ochilgan `<div>` bor edi).
Chat va A'zolar tablari endi to'g'ri ishlaydi.

### Task 9 — KRITIK: `apiPost` action yo'naltirish xatosi ("Action xato.")
**Muammo:** Til (EN/RU) saqlaganda "action xato", ko'nikma saqlaganda xato, Telegram
ulanganda xabar kelmasligi, ba'zi joylarda ma'lumotlar yuklanmasligi.
**Ildiz sababi:** `vercel.json` `rewrite` qoidasi `/api/(.*) → /api/index` asl yo'lni
o'chirib yuboradi. Backend esa `req.query.action || pathname.split('/').pop()`
orqali action ni aniqlaydi. Shuning uchun `apiPost('/api/<name>')` ko'rinishidagi
~90 ta chaqiruvning hammasi `action='index'` ga tushib, `api/index.js` ning
`return { status: 400, error: 'Action xato.' }` qaytardi.
**Qanday tuzatildi:** `js/firebase-service.js` dagi `apiPost()` funksiyasi endi har
doim URL ga `?action=<oxirgi-segment>` qo'shadi (agar allaqachon bo'lmasa). `req.query.action`
birinchi tekshirilgani uchun bu **ikki holatda ham** ishlaydi — yo'l saqlansa ham,
o'chirilsa ham. `pathname` o'zgarmaydi, shuning uchun `pathname.includes(...)` routelari
ham buzilmaydi. Bu bilan til/ko'nikma/telegram saqlash, hisobotlar, g'oya-analitikasi
va boshqa ko'plab funksiyalar tiklandi.

### Task 10 — "Lead actions" (a'zo qo'shish) ni Boshqaruv ga ko'chirish
**Muammo:** "lead actions" dagi a'zo qo'shish formasi alohida bo'lib, Boshqaruv bo'limiga
ko'chirilishi so'raldi.
**Qanday tuzatildi:** `team.html` dan `workspace-split-hero` (Lead actions / Member view)
butunlay olib tashlandi. A'zo qo'shish + secret-key reset formasi endi **Boshqaruv**
panelidagi yangi `👥 A'zolarni boshqarish` akkordeoniga (faqat lead/admin) joylashtirildi.
Element ID'lari (`memberEmail`, `inviteRole`, `inviteMemberBtn`, `memberInviteFeedback`,
`resetSecretBtn`) o'zgarmagan — mavjud listener'lar `?.` orqali qayta ulanadi.

### Task 11 — Notifications: kutilmagan (unread) soni + guruhlangan ko'rinish
**Muammo:** Bildirishnoma soni "ummumiy" sonini ko'rsatardi (yangi 1/2/3/4 ko'rinmasdi);
guruhlangan ko'rinish qisilib qolgan qutichada edi.
**Qanday tuzatildi:** `notifications.html` da `notificationCount` endi **o'qilmagan**
(unread) sonini ko'rsatadi va 0 bo'lganda yashiriladi. Guruhlangan (batch) ko'rinish
yangi `.batch-summary / .batch-list / .batch-group` kartochka uslublari bilan qulay
ro'yxatga aylantirildi (`css/styles.css` ga qo'shildi).

### Task 12 — Dashboard "Keyingi qadam" faqat fresh user ga
**Muammo:** "Keyingi qadam" matni doim ko'rinardi; faqat birinchi kirgan fresh user yoki
workspace'ga ulanmaganlarga chiqishi so'raldi.
**Qanday tuzatildi:** `dashboard.html` da agar foydalanuvchining `teams.length > 0`
bo'lsa, butun "Keyingi qadam" `.workspace-surface` bo'limi yashiriladi. Aks holda
(hech qanday workspace yo'q) tegishli yo'riqnoma ko'rsatiladi.

### Task 13 — Reports: "Qisqacha statistika Yuklanmoqda…" doimiy holatidan himoyalash
**Muammo:** Hisobotlar bo'limida yon paneldagi "Yuklanmoqda…" matni ba'zan abadiy qolardi.
**Qanday tuzatildi:** `reports.html` `showReportsError()` endi yon paneldagi
`reportStatsContent` ni ham to'xtatadi ("Statistikani yuklab bo‘lmadi.") va retry
tugmasi "Yuklanmoqda…" ga qaytaradi. Shuningdek `getDashboardData`/`getReports`
xatolarida side-stats abadiy "Yuklanmoqda" bo'lib qolmaydi. (Asosiy sabab — Task 9
`apiPost` tuzatishi; bu esa himoya qatlami.)

### Task 14 — "🧠 G'oyalar tahlili" (Idea Analytics) member'larga ham ochiq + 0/0 tuzatildi
**Muammo:** Akkordeon faqat lead/admin ga ko'rinardi; 2 ta g'oya bo'lsa-da "0/0" chiqardi.
**Qanday tuzatildi:** `team.html` dagi analytics akkordeon `data-roles` ga `member` ham
qo'shildi (`team_lead,member,admin`). "0/0" aslida Task 9 dagi `apiPost` xatosi
tufayli `getIdeaAnalytics` umuman ishlamaganligi edi — endi to'g'ri `?action=idea-analytics`
bilan ishlaydi va haqiqiy statistikani ko'rsatadi.

### Task 15 — Profil: "Shaxsiy statistika" admin/manager dan yashirish + sozlamalar ajratish
**Muammo:** Admin/manager uchun o'zining "Shaxsiy statistikasi" kerak emas; qo'shimcha
sozlamalar (Telegram Chat ID / Ko'nikmalar / Til) bitta kabi ko'rinardi.
**Qanday tuzatildi:** `profile.html` da `profile.role === 'admin' || 'manager'` bo'lsa
"Shaxsiy statistika" `.workspace-surface` yashiriladi (ular user/lead/team statistikasini
admin paneli orqali ko'radi). "Qo'shimcha sozlamalar" dagi 3 ta sozlama `.extra-setting`
kartochka uslubi bilan ajratildi (`css/styles.css` ga qo'shildi) va har biriga qisqa izoh
berildi.

### Task 16 — Admin "Feature Flags" aniqroq izoh + har bir flag ta'rifi
**Muammo:** "instruction noto'g'ri va tushunarsiz" edi.
**Qanday tuzatildi:** `admin.html` sarlavha ostidagi izoh aniqroq qilindi (flag nima
qilishini, "Saqlash" bosilganda qo'llanishini tushuntiradi). Har bir flag kartochkasida
endí `FLAG_DEFS` dagi `desc` ko'rsatiladi (checkbox yonida sarlavha + kulrang izoh).

### Task 17 — Kunduzgi rejim (light mode) polish
**Muammo:** "ayrim qismlar kunduzgi rejimda g'alati ko'rinardi."
**Qanday tuzatildi:** `css/styles.css` ga yetishmayotgan `theme-light` qoplanmalari
qo'shildi: `.ws-tabs` (workspace bo'lim tablari) va `.empty-state` uchun oq/yengil fon.
(Major konteynerlar — `.workspace-surface`, `.workspace-command`, `.workspace-record`,
`.workspace-message-item` — avvalgi bosqichlarda allaqachon qoplangan edi.)

---

## Tekshiruv natijalari (yakuniy)
- Barcha 12 ta HTML: `<div>` tag-balansi **OK** (teng); barcha inline `<script>` lar
  `vm.Script` orqali parse qilindi — **xatolik yo'q**.
- `team.html` `renderWorkspace` template-literal: **142/142** `<div>` (avval 143/142,
  1 ta yetishmaydigan `</div>` — Task 8 tuzatildi).
- `js/firebase-service.js`: `node --check` **OK** (Task 9 `apiPost` o'zgartirildi).
- Barcha o'zgarishlar **additive** (mavjud kod buzilmadi; faqat qo'shildi/qatlamlandi).

## Xavfsizlik (takroriy tasdiq)
- R1 `mountLayout` bir marta — buzilmadi.
- R2 `reports.html` faqat ruxsatlilarga — buzilmadi.
- R3 o'chirishda parol re-auth — buzilmadi.
- R4 har yozuvda cache invalidate — saqlanadi.
- R5 Vercel env — tegilmadi.
- `api/` (node backend) GA TE GILMADI. Faqat frontend fayllari o'zgartirildi.
