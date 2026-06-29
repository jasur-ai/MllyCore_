# Startap G'oyalari Platformasi: Mukammal Master-Reja

## 1. Kirish va Loyiha Maqsadlari

Ushbu hujjat startap g'oyalarini birlashtiruvchi, boshqaruvchi va rivojlantiruvchi veb-platformaning to'liq texnik va strategik rejasini taqdim etadi. Platformaning asosiy maqsadi - foydalanuvchilarga jamoalar tuzish, g'oyalarni samarali muhokama qilish, ularni rivojlantirish va amalga oshirish uchun innovatsion va xavfsiz muhit yaratish.

**Asosiy Maqsadlar:**

*   **Hamkorlikni kuchaytirish:** Jamoa a'zolari o'rtasida g'oyalar almashinuvi va muhokamasini osonlashtirish.
*   **G'oyalarni boshqarish:** G'oyalarni turli bosqichlarda (xom, faol, rejalashtirilgan) samarali boshqarish.
*   **Xavfsizlik va nazorat:** Foydalanuvchi ma'lumotlari va jamoa faoliyatining xavfsizligini ta'minlash, admin va team lead uchun kuchli nazorat mexanizmlarini joriy etish.
*   **Intuitiv interfeys:** Foydalanuvchilar uchun qulay va tushunarli interfeys yaratish.
*   **Innovatsion funksiyalar:** Sun'iy intellektga asoslangan g'oya tahlili, resurslar taqsimoti va loyiha boshqaruvi vositalarini integratsiya qilish.

## 2. Fundamental Arxitektura

Platforma uch qatlamli arxitekturaga asoslanadi:

1.  **Taqdimot Qatlami (Presentation Layer - Frontend):** Foydalanuvchi interfeysi (UI) va foydalanuvchi tajribasi (UX) uchun javobgar. HTML, CSS (Tailwind CSS bilan), JavaScript (Vanilla JS, modulli yondashuv) texnologiyalaridan foydalaniladi.
2.  **Mantiq Qatlami (Business Logic Layer - Backend):** Platformaning asosiy funksional imkoniyatlarini (autentifikatsiya, jamoa boshqaruvi, g'oyalar mantiqi, chat xizmatlari) ta'minlaydi. RESTful API orqali frontend bilan aloqa qiladi. (Texnologiyalar tanlovi: Node.js (Express.js/NestJS), Python (Django/FastAPI) yoki Go (Gin/Echo) - loyiha talablariga qarab tanlanadi).
3.  **Ma'lumotlar Qatlami (Data Layer - Database):** Barcha ma'lumotlarni (foydalanuvchilar, jamoalar, g'oyalar, xabarlar, rollar, ruxsatlar) saqlash va boshqarish. (Tavsiya etilgan: PostgreSQL/MySQL, NoSQL uchun MongoDB/Cassandra - ma'lumotlar turiga qarab).

## 3. Foydalanuvchi Rollari va Huquqlari

Platformada uchta asosiy foydalanuvchi roli mavjud bo'ladi, har birining o'ziga xos huquqlari va funksional imkoniyatlari bor:

### 3.1. Admin (Administrator)

**Maqsad:** Platformaning umumiy faoliyatini nazorat qilish, foydalanuvchilar va jamoalarni boshqarish, tizim xavfsizligini ta'minlash.

**Asosiy Funksiyalar:**

*   **Foydalanuvchilarni boshqarish:** Barcha foydalanuvchilar ro'yxatini ko'rish, profillarini tahrirlash, bloklash/blokdan chiqarish, admin huquqini berish/olib tashlash, email tasdiqlash holatini qo'lda o'zgartirish.
*   **Jamoalarni boshqarish:** Barcha jamoalar ro'yxatini ko'rish, yangi jamoalar yaratish, mavjud jamoalarni tahrirlash, o'chirish/arxivlash, invitation code'ini ko'rish va reset qilish.
*   **G'oyalarni nazorat qilish:** Barcha jamoalardagi g'oyalarni ko'rish, tahrirlash yoki o'chirish, kategoriyasini yoki statusini o'zgartirish.
*   **Tizim sozlamalari:** Platformaning umumiy sozlamalarini boshqarish (masalan, ro'yxatdan o'tishni yoqish/o'chirish, yangi funksiyalarni yoqish/o'chirish).
*   **Xavfsizlik monitoringi:** Tizim loglarini ko'rish, shubhali faoliyatni aniqlash va choralar ko'rish, xavfsizlik ogohlantirishlarini boshqarish.
*   **Kontent moderatsiyasi:** Noto'g'ri yoki zararli kontentni aniqlash va o'chirish.

### 3.2. Team Lead (Jamoa Rahbari)

**Maqsad:** O'z jamoasini boshqarish, a'zolarni taklif qilish, g'oyalar jarayonini nazorat qilish va jamoa ichidagi hamkorlikni ta'minlash.

**Asosiy Funksiyalar:**

*   **Jamoa sozlamalari:** Jamoa nomini, logosini va tavsifini tahrirlash.
*   **A'zolarni boshqarish:** Jamoa a'zolari ro'yxatini ko'rish, yangi a'zolarni taklif qilish (email orqali yoki invitation code berish orqali), a'zolarning so'rovlarini tasdiqlash/rad etish, a'zolarni jamoa tarkibidan chiqarish, boshqa a'zolarga Team Lead rolini berish.
*   **Invitation Code boshqaruvi:** Jamoaning 16 raqamli invitation code'ini ko'rish, istalgan vaqtda reset qilish, kodning amal qilish muddatini belgilash (ixtiyoriy).
*   **G'oyalar boshqaruvi:** Jamoa g'oyalarini ko'rish, yaratish, tahrirlash va o'chirish, g'oyalar kategoriyasini (Raw, Active, Planned, Archived) o'zgartirish, g'oyalar statusini yangilash.
*   **Chat monitoringi:** Jamoa chatidagi barcha xabarlarni ko'rish va moderatsiya qilish (zarur bo'lsa).
*   **Resurslar boshqaruvi:** G'oyalarga fayllar, linklar, vazifalar ro'yxatini biriktirish va boshqarish.

### 3.3. Member (Jamoa A'zosi)

**Maqsad:** Jamoa faoliyatida ishtirok etish, g'oyalar taklif qilish, muhokamalarda qatnashish.

**Asosiy Funksiyalar:**

*   **Jamoa sahifasini ko'rish:** Jamoa logosi, nomi, tavsifi va a'zolari ro'yxatini ko'rish.
*   **G'oyalar bilan ishlash:** Jamoaning barcha g'oyalarini ko'rish, yangi g'oyalar taklif qilish, o'zining g'oyalarini tahrirlash/o'chirish (Team Lead ruxsati bilan), g'oyalarga izohlar qoldirish.
*   **Chatda ishtirok etish:** Jamoa chatida xabarlar yuborish va qabul qilish.
*   **Profilni boshqarish:** O'z profil ma'lumotlarini (username, ism, familiya, profil rasmi) tahrirlash, parolni o'zgartirish.
*   **Bildirishnomalarni ko'rish:** O'ziga tegishli bildirishnomalarni ko'rish va boshqarish.

## 4. Foydalanuvchi Interfeysi (UI) va Foydalanuvchi Tajribasi (UX) Loyihasi

Platformaning har bir sahifasi foydalanuvchi uchun intuitiv, qulay va estetik jihatdan yoqimli bo'lishi kerak. Tailwind CSS yordamida tezkor va moslashuvchan dizayn yaratiladi.

### 4.1. Kirish va Ro'yxatdan O'tish Sahifalari

**Maqsad:** Foydalanuvchilarni xavfsiz va osonlik bilan platformaga kirishini ta'minlash.

*   **Login Sahifasi:**
    *   **Elementlar:** Logo, platforma nomi, 
email kiritish maydoni, parol kiritish maydoni, "Parolni unutdingizmi?" havolasi, "Kirish" tugmasi, "Ro'yxatdan o'tish" havolasi.
    *   **Validatsiya:** Email formati va parol murakkabligi tekshiruvi.
    *   **Xatolarni ko'rsatish:** Noto'g'ri ma'lumot kiritilganda aniq xato xabarlari.
*   **Ro'yxatdan O'tish Sahifasi:**
    *   **Elementlar:** Logo, platforma nomi, email kiritish maydoni, username kiritish maydoni, parol kiritish maydoni, parolni takrorlash maydoni, "Ro'yxatdan o'tish" tugmasi, "Kirish" havolasi.
    *   **Validatsiya:** Email formati, username noyobligi, parol murakkabligi va parollarning mos kelishi tekshiruvi.
    *   **Email Tasdiqlash:** Ro'yxatdan o'tgandan so'ng, foydalanuvchiga email tasdiqlash havolasi yuboriladi. Tasdiqlanmagan foydalanuvchilarning funksionalligi cheklanadi.

### 4.2. Dashboard (Boshqaruv Paneli)

**Maqsad:** Foydalanuvchiga platformadagi umumiy holat, faol jamoalar, so'nggi bildirishnomalar va muhim yangilanishlar haqida tezkor ma'lumot berish.

*   **Chap Panel (Sidebar):**
    *   **Logo va Platforma Nomi:** Yuqori chap burchakda joylashadi.
    *   **Navigatsiya Menyu:**
        *   "Mening Jamoalarim" (Active Teams): Foydalanuvchi a'zo bo'lgan jamoalar ro'yxati. Har bir jamoa nomi va logosi bilan ko'rsatiladi. Bosilganda tegishli jamoa sahifasiga o'tadi.
        *   "G'oyalarim" (My Ideas): Foydalanuvchi yaratgan yoki ishtirok etgan g'oyalar ro'yxati.
        *   "Bildirishnomalar" (Notifications): Yangi bildirishnomalar soni ko'rsatiladi.
        *   "Profil Sozlamalari" (Profile Settings).
        *   "Admin Paneli" (faqat Adminlar uchun).
    *   **Foydalanuvchi Profil Qismi:** Foydalanuvchi rasmi, username va kichik menyu (logout, sozlamalar).
*   **Asosiy Kontent Maydoni:**
    *   **Xush kelibsiz xabari:** Foydalanuvchi nomi bilan shaxsiylashtirilgan.
    *   **Faol Jamoalar Bloki:** Foydalanuvchi a'zo bo'lgan jamoalarning qisqacha ko'rinishi (logo, nomi, faol g'oyalar soni, so'nggi faoliyat).
    *   **So'nggi G'oyalar Bloki:** Jamoalardagi so'nggi yangilangan yoki yaratilgan g'oyalar.
    *   **Bildirishnomalar Lenta:** Eng so'nggi bildirishnomalar ro'yxati.
    *   **"Yangi Jamoa Yaratish" / "Jamoaga Qo'shilish" tugmalari.**

### 4.3. Jamoa Sahifasi (Team Page)

**Maqsad:** Muayyan jamoaning barcha ma'lumotlarini, a'zolarini, g'oyalarini va chatini bir joyda boshqarish.

*   **Yuqori Qism (Header):**
    *   **Jamoa Logosi va Nomi:** Chap burchakda.
    *   **Jamoa Tavsifi:** Qisqacha ma'lumot.
    *   **"Sozlamalar" tugmasi:** Faqat Team Lead va Admin uchun (jamoa nomini, logosini, tavsifini tahrirlash, a'zolarni boshqarish, invitation code'ini reset qilish).
*   **Asosiy Kontent (Tablar orqali):**
    *   **"G'oyalar" (Ideas) Tab:**
        *   **G'oyalar Ro'yxati:** Jamoaning barcha g'oyalari (Raw, Active, Planned, Archived) kategoriyalar bo'yicha filtrlash imkoniyati bilan. Har bir g'oya uchun nomi, statusi, yaratuvchisi va so'nggi yangilanish sanasi ko'rsatiladi.
        *   **"Yangi G'oya Yaratish" tugmasi.**
        *   **G'oya Qidiruvi va Filtrlash:** G'oyalarni nomi, statusi, kategoriyasi bo'yicha qidirish va filtrlash.
    *   **"A'zolar" (Members) Tab:**
        *   **A'zolar Ro'yxati:** Jamoa a'zolari (rasmi, ismi, roli, qo'shilgan sanasi). Team Lead va Admin a'zolarning rolini o'zgartirishi, ularni chiqarib yuborishi mumkin.
        *   **"A'zo Taklif Qilish" tugmasi:** Email orqali taklif yuborish yoki invitation code'ini ko'rsatish.
    *   **"Chat" (Chat) Tab:**
        *   **Xabarlar Maydoni:** Jamoa a'zolari o'rtasidagi real vaqt rejimida chat. Eski xabarlarni ko'rish imkoniyati.
        *   **Xabar Yuborish Maydoni:** Matn kiritish maydoni va "Yuborish" tugmasi.
        *   **Fayl biriktirish imkoniyati (kelajakda).**

### 4.4. G'oya Sahifasi (Idea Page)

**Maqsad:** Muayyan g'oyaning to'liq tavsifi, statusi, izohlari va unga bog'liq resurslarni ko'rish va boshqarish.

*   **Yuqori Qism (Header):**
    *   **G'oya Nomi va Jamoa Nomi.**
    *   **G'oya Statusi va Kategoriyasi:** Rangli belgilar bilan ko'rsatiladi.
    *   **"Tahrirlash" / "O'chirish" tugmalari:** Faqat g'oya yaratuvchisi, Team Lead va Admin uchun.
*   **Asosiy Kontent:**
    *   **G'oya Tavsifi:** To'liq matnli tavsif.
    *   **Qo'shimcha Ma'lumotlar:** Muammo, yechim, bozor tahlili va boshqalar.
    *   **Resurslar Bloki:** G'oyaga biriktirilgan fayllar, linklar, vazifalar ro'yxati.
    *   **Izohlar Bo'limi:**
        *   **Izohlar Ro'yxati:** Har bir izoh (foydalanuvchi rasmi, ismi, izoh matni, sanasi).
        *   **"Izoh Qoldirish" maydoni:** Matn kiritish maydoni va "Yuborish" tugmasi.

### 4.5. Profil Sozlamalari Sahifasi (Profile Settings Page)

**Maqsad:** Foydalanuvchiga o'z profil ma'lumotlarini va xavfsizlik sozlamalarini boshqarish imkonini berish.

*   **Asosiy Ma'lumotlar:** Ism, familiya, username, email (o'zgartirish imkoniyati bilan).
*   **Profil Rasmi:** Yuklash va o'zgartirish imkoniyati.
*   **Parolni O'zgartirish:** Eski parol, yangi parol, yangi parolni takrorlash maydonlari.
*   **Bildirishnoma Sozlamalari:** Qaysi turdagi bildirishnomalarni olishni tanlash.
*   **2FA Sozlamalari (agar joriy etilsa).**

### 4.6. Admin Paneli (Admin Dashboard)

**Maqsad:** Adminlarga platformaning barcha jihatlarini to'liq nazorat qilish imkonini berish.

*   **Foydalanuvchilarni Boshqarish:** Barcha foydalanuvchilar ro'yxati, qidiruv, filtrlash, tahrirlash, bloklash, admin huquqini berish/olib tashlash.
*   **Jamoalarni Boshqarish:** Barcha jamoalar ro'yxati, qidiruv, filtrlash, tahrirlash, o'chirish, invitation code'ini ko'rish/reset qilish.
*   **G'oyalarni Boshqarish:** Barcha g'oyalar ro'yxati, qidiruv, filtrlash, tahrirlash, o'chirish, status/kategoriya o'zgartirish.
*   **Tizim Loglari:** Xavfsizlik loglari, xato loglari, faoliyat loglari.
*   **Umumiy Sozlamalar:** Ro'yxatdan o'tishni yoqish/o'chirish, yangi funksiyalarni boshqarish.

## 5. Xavfsizlik va Fraudga Qarshi Kurash (Batafsil)

Platformaning xavfsizligi ustuvor vazifa bo'lib, quyidagi mexanizmlar joriy etiladi:

### 5.1. Autentifikatsiya Xavfsizligi

*   **Email Tasdiqlash (Email Verification):** Ro'yxatdan o'tish jarayonida foydalanuvchining email manziliga tasdiqlash havolasi yuboriladi. Bu botlar va soxta akkauntlar yaratilishining oldini oladi. Tasdiqlanmagan akkauntlar cheklangan funksionallikka ega bo'ladi yoki umuman tizimga kira olmaydi. Tasdiqlash havolasi ma'lum bir vaqtdan keyin (masalan, 24 soat) amal qilish muddatini tugatadi va yangisini yuborish imkoniyati bo'ladi.
*   **Parol Xeshlash (Password Hashing):** Foydalanuvchi parollari ma'lumotlar bazasida ochiq matn shaklida saqlanmaydi. Buning o'rniga, kuchli xeshlash algoritmlari (masalan, bcrypt, Argon2) yordamida xeshlangan shaklda saqlanadi. Har bir parol uchun noyob "salt" ishlatiladi. Bu ma'lumotlar bazasi buzilgan taqdirda ham parollarning xavfsizligini ta'minlaydi.
*   **Muvaffaqiyatsiz Kirish Urinishlarini Cheklash (Rate Limiting):** Ma'lum bir vaqt oralig'ida kirish urinishlari sonini cheklash orqali brute-force hujumlarining oldi olinadi. Har bir IP-manzildan yoki foydalanuvchi nomidan ma'lum bir vaqt ichida ruxsat etilgan kirish urinishlari soni cheklanadi. Ko'p marta noto'g'ri urinish bo'lsa, IP-manzil yoki foydalanuvchi ma'lum muddatga bloklanadi.
*   **Ikki Faktorli Autentifikatsiya (2FA):** Qo'shimcha xavfsizlik qatlami sifatida 2FA (masalan, TOTP asosidagi autentifikator ilovasi yoki SMS orqali kod) joriy etilishi mumkin. Bu, hatto parol o'g'irlangan taqdirda ham, ruxsatsiz kirishni qiyinlashtiradi. Foydalanuvchilar profil sozlamalarida 2FA'ni yoqishi/o'chirishi mumkin.
*   **Sessiya Boshqaruvi (Session Management):** Har bir kirish uchun noyob sessiya tokenlari generatsiya qilinadi va xavfsiz (HTTP-only, Secure flag) cookie'larda saqlanadi. Sessiyalar ma'lum bir vaqtdan keyin avtomatik ravishda tugaydi yoki foydalanuvchi tizimdan chiqqanda bekor qilinadi. Foydalanuvchiga faol sessiyalarni ko'rish va ularni tugatish imkoniyati beriladi.
*   **Parolni Tiklash (Password Reset):** Foydalanuvchi parolini unutgan taqdirda, email orqali parolni tiklash havolasi yuboriladi. Bu havolalar bir martalik va ma'lum muddatga (masalan, 15 daqiqa) amal qiladi.

### 5.2. Jamoaga Qo'shilish Kodu (Invitation Code) Xavfsizligi

*   **16 Raqamli Tasodifiy Kod Generatsiyasi:** Har bir jamoa uchun noyob, 16 raqamli, kriptografik jihatdan xavfsiz tasodifiy kod generatsiya qilinadi. Bu kodlar harflar va raqamlardan iborat bo'lishi mumkin (masalan, `ABCD-EFGH-IJKL-MNOP` formatida). Kod generatsiyasi uchun kuchli psevdo-tasodifiy sonlar generatori (CSPRNG) ishlatiladi.
*   **Kodning Maxfiyligi:** Kod faqat Team Lead tomonidan ko'rilishi va boshqarilishi mumkin. Uni jamoaga qo'shilmoqchi bo'lgan shaxslarga Team Lead shaxsan taqdim etadi. Adminlar ham kodni ko'rish va boshqarish huquqiga ega.
*   **Reset Qilish Imkoniyati:** Team Lead istalgan vaqtda mavjud invitation code'ini bekor qilib, yangisini generatsiya qilishi mumkin. Bu, agar kod noto'g'ri qo'llarga tushib qolsa yoki shubhali faoliyat aniqlansa, xavfsizlikni ta'minlash uchun muhim mexanizmdir. Kod reset qilinganda, eski kod orqali jamoaga qo'shilish imkoniyati butunlay yo'qoladi. Eski kodlar ma'lumotlar bazasida "bekor qilingan" sifatida belgilanadi, lekin o'chirilmaydi (audit uchun).
*   **Kodning Amal Qilish Muddati (Optional):** Qo'shimcha xavfsizlik uchun kodlarga ma'lum bir amal qilish muddati (masalan, 24 soat, 7 kun) belgilanishi mumkin. Muddat tugagandan so'ng kod avtomatik ravishda bekor bo'ladi. Team Lead bu muddatni belgilashi yoki cheksiz qoldirishi mumkin.

### 5.3. Ma'lumotlar Xavfsizligi

*   **Ma'lumotlarni Shifrlash (Encryption):** Ma'lumotlar bazasida saqlanadigan sezgir ma'lumotlar (masalan, parollar, shaxsiy ma'lumotlar, email manzillar) shifrlangan holda saqlanadi. Ma'lumotlar uzatishda (frontend va backend o'rtasida) HTTPS protokoli orqali shifrlash majburiy bo'ladi. Backend va ma'lumotlar bazasi o'rtasidagi aloqa ham shifrlangan bo'lishi kerak.
*   **Ruxsatlar Boshqaruvi (Authorization):** Har bir foydalanuvchining harakatlari uning roli va huquqlariga qarab cheklanadi. Rolga asoslangan kirish nazorati (RBAC) mexanizmi qo'llaniladi. Masalan, oddiy a'zo jamoa sozlamalarini o'zgartira olmaydi, faqat Team Lead yoki Admin bu huquqqa ega bo'ladi. Har bir API endpointiga kirish ruxsatlari qat'iy nazorat qilinadi.
*   **Kiritilgan Ma'lumotlarni Validatsiya Qilish (Input Validation):** Barcha foydalanuvchi kiritgan ma'lumotlar (email, parol, g'oya tavsifi va h.k.) server tomonida qat'iy validatsiya qilinadi. Bu SQL Injection, XSS (Cross-Site Scripting), CSRF (Cross-Site Request Forgery) kabi hujumlarning oldini oladi. Frontendda ham asosiy validatsiya amalga oshiriladi, lekin server tomoni validatsiyasi asosiy himoya qatlami hisoblanadi.
*   **Audit Loglari:** Muhim harakatlar (masalan, foydalanuvchi yaratish, jamoa o'chirish, g'oya statusini o'zgartirish) audit loglarida qayd etiladi. Bu xavfsizlik buzilishlarini aniqlash va tahlil qilish uchun muhim.
*   **Doimiy Xavfsizlik Tekshiruvlari:** Penetration testing, zaiflik skanerlash va kod reviewlari muntazam ravishda o'tkaziladi.

## 6. G'oyalar Hayotiy Sikli (Idea Lifecycle) - Kengaytirilgan

Platformadagi har bir startap g'oyasi quyidagi bosqichlardan o'tadi, bu esa g'oyalarni tizimli ravishda boshqarish imkonini beradi:

### 6.1. G'oya Yaratish (Idea Creation)

*   **Kim yaratadi:** Jamoaning har qanday a'zosi g'oya yaratishi mumkin.
*   **Dastlabki holat:** Yangi yaratilgan g'oya avtomatik ravishda `Raw` kategoriyasiga va `Draft` statusiga ega bo'ladi.
*   **Kerakli ma'lumotlar:** G'oya nomi (title), qisqa tavsifi (description), va ixtiyoriy ravishda qo'shimcha ma'lumotlar (masalan, muammo, yechim, bozor tahlili, maqsadli auditoriya, raqobat tahlili, moliyaviy prognozlar). Foydalanuvchiga g'oyani boyitish uchun shablonlar taklif qilinishi mumkin.
*   **Fayl biriktirish:** G'oyaga tegishli hujjatlar, rasmlar, prototiplar va boshqa fayllarni biriktirish imkoniyati.

### 6.2. G'oyalarni Ko'rib Chiqish va Kategoriyalash (Review & Categorization)

*   **Kim ko'rib chiqadi:** Team Lead yoki Admin.
*   **Jarayon:** Team Lead `Raw` kategoriyasidagi g'oyalarni ko'rib chiqadi. Agar g'oya salohiyatli deb topilsa, uni `Active` yoki `Planned` kategoriyasiga o'tkazishi mumkin. Bu bosqichda g'oyaning statusi `Under Review` ga o'zgarishi mumkin. Team Lead g'oyani rad etishi va rad etish sababini ko'rsatishi ham mumkin.
*   **Muhokama:** G'oya sahifasida jamoa a'zolari g'oya bo'yicha izohlar qoldirishi, savollar berishi va takliflar kiritishi mumkin. Izohlarga javob berish va ularni "like" qilish imkoniyati.
*   **Baholash tizimi (Optional):** Jamoa a'zolari g'oyalarni ma'lum mezonlar (masalan, innovatsionlik, bozor salohiyati, amalga oshirish qulayligi) bo'yicha baholashi mumkin.

### 6.3. G'oyalarni Rivojlantirish (Idea Development)

*   **Kategoriya:** `Active` kategoriyasidagi g'oyalar ustida jamoa faol ish olib boradi.
*   **Statuslar:** Bu bosqichda g'oyaning statusi `Approved`, `Rejected` (agar g'oya maqbul deb topilmasa) yoki `Implemented` (agar g'oya amalga oshirilgan bo'lsa) kabi holatlarga o'zgarishi mumkin. Qo'shimcha statuslar (masalan, `In Progress`, `On Hold`, `Testing`) kiritilishi mumkin.
*   **Resurslar:** G'oya sahifasiga qo'shimcha resurslar (fayllar, linklar, vazifalar ro'yxati, loyiha jadvallari) biriktirish imkoniyati. Resurslarni versiyalash va ularga kirish huquqlarini boshqarish.
*   **Vazifalar Boshqaruvi (Task Management):** Har bir g'oya uchun kichik vazifalar yaratish, ularni a'zolarga tayinlash, muddatlarni belgilash va bajarilishini kuzatish imkoniyati (Kanban board yoki Gantt chart ko'rinishida).
*   **Progress Kuzatuvi:** G'oyaning rivojlanishini vizual tarzda ko'rsatuvchi progress barlari yoki grafiklar.

### 6.4. G'oyalarni Arxivlash (Idea Archiving)

*   **Kim arxivlaydi:** Team Lead yoki Admin.
*   **Jarayon:** Amalga oshirilgan, bekor qilingan yoki dolzarbligini yo'qotgan g'oyalar `Archived` kategoriyasiga o'tkaziladi. Arxivlangan g'oyalar faol ro'yxatda ko'rinmaydi, lekin istalgan vaqtda ularni ko'rish va tiklash mumkin. Arxivlash sababini ko'rsatish majburiy bo'ladi.

## 7. Chat Ekotizimi (Kengaytirilgan)

Platformadagi chat funksionalligi jamoa a'zolari o'rtasida tezkor va samarali aloqani ta'minlashga qaratilgan.

### 7.1. Jamoa Chati (Team Chat)

*   **Joylashuvi:** Har bir jamoaning o'z sahifasida, markaziy qismda joylashgan.
*   **Xabar Turlari:** Matnli xabarlar, emoji, fayl biriktirish (rasm, hujjat, video), ovozli xabarlar (kelajakda).
*   **Xabar Tarixi:** Foydalanuvchilar jamoa chatining oldingi xabarlarini ko'rishlari mumkin. Cheksiz skrollash (infinite scroll) orqali eski xabarlarni yuklash.
*   **Bildirishnomalar:** Yangi xabar kelganda foydalanuvchilarga bildirishnoma yuboriladi (agar ular chat sahifasida bo'lmasa). O'qilmagan xabarlar soni ko'rsatiladi.
*   **Xabarlarni tahrirlash/o'chirish:** Foydalanuvchilar o'z xabarlarini ma'lum bir vaqt ichida tahrirlashi yoki o'chirishi mumkin.
*   **Xabarlarga javob berish (Reply) va reaksiyalar (Reactions):** Muayyan xabarlarga javob berish va emoji reaksiyalar qoldirish.
*   **@mention funksiyasi:** Muayyan a'zolarni chatda belgilash va ularga bildirishnoma yuborish.

### 7.2. Shaxsiy Chatlar (Direct Messages - DM) - Kelajakda

*   Jamoa a'zolari o'rtasida shaxsiy xabarlar almashish imkoniyati. Bu platformaning hamkorlik imkoniyatlarini yanada kengaytiradi. Foydalanuvchilar bir-birlariga to'g'ridan-to'g'ri xabar yuborishi mumkin.

## 8. Bildirishnomalar Tizimi (Notification System) - Kengaytirilgan

Foydalanuvchilarni platformadagi muhim voqealar haqida xabardor qilish uchun markazlashgan bildirishnomalar tizimi joriy etiladi.

### 8.1. Bildirishnoma Turlari

*   **Jamoaga Taklif:** Yangi jamoaga qo'shilish taklifi kelganda.
*   **G'oya Yangilanishi:** Foydalanuvchi yaratgan g'oyaning statusi o'zgarganda, unga yangi izoh qoldirilganda, yoki unga yangi vazifa tayinlanganida.
*   **Chat Xabari:** Foydalanuvchi a'zo bo'lgan jamoa chatida yangi xabar kelganda (agar u chat sahifasida bo'lmasa).
*   **Admin Xabarlari:** Admin tomonidan yuborilgan umumiy e'lonlar yoki shaxsiy xabarlar.
*   **Yangi A'zo:** Jamoaga yangi a'zo qo'shilganda (Team Lead uchun).
*   **Invitation Code Reset:** Team Lead invitation code'ini reset qilganda (o'ziga bildirishnoma).

### 8.2. Bildirishnomalarni Boshqarish

*   **Bildirishnomalar Markazi:** Foydalanuvchining barcha bildirishnomalari bir joyda to'planadi. O'qilgan/o'qilmagan holatini ko'rsatish.
*   **Sozlamalar:** Foydalanuvchilar qaysi turdagi bildirishnomalarni olishni (email, platforma ichida, push-bildirishnoma - kelajakda) tanlashi mumkin.
*   **Real-time bildirishnomalar:** WebSocket orqali real vaqt rejimida bildirishnomalarni yetkazish.

## 9. Qo'shimcha Innovatsion Funksiyalar (Kelajakda Rivojlantirish Uchun)

Platformaning raqobatbardoshligini oshirish va foydalanuvchi tajribasini boyitish uchun quyidagi funksiyalar kelajakda integratsiya qilinishi mumkin:

*   **Sun'iy Intellektga Asoslangan G'oya Tahlili:**
    *   **G'oya Unikalligini Tekshirish:** Kiritilgan g'oyani mavjud g'oyalar bazasi va ochiq manbalar bilan solishtirib, uning o'ziga xosligini baholash.
    *   **Bozor Tahlili:** G'oya tavsifi asosida potentsial bozor hajmi, raqobatchilar va trendlarni tahlil qilish.
    *   **SWOT Tahlili:** G'oyaning kuchli va zaif tomonlari, imkoniyatlari va tahdidlarini avtomatik aniqlash.
    *   **Kalit So'zlar Generatsiyasi:** G'oya tavsifidan asosiy kalit so'zlarni ajratib olish va teglar yaratish.
*   **Resurslar Taqsimoti va Loyiha Boshqaruvi:**
    *   **Vazifalar Boshqaruvi:** Kengaytirilgan vazifalar boshqaruvi (sub-tasklar, bog'liqliklar, prioritetlar).
    *   **Gantt Chartlar:** Loyiha muddatlarini vizual tarzda ko'rsatish.
    *   **Resurslar Taqsimoti:** Jamoa a'zolarining yuklamasini kuzatish va resurslarni optimallashtirish bo'yicha takliflar.
*   **Integratsiyalar:**
    *   **Uchinchi Tomon Xizmatlari:** GitHub, Trello, Slack kabi mashhur loyiha boshqaruvi va aloqa vositalari bilan integratsiya.
    *   **Bulut Xizmatlari:** Google Drive, Dropbox kabi bulutli saqlash xizmatlari bilan fayl almashish.
*   **Gamifikatsiya Elementlari:**
    *   **Ballar va Nishonlar:** Faol ishtirok etgan foydalanuvchilarni rag'batlantirish.
    *   **Liderlar Jadvali:** Eng faol jamoalar yoki g'oya mualliflari reytingi.
*   **Video Konferensiya:** Jamoa a'zolari o'rtasida video uchrashuvlar o'tkazish imkoniyati.

## 10. Texnik Talablar va Texnologiyalar Tanlovi

### 10.1. Frontend

*   **Texnologiyalar:** HTML5, CSS3 (Tailwind CSS bilan), JavaScript (Vanilla JS, ES6+).
*   **Arxitektura:** Modulli, komponentga asoslangan yondashuv. Har bir UI elementi alohida komponent sifatida ishlab chiqiladi.
*   **Build Tools:** Vite (tezkor development va optimallashtirish uchun).
*   **State Management:** Vanilla JS bilan oddiy state management yoki kichik kutubxonalar (masalan, Zustand, Valtio) agar loyiha hajmi o'ssa.
*   **Routing:** Custom client-side routing yoki kichik router kutubxonasi.
*   **Responsiv Dizayn:** Barcha qurilmalar (desktop, planshet, mobil) uchun moslashuvchan dizayn.

### 10.2. Backend

*   **Texnologiyalar (Tanlovga ko'ra):**
    *   **Node.js:** Express.js (RESTful API uchun), Socket.IO (real-time chat va bildirishnomalar uchun), NestJS (agar katta, kengaytiriladigan loyiha bo'lsa).
    *   **Python:** FastAPI (yuqori unumdorlik va oson API yaratish uchun), Django (agar to'liq funksional framework kerak bo'lsa).
    *   **Go:** Gin (tezkor va yengil API uchun).
*   **Ma'lumotlar Bazasini Boshqarish (ORM/ODM):**
    *   **SQL:** Sequelize (Node.js), SQLAlchemy (Python), GORM (Go).
    *   **NoSQL:** Mongoose (MongoDB uchun Node.js).
*   **Autentifikatsiya:** JWT (JSON Web Tokens) asosida token-based autentifikatsiya.
*   **Xavfsizlik:** Helmet.js (Node.js), CORS, CSRF himoyasi, XSS filtrlash.
*   **Testlash:** Unit testlar, integratsiya testlari.

### 10.3. Ma'lumotlar Bazasini

*   **Relatsion DB:** PostgreSQL (kengaytiriladigan, ishonchli), MySQL (keng tarqalgan).
*   **NoSQL DB (ixtiyoriy):** MongoDB (agar hujjatga asoslangan ma'lumotlar uchun mos bo'lsa, masalan, chat xabarlari).
*   **Kesh:** Redis (sessiyalar, rate limiting, tezkor ma'lumotlar uchun).

### 10.4. Deployment va Infrastruktura

*   **Bulut Xizmatlari:** AWS, Google Cloud, DigitalOcean, Vercel (frontend uchun).
*   **Kontenerizatsiya:** Docker (ilovaning izolyatsiyasi va portativligi uchun).
*   **CI/CD:** GitHub Actions, GitLab CI/CD (avtomatik testlash va deployment uchun).

## 11. Fayllar Tuzilishi (Frontend uchun)

Loyihaning tartibli va boshqarilishi oson bo'lishi uchun quyidagi fayllar tuzilishi tavsiya etiladi:

```
startup-platform/
├── public/
│   ├── index.html
│   └── assets/
│       ├── images/
│       ├── fonts/
│       └── favicon.ico
├── src/
│   ├── main.js             # Asosiy JavaScript fayli, ilovani ishga tushiradi
│   ├── style.css           # Global CSS (Tailwind importlari va asosiy stillar)
│   ├── components/         # Qayta ishlatiladigan UI komponentlar
│   │   ├── Button/
│   │   │   ├── Button.js
│   │   │   └── Button.css
│   │   ├── Input/
│   │   │   ├── Input.js
│   │   │   └── Input.css
│   │   └── ...
│   ├── pages/              # Har bir sahifa uchun alohida fayllar
│   │   ├── Auth/
│   │   │   ├── LoginPage.js
│   │   │   ├── RegisterPage.js
│   │   │   └── VerifyEmailPage.js
│   │   ├── Dashboard/
│   │   │   ├── DashboardPage.js
│   │   │   └── Dashboard.css
│   │   ├── Team/
│   │   │   ├── TeamPage.js
│   │   │   ├── TeamSettings.js
│   │   │   ├── TeamMembers.js
│   │   │   └── TeamChat.js
│   │   ├── Idea/
│   │   │   ├── IdeaPage.js
│   │   │   ├── IdeaForm.js
│   │   │   └── IdeaComments.js
│   │   ├── Profile/
│   │   │   ├── ProfileSettingsPage.js
│   │   │   └── ChangePasswordForm.js
│   │   ├── Admin/
│   │   │   ├── AdminDashboardPage.js
│   │   │   └── UserManagement.js
│   │   └── NotFoundPage.js
│   ├── services/           # Backend API bilan aloqa qilish uchun funksiyalar
│   │   ├── authService.js
│   │   ├── teamService.js
│   │   ├── ideaService.js
│   │   └── notificationService.js
│   ├── utils/              # Yordamchi funksiyalar (validatsiya, formatlash)
│   │   ├── validation.js
│   │   └── helpers.js
│   ├── router/             # Client-side routing logikasi
│   │   └── index.js
│   └── store/              # Global state management (agar ishlatilsa)
│       └── index.js
├── .env                    # Atrof-muhit o'zgaruvchilari
├── package.json
├── package-lock.json
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

## 12. Xulosa

Ushbu master-reja startap g'oyalari platformasini yaratish uchun keng qamrovli yo'l xaritasini taqdim etadi. Loyiha davomida ushbu rejaga amal qilish, platformaning mustahkam, xavfsiz va kengaytiriladigan bo'lishini ta'minlaydi. Har bir bosqichda sifatga e'tibor qaratish va foydalanuvchi ehtiyojlarini inobatga olish muvaffaqiyat garovidir.

**Izoh:** Ushbu reja HTML, CSS (Tailwind CSS bilan) va JavaScript (Vanilla JS, modulli yondashuv) texnologiyalarida amalga oshirilishi kerak. Har bir sahifa va komponent alohida fayllarga bo'linadi va o'zaro bog'lanadi. Katta bitta HTML fayl o'rniga, tartibli va boshqarilishi oson bo'lgan fayllar tuzilmasi qo'llaniladi. 

## 13. Ma'lumotlar Modeli (Entity-Relationship Diagram - ERD asosida)

Quyida platformaning asosiy ma'lumotlar modellari va ular o'rtasidagi bog'liqliklar keltirilgan. Ushbu model ma'lumotlar bazasining tuzilishini aniqlaydi va tizimning mustahkamligini ta'minlaydi.

### 13.1. Entitetalar va Attributlar

**1. Foydalanuvchi (User)**

| Attribut Nomi       | Turi           | Izoh                                                              |
| :------------------ | :------------- | :---------------------------------------------------------------- |
| `user_id`           | UUID (PK)      | Foydalanuvchining noyob identifikatori                             |
| `email`             | String (Unique)| Majburiy, Email tasdiqlash uchun ishlatiladi                       |
| `password_hash`     | String         | Majburiy, Xeshlangan parol (bcrypt/Argon2)                          |
| `username`          | String (Unique)| Majburiy, Foydalanuvchi nomi                                      |
| `full_name`         | String         | Ixtiyoriy, Foydalanuvchining to'liq ismi                          |
| `profile_picture_url`| String         | Ixtiyoriy, Profil rasmi URL manzili                               |
| `is_admin`          | Boolean        | Default: `False`, Admin huquqini belgilaydi                       |
| `email_verified`    | Boolean        | Default: `False`, Email tasdiqlanganligini bildiradi              |
| `created_at`        | Timestamp      | Foydalanuvchi yaratilgan sana va vaqt                              |
| `updated_at`        | Timestamp      | Oxirgi yangilangan sana va vaqt                                   |

**2. Jamoa (Team)**

| Attribut Nomi       | Turi           | Izoh                                                              |
| :------------------ | :------------- | :---------------------------------------------------------------- |
| `team_id`           | UUID (PK)      | Jamoaning noyob identifikatori                                    |
| `name`              | String (Unique)| Majburiy, Jamoa nomi                                              |
| `logo_url`          | String         | Ixtiyoriy, Jamoa logosi URL manzili                               |
| `description`       | Text           | Ixtiyoriy, Jamoa tavsifi                                          |
| `invitation_code`   | String (Unique)| 16 raqamli, tasodifiy generatsiya qilinadi, Nullable              |
| `created_by_user_id`| UUID (FK)      | Jamoani yaratgan foydalanuvchi IDsi (User.user_id)                |
| `created_at`        | Timestamp      | Jamoa yaratilgan sana va vaqt                                     |
| `updated_at`        | Timestamp      | Oxirgi yangilangan sana va vaqt                                   |

**3. Jamoa A'zosi (TeamMember)**

| Attribut Nomi       | Turi           | Izoh                                                              |
| :------------------ | :------------- | :---------------------------------------------------------------- |
| `team_member_id`    | UUID (PK)      | Jamoa a'zosining noyob identifikatori                             |
| `user_id`           | UUID (FK)      | Foydalanuvchi IDsi (User.user_id)                                 |
| `team_id`           | UUID (FK)      | Jamoa IDsi (Team.team_id)                                         |
| `role`              | Enum           | Majburiy: 'member', 'team_lead'                                   |
| `joined_at`         | Timestamp      | Jamoaga qo'shilgan sana va vaqt                                   |
| `status`            | Enum           | Default: 'active', 'pending', 'inactive'                          |

**4. G'oya (Idea)**

| Attribut Nomi       | Turi           | Izoh                                                              |
| :------------------ | :------------- | :---------------------------------------------------------------- |
| `idea_id`           | UUID (PK)      | G'oyaning noyob identifikatori                                    |
| `team_id`           | UUID (FK)      | G'oya tegishli bo'lgan jamoa IDsi (Team.team_id)                  |
| `title`             | String         | Majburiy, G'oya nomi                                              |
| `description`       | Text           | Majburiy, G'oya tavsifi                                           |
| `category`          | Enum           | Default: 'raw', 'active', 'planned', 'archived'                   |
| `status`            | Enum           | Default: 'draft', 'under_review', 'approved', 'rejected', 'implemented' |
| `created_by_user_id`| UUID (FK)      | G'oyani yaratgan foydalanuvchi IDsi (User.user_id)                |
| `created_at`        | Timestamp      | G'oya yaratilgan sana va vaqt                                     |
| `updated_at`        | Timestamp      | Oxirgi yangilangan sana va vaqt                                   |

**5. G'oya Izohi (IdeaComment)**

| Attribut Nomi       | Turi           | Izoh                                                              |
| :------------------ | :------------- | :---------------------------------------------------------------- |
| `comment_id`        | UUID (PK)      | Izohning noyob identifikatori                                     |
| `idea_id`           | UUID (FK)      | Izoh tegishli bo'lgan g'oya IDsi (Idea.idea_id)                   |
| `user_id`           | UUID (FK)      | Izoh qoldirgan foydalanuvchi IDsi (User.user_id)                  |
| `content`           | Text           | Majburiy, Izoh matni                                              |
| `created_at`        | Timestamp      | Izoh qoldirilgan sana va vaqt                                     |

**6. Chat Xabari (ChatMessage)**

| Attribut Nomi       | Turi           | Izoh                                                              |
| :------------------ | :------------- | :---------------------------------------------------------------- |
| `message_id`        | UUID (PK)      | Xabarning noyob identifikatori                                    |
| `team_id`           | UUID (FK)      | Xabar tegishli bo'lgan jamoa IDsi (Team.team_id)                  |
| `sender_user_id`    | UUID (FK)      | Xabar yuborgan foydalanuvchi IDsi (User.user_id)                  |
| `content`           | Text           | Majburiy, Xabar matni                                             |
| `sent_at`           | Timestamp      | Xabar yuborilgan sana va vaqt                                     |

**7. Bildirishnoma (Notification)**

| Attribut Nomi       | Turi           | Izoh                                                              |
| :------------------ | :------------- | :---------------------------------------------------------------- |
| `notification_id`   | UUID (PK)      | Bildirishnomaning noyob identifikatori                            |
| `user_id`           | UUID (FK)      | Bildirishnoma yuborilgan foydalanuvchi IDsi (User.user_id)        |
| `type`              | Enum           | 'team_invite', 'idea_comment', 'team_message', 'admin_message', 'idea_status_change', 'task_assigned' |
| `content`           | Text           | Majburiy, Bildirishnoma matni                                     |
| `is_read`           | Boolean        | Default: `False`, Bildirishnoma o'qilganligini bildiradi          |
| `created_at`        | Timestamp      | Bildirishnoma yaratilgan sana va vaqt                             |
| `related_entity_id` | UUID           | Ixtiyoriy, Bog'liq entitetaning IDsi (masalan, idea_id, team_id) |

### 13.2. Entitetalararo Bog'liqliklar (Relationships)

*   **User - Team:** Bir foydalanuvchi bir nechta jamoa yaratishi mumkin (One-to-Many: `User.user_id` -> `Team.created_by_user_id`).
*   **User - TeamMember:** Bir foydalanuvchi bir nechta jamoaning a'zosi bo'lishi mumkin (One-to-Many: `User.user_id` -> `TeamMember.user_id`).
*   **Team - TeamMember:** Bir jamoada bir nechta a'zo bo'lishi mumkin (One-to-Many: `Team.team_id` -> `TeamMember.team_id`).
*   **User - Idea:** Bir foydalanuvchi bir nechta g'oya yaratishi mumkin (One-to-Many: `User.user_id` -> `Idea.created_by_user_id`).
*   **Team - Idea:** Bir jamoada bir nechta g'oya bo'lishi mumkin (One-to-Many: `Team.team_id` -> `Idea.team_id`).
*   **User - IdeaComment:** Bir foydalanuvchi bir nechta izoh qoldirishi mumkin (One-to-Many: `User.user_id` -> `IdeaComment.user_id`).
*   **Idea - IdeaComment:** Bir g'oyaga bir nechta izoh qoldirilishi mumkin (One-to-Many: `Idea.idea_id` -> `IdeaComment.idea_id`).
*   **User - ChatMessage:** Bir foydalanuvchi bir nechta chat xabari yuborishi mumkin (One-to-Many: `User.user_id` -> `ChatMessage.sender_user_id`).
*   **Team - ChatMessage:** Bir jamoada bir nechta chat xabari bo'lishi mumkin (One-to-Many: `Team.team_id` -> `ChatMessage.team_id`).
*   **User - Notification:** Bir foydalanuvchiga bir nechta bildirishnoma yuborilishi mumkin (One-to-Many: `User.user_id` -> `Notification.user_id`).

## 14. API Loyihasi (Backend uchun) - Kengaytirilgan

Backend RESTful API orqali frontend bilan aloqa qiladi. Har bir endpoint uchun autentifikatsiya va avtorizatsiya mexanizmlari qo'llaniladi. API versiyalash (masalan, `/api/v1/`) kelajakda o'zgarishlarni boshqarish uchun tavsiya etiladi.

### 14.1. Autentifikatsiya va Foydalanuvchi Boshqaruvi

*   `POST /api/auth/register`: Yangi foydalanuvchi ro'yxatdan o'tishi.
*   `POST /api/auth/login`: Foydalanuvchi tizimga kirishi va JWT olishi.
*   `GET /api/auth/verify-email?token={token}`: Email tasdiqlash.
*   `POST /api/auth/forgot-password`: Parolni tiklash havolasini yuborish.
*   `POST /api/auth/reset-password`: Parolni tiklash.
*   `GET /api/users/me`: Joriy foydalanuvchi profilini olish.
*   `PUT /api/users/me`: Joriy foydalanuvchi profilini tahrirlash.
*   `PUT /api/users/me/password`: Joriy foydalanuvchi parolini o'zgartirish.
*   `POST /api/users/me/profile-picture`: Profil rasmini yuklash.

### 14.2. Jamoa Boshqaruvi

*   `GET /api/teams`: Foydalanuvchi a'zo bo'lgan barcha jamoalarni olish.
*   `POST /api/teams`: Yangi jamoa yaratish.
*   `GET /api/teams/{team_id}`: Muayyan jamoa ma'lumotlarini olish.
*   `PUT /api/teams/{team_id}`: Muayyan jamoa ma'lumotlarini tahrirlash (Team Lead/Admin).
*   `DELETE /api/teams/{team_id}`: Muayyan jamoani o'chirish (Admin).
*   `GET /api/teams/{team_id}/members`: Jamoa a'zolari ro'yxatini olish.
*   `POST /api/teams/{team_id}/members`: Jamoaga a'zo taklif qilish (Team Lead/Admin).
*   `PUT /api/teams/{team_id}/members/{user_id}/role`: Jamoa a'zosining rolini o'zgartirish (Team Lead/Admin).
*   `DELETE /api/teams/{team_id}/members/{user_id}`: Jamoa a'zosini chiqarish (Team Lead/Admin).
*   `POST /api/teams/{team_id}/join`: Invitation code orqali jamoaga qo'shilish.
*   `GET /api/teams/{team_id}/invitation-code`: Jamoaning invitation code'ini olish (Team Lead/Admin).
*   `POST /api/teams/{team_id}/invitation-code/reset`: Jamoa invitation code'ini reset qilish (Team Lead/Admin).

### 14.3. G'oyalar Boshqaruvi

*   `GET /api/ideas`: Barcha g'oyalarni olish (filtrlash va sahifalash imkoniyati bilan).
*   `POST /api/teams/{team_id}/ideas`: Muayyan jamoada yangi g'oya yaratish.
*   `GET /api/ideas/{idea_id}`: Muayyan g'oya ma'lumotlarini olish.
*   `PUT /api/ideas/{idea_id}`: Muayyan g'oyani tahrirlash (G'oya yaratuvchisi/Team Lead/Admin).
*   `DELETE /api/ideas/{idea_id}`: Muayyan g'oyani o'chirish (G'oya yaratuvchisi/Team Lead/Admin).
*   `PUT /api/ideas/{idea_id}/status`: G'oya statusini o'zgartirish (Team Lead/Admin).
*   `PUT /api/ideas/{idea_id}/category`: G'oya kategoriyasini o'zgartirish (Team Lead/Admin).

### 14.4. G'oya Izohlari

*   `GET /api/ideas/{idea_id}/comments`: Muayyan g'oyaning izohlarini olish.
*   `POST /api/ideas/{idea_id}/comments`: Muayyan g'oyaga izoh qoldirish.
*   `PUT /api/comments/{comment_id}`: Izohni tahrirlash (Izoh egasi/Team Lead/Admin).
*   `DELETE /api/comments/{comment_id}`: Izohni o'chirish (Izoh egasi/Team Lead/Admin).

### 14.5. Chat Xabarlari

*   `GET /api/teams/{team_id}/chat/messages`: Muayyan jamoa chat xabarlarini olish.
*   `POST /api/teams/{team_id}/chat/messages`: Muayyan jamoa chatiga xabar yuborish.
*   `PUT /api/messages/{message_id}`: Xabarni tahrirlash (Xabar egasi/Team Lead/Admin).
*   `DELETE /api/messages/{message_id}`: Xabarni o'chirish (Xabar egasi/Team Lead/Admin).

### 14.6. Bildirishnomalar

*   `GET /api/notifications`: Foydalanuvchining barcha bildirishnomalarini olish.
*   `PUT /api/notifications/{notification_id}/read`: Bildirishnomani o'qilgan deb belgilash.
*   `PUT /api/notifications/read-all`: Barcha bildirishnomalarni o'qilgan deb belgilash.

### 14.7. Admin API (faqat Adminlar uchun)

*   `GET /api/admin/users`: Barcha foydalanuvchilarni boshqarish.
*   `PUT /api/admin/users/{user_id}`: Foydalanuvchi profilini tahrirlash.
*   `DELETE /api/admin/users/{user_id}`: Foydalanuvchini o'chirish.
*   `PUT /api/admin/users/{user_id}/block`: Foydalanuvchini bloklash/blokdan chiqarish.
*   `PUT /api/admin/users/{user_id}/admin-status`: Admin huquqini berish/olib tashlash.
*   `GET /api/admin/teams`: Barcha jamoalarni boshqarish.
*   `POST /api/admin/teams`: Yangi jamoa yaratish.
*   `PUT /api/admin/teams/{team_id}`: Jamoani tahrirlash.
*   `DELETE /api/admin/teams/{team_id}`: Jamoani o'chirish.
*   `GET /api/admin/ideas`: Barcha g'oyalarni boshqarish.
*   `PUT /api/admin/ideas/{idea_id}`: G'oyani tahrirlash.
*   `DELETE /api/admin/ideas/{idea_id}`: G'oyani o'chirish.
*   `GET /api/admin/logs`: Tizim loglarini ko'rish.
*   `PUT /api/admin/settings`: Umumiy platforma sozlamalarini boshqarish.

Ushbu API loyihasi tizimning barcha funksional imkoniyatlarini qamrab oladi va frontend bilan mustahkam aloqani ta'minlaydi. Har bir endpoint uchun tegishli HTTP metodlari (GET, POST, PUT, DELETE) va status kodlari (200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Internal Server Error) qo'llaniladi.

## 15. Frontend Tuzilishi (HTML/CSS/JS) va Fayllar Ierarxiyasi

Frontend qismi HTML5, CSS3 (Tailwind CSS bilan) va Vanilla JavaScript (ES6+) yordamida modulli va kengaytiriladigan tarzda quriladi. Bu yondashuv kodning tozaligini, boshqaruvchanligini va kelajakda osonlikcha yangi funksiyalar qo'shish imkoniyatini ta'minlaydi.

### 15.1. HTML Tuzilishi

Har bir sahifa o'zining asosiy HTML fayliga ega bo'ladi, lekin umumiy elementlar (header, footer, sidebar) JavaScript yordamida dinamik ravishda yuklanadi yoki shablon mexanizmlari orqali boshqariladi. Bu kod takrorlanishini kamaytiradi va bir xil UI/UX ni ta'minlaydi.

**`public/index.html` (Asosiy HTML fayl):**

```html
<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Startap G'oyalari Platformasi</title>
    <link rel="stylesheet" href="/src/style.css"> <!-- Tailwind CSS va asosiy stillar -->
</head>
<body>
    <div id="app"></div> <!-- Ilova shu yerga yuklanadi -->
    <script type="module" src="/src/main.js"></script> <!-- Asosiy JavaScript fayli -->
</body>
</html>
```

`#app` elementi ichiga JavaScript yordamida sahifalar va komponentlar yuklanadi. Bu Single Page Application (SPA) yondashuviga o'xshash, ammo murakkab frameworklarsiz amalga oshiriladi.

### 15.2. CSS Metodologiyasi (Tailwind CSS)

Tailwind CSS yordamida utility-first yondashuv qo'llaniladi. Bu tezkor dizayn, moslashuvchanlik va CSS fayllarining kichik hajmini ta'minlaydi.

*   **Global CSS (`src/style.css`):** Faqat Tailwind direktivalari va loyihaga xos asosiy stillar (masalan, shriftlar, global o'zgaruvchilar) shu yerda joylashadi.
    ```css
    @tailwind base;
    @tailwind components;
    @tailwind utilities;

    /* Loyihaga xos global stillar */
    body {
        font-family: 'Inter', sans-serif;
        @apply bg-gray-100 text-gray-900;
    }
    ```
*   **Komponentga Xos CSS:** Har bir komponent o'zining kichik CSS fayliga ega bo'lishi mumkin (`components/Button/Button.css`), lekin asosan Tailwind utility classlari ishlatiladi. Agar komponentga xos murakkab stillar kerak bo'lsa, `@apply` direktivasi yordamida Tailwind classlari guruhlanadi yoki oddiy CSS yoziladi.

### 15.3. JavaScript Modulligi

Vanilla JavaScript ES6 modullari yordamida kod modullarga bo'linadi. Har bir funksional blok (komponent, servis, util) alohida faylda joylashadi va kerakli joyda import/export qilinadi. Bu kodning qayta ishlatilishini va test qilinishini osonlashtiradi.

**`src/main.js` (Asosiy JavaScript fayli):**

```javascript
import { initRouter } from './router';
import { renderPage } from './utils/helpers';
import { checkAuthStatus } from './services/authService';

document.addEventListener('DOMContentLoaded', async () => {
    const appRoot = document.getElementById('app');
    if (!appRoot) {
        console.error('App root element not found!');
        return;
    }

    // Autentifikatsiya holatini tekshirish
    const isAuthenticated = await checkAuthStatus();

    // Routerni ishga tushirish
    initRouter(appRoot, isAuthenticated);

    // Boshlang'ich sahifani yuklash
    // renderPage(appRoot, isAuthenticated ? '/dashboard' : '/login');
});
```

### 15.4. Fayllar Ierarxiyasi (Batafsil)

```
startup-platform/
├── public/
│   ├── index.html              # Asosiy HTML fayl
│   └── assets/                 # Statik resurslar (rasmlar, shriftlar)
│       ├── images/
│       │   ├── logo.svg
│       │   └── user-placeholder.png
│       ├── fonts/
│       │   └── Inter-Regular.ttf
│       └── favicon.ico
├── src/
│   ├── main.js                 # Ilovani ishga tushiruvchi asosiy JS fayl
│   ├── style.css               # Global Tailwind CSS importlari va asosiy stillar
│   ├── components/             # Qayta ishlatiladigan UI komponentlar
│   │   ├── common/             # Umumiy komponentlar (Button, Input, Modal)
│   │   │   ├── Button.js
│   │   │   ├── Button.css
│   │   │   ├── Input.js
│   │   │   ├── Input.css
│   │   │   └── Modal.js
│   │   ├── layout/             # Layout komponentlar (Header, Sidebar, Footer)
│   │   │   ├── Header.js
│   │   │   ├── Sidebar.js
│   │   │   └── Footer.js
│   │   ├── team/               # Jamoaga oid komponentlar (TeamCard, MemberList)
│   │   │   ├── TeamCard.js
│   │   │   └── MemberList.js
│   │   ├── idea/               # G'oyaga oid komponentlar (IdeaCard, CommentForm)
│   │   │   ├── IdeaCard.js
│   │   │   └── CommentForm.js
│   │   └── notification/       # Bildirishnomaga oid komponentlar (NotificationItem)
│   │       └── NotificationItem.js
│   ├── pages/                  # Har bir sahifa uchun alohida fayllar
│   │   ├── auth/               # Autentifikatsiya sahifalari
│   │   │   ├── LoginPage.js
│   │   │   ├── RegisterPage.js
│   │   │   ├── ForgotPasswordPage.js
│   │   │   └── VerifyEmailPage.js
│   │   ├── dashboard/          # Dashboard sahifasi
│   │   │   └── DashboardPage.js
│   │   ├── team/               # Jamoa sahifalari
│   │   │   ├── TeamDetailPage.js
│   │   │   ├── TeamSettingsPage.js
│   │   │   └── TeamJoinPage.js
│   │   ├── idea/               # G'oya sahifalari
│   │   │   ├── IdeaListPage.js
│   │   │   ├── IdeaDetailPage.js
│   │   │   └── IdeaCreatePage.js
│   │   ├── profile/            # Profil sahifalari
│   │   │   └── ProfileSettingsPage.js
│   │   ├── admin/              # Admin paneli sahifalari
│   │   │   ├── AdminDashboardPage.js
│   │   │   ├── UserManagementPage.js
│   │   │   └── TeamManagementPage.js
│   │   └── NotFoundPage.js     # 404 sahifasi
│   ├── services/               # Backend API bilan aloqa qilish uchun funksiyalar
│   │   ├── authService.js      # Autentifikatsiya API chaqiruvlari
│   │   ├── teamService.js      # Jamoa API chaqiruvlari
│   │   ├── ideaService.js      # G'oya API chaqiruvlari
│   │   ├── notificationService.js # Bildirishnoma API chaqiruvlari
│   │   └── api.js              # Umumiy API konfiguratsiyasi (base URL, tokenlar)
│   ├── utils/                  # Yordamchi funksiyalar
│   │   ├── validation.js       # Forma validatsiyasi logikasi
│   │   ├── helpers.js          # Umumiy yordamchi funksiyalar (DOM manipulyatsiyasi, formatlash)
│   │   └── constants.js        # Global konstantalar
│   ├── router/                 # Client-side routing logikasi
│   │   └── index.js            # Router konfiguratsiyasi va boshqaruvi
│   └── store/                  # Global state management (agar kerak bo'lsa, masalan, foydalanuvchi ma'lumotlari)
│       └── authStore.js
├── .env                        # Atrof-muhit o'zgaruvchilari (API_BASE_URL)
├── package.json                # Loyiha metama'lumotlari va bog'liqliklar
├── package-lock.json
├── tailwind.config.js          # Tailwind CSS konfiguratsiyasi
├── postcss.config.js           # PostCSS konfiguratsiyasi
└── README.md                   # Loyiha haqida ma'lumot
```

### 15.5. Routing Mexanizmi

Client-side routing Vanilla JavaScript yordamida `History API` (`pushState`, `replaceState`) orqali amalga oshiriladi. Bu sahifalarni qayta yuklamasdan URL manzilini o'zgartirish va turli sahifalarni ko'rsatish imkonini beradi.

*   **`src/router/index.js`:**
    *   `routes` obyekti: Har bir URL yo'li uchun tegishli sahifa komponentini xaritalaydi.
    *   `navigateTo(path)` funksiyasi: URL manzilini o'zgartiradi va yangi sahifani yuklaydi.
    *   `handleLocation()` funksiyasi: Joriy URL manziliga qarab tegishli sahifani render qiladi.
    *   Autentifikatsiya tekshiruvi: Ba'zi sahifalarga (masalan, `/dashboard`) faqat autentifikatsiya qilingan foydalanuvchilar kira olishini ta'minlaydi.

### 15.6. Komponentlar Yondashuvi

Har bir UI elementi (tugma, input, modal, jamoa kartasi, g'oya kartasi) alohida JavaScript moduli sifatida yaratiladi. Bu komponentlar o'zining HTML tuzilishi, stillari va logikasini inkapsulyatsiya qiladi.

**Misol: `src/components/common/Button.js`**

```javascript
export function Button(text, onClick, classes = '') {
    const button = document.createElement('button');
    button.textContent = text;
    button.className = `py-2 px-4 rounded-md font-semibold ${classes}`;
    button.addEventListener('click', onClick);
    return button;
}
```

Bu yondashuv bilan, `Button` komponentini istalgan joyda import qilib, uni DOMga qo'shish mumkin. Masalan:

```javascript
import { Button } from '../../components/common/Button.js';

// ...

const myButton = Button('Yuborish', () => {
    console.log('Tugma bosildi!');
}, 'bg-blue-500 text-white hover:bg-blue-600');

// appRoot.appendChild(myButton);
```

### 15.7. Ma'lumotlar Oqimi va State Management

Oddiy loyihalar uchun global state management kutubxonalari shart emas. Ma'lumotlar oqimi asosan quyidagicha bo'ladi:

1.  **API chaqiruvlari:** `src/services/` ichidagi servislar backend bilan aloqa qiladi va ma'lumotlarni olib keladi.
2.  **Sahifa komponentlari:** Servislardan olingan ma'lumotlarni qabul qiladi va ularni kichik komponentlarga uzatadi.
3.  **Komponentlar:** Ma'lumotlarni ko'rsatadi va foydalanuvchi interaksiyalarini (tugma bosilishi, input o'zgarishi) qayta ishlaydi.
4.  **Event Delegation:** DOM elementlariga to'g'ridan-to'g'ri event listenerlar qo'yish o'rniga, yuqori darajadagi elementlarga event listenerlar qo'yish va eventlarni delegatsiya qilish tavsiya etiladi. Bu performance'ni oshiradi va kodni soddalashtiradi.

Murakkabroq state management kerak bo'lsa, `src/store/` katalogida oddiy JavaScript obyekti asosida global state yaratish mumkin. Masalan, `authStore.js` foydalanuvchining autentifikatsiya holatini saqlashi mumkin.

### 15.8. Build Jarayoni

Vite build tool sifatida ishlatiladi. U development serverni ta'minlaydi va production uchun kodni optimallashtiradi (minifikatsiya, tree-shaking, CSS/JS birlashtirish).

*   `package.json` skriptlari:
    *   `"dev": "vite"`: Development serverni ishga tushirish.
    *   `"build": "vite build"`: Production uchun kodni build qilish.

Bu tuzilma loyihaning boshidan oxirigacha tartibli va samarali rivojlanishini ta'minlaydi. Har bir qism o'z vazifasini aniq bajaradi va boshqa qismlar bilan aniq interfeyslar orqali aloqa qiladi.
