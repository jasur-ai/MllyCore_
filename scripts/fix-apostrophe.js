const fs = require('fs');
let c = fs.readFileSync('api/index.js', 'utf8');

// The problem is "so'ng" — we need to escape the apostrophe
// Replace the broken string
var oldStr = "await sendTelegramMessage(db, chatId, 'Salom, ' + fromName + '! MllyCore botiga xush kelibsiz.\\n\\nProfil sozlamalarida Kod olish tugmasini bosing, so'ng /start KODINGIZ yozing yoki kodni menga yuboring.\\n\\nMavjud buyruqlar:\\n/start <code> - hisobni ulash\\n/me - profil ma\\lumotlari\\n/help - yordam');";
var newStr = "await sendTelegramMessage(db, chatId, \"Salom, \" + fromName + \"! MllyCore botiga xush kelibsiz.\\n\\nProfil sozlamalarida Kod olish tugmasini bosing, so'ng /start KODINGIZ yozing yoki kodni menga yuboring.\\n\\nMavjud buyruqlar:\\n/start <code> - hisobni ulash\\n/me - profil ma'lumotlari\\n/help - yordam\");";

if (c.includes(oldStr)) {
  c = c.replace(oldStr, newStr);
  fs.writeFileSync('api/index.js', c);
  console.log('OK: Apostrophe fixed (switched to double quotes)');
} else {
  console.log('FAIL: Pattern not found');
  var idx = c.indexOf("so'ng");
  if (idx >= 0) {
    console.log('Found so\'ng at index', idx);
    console.log('Context:', c.substring(idx - 50, idx + 50));
  }
}
