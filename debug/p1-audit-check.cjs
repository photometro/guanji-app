// 验证 #42 去重
const fs = require('fs');
const L = fs.readFileSync('IMPROVEMENTS.md', 'utf8').split('\n');
const hits = L.map((l, i) => ({ i, l })).filter((x) => x.l.startsWith('## 42.'));
console.log('#42 条目数:', hits.length);
hits.forEach((h) => console.log((h.i + 1) + ': ' + h.l.slice(0, 85)));
// 总条数
console.log('总条目数:', L.filter((l) => l.startsWith('## ')).length);
