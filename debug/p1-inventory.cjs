// P1 盘点：app.js / styles.css 区块结构与函数索引
const fs = require('fs');

function inventory(file, sectionRe, fnRe) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const sections = [];
  lines.forEach((l, i) => {
    const m = l.match(sectionRe);
    if (m && m[1] && m[1].trim()) sections.push([i + 1, m[1].trim().slice(0, 58)]);
  });
  console.log('===== ' + file + ' 总行数: ' + lines.length + ' =====');
  sections.forEach((s) => console.log(s[0] + ': ' + s[1]));
  if (fnRe) {
    console.log('--- 函数/常量索引 ---');
    lines.forEach((l, i) => {
      const m = l.match(fnRe);
      if (m && m[1]) console.log(i + 1 + ': ' + m[1]);
    });
  }
}

inventory('www/app.js', /\/\* -+([^*]*)/, /^function\s+([A-Za-z0-9_]+)|^const\s+([A-Z_][A-Z0-9_]*)\s*=/);
