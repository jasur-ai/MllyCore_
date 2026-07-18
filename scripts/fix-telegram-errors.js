const fs = require('fs');
let c = fs.readFileSync('api/index.js', 'utf8');

// Fix 1: Unescaped apostrophe in "so'ng" on the greeting message line
// The old string uses single quotes: 'Salom, ' + fromName + '! ... so'ng ...'
// Replace with escaped apostrophe
var old1 = "'Salom, ' + fromName + '! MllyCore botiga xush kelibsiz.\\n\\nProfil sozlamalarida Kod olish tugmasini bosing, so'ng /start KODINGIZ yozing yoki kodni menga yuboring.\\n\\nMavjud buyruqlar:\\n/start <code> - hisobni ulash\\n/me - profil ma\\lumotlari\\n/help - yordam'";
var new1 = "'Salom, ' + fromName + '! MllyCore botiga xush kelibsiz.\\\\n\\\\nProfil sozlamalarida Kod olish tugmasini bosing, so\\'ng /start KODINGIZ yozing yoki kodni menga yuboring.\\\\n\\\\nMavjud buyruqlar:\\\\n/start <code> - hisobni ulash\\\\n/me - profil ma\\\\lumotlari\\\\n/help - yordam'";

if (c.includes(old1)) {
  c = c.replace(old1, new1);
  console.log('OK 1: Fixed apostrophe in greeting message');
} else {
  console.log('FAIL 1: Greeting pattern not found');
  // Debug: find context
  var idx = c.indexOf('Salom, ');
  if (idx >= 0) console.log('Found Salom at', idx, 'context:', c.substring(idx, idx + 100));
}

// Fix 2: Replace queries that need composite index with simpler ones
// In handleTelegramWebhook - replace .where('used', '==', false) with in-memory filter
var oldQuery = 'var codeSnap = await db.collection(\\'telegramCodes\\').where(\\'code\\', \\'==\\', code).where(\\'used\\', \\'==\\', false).limit(1).get();';
var newQuery = 'var codeSnap = await db.collection(\\'telegramCodes\\').where(\\'code\\', \\'==\\', code).limit(1).get();';

if (c.includes(oldQuery)) {
  c = c.replace(oldQuery, newQuery);
  console.log('OK 2: Fixed composite index query in webhook');
} else {
  console.log('FAIL 2: Webhook query pattern not found');
}

// Also fix the second occurrence of this query (the direct code input path)
if (c.includes(oldQuery)) {
  c = c.replace(oldQuery, newQuery);
  console.log('OK 2b: Fixed second composite index query');
}

// Fix 3: Add in-memory filter after the query results
var oldFilter = "      if (codeSnap.empty) {\n        await sendTelegramMessage(db, chatId,\n          'Kod notogri yoki muddati otgan. Profil sozlamalarida yangi kod oling.'\n        );\n        return { status: 200, ok: true };\n      }\n      var codeDoc = codeSnap.docs[0];\n      var codeData = codeDoc.data();";
var newFilter = "      if (codeSnap.empty) {\n        await sendTelegramMessage(db, chatId,\n          'Kod notogri yoki muddati otgan. Profil sozlamalarida yangi kod oling.'\n        );\n        return { status: 200, ok: true };\n      }\n      // In-memory filter: used === false (composite index talab qilmaydi)\n      var codeDoc = codeSnap.docs.find(function(d) { return d.data().used === false; });\n      if (!codeDoc) {\n        await sendTelegramMessage(db, chatId,\n          'Kod notogri yoki muddati otgan. Profil sozlamalarida yangi kod oling.'\n        );\n        return { status: 200, ok: true };\n      }\n      var codeData = codeDoc.data();";

if (c.includes('var codeDoc = codeSnap.docs[0];\n      var codeData = codeDoc.data();')) {
  c = c.replace('var codeDoc = codeSnap.docs[0];\n      var codeData = codeDoc.data();', 
    '// In-memory filter: used === false (composite index talab qilmaydi)\n      var codeDoc = codeSnap.docs.find(function(d) { return d.data().used === false; });\n      if (!codeDoc) {\n        await sendTelegramMessage(db, chatId,\n          \"Kod notogri yoki muddati otgan. Profil sozlamalarida yangi kod oling.\"\n        );\n        return { status: 200, ok: true };\n      }\n      var codeData = codeDoc.data();');
  console.log('OK 3: Added in-memory filter after first query');
} else {
  console.log('FAIL 3: First query result pattern not found');
}

// Fix 4: Same for the second occurrence (direct code input)
var secondOld = "      var cs = await db.collection('telegramCodes').where('code', '==', text).where('used', '==', false).limit(1).get();";
var secondNew = "      var cs = await db.collection('telegramCodes').where('code', '==', text).limit(1).get();";

if (c.includes(secondOld)) {
  c = c.replace(secondOld, secondNew);
  console.log('OK 4: Fixed second composite index query (direct code)');
} else {
  console.log('FAIL 4: Second query pattern not found');
}

// Fix 5: In-memory filter for second direct code query
if (c.includes('var cd = cs.docs[0];\n      var cdData = cd.data();')) {
  c = c.replace('var cd = cs.docs[0];\n      var cdData = cd.data();',
    'var cd = cs.docs.find(function(d) { return d.data().used === false; });\n      if (!cd) {\n        await sendTelegramMessage(db, chatId, \"Kod notogri. Profil sozlamalarida yangi kod oling.\");\n        return { status: 200, ok: true };\n      }\n      var cdData = cd.data();');
  console.log('OK 5: Added in-memory filter for second query');
} else {
  console.log('FAIL 5: Second query result pattern not found');
}

fs.writeFileSync('api/index.js', c);
