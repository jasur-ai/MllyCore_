# MllyCore — Funksiyalar nima qiladi va NEGA kerak (Egasi uchun batafsil qo'llanma)

> Bu hujjat **sen (loyiha egasi) o'zing uchun** yozilgan. Maqsad: har bir funksiyani chuqurroq, odamcha tushuntirish — qanday ishlashi, qanday misolda ishlatilishi va **nima uchun** loyihaga qo'shilgani.
> Bu yerda tavsiya yoki qisqa "faktlar" YO'Q — balki to'liq, misollar bilan tushuntirish. Loyiha kodiga hech qanday o'zgartirish kiritilmagan, faqat hujjat.

---

## 0. Boshidan: MllyCore nima va kim uchun?

MllyCore — bu startaplar, jamoalar va ishlab chiquvchilar uchun **yopiq (private) workspace platformasi**. Oddiy tilda: bir joyda g'oyalar, vazifalar, chat va hisobotlar bo'ladi; kim nima qilayotgani ko'rinadi, lekin tashqaridagi kishilar kira olmaydi.

Har bir funksiya quyidagi muammolarni hal qilish uchun qo'shilgan:
- Jamoa ichida tartib bo'lsin (kim, nima, qachongacha).
- G'oyalar yo'qolmasin, ustuvorlansin.
- Tashqi hamkor/investor ko'ra olsa ham maxfiylik saqlansin.
- Real-time xabar (Telegram) orqali hech narsi o'tib ketmasin.
- Moliyaviy holat (qancha pul qoldi) ko'rinib tursin.

Endi har birini alohida, chuqur ko'ramiz.

---

## 1. Asosiy tushunchalar (barcha funksiyalar shu ustiga qurilgan)

**Workspace** — yopiq jamoa muhiti. Ichida g'oyalar, vazifalar (Kanban taxta), real-time chat, hisobotlar bo'ladi. Bir kompaniya/oila/jamoa = bitta workspace.

**Rollar (kim nima qila oladi):**
- `admin` — hamma huquq (kimdirni chiqarib yuborish, workspace o'chirish, bot/integration sozlash).
- `manager` — boshqaruvchi huquqlari.
- `team_lead` — jamoa boshlig'i (taklif qiladi, vazifa beradi, secret key ni boshqaradi).
- `member` — oddiy ishchi a'zo.
- `viewer` — faqat o'qiydi, hech narsa yozolmaydi (masalan, mijozni kuzatuvchi sifatida qo'shish uchun, T2).

**Secret key** — workspace'ga kirish uchun kerak bo'ladigan maxfiy kod. Biror kishi taklif qilinsa, u bu kodni bilishi kerak (boshqa hech kim kira olmasin deb).

**Email tasdiqlash** — tizimga kirishdan oldin emailingiz tasdiqlangan bo'lishi shart. Tasdiqlanmagan email bilan kirish bloklanadi (spam/ghost account'lardan himoya).

---

## 2. T1–T17 (asosiy funksiyalar)

Bular platformaning poydevori. Qisqaroq, lekin nega kerakligi bilan.

- **T1 Archive** — Workspace'ni butunlay o'chirmasdan "arxivlangan" qilish. *Nima uchun:* Xato bilan o'chirib yuborishning oldini olish; eski workspace saqlanib qoladi lekin faol emas.
- **T2 Viewer roli** — Faqat o'qidigan a'zo. *Nima uchun:* Mijoz yoki hamkorini ichki ishlarga aralashtirmasdan kuzatuvchi qilib qo'shish.
- **T3 Admin 2FA** — Admin uchun ikki bosqichli tasdiqlash (telefonga kod keladi). *Nima uchun:* Admin hisobi eng kuchli — uni egallab olish xavfini kamaytirish.
- **T4 Time Logging** — Har bir vazifaga sarflangan vaqtni yozish. *Nima uchun:* Kim qancha ishlaganini, haqiqatda vazifa qancha vaqtda bajarilganini bilish.
- **T6 Feature Flags** — Ba'zi funksiyalarni yoqib/o'chirib qo'yish (admin uchun). *Nima uchun:* Yangi narsa qo'shganda hammaga birdan ochib yubormaslik, xavfsiz sinab ko'rish.
- **T7 Export My Data** — O'z ma'lumotini yuklab olish. *Nima uchun:* Foydalanuvchi huquqi (o'z ma'lumotim ustida nazorat).
- **T8 Task Dependencies** — Bir vazifa boshqasiga bog'lanadi (`dependsOn`). *Nima uchun:* "Avval shu bo'lishi kerak, keyin bu" tartibini saqlash; bog'liq vazifa tugamasa ikkinchisini bajarib bo'lmaydi.
- **T9 Presence** — Kim onlayn ekanligi (yashil nuqta). *Nima uchun:* Jamoa a'zolari bir-birini ko'rib, tezroq muloqot qiladi.
- **T10 AI klasterlash** — O'xshash g'oyalarni avtomatik topish. *Nima uchun:* Bir xil g'oya 5 marta yozilmasin; dublikat kamayadi.
- **T11 Permission Override** — Admin a'zoning huquqini o'zgartiradi. *Nima uchun:* Nozik vaziyatda tez tartaqlash.
- **T12 Rollback** — Oxirgi o'zgarishni (masalan, o'chirilgan narsa) qaytarish. *Nima uchun:* Xatolikni 24 soat ichida tuzatish imkoniyati.
- **T13 Templates** — Tayyor workspace shabloni (vazifalar bilan birga). *Nima uchun:* Har safar boshidan boshlamaslik, tez boshlash.
- **T14 Quiet Hours** — "Tinchlik soatlari" — bu vaqtda xabar yuborilmaydi. *Nima uchun:* Kechasi bezovta bo'lmaslik; xabar ish vaqtida yetkaziladi.
- **T15 Cross-WS Overview** — Barcha workspace'larni bitta ekrandan ko'rish. *Nima uchun:* Bir nechta loyihang bo'lsa, umumiy rasmni ko'rish.
- **T16 E2E Encrypted Files** — Fayllar brauzerda shifrlanib (AES-GCM) saqlanadi. *Nima uchun:* Maxfiy hujjatlar serverda ham ochiq yotmasin.
- **T17 Weekly Digest** — Haftalik xulosa (har dushanba). *Nima uchun:* Jamoa bir haftada nima qilganini bir ko'rish; kim nima qilgani esda qolsin.

---

## 3. T18–T37 (kengaytirilgan funksiyalar) — BATASIL

Sen ayniqsa **roadmap, github, telegram, cronSecret** ni so'rading — ularni eng chuqur yozdim. Qolganlari ham misollar bilan.

### T18 — Idea Scoring (ICE/RICE)
**Muammo:** G'oyalar ko'p, lekin qaysi birinchi qilishni bilish qiyin. Hamma "mening g'oyam muhim" deb o'ylaydi.
**Qanday ishlaydi:** `idea.html` da 3 ta slayder chiqadi — Impact (qanchalik foydali), Confidence (isa qadar ishonchimiz bor), Ease (qanchalik oson qilish mumkin). Son kiritib saqlasa, g'oya shu bahoga ega bo'ladi.
**Misol:** "AI chatbot" g'oyasi — Impact 9, Confidence 7, Ease 4. Boshqa "logotip o'zgartirish" — Impact 3, Confidence 9, Ease 9. Birinchi o'rtacha yuqoriroq bo'ladi → uni oldin qilish kerak.
**Nima uchun qo'shilgan:** Subyektiv "meniki yaxshiroq" bahosini o'rniga raqamli ustuvorlik. T10 (dublikat + past ball) bilan birga "e'tibor" belgisi qo'yiladi.

### T19 — Pitch One-Pager Generator
**Muammo:** Investorga g'oya tushuntirish uchun alohida hujjat yozish vaqti talab qiladi.
**Qanday ishlaydi:** Bitta tugma → tizim g'oya + unga bog'liq vazifalar + jamoa haqida chiroyli bitta HTML sahifa yaratadi. Siz uni yuklab, PDF qilib yuborasiz.
**Nima uchun qo'shilgan:** Investor yoki hamkorga tez va profesional ko'rinishda pitch berish; vaqtni tejash.

### T20 — Public Showcase (opt-in investor link)
**Muammo:** Investorga g'oyani ko'rsatmoqchi bo'lsang, uni butun workspace'ga kirita olmaysan (maxfiy).
**Qanday ishlaydi:** Admin g'oyani "public" qilsa, tizim maxsus `publicToken` hosil qiladi. O'sha tokenli linkni investorga yuborasiz — u **login qilmasdan**, faqat o'sha bitta g'oyani read-only ko'radi. Qolgan ichki narsa ko'rinmaydi.
**Nima uchun qo'shilgan:** Tashqi odamga ichki tizimga kirmasdan bitta narsa ko'rsatish — maxfiylik saqlanib, ehtiyoj qondiriladi.

### T21 — Roadmap / Timeline  ⭐ (sen so'ragan)
**Muammo:** Vazifalar bor, lekin ular qachongacha, qaysi tartibda, kim boshqasiga bog'liq — bir ko'rinishda ko'rinmaydi. Excel yoki boshqa tool'da alohida yozish kerak bo'ladi.
**Qanday ishlaydi:**
1. `getRoadmap` funksiyasi barcha `tasks` (vazifalar) va `ideas` (g'oyalar) ni yig'adi.
2. Ularni vaqt bo'yicha tartiblab, bir xil vaqt chizig'i (Gantt uslubida) ko'rsatadi.
3. `team.html` ichida alohida "Roadmap" tab'i bor.
4. Agar vazifa boshqasiga bog'langan bo'lsa (`dependsOn`, T8), u 🔒 belgisi bilan ko'rsatiladi — "bu vazifa shug'a tugamasa bajarilmaydi" degani.
**Misol:** "Landing sahifa" vazifasi "Copy tayyor" vazifasiga bog'langan. Roadmap'da ular ketma-ket chiziladi, 🔒 ko'rsatadi. Siz birinchi bo'lmaganini boshlasangiz, tizim ogohlantiradi.
**Nima uchun qo'shilgan:** Jamoa rejani bir joyda, vizual ko'rib olsin. Kim nima uchun kechikayotganini, qaysi bog'liqlik buzmaganligini ko'rish — rejani boshqarish uchun asosiy vosita.

### T22 — Telegram Bot Bridge  ⭐ (sen so'ragan)
**Muammo:** O'zbekistonda odamlar email tez-tez tekshirmaydi; Telegram esa doim yonida. Muhim xabar (T14, T17) emailga tushsa, kechikib o'qiladi.
**Qanday ishlaydi (bosqichma-bosqich):**
1. Siz (yoki admin) Telegram'da `@BotFather` orqali bot yaratadi, token oladi.
2. O'sha tokenni Vercel muhit o'zgaruvchisiga (`TELEGRAM_BOT_TOKEN`) qo'yasiz.
3. `profile.html` da foydalanuvchi o'z **chat ID** sini kiritib "Ulash" bosadi → tizim `users.telegramChatId` ni eslab qoladi.
4. Keyin T14 (kimdir sizga vazifa berganda) yoki T17 (haftalik digest) chiqqanda, tizim `pushTelegram` orqali shu chat'ga xabar yuboradi (`https://api.telegram.org/bot<TOKEN>/sendMessage`).
- ⚠️ Muhim: bu faqat **chiqish** (bot sizga yozadi). Siz botga yozsangiz, u javob bermaydi (hozircha kiruvchi buyruqlar qayta ishlanmagan).
**Misol:** Jamoangizda "urgent" vazifa sizga berildi → darhol Telegram'ga "Sizga yangi vazifa: X" deb xabar keladi. Email tekshirmasangiz ham ko'rasiz.
**Nima uchun qo'shilgan:** O'zbekiston sharoitida Telegram — asosiy aloqa vositasi. Email o'rniga real-time ogohlantirish; Slack o'rniga eng tabiiy tanlov.

### T23 — Financial Runway Tracker
**Muammo:** Startapda qancha pul qolganini, u qancha vaqtga yetishini hech kim aniq bilmaydi.
**Qanday ishlaydi:** `finances/{teamId}` kolleksiyasida byudjet (qancha pul) va oylik sarf (burnRate) saqlanadi. "Runway" hisobi qancha oy pullar yetishini chiqaradi. `team.html` da ko'rsatiladi.
**Misol:** Byudjet $30,000, oylik sarf $5,000 → runway = 6 oy. 6 oydan oldin investitsiya izlash kerakligi ko'rinadi.
**Nima uchun qo'shilgan:** Pul tugashidan oldin vaqt bo'lishi uchun moliyaviy nazorat.

### T24 — Decision Log
**Muammo:** "Nega biz shunday qaror qildik?" — 3 oy o'tgach hech kim eslamaydi.
**Qanday ishlaydi:** `decisions/{decisionId}` — biznes qarorlari alohida yozuvi. Texnik o'zgarishlar (kim nima o'chirdi) uchun `auditLogs` bor, lekin bu — aynan **biznes** qarorlari uchun alohida.
**Nima uchun qo'shilgan:** Qarorlar tarixi saqlansin; keyinroq "negadandir shunday qildik?" demaslik uchun javob bo'lsin.

### T25 — Skill Tagging & Gap Matching
**Muammo:** Vazifaga odam tanlaganda, u bu ishni qila oladimi — ko'rinmaydi.
**Qanday ishlaydi:** Har bir user o'z ko'nikmalarini (`users.skills[]`) yozadi. Vazifaga kerakli ko'nikma (`tasks.requiredSkill`) qo'yiladi. Agar tayinlangan odamda u ko'nikma bo'lmasa, vazifa karta "Ko'nikma ⚠ gap" deb ogohlantiradi.
**Misol:** "Backend" vazifasiga Rust kerak, lekin tayinlangan odamda faqat Python bor → tizim ⚠ ko'rsatadi, siz boshqasini tanlaysiz.
**Nima uchun qo'shilgan:** Odamni o'z ko'nikmasiga mos vazifaga qo'yish; jamoada qanday ko'nikma yetishmayotganini ko'rish.

### T26 — Idea Health Monitor
**Muammo:** G'oya yozildi-yozilmadi, keyin unutildi, hech kim tegmadi.
**Qanday ishlaydi:** Har g'oya oxirgi faollik vaqtini (`lastActivityAt`) saqlaydi. Agar X kun (masalan 30) yangilanmasa, "stale" (eskirgan) deb belgilanadi.
**Nima uchun qo'shilgan:** E'tibordan chetda qolgan g'oyalarni ko'rsatib, ularni tiriltirish yoki yopish uchun.

### T27 — Threaded @Mentions
**Muammo:** G'oya muhokamasida aniq odamni jalb qilish qiyin.
**Qanday ishlaydi:** `ideaComments` da izoh yozganda `@username` deb yozilsa, o'sha odamga xabarnoma (`notifications.mentionedUid`) boradi.
**Misol:** "Bu dizaynga @jasur qarasa yaxshiroq bo'ladi" → Jasurga bildirishnoma keladi.
**Nima uchun qo'shilgan:** Muhokamada aniq odamni jalb qilish, javob tezroq bo'lishi.

### T28 — Reputation / Badges
**Muammo:** Faol a'zolar rag'batlantirilmaydi.
**Qanday ishlaydi:** `users.reputation`, `teamMembers.contributions` — qancha vazifa/g'oya/qo'shilgan hissa hisoblanadi, `team.html` da reyting ko'rinadi.
**Nima uchun qo'shilgan:** Gamifikatsiya orqali faollikka rag'bat.

### T29 — Custom Idea Stages
**Muammo:** G'oya holati ("fikr", "jarayonda", "tugadi") aniq emas.
**Qanday ishlaydi:** `ideas.stage` — bosqichlar: Raw → Validated → Building → Launched. `idea.html` da tanlanadi.
**Nima uchun qo'shilgan:** G'oya hayotiy siklini bosqichma-bosqich kuzatish.

### T30 — Meeting Minutes
**Muammo:** Yig'ilish bo'ldi, lekin natijasi yo'qoladi, keyingi qadamlar amalga oshmaydi.
**Qanday ishlaydi:** `meetingNotes/{noteId}` — yig'ilish daftari. Qarorlar avtomatik T24 ga, action item'lar vazifaga aylanadi.
**Nima uchun qo'shilgan:** Yig'ilish foydali bo'lishi, natijasi yo'qolmasligi.

### T31 — GitHub Issues Sync  ⭐ (sen so'ragan)
**Muammo:** Dasturchilar vazifalarni GitHub'da kuzatadi; MllyCore'dagi vazifa bilan GitHub issue ikki xil joyda yoziladi, sinxron emas.
**Qanday ishlaydi (bosqichma-bosqich):**
1. GitHub'da `GITHUB_TOKEN` (Personal Access Token, `repo` huquqi bilan) yaratib, Vercel env'ga qo'yasiz (yoki har safar UI'da kiritasiz).
2. `team.html` dagi sync formga vazifa ID'si va repo nomi (`owner/repo`, masalan `jasur-ai/MllyCore`) kiritiladi.
3. `sync-github` funksiyasi GitHub API'ga murojaat qilib, o'sha repo'ga yangi **issue** yaratadi va vazifaga `githubIssueUrl` ni yozadi.
4. Faqat `team_lead` yoki `admin` bajara oladi.
**Misol:** "Login sahifasini tuzatish" vazifasini sync qildingiz → GitHub'da `jasur-ai/MllyCore/issues/123` hosil bo'ladi. Dasturchi issue'da ishlaydi, MllyCore'dagi vazifa bilan bog'liq bo'lib qoladi.
**Nima uchun qo'shilgan:** Vazifa ikki joyda duplikat yozilmasin; developer o'z odatiy GitHub oqimida qolsa ham, workspace bilan bog'liq bo'lsin.

### T32 — Onboarding Wizard
**Muammo:** Yangi workspace ochganda odam adashib qoladi, nima qilishni bilmaydi.
**Qanday ishlaydi:** `onboarding-status` — yangi workspace uchun bosqichma-bosqich sozlash (taklif qilish, maqsad belgilash).
**Nima uchun qo'shilgan:** Foydalanuvchi tez va to'g'ri boshlashi.

### T33 — Localization (i18n)
**Muammo:** Interfeys faqat bitta tilda — O'zbekistonda odamlar turli tillarda qulay.
**Qanday ishlaydi:** `users.locale` (uz / ru / en). `update-profile` orqali o'zgartiriladi.
**Nima uchun qo'shilgan:** O'zbekiston konteksti — foydalanuvchi o'z tilini tanlashi.

### T34 — Idea Voting / Upvotes
**Muammo:** G'oyalarni ustuvorlashtirishda faqat admin emas, jamoa ham ovoz berishi kerak.
**Qanday ishlaydi:** `ideas.votes[]` / `voteCount`. `vote-idea` action'i, `idea.html` da tugma.
**Misol:** 10 kishi "AI chatbot" g'oyasiga ovoz berdi → u yuqoriga chiqadi.
**Nima uchun qo'shilgan:** Demokratik ustuvorlik — jamoa nima kerakligini ovoz bilan ko'rsatadi.

### T35 — Risk Register
**Muammo:** Xavflar kuzatilmaydi, kutilmagan muammolar chiqib qoladi.
**Qanday ishlaydi:** `risks/{riskId}` — har bir xavf uchun ehtimollik (likelihood) va ta'sir (impact). `idea.html` da kiritiladi.
**Nima uchun qo'shilgan:** Startap xavflarini oldindan ko'rib, ularni boshqarish.

### T36 — Activity Timeline
**Muammo:** "Nima bo'lyapti?" savoliga javob berish uchun bir necha joyga qarash kerak.
**Qanday ishlaydi:** `activity-feed` — barcha workspace hodisalari (vazifa yaratildi, g'oya baholandi, a'zo qo'shildi...) bitta lentada.
**Nima uchun qo'shilgan:** Bir ko'rinishda umumiy holat.

### T37 — Workspace Clone
**Muammo:** Bir xil tuzilmani (vazifalar, rollar) yangi jamoa uchun qayta-qayta qurish kerak.
**Qanday ishlaydi:** `clone-workspace` (faqat admin) — mavjud workspace ni shablon sifatida nusxalaydi (T13 ni kengaytiradi). `admin.html` da tugma.
**Nima uchun qo'shilgan:** Yangi loyiha/yamoa uchun vaqtni tejash.

---

## 4. Yaqinda qo'shilgan / tuzatilgan (muhim)

### 4.1 — Forgot-password ("Parolni unutdim")
**Muammo:** Oddiy a'zo (member/manager/lead) parolini unutsa, tizimga kira olmas edi; faqat admin Firebase Console orqali tiklashi kerak edi.
**Qanday ishlaydi:**
1. `login.html` da "Parolni unutdingizmi?" linki bor → bosganda email kiritish oynasi ochiladi.
2. Klient `/api/forgot-password` ga so'rov yuboradi (login qilmagan holatda ham ishlaydi).
3. **Server** `users` dan shu email'ning `role` ini tekshiradi:
   - Agar `role === 'admin'` bo'lsa → "Firebase Console orqali tiklang" deb qaytaradi (admin xavfsizlik uchun Console'dan tiklaydi).
   - Aks holda (member/manager/lead) → klient Firebase orqali `sendPasswordResetEmail` chaqiradi, reset xati emailingizga tushadi.
**Nima uchun qo'shilgan:** Oddiy foydalanuvchi parolini unutsa, o'zi tiklashi uchun (admin yordamisiz). Adminlar esa xavfsizlik sababli Console orqali tiklaydi.

### 4.2 — Secret-key / taklif xatosi TUZATILDI
**Muammo edi (va bu sening duch kelgan xato edi):** Avval ikkita alohida key tizimi ziddiyatda edi:
- Tizim har taklifga **yashirin** per-invite key generatsiya qilar (va uni hech kimga ko'rsatmas edi).
- Lekin UI senga **workspace `teams.secretKey`** ni ko'rsatar (reset qilganda o'zgaradigan).
- Natijada sen qanday key kiritsang ham, tizim yashirin per-invite kodni tekshirar → "Secret key noto'g'ri" chiqardi. Takliflar amalda ishlamay qolgan edi.
**Qanday tuzatildi:**
- Endi taklif faqat **workspace `teams.secretKey`** bilan tekshiriladi (ikkita tizim birlashtirildi).
- `create-workspace` ham key'ni boshlang'ich o'rnatadi (yangi workspace'da bo'sh bo'lmasin).
**Natija:** "Secret key reset" qilgandan keyin eski taklif **yangi** key bilan ishlaydi; eski key esa "noto'g'ri" deb rad etiladi (bu to'g'ri — reset eski kodni o'chirdi, shuning uchun eski kod ishlamaydi, yangisini ishlating).

---

## 5. Deploy uchun kerakli muhit o'zgaruvchilari (env)

Bular **Vercel** (Settings → Environment Variables) da o'rnatiladi. Firebase Console'da emas. Agar ular bo'lmasa, tegishli funksiya ishlamaydi.

### `FIREBASE_SERVICE_ACCOUNT_JSON` — MAJBURIY
- **Nima qiladi:** Backend (API) Firebase Admin SDK orqali Firestore'ga kiradi.
- **Nima uchun kerak:** Barcha API funksiyalari (taklif, vazifa, digest...) backend'da ishlaydi; u Firestore'ga kira olmasa, hech narsa ishlamaydi (R5 qoidasi).
- **Qayerdan:** Firebase Console → Project Settings → Service Accounts → "Generate new private key".
- **Diqqat:** JSON to'g'ri ko'chirilishi kerak (qator uzilmasin); noto'g'ri bo'lsa `1E08010C` xatosi chiqadi.

### `TELEGRAM_BOT_TOKEN` — T22 uchun
- **Nima qiladi:** Telegram botga yozish huquqi.
- **Nima uchun kerak:** Telegram orqali xabar yuborish uchun.
- **Qayerdan:** @BotFather → /newbot.

### `GITHUB_TOKEN` — T31 uchun
- **Nima qiladi:** GitHub issue yaratish huquqi.
- **Nima uchun kerak:** GitHub sync uchun.
- **Qayerdan:** GitHub → Settings → Developer settings → Personal Access Tokens (classic, `repo` scope).

### `CRON_SECRET` — T17 (weekly digest) uchun  ⭐ (sen so'ragan)
- **Nima qiladi:** Weekly-digest cron'ni himoyalash.
- **Qanday ishlaydi:** `vercel.json` da har dushanba 09:00 da `/api/weekly-digest` chaqiriladi. Lekin bu endpoint "kimdir chaqirdi" deb ishlamaydi — unda so'rovda `x-cron-secret: <CRON_SECRET>` header'i bo'lishi kerak (yoki admin Firebase tokeni). Aks holda "401 ruxsat yo'q" qaytaradi.
- **Nima uchun kerak:** Tashqi kishi `/api/weekly-digest` ni qo'lda chaqirib, barchaga spam xat yubormasligi uchun eshik kaliti. `CRON_SECRET` — shu kalit.
- **Qayerdan:** Ixtiyoriy random satr (o'zingiz o'ylab topib Vercel env'ga qo'yasiz).

---

## 6. Xulosa (odamcha)

MllyCore — bu jamoa ishini bir joyda tartibga soluvchi platforma. T1–T37 funksiyalari bir maqsadga xizmat qiladi: **g'oyalar yo'qolmasin, vazifalar rejali bajarilsin, tashqi odamlar bilan maxfiy hamkorlik bo'lsin, va jamoa real-time xabarda qolsın**.

Sen so'ragan asosiy narsalar:
- **Roadmap** — rejani bir ko'rinishda ko'rish (va bog'liqlikni 🔒 bilan ko'rish).
- **GitHub** — dasturchilar vazifani GitHub issue'ga aylantirib, ikki joyda duplikat yozmaslik.
- **Telegram** — O'zbekistonda asosiy messenger orqali real-time xabar.
- **cronSecret** — haftalik digest'ni himoyalash (begona kishi spam yubormasligi uchun kalit).

Hammasi kodlangan va tekshirilgan. Bu hujjat esa — sen o'zing uchun, kodga tegmay, faqat tushuntirish. Agar qaysidir funksiyani yanada chuqur (masalan, aniq misol bilan yoki diagramma bilan) ko'rmoqchi bo'lsang — ayt, kengaytiraman.

---

## QO'SHIMCHA (2026-07-09): UI yangilanishlari — odamcha tushuntirish

Bu bo'limni o'zingiz uchun yozdim. Kod o'zgarganda bu yerga qarang.

### 1. Bildirishnomalar (notifications) endi hamma rolda ko'rinadi
- Oldin faqat oddiy a'zo (member) uchun chap menyuda "Bildirishnomalar" bordi. Endi **admin, manager, lead va member** — hamma uchun ko'rinadi va o'qilmaganlar soni (qizil soncha) ko'rsatiladi.
- Ochish: chap menyudan "Bildirishnomalar" yoki dashboard'dagi "Bildirishnomalar" kartasi.

### 2. "Mening workspace'larim" (T15) endi bo'sh ko'rinmaydi
- Oldin faqat `Workspace: <uzun ID>` ko'rinardi (bu "bo'sh" deb o'ylangan). Endi **workspace NOMI** va sizning rolingiz (team_lead/member) chiqadi, va "Ochish" tugmasi bor.
- Agar hali ham bo'sh bo'lsa — demak siz haqiqatan ham hech qanday workspace'ga a'zo emassiz (admin bo'lsangiz ham a'zo bo'lmaydi, chunki admin alohida).

### 3. Tezlik va tartib (layout/flash) tuzatildi
- Sahifaga o'tganda chap oynalar "sochilib 1-2 sekunddan keyin yig'ilish" o'rniga, darhol **sidebar** chiqadi va kontent o'rniga **skeleton** (kulrang miltillovchi qutilar) ko'rsatiladi, keyin to'liq yuklanadi. Bu "xunuk flash" ni oldi.
- Har safar yangilanganda **presence (online/offline nuqtacha)** obunalari tozalanadi — aks holda brauzer xotirasi to'lib, tezlik sekinlashardi. Endi sekinlashmaydi.
- Sidebar (chap meny) ma'lumotlar keshdan darhol chiqadi, keyin bir marta yangilanadi.

### 4. "Qo'shimcha funksiyalar" endi collapsible (ochiladigan)
- Roadmap, Qarorlar, Meeting, Activity, Reputation, Moliyaviy — har biri alohida **kichik bo'lim**. Ustidan bosganda ochiladi, ichida ma'lumot va amallar chiqadi.
- Ma'lumot faqat **bir marta** yuklanadi (ochilganda), shuning uchun tez.
- Moliyaviy (T23): endi `prompt()` oynasi emas, **ichki forma** — byudjet + burn-rate + valyuta kiritiladi, "Saqlash" bosilsa "qancha oy yetishin (runway)" darhol ko'rsatiladi.

### 5. 2FA (ikki bosqichli tasdiqlash) — endi har rol uchun
- Oldin faqat admin yoqa olardi. Endi **lead, member, manager** ham o'z shaxsiy hisobiga 2FA yoqishi mumkin (Profil → "Ikki bosqichli tasdiqlash").
- Yoqish: "2FA ni yoqish" → Google Authenticator/Authy ga secret ni kiriting yoki QR ochib skan qiling → 6 xonali kodni kiritib tasdiqlang.
- Admin workspace o'chirishda ham kod talab qilinadi (xavfsizlik saqlanadi).

### 6. Telegram (T22), Ko'nikmalar (T25), Til (T33) — tushuntirish qo'shildi
- **Telegram Chat ID qayerdan:** Telegram'da `@userinfobot` ga yozing va `/start` bosing — u sizga raqamli ID bersin. Uni "Telegram Chat ID" ga yozib "Ulash" bosing. Keyin bildirishnomalar (taklif, mention) Telegram'ga kelaveradi.
- **Ko'nikmalar** — bu SIZNING shaxsiy ko'nikmangiz (React, Figma...), Telegram bilan aloqasi yo'q.
- **Til** — bu SAYT INTERFEYSI tili (UI). Telegram boti shunchaki xabar yuboradi, uning tilini bu yerda tanlamaysiz.

### 7. GitHub (T31) — env qayerga ketishini tushuntirish
- Vazifani GitHub Issue ga aylantirish uchun: workspace ichidagi vazifa kartasidagi **🐙 GitHub'ga** tugmasi.
- Repo ni `user/repo` ko'rinishida kiriting.
- Agar serverda (Vercel) **GITHUB_TOKEN** environment o'zgaruvchi sozlangan bo'lsa — u avtomatik ishlatiladi, har safar token kiritishingiz shart emas. Aks holda tugma sizdan token so'raydi.
- Natija: GitHub'da yangi Issue ochiladi, va workspace'da "✓ GitHub'da" havolasi paydo bo'ladi.

### ⚠️ DEPLOY qilishdan oldin (MUHIM)
Roadmap va Activity xatolar ("index required") QO'SHILGAN composite index'lar Firebase'ga joylanganidan keyingina yo'qoladi. Shuning uchun:
```
firebase deploy --only firestore:rules,firestore:indexes
```
keyin Vercel'da qayta deploy. Aks holda Roadmap/Activity hali "index kerak" deb chiqadi.
