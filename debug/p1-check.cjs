// 检查 ui-sheet.js 各拼接段行数与内容完整性
const fs = require('fs');
const s = fs.readFileSync('www/js/ui-sheet.js', 'utf8').split('\n');
console.log('ui-sheet.js 总行数:', s.length);
s.forEach((l, i) => {
  if (/^\/\* -+/.test(l)) console.log((i + 1) + ': ' + l.trim().slice(0, 55));
});
console.log('--- 尾部 6 行 ---');
for (let i = Math.max(0, s.length - 6); i < s.length; i++) console.log((i + 1) + ': ' + s[i]);
