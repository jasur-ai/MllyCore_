const fs = require('fs');
let c = fs.readFileSync('api/index.js', 'utf8');
let changes = 0;

// ============================================================
// 1. Replace handleTelegramWebhook stub with full implementation
// ============================================================
const oldWebhook = `async function handleTelegramWebhook(req, res) {
  return { status: 200, ok: true };
}
async function pushTelegram(db, userId, text) {`;

const newWebhook = `// Telegram kodini yaratish (15 daqiqa muddat bilan)
async function handleGenerateTelegramCode(req, res, db, decoded, user) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  const oldCodes = await db.collection('telegramCodes').where('userId', '==', decoded.uid).get();
  const batch = db.batch();
  oldCodes.docs.forEach(function(d) { batch.delete(d.ref); });
  batch.set(db.collection('telegramCodes').doc(), {
    userId: decoded.uid,
    email: user.email || '',
    name: user.name || user.email || '',
    code: code,
    createdAt: admin.firestore.Timestamp.now(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    used: false
  });
  await batch.commit();
  return { status: 200, success: true, code: code, message: 'Kod yaratildi. 15 daqiqa ichida Telegram botga yuboring.' };
}

// Telegram webhook - Telegram serveridan keladigan xabarlarni qabul qiladi (authsiz)
async function handleTelegramWebhook(req, res, db) {
  var update = req.body || {};
  var msg = update.message;
  if (!msg || !msg.text || !msg.from || !msg.chat) {
    return { status: 200, ok: true };
  }
  var chatId = String(msg.chat.id);
  var text = String(msg.text || '').trim();
  var fromName = msg.from.first_name || msg.from.username || 'User';
  var lower = text.toLowerCase();
  try {
    if (lower === '/start' || lower.startsWith('/start ')) {
      var parts = text.split(/\\s+/);
      var code = parts.length > 1 ? parts[1].trim().toUpperCase() : '';
      if (!code) {
        await sendTelegramMessage(db, chatId, 'Salom, ' + fromName + '! MllyCore botiga xush kelibsiz.\\n\\nProfil sozlamalarida Kod olish tugmasini bosing, so\'ng /start KODINGIZ yozing yoki kodni menga yuboring.\\n\\nMavjud buyruqlar:\\n/start <code> - hisobni ulash\\n/me - profil ma\\lumotlari\\n/help - yordam');
        return { status: 200, ok: true };
      }
      var codeSnap = await db.collection('telegramCodes').where('code', '==', code).where('used', '==', false).limit(1).get();
      if (codeSnap.empty) {
        await sendTelegramMessage(db, chatId, 'Kod notogri yoki muddati otgan. Profil sozlamalarida yangi kod oling.');
        return { status: 200, ok: true };
      }
      var codeDoc = codeSnap.docs[0];
      var codeData = codeDoc.data();
      var expiresAt = codeData.expiresAt && codeData.expiresAt.toMillis ? codeData.expiresAt.toMillis() : 0;
      if (expiresAt && Date.now() > expiresAt) {
        await codeDoc.ref.update({ used: true });
        await sendTelegramMessage(db, chatId, 'Kodning muddati otgan. Profil sozlamalarida yangi kod oling.');
        return { status: 200, ok: true };
      }
      var userId = codeData.userId;
      await db.collection('users').doc(userId).update({
        telegramChatId: chatId,
        telegramLinkedAt: admin.firestore.Timestamp.now()
      });
      await codeDoc.ref.update({ used: true, linkedChatId: chatId });
      await sendTelegramMessage(db, chatId, 'Hisobingiz muvaffaqiyatli ulandi! Endi MllyCore dan barcha bildirishnomalarni Telegram orqali olasiz.\\n\\nProfil: ' + (codeData.name || codeData.email || userId));
      return { status: 200, ok: true };
    }
    if (lower === '/me') {
      var userSnap = await db.collection('users').where('telegramChatId', '==', chatId).limit(1).get();
      if (userSnap.empty) {
        await sendTelegramMessage(db, chatId, 'Hisobingiz hali ulanmagan. Avval profil sozlamalarida kod oling va /start KOD ni yuboring.');
        return { status: 200, ok: true };
      }
      var u = userSnap.docs[0].data();
      await sendTelegramMessage(db, chatId, 'Profil\\nIsm: ' + (u.name || '-') + '\\nEmail: ' + (u.email || '-') + '\\nRol: ' + (u.role || 'member') + '\\nUsername: @' + (u.username || '-'));
      return { status: 200, ok: true };
    }
    if (lower === '/help') {
      await sendTelegramMessage(db, chatId, 'MllyCore Bot yordam\\n\\n/start <code> - hisobni kod orqali ulash\\n/me - profil malumotlari\\n/help - bu yordam xabari\\n\\nKod olish uchun MllyCore web-saytidagi Profil > Telegram bolimiga kiring.');
      return { status: 200, ok: true };
    }
    if (/^[A-Z0-9]{6}$/.test(text)) {
      var cs = await db.collection('telegramCodes').where('code', '==', text).where('used', '==', false).limit(1).get();
      if (cs.empty) {
        await sendTelegramMessage(db, chatId, 'Kod notogri. Profil sozlamalarida yangi kod oling.');
        return { status: 200, ok: true };
      }
      var cd = cs.docs[0];
      var cdData = cd.data();
      var ea = cdData.expiresAt && cdData.expiresAt.toMillis ? cdData.expiresAt.toMillis() : 0;
      if (ea && Date.now() > ea) {
        await cd.ref.update({ used: true });
        await sendTelegramMessage(db, chatId, 'Kod muddati otgan. Yangi kod oling.');
        return { status: 200, ok: true };
      }
      await db.collection('users').doc(cdData.userId).update({ telegramChatId: chatId, telegramLinkedAt: admin.firestore.Timestamp.now() });
      await cd.ref.update({ used: true, linkedChatId: chatId });
      await sendTelegramMessage(db, chatId, 'Hisob ulandi! Endi bildirishnomalarni Telegram orqali olasiz.');
      return { status: 200, ok: true };
    }
    await sendTelegramMessage(db, chatId, 'Nomalum buyruq. /help ni bosing.');
  } catch (err) {
    console.error('Telegram webhook error:', err.message);
  }
  return { status: 200, ok: true };
}

// Telegram orqali xabar yuborish (chatId malum bolganda)
async function sendTelegramMessage(db, chatId, text) {
  var token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  try {
    await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: String(chatId), text: String(text).slice(0, 4000), parse_mode: 'HTML' })
    });
  } catch (_) {}
}

async function pushTelegram(db, userId, text) {`;

if (c.includes(oldWebhook)) {
  c = c.replace(oldWebhook, newWebhook);
  console.log('OK 1: handleTelegramWebhook + handleGenerateTelegramCode added');
  changes++;
} else {
  console.log('FAIL 1: oldWebhook pattern not found');
  process.exit(1);
}

// ============================================================
// 2. Add telegram-webhook as public route (before auth check)
// ============================================================
var publicIdeaMarker = "if (_pathname.includes('public-idea')) {";
var publicIdeaIdx = c.indexOf(publicIdeaMarker);
if (publicIdeaIdx >= 0) {
  // Find the closing of this block (the if block that catches errors)
  var publicIdeaEndIdx = c.indexOf('}', publicIdeaIdx);
  publicIdeaEndIdx = c.indexOf('}', publicIdeaEndIdx + 1); // closing of try
  publicIdeaEndIdx = c.indexOf('}', publicIdeaEndIdx + 1); // closing of if
  
  var beforeInsert = c.slice(0, publicIdeaEndIdx + 1);
  var afterInsert = c.slice(publicIdeaEndIdx + 1);
  
  var telegramPublicRoute = "\n\n  // Telegram webhook - auth talab qilmaydi, Telegram serveridan keladi\n" +
    "  if (_pathname.includes('telegram-webhook') || _pathname.includes('telegram_webhook')) {\n" +
    "    try {\n" +
    "      initAdmin();\n" +
    "      var _tgDb = admin.firestore();\n" +
    "      var _tgResult = await handleTelegramWebhook(req, res, _tgDb);\n" +
    "      return res.status(200).json(_tgResult);\n" +
    "    } catch (_tgErr) {\n" +
    "      return res.status(400).json({ error: 'Telegram webhook xatosi.' });\n" +
    "    }\n" +
    "  }";
  
  c = beforeInsert + telegramPublicRoute + afterInsert;
  console.log('OK 2: telegram-webhook public route added');
  changes++;
} else {
  console.log('FAIL 2: public-idea marker not found');
  process.exit(1);
}

// ============================================================
// 3. Remove telegram-webhook from SENSITIVE set
// ============================================================
c = c.replace("'send-chat', 'create-workspace', 'forgot-password', 'telegram-webhook',", "'send-chat', 'create-workspace', 'forgot-password',");
console.log('OK 3: telegram-webhook removed from SENSITIVE');

// ============================================================
// 4. Remove telegram-webhook from authenticated router
// ============================================================
var oldRouter = "    else if (action === 'telegram-webhook') result = await handleTelegramWebhook(req, res);\n    else if (action === 'finances') result = await handleFinances(req, res, db, decoded, user);";
var newRouter = "    else if (action === 'finances') result = await handleFinances(req, res, db, decoded, user);";
c = c.replace(oldRouter, newRouter);
console.log('OK 4: telegram-webhook removed from auth router');

// ============================================================
// 5. Ensure generate-telegram-code is in router
// ============================================================
if (c.includes("action === 'generate-telegram-code'")) {
  console.log('OK 5: generate-telegram-code present in router');
} else {
  console.log('FAIL 5: generate-telegram-code NOT in router');
}

fs.writeFileSync('api/index.js', c);
console.log('\nTotal changes: ' + changes);
