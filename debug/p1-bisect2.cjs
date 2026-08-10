// 二分定位 ui-sheet.js 语法断点（v2：递归找最小失败区间）
const fs = require('fs');
const { execSync } = require('child_process');
const s = fs.readFileSync('www/js/ui-sheet.js', 'utf8').split('\n');

function checkSlice(start, end) {
  const tmp = 'debug/tmp-slice.js';
  fs.writeFileSync(tmp, s.slice(start, end).join('\n'));
  try { execSync('node --check ' + tmp, { stdio: 'pipe' }); return true; }
  catch (e) { return false; }
}

function find(start, end, label) {
  if (end - start <= 8) {
    console.log(label + ' 最小失败区间: 行 ' + (start + 1) + '-' + end);
    for (let i = start; i < end; i++) console.log('  ' + (i + 1) + ': ' + s[i].slice(0, 80));
    return;
  }
  const mid = Math.floor((start + end) / 2);
  const leftOk = checkSlice(start, mid);
  const rightOk = checkSlice(mid, end);
  if (!leftOk) find(start, mid, label + 'L');
  else if (!rightOk) find(mid, end, label + 'R');
  else console.log(label + ': 未知（两半都 OK？）');
}

find(0, 410, 'A');
