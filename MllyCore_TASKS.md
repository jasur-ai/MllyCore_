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

---

## Keyingi bosqich — 5-x foydalanuvchi xabarlari (akkordeon + vazifa/a'zo tuzatishlari)

> Foydalanuvchi 4-x tuzatishlardan keyin qo'shimcha aniq muammolarni ko'rsatdi: bo'limlar
> "ostidan ochiladigan" akkordeon bo'lishi kerakligi, vazifa mas'ulini ko'rsatish/noto'g'riligi,
> "Mas'ulni o'zgartirish" tugmasi va a'zo rolini (viewer/member) team lead o'zgartira olishi.

### Task 18 — Workspace bo'limlari akkordeonga o'tkazildi ("ostidan ochiladigan")
**Muammo:** "Ish doskasi / Boshqaruv / Chat / A'zolar" tab'lari burchakda qolib, pastdan
ochiladigan bo'lishi so'raldi.
**Qanday tuzatildi:** `team.html` `renderWorkspace()` ichidagi `ws-tabs` + `ws-tab-panels`
tuzilmasi `ws-accordion` > `ws-section` (sarlavha + tanasi) ko'rinishiga o'zgartirildi.
Har bir bo'lim sarlavhasini bosganda tanasi pastdan ochiladi/yopiladi; bir nechtasini bir
vaqtda ochish mumkin. Holat `localStorage` da saqlanadi. Tab almashtirish JS'i akkordeon
toggle logikasiga almashtirildi; aktivlik sub-nav (`data-bq` guruh filteri) `.ws-section-body`
ga o'tkazildi (CSS ham yangilandi). Yangi CSS `.ws-accordion / .ws-section / .ws-section-head /
.ws-section-body` `css/styles.css` ga qo'shildi. Template balans: **145/145** `<div>`.

### Task 19 — Vazifa mas'uli to'g'ri ko'rsatiladi (assignedTo → Mas'ul)
**Muammo:** Vazifa biriktirilgan a'zoga berilsa-da, "Hali olinmagan" chiqardi va team lead
o'zi mas'ul bo'lib qolardi; biriktirilgan a'zo vazifani bajara olmasdi.
**Ildiz sababi:** Backend `createTask` faqat `assignedTo` (UID) saqlaydi; `assignedUserId` /
`assignedUserName` / `assignmentMode` maydonlarini saqlamaydi. Lekin `renderTasks` aynan
shu yo'q maydonlardan foydalanardi → noto'g'ri ko'rinish.
**Qanday tuzatildi:** `renderTasks` da `assignedId = task.assignedTo || task.assignedUserId`,
`assignedName` a'zolar ro'yxatidan (userId orqali) topiladi, `mode = assignmentMode ||
(assignedId ? 'direct' : 'open')` hisoblanadi. Mas'ul qatori, `canClaim`, `isAssignedToCurrent`
va `canSubmit` endi shu qiymatlardan foydalanadi — biriktirilgan a'zo Mas'ul sifatida ko'rsatiladi
va vazifani bajarishi mumkin.

### Task 20 — Har bir vazifada "Mas'ulni o'zgartirish" tugmasi (faqat team lead)
**Muammo:** Mas'ulni keyinroq o'zgartirish imkoniyati yo'q edi.
**Qanday tuzatildi:** `team.html` vazifa kartasida (lead uchun) `memberOptions` bilan
`<select>` + "Mas'ulni o'zgartirish" tugmasi qo'shildi. Tugma `MllyCore.reassignTask()`
ni chaqiradi — bu **client-side Firestore `updateDoc`** (`tasks/{id}` dagi `assignedTo` ni
yangilaydi). Firestore qoidasi (`/tasks` write → `isTeamLead`) team lead'ga ruxsat beradi,
shuning uchun backendga tegmasdan ishlaydi. O'zgarishdan so'ng workspace avtomatik qayta
render qilinadi.

### Task 21 — A'zo rolini o'zgartirish (viewer ↔ member), faqat team lead
**Muammo:** Team lead a'zoning statusini (viewer yoki member) o'zgartira olmasdi.
**Qanday tuzatildi:** `renderMembers` da (lead uchun, o'zidan va team_lead'a a'zolar uchun
emas) har bir a'zoga rol `<select>` (Member / Viewer) + "Rolni saqlash" tugmasi qo'shildi.
Tugma `MllyCore.updateMemberRole()` ni chaqiradi — bu ham **client-side Firestore
`updateDoc`** (`teamMembers/{teamId_userId}` dagi `role` ni yangilaydi). Firestore qoidasi
(`/teamMembers` update → `isTeamLead`) team lead'ga ruxsat beradi.

### Task 22 — Bog'liqlik faqat aniq ko'rsatilganidek
**Muammo:** "Hamma topshiriq bir-biriga bog'lanib qolyapti" degan tasavvur.
**Qanday tuzatildi:** Tekshirildi — backend `createTask` faqat klient yuborgan `dependsOn`
ro'yxatini saqlaydi (bo'sh bo'lsa `[]`); hech qanday avtomatik bog'lash yo'q. Shuning uchun
bog'liqlik faqat team lead `dependsOn` select'da aniq tanlagan vazifalar uchun hosil bo'ladi.
(`blocked` ham faqat shunda `true` bo'ladi.)

---

## Tekshiruv natijalari (yakuniy — 2-bosqich)
- Barcha 12 ta HTML: `<div>` balansi **OK**; barcha inline `<script>` lar parse **OK**.
- `team.html` `renderWorkspace` template: **145/145** `<div>` (akkordeon tuzilmasi bilan).
- `js/firebase-service.js`: `node --check` **OK** (`reassignTask`, `updateMemberRole` qo'shildi).
- Barcha o'zgarishlar **additive** (mavjud kod buzilmadi; faqat qo'shildi/qatlamlandi).

## Xavfsizlik (takroriy tasdiq — 2)
- R1 `mountLayout` bir marta — buzilmadi.
- R2 `reports.html` faqat ruxsatlilarga — buzilmadi.
- R3 o'chirishda parol re-auth — buzilmadi.
- R4 har yozuvda cache invalidate (`reassignTask`/`updateMemberRole` ham `invalidateTeamCache`
  chaqiradi) — saqlanadi.
- R5 Vercel env — tegilmadi.
- `api/` (node backend) GA TE GILMADI. Faqat frontend fayllari o'zgartirildi.
- Eslatma: Task 20 va 21 dagi yozuvlar **client-side Firestore SDK** orqali bajariladi
  (maxsus `api/` endpoint'i emas); bu Firestore qoidalari bilan ruxsat etilgan
  (team lead uchun) va backend fayllariga tegmaydi.

---

## Keyingi bosqich — 6-x foydalanuvchi xabarlari (Load signal xatosi)

> Foydalanuvchi 🔥 Load signal bo'limida a'zolar o'rniga **xom Firebase UID** lar
> chiqayotganini ko'rsatdi (masalan `VPg7ya8NFMMYKtKKBn3ZazIvysu2 — 0 ochiq…`).

### Task 23 — 🔥 Load signal: xom UID o'rniga a'zo ismi
**Muammo:** `🔥 Load signal` akkordeonida har bir a'zo xom Firebase UID (28 belgili
`uid`) sifatida chiqardi; ism ko'rinmasdi.
**Ildiz sababi:** Backend `handleTeamLoad` (`api/index.js`) `load` massiviga
`{ userId, name: m.name || uid, ... }` shaklda yozadi. Lekin `teamMembers` hujjatlarida
aloḥida `name` maydoni bo'lmasligi mumkin, shuning uchun `m.name` `undefined` bo'lib,
`uid` (xom UID) fallback sifatida ko'rsatilardi.
**Qanday tuzatildi (faqat UI, backend'ga tezilmadi):** `team.html` dagi `key === 'load'`
render blokida `escapeHtml(m.name)` o'rniga `data.members` dan `userId` orqali a'zo
ismini topuvchi `nameOf(m)` yordamchi funksiyasi ishlatildi:
`(data.members.find(mm => mm.userId === m.userId)?.user?.name || mm.user?.email) || m.name || m.userId || 'A’zo'`.
`data.members` da `user?.name` / `user?.email` mavjud (Task 19 dagi a'zo-ISM
lookup bilan bir xil manba), shuning uchun endi **haqiqiy ism** ko'rinadi. Bu
o'zgarish `api/` ga tegmaydi, faqat frontend render.

---

## Tekshiruv natijalari (yakuniy — 3-bosqich)
- Barcha 12 ta HTML: `<div>` balansi **OK** (teng); barcha inline `<script>` lar parse **OK**.
- `team.html` `renderWorkspace` template: **145/145** `<div>` (akkordeon tuzilmasi bilan).
- `team.html` Load signal render: `nameOf(m)` orqali `data.members` dan ism topiladi
  (xom UID ko'rsatilmaydi).
- `js/firebase-service.js`: `node --check` **OK** (`reassignTask`, `updateMemberRole` mavjud).
- `team.html` da `ws-tab` / `ws-tab-panel` / `data-panel` kabi eski (stale) referencelar
  **yo'q** (grevp bilan tasdiqlandi).
- Barcha o'zgarishlar **additive** (mavjud kod buzilmadi; faqat qo'shildi/qatlamlandi).

## Xavfsizlik (takroriy tasdiq — 3)
- R1 `mountLayout` bir marta — buzilmadi.
- R2 `reports.html` faqat ruxsatlilarga — buzilmadi.
- R3 o'chirishda parol re-auth — buzilmadi.
- R4 har yozuvda cache invalidate (`reassignTask`/`updateMemberRole` ham `invalidateTeamCache`
  chaqiradi) — saqlanadi.
- R5 Vercel env — tegilmadi.
- `api/` (node backend) GA TE GILMADI. Faqat frontend fayllari o'zgartirildi.
- Eslatma: Task 20 va 21 dagi yozuvlar **client-side Firestore SDK** orqali bajariladi
  (maxsus `api/` endpoint'i emas); bu Firestore qoidalari bilan ruxsat etilgan
  (team lead uchun) va backend fayllariga tegmaydi.

---

## Yakuniy bosqich — Professional (ClickUp-darajali) polish

> Foydalanuvchi loyihani "professional tarzda yakunlash"ni so'radi. Tekshiruv
> davomida bir qator **haqiqiy ko'rinish xatolari** aniqlandi (aniqlanmagan CSS
> tokenlari tufayli ko'rinmaydigan kartalar/chegaralar) va ular tuzatildi, shuningdek
> interaktivlik hamda xavfsizlik yakuniy darajaga ko'tarildi. Faqat UI/CSS.

### Task 24 — Aniqlanmagan dizayn tokenlari (ko'rinmaydigan elementlar) tuzatildi
**Muammo:** `profile.html` "Qo'shimcha sozlamalar" kartalari (`.extra-setting`), 2FA
secret qutisi va "Cross-WS Overview" kartalari; `reports.html` hisobot paneli va
`admin.html` "Manager" badge; `team.html` timezone bo'limidagi `<hr>` ajratgichlari
**ko'rinmas edi** (shaffof fon, ko'rinmaydigan chegara).
**Ildiz sababi:** Koddan foydalanilgan `--accent`, `--surface`, `--line`,
`--surface-sub`, `--text-muted` CSS o'zgaruvchilari hech qayerda e'lon qilinmagan
edi (faqat ishlatilgan). Natijada brauzer ularni `initial` (shaffof) deb hisoblab,
fon/chegara yo'qolgan.
**Qanday tuzatildi:** `css/styles.css` ning `:root` va `body.theme-light` ga ushbu
5 ta token qiymatlari qo'shildi (`--accent` → indigo brend; `--surface` → panel;
`--line` → border; `--surface-sub` → panel-2; `--text-muted` → muted). Endi barcha
ushbu elementlar to'g'ri fon/chegara bilan ko'rinadi (qorong'i va kunduzgi rejimda).
Bu o'zgarish butun loyiha bo'ylab ushbu tokenlardan foydalangan joylarni bir vaqtda
tuzatadi.

### Task 25 — ClickUp-darajali interaktiv polish
**Qanday qo'shildi (additive CSS blok):**
- Vazifa kartalari (`.workspace-task-card`) va a'zo qatorlari (`.workspace-list-row`)
  uchun nozik **hover/transition** (pastga ko'tarilish + chegara/soya accent) — sichqoncha
  ustidan o'tganda javob beradigan his-tuyg'u.
- Bo'sh holatlar (`.workspace-empty`) yanada aniqroq, markazlashgan ko'rinishga keltirildi
  (dashed chegara + yengil fon).
- Juda keng ekranlarda (ultra-wide) workspace kontenti `max-width: 1500px` bilan
  markazlashtirildi.
- Tugma/sarlavha bosilganda nozik **press** effekti (`transform: translateY(1px)`).
- Toast ga `z-index` balandligi berildi (boshqa elementlar ustida ishonchli ko'rinadi).

### Task 26 — Halokatli amal uchun tasdiqlash (xavfsizlik)
**Muammo:** "Secret key reset" tugmasi tasdiqlashsiz darhol ishlagan — tasodifiy
bosish butun jamoani workspace'ga kira olmay qoldirishi mumkin edi.
**Qanday tuzatildi:** `team.html` dagi `resetSecretBtn` handler'iga `window.confirm(...)`
qo'shildi: foydalanuvchi "Eski key bilan a'zolar kira olmaydi" deb ogohlantiriladi va
faqat tasdiqlasa reset bajariladi. Bekor qilsa — hech narsa o'zgarmaydi.

---

## Tekshiruv natijalari (YAKUNIY — professional polish)
- Barcha 12 ta HTML: `<div>` balansi **OK** (teng); barcha inline `<script>` lar parse **OK**.
- `css/styles.css`: qavs balansi **OK** (635/635); yangi tokenlar `:root` va
  `body.theme-light` da e'lon qilindi; qolgan aniqlanmagan token yo'q
  (to'liq skan bilan tasdiqlandi).
- `js/firebase-service.js`: `node --check` **OK**.
- `team.html`: reset-secret uchun `confirm()` qo'shildi (additive, mavjud handler buzilmadi).
- Barcha o'zgarishlar **additive** (mavjud kod buzilmadi; faqat qo'shildi/qatlamlandi).

## Xavfsizlik (YAKUNIY tasdiq)
- R1 `mountLayout` bir marta — buzilmadi.
- R2 `reports.html` faqat ruxsatlilarga — buzilmadi.
- R3 o'chirishda parol re-auth — buzilmadi.
- R4 har yozuvda cache invalidate (`reassignTask`/`updateMemberRole` ham `invalidateTeamCache`
  chaqiradi) — saqlanadi.
- R5 Vercel env — tegilmadi.
- `api/` (node backend) GA TE GILMADI. Faqat frontend fayllari o'zgartirildi.
- Halokatli amal (secret key reset) endi foydalanuvchi tasdig'i bilan bajariladi.

---

## Qo'shimcha (foydalanuvchi rasmga asoslangan) — Task 27

> Foydalanuvchi rasm yuborib, bo'limlar joylashuvini aniqlik kiritdi: 4 ta bo'lim
> (Ish doskasi / Boshqaruv / Chat / A'zolar) **yonma-yon (ketma-ket) bitta qatorda**
> bo'lishi, "ostidan ochiladigan" akkordeon saqlanishi, lekin **sukut bo'yicha qisqa
> (yopiq)** tursin — vazifa qo'shilganda o'zi katta bo'lib qolmasin; faqat sarlavhaga
> bossangiz katta ochilsin.

### Task 27 — Bo'limlar yonma-yon tab-qator + sukutda yopiq akkordeon
**Muammo:** Bo'limlar vertikal (biri pastda biri) joylashgan edi va Ish doskasi
sukut bo'yicha ochiq (katta) edi; vazifa qo'shilganda ham katta holatda qolardi.
**Qanday tuzatildi (faqat CSS + 2 ta kichik HTML atributi, JS toggling'iga tegilmadi):**
- `css/styles.css`: `.ws-accordion` endi **grid** (4 ustun); `.ws-section` ga
  `display: contents` berildi — shunda har bir bo'limning sarlavhasi va tanasi
  to'g'ridan-to'g'ri grid elementiga aylanadi. Sarlavhalar (`data-section` bo'yicha)
  **1-qatorga yonma-yon** joylashtirildi; barcha tanalar esa **2-qatorga, to'liq
  kenglikda** qo'yildi (yopiqlarining `display:none` bo'lgani uchun faqat bitta ochilgan
  tana ko'rinadi). Karta chegara/fon stillari `.ws-section` dan `.ws-section-body` ga
  ko'chirildi (chunki `display:contents` wrapper ko'rinishini yo'qotadi).
- Sarlavhalar tab ko'rinishiga keltirildi (markazlangan, yumaloq, aktivida gradient +
  soya); ochilganda `aria-expanded="true"`.
- `.ws-section-body` hali ham `pastdan ochiladi` (`hidden` → ko'rsatiladi); ichki
  `.ws-acc` (Boshqaruv akkordeonlari) va sub-nav (`data-bq`) logikasi o'zgarmadi.
- Sukut bo'yicha **barcha bo'limlar yopiq**: `team.html` da Ish doskasi sarlavhasi
  `aria-expanded="false"` va uning tanasiga `hidden` qo'shildi (qolgan 3 tasi allaqachon
  yopiq edi). Natija: sahifa 4 ta yonma-yon tab bilan ochiladi; foydalanuvchi bossagina
  tegishli bo'lim pastdan katta ochiladi. `localStorage` (`mlly_sec_<teamId>`) avval
  ochilgan bo'limni eslab qoladi, shuning uchun vazifa qo'shish/render'da holat saqlanadi.
- Kichik ekranlarda (`max-width: 720px`) grid 1 ustunga o'tib, vertikal akkordeon
  (sarlavha → tanasi ketma-ket) ko'rinishiga qaytadi.
- **JS o'zgartirilmadi:** toggling `data-section` orqali ishlaydi, DOM tuzilmasi
  (`.ws-section` ichida head + body) saqlangan; `display:contents` faqat vizual.

### Tekshiruv (Task 27)
- `team.html`: `<div>` balansi **OK**; inline `<script>` parse **OK**.
- `css/styles.css`: qavs balansi **OK** (645/645).
- Ish doskasi endi `aria-expanded="false"` + tana `hidden` (sukutda yopiq).
- Barcha o'zgarishlar **additive** (mavjud kod buzilmadi).
