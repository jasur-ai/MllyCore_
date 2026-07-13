// T50 — Offline / PWA mode: app-shell caching service worker.
// Firebase Firestore offline-first keshlash alohida (firebase-service.js).
// Bu yerda faqat statik app-shell (HTML/CSS/JS) keshlanadi.
//
// FIX (file:// protocol): Service Worker faqat HTTPS yoki localhost da ishlaydi.
// file:// protokolda SW ro'yxatdan o'tmaydi — bu normal holat.
// HTML dagi SW registration kodi 'location.protocol === "file:"' check bilan o'ralgan.

const CACHE = 'mllycore-shell-v2';
const SHELL = [
  // HTML pages (PWA app-shell)
  'index.html',
  'login.html',
  'register.html',
  'dashboard.html',
  'team.html',
  'idea.html',
  'my-ideas.html',
  'profile.html',
  'notifications.html',
  'reports.html',
  'admin.html',
  'verify-email.html',
  // CSS
  'css/styles.css',
  // JS — Core
  'js/firebase-config.js',
  'js/firebase-service.js',
  'js/icons.js',
  'js/layout.js',
  'js/auth-guard.js',
  'js/theme.js',
  // JS — Widgets
  'js/analytics-widgets.js',
  // Images (brand)
  'images/favicon.svg',
  'images/logo-icon.svg',
  'images/logo-text.svg',
  // Images (PWA)
  'images/icon-192.png',
  'images/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // API va tashqi (firebase/gstatic) so'rovlarni cache qilmaymiz — ular o'z keshiga ega.
  if (url.pathname.startsWith('/api/')) return;
  if (url.hostname.includes('firebase') || url.hostname.includes('gstatic') || url.hostname.includes('googleapis')) return;

  // App-shell: cache-first, keyin network, oxirida index.html fallback.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        try {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        } catch (_) { /* ignore */ }
        return res;
      }).catch(() => caches.match('index.html'));
    })
  );
});
