// 二分定位 ui-sheet.js 语法断点
const fs = require('fs');
const { execSync } = require('child_process');
const s = fs.readFileSync('www/js/ui-sheet.js', 'utf8').split('\n');

function checkSlice(start, end) {
  const tmp = 'debug/tmp-slice.js';
  fs.writeFileSync(tmp, s.slice(start, end).join('\n'));
  try { execSync('node --check ' + tmp, { stdio: 'pipe' }); return true; }
  catch (e) { return false; }
}

// 大二分：先试前半/后半
const mid = Math.floor(s.length / 2);
console.log('总行数:', s.length, '中位:', mid);
console.log('前半(0-mid):', checkSlice(0, mid) ? 'OK' : 'FAIL');
console.log('后半(mid-end):', checkSlice(mid, s.length) ? 'OK' : 'FAIL');
