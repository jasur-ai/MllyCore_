const fs = require('fs');
let c = fs.readFileSync('api/index.js', 'utf8');

// Fix: Add query param check to the public route condition
var oldLine = "  if (_pathname.includes('telegram-webhook') || _pathname.includes('telegram_webhook')) {";
var newLine = "  if (_pathname.includes('telegram-webhook') || _pathname.includes('telegram_webhook') || (req.query && req.query.action === 'telegram-webhook')) {";

if (c.includes(oldLine)) {
  c = c.replace(oldLine, newLine);
  fs.writeFileSync('api/index.js', c);
  console.log('OK: telegram-webhook route condition updated');
} else {
  console.log('FAIL: oldLine not found');
  // Try to find what's actually there
  var idx = c.indexOf('telegram-webhook');
  if (idx >= 0) {
    console.log('Found at position:', idx);
    console.log('Context:', c.substring(idx - 5, idx + 100));
  } else {
    console.log('telegram-webhook not found at all!');
    // Check if the file was modified differently
    var gidx = c.indexOf('_tgDb');
    if (gidx >= 0) {
      console.log('Found _tgDb context:', c.substring(gidx - 80, gidx + 50));
    }
  }
}
