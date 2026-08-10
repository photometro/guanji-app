// 资源版本统一 bump 62 → 64
const fs = require('fs');
const p = 'www/index.html';
let s = fs.readFileSync(p, 'utf8');
const n = s.replace(/\?v=62/g, '?v=64');
fs.writeFileSync(p, n, 'utf8');
console.log('替换数:', (s.match(/\?v=62/g) || []).length);
console.log('剩余 v=62:', (n.match(/\?v=62/g) || []).length, ' v=64:', (n.match(/\?v=64/g) || []).length);
