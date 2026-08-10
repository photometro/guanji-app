// 定位次数趋势卡片结构
const fs = require('fs');
const idx = fs.readFileSync('www/index.html', 'utf8').split('\n');
const home = fs.readFileSync('www/js/ui-home.js', 'utf8').split('\n');
console.log('=== index.html 趋势相关 ===');
idx.forEach((l, i) => {
  if (/趋势|chart|range|14|30|trend|seg/.test(l) && i < 400) console.log((i + 1) + ': ' + l.trim().slice(0, 100));
});
console.log('=== ui-home.js 函数 ===');
home.forEach((l, i) => {
  if (/^function |render|chart|range|seg/.test(l) && i < 300) console.log((i + 1) + ': ' + l.trim().slice(0, 80));
});
