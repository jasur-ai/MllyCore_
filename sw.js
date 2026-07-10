// T50 — Offline / PWA mode: app-shell caching service worker.
// Firebase Firestore offline-first keshlash alohida (firebase-service.js).
// Bu yerda faqat statik app-shell (HTML/CSS/JS) keshlanadi.
const CACHE = 'mllycore-shell-v1';
const SHELL = [
  'index.html',
  'login.html',
  'dashboard.html',
  'css/styles.css',
  'js/firebase-config.js',
  'js/firebase-service.js',
  'js/layout.js',
  'js/theme.js',
  'js/auth-guard.js'
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
