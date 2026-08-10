// 查看 IMPROVEMENTS.md 尾部 + 记录区最新行
const fs = require('fs');
const L = fs.readFileSync('IMPROVEMENTS.md', 'utf8').split('\n');
console.log('总行数:', L.length);
for (let i = L.length - 1; i >= 0; i--) {
  if (L[i].trim()) { console.log('最后内容行 ' + (i + 1) + ': ' + L[i].slice(0, 90)); break; }
}
// 记录区（2026-08-09 开头）最新行
for (let i = 0; i < L.length; i++) {
  if (L[i].startsWith('- 2026-08-09')) { console.log('记录区首行 ' + (i + 1) + ': ' + L[i].slice(0, 60)); break; }
}
