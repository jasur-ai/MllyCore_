const fs = require('fs');
let c = fs.readFileSync('admin.html', 'utf8');

// Fix the first Promise.all in admin.html (unprotected)
var oldStr = '    if (!user) return;\n\n      const [users, teams] = await Promise.all([\n        MllyCore.getCollection(\'users\'),\n        MllyCore.getCollection(\'teams\')\n      ]);\n\n      // Faqat bir marta, barcha ma\'lumotlar';
var newStr = '    if (!user) return;\n\n      let users = [], teams = [];\n      try {\n        const _r = await Promise.all([\n          MllyCore.getCollection(\'users\'),\n          MllyCore.getCollection(\'teams\')\n        ]);\n        users = _r[0] || [];\n        teams = _r[1] || [];\n      } catch (_) { console.warn(\'Admin ma\\\'lumotlarini yuklashda xatolik\'); }\n\n      // Faqat bir marta, barcha ma\'lumotlar';

if (c.includes(oldStr)) {
  c = c.replace(oldStr, newStr);
  fs.writeFileSync('admin.html', c);
  console.log('OK: Admin Promise.all wrapped in try/catch');
} else {
  console.log('FAIL: Pattern not found');
  // Debug
  var idx = c.indexOf('const [users, teams] = await Promise.all([');
  if (idx >= 0) console.log('Found at', idx, 'context:', JSON.stringify(c.substring(idx-40, idx+160)));
}
