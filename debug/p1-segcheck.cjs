// 各区间独立语法检查，定位未闭合构造所在区间
const fs = require('fs');
const { execSync } = require('child_process');
const orig = fs.readFileSync('debug/p1-backup/app.js', 'utf8').split('\n');

function check(name, lines) {
  fs.writeFileSync('debug/tmp-seg.js', lines.join('\n'));
  try { execSync('node --check debug/tmp-seg.js', { stdio: 'pipe' }); console.log(name + ': OK (' + lines.length + ' 行)'); }
  catch (e) {
    const err = (e.stderr || '').toString();
    const m = err.match(/tmp-seg\.js:(\d+)/);
    console.log(name + ': FAIL 报错行 ' + (m ? m[1] : '?') + '（' + lines.length + ' 行）');
  }
}

check('区间1 [409,491]', orig.slice(408, 491));
check('区间2 [635,768]', orig.slice(634, 768));
check('区间3 [1625,2069]', orig.slice(1624, 2069));
check('区间4 [2253,2405]', orig.slice(2252, 2405));
check('区间3+4 合并 [1625,2405]', orig.slice(1624, 2405));
// 区间4 前半/后半
check('区间4a [2253,2325]', orig.slice(2252, 2325));
check('区间4b [2325,2405]', orig.slice(2324, 2405));
