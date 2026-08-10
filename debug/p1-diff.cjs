// 对比 ui-sheet.js 与备份原文件对应区间是否完全一致
const fs = require('fs');
const orig = fs.readFileSync('debug/p1-backup/app.js', 'utf8').split('\n');
const sheet = fs.readFileSync('www/js/ui-sheet.js', 'utf8').split('\n');
// 去掉 ui-sheet 头部生成注释（第 1 行）
const sheetBody = sheet.slice(1);
const ranges = [[409, 491], [635, 768], [1625, 2069], [2253, 2405]];
let expected = [];
for (const [s, e] of ranges) {
  expected.push(...orig.slice(s - 1, e));
}
// 比较（忽略 join 引入的空行差异：比较「非空行序列」）
const norm = (arr) => arr.filter((l) => l.trim() !== '');
const a = norm(sheetBody);
const b = norm(expected);
console.log('ui-sheet 非空行:', a.length, ' 期望非空行:', b.length);
let diffCount = 0;
for (let i = 0; i < Math.max(a.length, b.length); i++) {
  if (a[i] !== b[i]) {
    diffCount++;
    if (diffCount <= 10) console.log('差异@' + i + ':\n  实际: ' + (a[i] || '<缺>').slice(0, 90) + '\n  期望: ' + (b[i] || '<缺>').slice(0, 90));
  }
}
console.log('总差异行数:', diffCount);
// 也检查原始序列（含空行）在区间拼接处的连续性
console.log('--- 检查区间边界空行 ---');
const segStarts = [409, 635, 1625, 2253];
for (const s of segStarts) {
  console.log('原 ' + s + ' 行: ' + JSON.stringify(orig[s - 1].slice(0, 60)));
}
