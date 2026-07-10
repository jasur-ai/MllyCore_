/* ============================================================================
 * T39 (R6) — Rate Limiting / Abuse Protection
 * ----------------------------------------------------------------------------
 * Firestore-based sliding-window limiter. Sezgir endpoint'lar (invite-member,
 * verify-2fa, send-chat, create-workspace, ...) uchun brute-force / spam'ga
 * qarshi ishlatiladi. Admin SDK orqali yoziladi (security rules qo'llanilmaydi).
 *
 * Har bir "action" uchun alohida limit / oyna. Kalit: `${action}:${uid|ip}`.
 * Tugaganidan keyin avtomatik yangilanadi (expiresAt <= now bo'lsa reset).
 * ==========================================================================*/

const admin = require('firebase-admin');
const db = admin.firestore();

const CONFIG = {
  'invite-member':    { limit: 20,  windowMs: 60 * 60 * 1000 },  // 20 / soat
  'delete-workspace': { limit: 10,  windowMs: 60 * 60 * 1000 },  // 10 / soat
  'verify-2fa':       { limit: 10,  windowMs: 15 * 60 * 1000 },  // 10 / 15 daq
  'enable-2fa':       { limit: 5,   windowMs: 60 * 60 * 1000 },
  'disable-2fa':      { limit: 5,   windowMs: 60 * 60 * 1000 },
  'send-chat':        { limit: 60,  windowMs: 60 * 1000 },       // 60 / daq
  'create-workspace': { limit: 10,  windowMs: 60 * 60 * 1000 },
  'forgot-password':  { limit: 5,   windowMs: 60 * 60 * 1000 },
  'telegram-webhook': { limit: 30,  windowMs: 60 * 1000 },
  'default':          { limit: 120, windowMs: 60 * 1000 },
};

async function checkRateLimit({ uid, ip, action }) {
  const cfg = CONFIG[action] || CONFIG.default;
  const limit = cfg.limit;
  const windowMs = cfg.windowMs;
  const key = `${action}:${uid || ip || 'anon'}`;
  const ref = db.collection('rateLimits').doc(key);
  const now = Date.now();

  const w = await ref.get();
  if (!w.exists) {
    await ref.set({ count: 1, firstAt: now, expiresAt: now + windowMs });
    return { limited: false, remaining: limit - 1, retryAfter: 0 };
  }
  const d = w.data();
  if (d.expiresAt && d.expiresAt <= now) {
    await ref.set({ count: 1, firstAt: now, expiresAt: now + windowMs });
    return { limited: false, remaining: limit - 1, retryAfter: 0 };
  }
  const count = (d.count || 0) + 1;
  if (count > limit) {
    const retryAfter = Math.max(1, Math.ceil((d.expiresAt - now) / 1000));
    return { limited: true, remaining: 0, retryAfter };
  }
  await ref.update({ count, expiresAt: d.expiresAt });
  return { limited: false, remaining: limit - count, retryAfter: 0 };
}

module.exports = { checkRateLimit, RATE_LIMIT_CONFIG: CONFIG };
