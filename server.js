// =============================================================================
// MllyCore — Node.js Express Server
// =============================================================================
// Fully replaces static HTML hosting with Express + EJS while preserving
// 100% of the original UI, UX, design, layout, and URL structure.
// All .html pages become .ejs templates in views/ directory.
// The existing API (api/index.js) is lazy-loaded on first API request.
// =============================================================================

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── 1. EJS Template Engine ──────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── 2. Middleware ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── 3. Static File Serving ──────────────────────────────────────────────────
// All original static assets served from their original locations
app.use('/css', express.static(path.join(__dirname, 'css'), { maxAge: '1h' }));
app.use('/js', express.static(path.join(__dirname, 'js'), { maxAge: '1h' }));
app.use('/images', express.static(path.join(__dirname, 'images'), { maxAge: '1d' }));
app.use('/design-tokens', express.static(path.join(__dirname, 'design-tokens'), { maxAge: '1h' }));
app.use('/scripts', express.static(path.join(__dirname, 'scripts'), { maxAge: '1h' }));

// Root-level static files
app.get('/sw.js', (req, res) => res.sendFile(path.join(__dirname, 'sw.js')));
app.get('/manifest.webmanifest', (req, res) => res.sendFile(path.join(__dirname, 'manifest.webmanifest')));
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'images', 'favicon.svg')));
app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nAllow: /\n'));

// ── 4. Page Routes — All .html URLs preserved exactly ───────────────────────
// Landing
app.get('/', (req, res) => res.render('index'));
app.get('/index.html', (req, res) => res.render('index'));

// Auth
app.get('/login.html', (req, res) => res.render('login'));
app.get('/register.html', (req, res) => res.render('register'));
app.get('/verify-email.html', (req, res) => res.render('verify-email'));

// App pages
app.get('/dashboard.html', (req, res) => res.render('dashboard'));
app.get('/team.html', (req, res) => res.render('team'));
app.get('/admin.html', (req, res) => res.render('admin'));
app.get('/profile.html', (req, res) => res.render('profile'));
app.get('/idea.html', (req, res) => res.render('idea'));
app.get('/my-ideas.html', (req, res) => res.render('my-ideas'));
app.get('/notifications.html', (req, res) => res.render('notifications'));
app.get('/reports.html', (req, res) => res.render('reports'));

// Demo
app.get('/tw-demo.html', (req, res) => res.render('tw-demo'));

// ── 5. API — Lazy-loaded from existing api/index.js ─────────────────────────
// The API requires firebase-admin credentials, so we load it only when needed.
// If credentials aren't set, the API returns clear 503.

let _apiHandler = null;
let _apiLoadAttempted = false;

function loadApiHandler() {
  if (_apiLoadAttempted) return _apiHandler;
  _apiLoadAttempted = true;
  try {
    const mod = require('./api/index');
    if (typeof mod === 'function') {
      _apiHandler = mod;
      console.log('API handler loaded successfully.');
    }
  } catch (err) {
    console.warn('API handler not loaded:', err.message);
  }
  return _apiHandler;
}

// Catch-all for /api/* routes
app.all('/api/*', (req, res) => {
  const handler = loadApiHandler();
  if (handler) {
    try {
      return handler(req, res);
    } catch (err) {
      console.error('API handler error:', err.message);
      return res.status(500).json({ error: 'API xatoligi.', status: 500 });
    }
  }
  res.status(503).json({
    error: 'API mavjud emas. FIREBASE_SERVICE_ACCOUNT_JSON sozlanmagan.',
    status: 'unavailable'
  });
});

// ── 6. 404 Handler ──────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint topilmadi.', status: 404 });
  }
  res.status(404).render('index');
});

// ── 7. Error Handler ────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ error: 'Server xatoligi.', status: 500 });
  }
  res.status(500).send('Server xatoligi yuz berdi.');
});

// ── 8. Start ────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`╔══════════════════════════════════════════════╗`);
  console.log(`║   MllyCore — Express Server                 ║`);
  console.log(`║   Port: ${PORT}                              ║`);
  console.log(`║   URL:  http://localhost:${PORT}               ║`);
  console.log(`╚══════════════════════════════════════════════╝`);
});

module.exports = app;
