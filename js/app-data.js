// Boshlang'ich ma'lumotlar va umumiy yordamchi funksiyalar

window.MOCK = {
  currentUser: {
    id: 'u1',
    username: 'aziz_dev',
    name: 'Aziz Karimov',
    email: 'aziz@startup.uz',
    role: 'team_lead', // admin | team_lead | member
    avatar: 'AK',
  },
  users: [
    { id: 'u1', name: 'Aziz Karimov', username: 'aziz_dev', email: 'aziz@startup.uz', role: 'team_lead', avatar: 'AK', verified: true, blocked: false, joined: '2024-11-12' },
    { id: 'u2', name: 'Diyora Yusupova', username: 'diyora_y', email: 'diyora@startup.uz', role: 'member', avatar: 'DY', verified: true, blocked: false, joined: '2025-01-04' },
    { id: 'u3', name: 'Bekzod Otaboyev', username: 'bekzod_o', email: 'bekzod@startup.uz', role: 'member', avatar: 'BO', verified: true, blocked: false, joined: '2025-02-19' },
    { id: 'u4', name: 'Madina Rasulova', username: 'madina_r', email: 'madina@startup.uz', role: 'member', avatar: 'MR', verified: false, blocked: false, joined: '2025-03-08' },
    { id: 'u5', name: 'Sardor Aliyev', username: 'sardor_a', email: 'sardor@startup.uz', role: 'admin', avatar: 'SA', verified: true, blocked: false, joined: '2024-09-01' },
    { id: 'u6', name: 'Nodira Tursunova', username: 'nodira_t', email: 'nodira@startup.uz', role: 'member', avatar: 'NT', verified: true, blocked: true, joined: '2024-12-22' },
    { id: 'u7', name: 'Jasur Komilov', username: 'jasur_k', email: 'jasur@startup.uz', role: 'team_lead', avatar: 'JK', verified: true, blocked: false, joined: '2025-01-30' },
  ],
  teams: [
    {
      id: 't1', name: 'EduTech Innovators', logo: 'EI', color: 'tl-1',
      description: 'Maktab va universitet talabalari uchun zamonaviy ta\'lim platformalarini ishlab chiqamiz.',
      members: ['u1','u2','u3','u4'], lead: 'u1', code: 'ED4F-9X2K-7BQA-MN1P', created: '2024-12-01', ideasCount: 4,
    },
    {
      id: 't2', name: 'FinFlow', logo: 'FF', color: 'tl-2',
      description: 'Kichik biznes uchun moliyani avtomatlashtiruvchi SaaS yechimlari.',
      members: ['u1','u3','u7'], lead: 'u7', code: 'FN82-K4LM-99XA-2QWE', created: '2025-01-10', ideasCount: 3,
    },
    {
      id: 't3', name: 'GreenChain', logo: 'GC', color: 'tl-3',
      description: 'Qishloq xo\'jaligi uchun IoT va blockchain asosidagi yechimlar.',
      members: ['u1','u2','u5'], lead: 'u1', code: 'GR55-AB12-77CD-XYZ9', created: '2025-02-15', ideasCount: 5,
    },
    {
      id: 't4', name: 'MediCare AI', logo: 'MC', color: 'tl-4',
      description: 'Tibbiyot xodimlari uchun AI-yordamchi diagnostika tizimi.',
      members: ['u2','u4','u5'], lead: 'u5', color: 'tl-4', code: 'MD11-AI22-DOC3-CARE', created: '2025-03-01', ideasCount: 2,
    },
  ],
  ideas: [
    { id: 'i1', teamId: 't1', title: 'AI-asoslangan shaxsiy o\'qituvchi', category: 'active', status: 'progress', author: 'u2', created: '2025-04-12', updated: '2025-06-20', desc: 'Har bir talaba uchun moslashtirilgan o\'quv yo\'lini AI yordamida tuzadigan tizim. Talabaning bilim darajasi, sur\'ati va qiziqishlariga moslashadi.', problem: 'An\'anaviy ta\'lim hamma uchun bir xil tezlikda boradi.', solution: 'Adaptive learning algoritmi orqali individual o\'quv yo\'li.', market: 'O\'zbekistondagi 6M+ maktab o\'quvchisi va 400K+ talaba.', comments: 8 },
      { id: 'i2', teamId: 't1', title: 'Interaktiv darslik platformasi', category: 'planned', status: 'approved', author: 'u1', created: '2025-05-02', updated: '2025-06-18', desc: '3D va AR yordamida fizika, kimyo darslarini interaktiv ko\'rish.', problem: 'O\'quvchilar nazariy materialni vizualizatsiya qila olmaydi.', solution: 'AR.js asosidagi mobil ilova.', market: 'Boshlang\'ich va o\'rta maktablar.', comments: 4 },
    { id: 'i3', teamId: 't1', title: 'O\'qituvchilar uchun analitika', category: 'raw', status: 'draft', author: 'u3', created: '2025-06-10', updated: '2025-06-25', desc: 'O\'qituvchilarga sinf bo\'yicha real-time analitika.', comments: 2 },
    { id: 'i4', teamId: 't1', title: 'Online imtihon tizimi', category: 'archived', status: 'rejected', author: 'u4', created: '2025-02-01', updated: '2025-04-20', desc: 'Anti-cheat texnologiyalari bilan online imtihon.', comments: 12 },

    { id: 'i5', teamId: 't2', title: 'Avtomatik soliq hisobotlari', category: 'active', status: 'progress', author: 'u7', created: '2025-03-15', updated: '2025-06-22', desc: 'Kichik biznes uchun soliq hisobotlarini avtomatik tayyorlash.', comments: 6 },
    { id: 'i6', teamId: 't2', title: 'Pul oqimini bashorat qilish', category: 'planned', status: 'approved', author: 'u3', created: '2025-04-01', updated: '2025-06-15', desc: 'Mashina o\'rganishi bilan keyingi 6 oy uchun pul oqimi.', comments: 3 },
    { id: 'i7', teamId: 't2', title: 'Invoys generatori', category: 'raw', status: 'draft', author: 'u1', created: '2025-06-05', updated: '2025-06-26', desc: 'PDF invoyslarni avtomatik yaratish.', comments: 1 },

    { id: 'i8', teamId: 't3', title: 'Tuproq namligi sensori tarmog\'i', category: 'active', status: 'progress', author: 'u1', created: '2025-03-20', updated: '2025-06-24', desc: 'IoT sensorlar orqali tuproq namligini kuzatish.', comments: 9 },
    { id: 'i9', teamId: 't3', title: 'Mahsulot kelib chiqishini kuzatish', category: 'planned', status: 'approved', author: 'u2', created: '2025-04-10', updated: '2025-06-19', desc: 'Blockchain orqali mahsulotning fermer xo\'jaligidan iste\'molchigacha yo\'lini kuzatish.', comments: 5 },
    { id: 'i10', teamId: 't3', title: 'Avtomatik sug\'orish tizimi', category: 'raw', status: 'draft', author: 'u5', created: '2025-06-12', updated: '2025-06-25', desc: 'Sensorlardan kelgan ma\'lumotlarga asoslangan avtomatik sug\'orish.', comments: 2 },
    { id: 'i11', teamId: 't3', title: 'Hosildorlik bashorati', category: 'active', status: 'progress', author: 'u1', created: '2025-05-01', updated: '2025-06-23', desc: 'Ob-havo va tuproq ma\'lumotlariga asoslangan hosildorlik bashorati.', comments: 7 },
    { id: 'i12', teamId: 't3', title: 'Fermer marketplace', category: 'archived', status: 'rejected', author: 'u2', created: '2025-01-15', updated: '2025-03-10', desc: 'To\'g\'ridan-to\'g\'ri fermer-iste\'molchi platformasi.', comments: 4 },

    { id: 'i13', teamId: 't4', title: 'Radiologik tasvir tahlili', category: 'active', status: 'progress', author: 'u5', created: '2025-04-05', updated: '2025-06-21', desc: 'Rentgen tasvirlarni AI bilan tahlil qilish.', comments: 11 },
    { id: 'i14', teamId: 't4', title: 'Bemor tarixi xulosalovchi', category: 'raw', status: 'draft', author: 'u4', created: '2025-06-08', updated: '2025-06-25', desc: 'Bemor tibbiy tarixini AI orqali qisqacha xulosalash.', comments: 3 },
  ],
  comments: {
    i1: [
      { id: 'c1', user: 'u1', text: 'Ajoyib g\'oya! Tajriba dasturini boshlash kerakmi?', date: '2025-06-21 14:20' },
      { id: 'c2', user: 'u3', text: 'Dataset masalasi bilan yordam bera olaman.', date: '2025-06-22 09:10' },
      { id: 'c3', user: 'u2', text: 'Rahmat! Bu hafta MVP rejasini yuboraman.', date: '2025-06-22 11:45' },
    ],
  },
  messages: {
    t1: [
      { id: 'm1', user: 'u2', text: 'Salom jamoa! Yangi sprint rejasi tayyormi?', time: '09:12' },
      { id: 'm2', user: 'u1', text: 'Ha, bugun soat 15:00 da review qilamiz.', time: '09:14' },
      { id: 'm3', user: 'u3', text: 'Men dataset tayyorladim, repoga yukladim.', time: '09:20' },
      { id: 'm4', user: 'u4', text: 'Dizayn maketlari Figma\'da: figma.com/edutech', time: '10:02' },
      { id: 'm5', user: 'u1', text: 'Zo\'r! Taqdimot uchun ham slaydlar kerak bo\'ladi.', time: '10:05' },
    ],
  },
  notifications: [
    { id: 'n1', type: 'idea', text: 'Diyora yangi g\'oya qo\'shdi: "AI-asoslangan shaxsiy o\'qituvchi"', time: '2 soat oldin', unread: true },
    { id: 'n2', type: 'chat', text: 'EduTech Innovators chatida 3 yangi xabar', time: '4 soat oldin', unread: true },
    { id: 'n3', type: 'member', text: 'Madina FinFlow jamoasiga qo\'shilish so\'rovini yubordi', time: 'Kecha', unread: true },
    { id: 'n4', type: 'idea', text: 'G\'oya "Interaktiv darslik platformasi" tasdiqlandi', time: '2 kun oldin', unread: false },
    { id: 'n5', type: 'system', text: 'Profilingizni to\'ldirib bo\'ldingiz', time: '3 kun oldin', unread: false },
  ],
  tasks: {
    i1: [
      { id: 'tk1', title: 'Dataset yig\'ish', assignee: 'u3', done: true },
      { id: 'tk2', title: 'Model arxitekturasini tanlash', assignee: 'u2', done: true },
      { id: 'tk3', title: 'MVP prototip', assignee: 'u1', done: false },
      { id: 'tk4', title: 'A/B test reja', assignee: 'u4', done: false },
    ],
  },
  resources: {
    i1: [
      { name: 'Bozor tahlili.pdf', type: 'file' },
      { name: 'Figma maketlar', type: 'link', url: '#' },
      { name: 'Texnik spetsifikatsiya.docx', type: 'file' },
    ],
  },
  logs: [
    { time: '2025-06-29 10:14', user: 'Aziz Karimov', action: 'G\'oya yaratdi', target: 'AI-asoslangan shaxsiy o\'qituvchi' },
    { time: '2025-06-29 09:50', user: 'Sardor Aliyev', action: 'Foydalanuvchini bloklash', target: 'Nodira Tursunova' },
    { time: '2025-06-28 18:22', user: 'Jasur Komilov', action: 'Secret key reset', target: 'FinFlow' },
    { time: '2025-06-28 14:05', user: 'Diyora Yusupova', action: 'Login', target: '—' },
    { time: '2025-06-27 11:10', user: 'Aziz Karimov', action: 'G\'oya statusini o\'zgartirdi', target: 'Tuproq namligi' },
  ],
};

window.UTIL = {
  qs: (k) => new URLSearchParams(location.search).get(k),
  user: (id) => MOCK.users.find(u => u.id === id),
  team: (id) => MOCK.teams.find(t => t.id === id),
  idea: (id) => MOCK.ideas.find(i => i.id === id),
  initials: (name) => name.split(' ').map(s => s[0]).join('').slice(0,2).toUpperCase(),
  toast: (msg) => {
    const el = document.createElement('div');
    el.className = 'toast'; el.textContent = msg; document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 2200);
  },
  openModal: (id) => document.getElementById(id)?.classList.add('open'),
  closeModal: (id) => document.getElementById(id)?.classList.remove('open'),
  catBadge: (c) => `<span class="badge badge-${c}">${({raw:'Xom',active:'Faol',planned:'Rejalashtirilgan',archived:'Arxiv'})[c]||c}</span>`,
  statusBadge: (s) => `<span class="badge badge-${s}">${({draft:'Qoralama',progress:'Jarayonda',approved:'Tasdiqlangan',rejected:'Rad etilgan'})[s]||s}</span>`,
};
