// 列出 IMPROVEMENTS.md 全部条目标题 + 状态标记
const fs = require('fs');
const L = fs.readFileSync('IMPROVEMENTS.md', 'utf8').split('\n');
L.forEach((l, i) => {
  if (l.startsWith('## ')) console.log((i + 1) + ': ' + l.slice(0, 95));
});
