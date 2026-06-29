# Startap Hub — MVP (Static HTML Frontend)

Bu loyiha master-rejaga asoslangan **statik HTML/CSS/JS frontend MVP**. Backend yo'q — barcha ma'lumotlar mock holatda `js/mock-data.js` faylida.

## Ishga tushirish

1. Papkani oching
2. `index.html` faylini brauzerda oching (yoki har qanday statik server bilan ishlating, masalan `python3 -m http.server`)

## Sahifalar

| Sahifa | Tavsif |
|---|---|
| `index.html` | Landing |
| `login.html` | Kirish (demo: aziz@startup.uz / demo1234) |
| `register.html` | Ro'yxatdan o'tish |
| `dashboard.html` | Boshqaruv paneli (stats, jamoalar, g'oyalar, bildirishnomalar) |
| `team.html?id=t1` | Jamoa sahifasi (G'oyalar / A'zolar / Chat / Kanban) |
| `idea.html?id=i1` | G'oya sahifasi (tavsif, vazifalar, resurslar, izohlar) |
| `my-ideas.html` | Mening g'oyalarim ro'yxati + qidiruv |
| `notifications.html` | Bildirishnomalar |
| `profile.html` | Profil sozlamalari, parol, 2FA, bildirishnoma sozlamalari |
| `admin.html` | Admin paneli (foydalanuvchilar, jamoalar, g'oyalar, loglar, tizim sozlamalari) |

## Texnologiyalar

- Sof HTML5 + CSS3 (custom design system, dark theme)
- Vanilla JavaScript (modulli)
- Hech qanday build qadami yo'q, framework yo'q, Node.js yo'q

## Mock ma'lumotlar

- 7 foydalanuvchi (admin, team lead, member rollar)
- 4 jamoa
- 14 g'oya (Raw / Active / Planned / Archived)
- Chat xabarlari, izohlar, vazifalar, audit loglar

## Funksional MVP imkoniyatlari

- ✓ Multi-rolli foydalanuvchi tizimi (mock)
- ✓ Jamoa boshqaruvi (sozlamalar, invite kod reset)
- ✓ G'oyalar lifecycle va kategoriya filtrlash
- ✓ Kanban ko'rinishi
- ✓ Real-time tuyg'usidagi chat (lokal)
- ✓ Izohlar va vazifalar tizimi
- ✓ Bildirishnomalar
- ✓ Admin paneli + audit loglar
- ✓ Responsive dizayn