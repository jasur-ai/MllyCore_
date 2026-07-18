const fs = require('fs');
let c = fs.readFileSync('api/index.js', 'utf8');

// Fix 1: First query (webhook - /start code)
var oldQ1 = "var codeSnap = await db.collection('telegramCodes').where('code', '==', code).where('used', '==', false).limit(1).get();";
var newQ1 = "var codeSnap = await db.collection('telegramCodes').where('code', '==', code).limit(1).get();";

if (c.includes(oldQ1)) {
  c = c.replace(oldQ1, newQ1);
  console.log('OK 1: Fixed first query');
} else {
  console.log('FAIL 1: First query not found');
}

// Fix 2: Second query (direct code entry)
var oldQ2 = "var cs = await db.collection('telegramCodes').where('code', '==', text).where('used', '==', false).limit(1).get();";
var newQ2 = "var cs = await db.collection('telegramCodes').where('code', '==', text).limit(1).get();";

if (c.includes(oldQ2)) {
  c = c.replace(oldQ2, newQ2);
  console.log('OK 2: Fixed second query');
} else {
  console.log('FAIL 2: Second query not found');
}

// Fix 3: Add in-memory filter after first query result
var oldR1 = "      var codeDoc = codeSnap.docs[0];\n      var codeData = codeDoc.data();\n      var expiresAt";
var newR1 = "      var codeDoc = codeSnap.docs.find(function(d) { return d.data().used === false; });\n      if (!codeDoc) {\n        await sendTelegramMessage(db, chatId, 'Kod notogri yoki muddati otgan. Profil sozlamalarida yangi kod oling.');\n        return { status: 200, ok: true };\n      }\n      var codeData = codeDoc.data();\n      var expiresAt";

if (c.includes(oldR1)) {
  c = c.replace(oldR1, newR1);
  console.log('OK 3: Added in-memory filter for first result');
} else {
  console.log('FAIL 3: First result pattern not found');
  // Debug
  var idx = c.indexOf('codeSnap.docs[0]');
  if (idx >= 0) console.log('Found at', idx, 'ctx:', c.substring(idx, idx + 80));
}

// Fix 4: Add in-memory filter after second query result
var oldR2 = "      var cd = cs.docs[0];\n      var cdData = cd.data();\n      var ea = cdData.expiresAt";
var newR2 = "      var cd = cs.docs.find(function(d) { return d.data().used === false; });\n      if (!cd) {\n        await sendTelegramMessage(db, chatId, 'Kod notogri. Profil sozlamalarida yangi kod oling.');\n        return { status: 200, ok: true };\n      }\n      var cdData = cd.data();\n      var ea = cdData.expiresAt";

if (c.includes(oldR2)) {
  c = c.replace(oldR2, newR2);
  console.log('OK 4: Added in-memory filter for second result');
} else {
  console.log('FAIL 4: Second result pattern not found');
  var idx = c.indexOf('cs.docs[0]');
  if (idx >= 0) console.log('Found at', idx, 'ctx:', c.substring(idx, idx + 80));
}

fs.writeFileSync('api/index.js', c);
console.log('\nDone');
