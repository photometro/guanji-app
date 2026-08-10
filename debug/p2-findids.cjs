// 查找弹窗与计时页的 DOM id
const fs = require('fs');
const idx = fs.readFileSync('www/index.html', 'utf8').split('\n');
idx.forEach((l, i) => {
  const m = l.match(/id="([^"]+)"/g);
  if (m && m.some((x) => /dialog|timer|sheet|screen/i.test(x))) console.log((i + 1) + ': ' + m.join(' '));
});
console.log('=== ui-sheet 弹窗引用 ===');
const sheet = fs.readFileSync('www/js/ui-sheet.js', 'utf8').split('\n');
sheet.forEach((l, i) => {
  if (/Dialog|dialog/.test(l) && /\$\(/.test(l)) console.log((i + 1) + ': ' + l.trim().slice(0, 70));
});
console.log('=== ui-timer 页面类 ===');
const timer = fs.readFileSync('www/js/ui-timer.js', 'utf8').split('\n');
timer.forEach((l, i) => {
  if (/timerScreen|timer-screen/.test(l)) console.log((i + 1) + ': ' + l.trim().slice(0, 70));
});
