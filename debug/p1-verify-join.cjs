// 验证：备份原文件区间拼接（无头部）能否通过语法检查
const fs = require('fs');
const { execSync } = require('child_process');
const orig = fs.readFileSync('debug/p1-backup/app.js', 'utf8').split('\n');
const ranges = [[409, 491], [635, 768], [1625, 2069], [2253, 2405]];

const parts = [];
for (const [s, e] of ranges) parts.push(orig.slice(s - 1, e).join('\n'));
fs.writeFileSync('debug/tmp-ranges.js', parts.join('\n\n') + '\n');
try { execSync('node --check debug/tmp-ranges.js', { stdio: 'pipe' }); console.log('区间拼接: OK'); }
catch (e) { console.log('区间拼接: FAIL'); console.log(e.stderr ? e.stderr.toString().split('\n').slice(0, 4).join('\n') : e.message); }

// 备份原文件整体
try { execSync('node --check debug/p1-backup/app.js', { stdio: 'pipe' }); console.log('备份原 app.js: OK'); }
catch (e) { console.log('备份原 app.js: FAIL'); }

// 头部一行 + 区间拼接（模拟 p1-split 输出）
const header = '// 观己 App · ui-sheet（P1 搬移式拆分，2026-08-09——函数原样搬移，零逻辑改动）';
fs.writeFileSync('debug/tmp-withhead.js', header + '\n' + parts.join('\n\n') + '\n');
try { execSync('node --check debug/tmp-withhead.js', { stdio: 'pipe' }); console.log('带头拼接: OK'); }
catch (e) { console.log('带头拼接: FAIL'); }
