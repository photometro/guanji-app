// P1 盘点：styles.css 区块结构
const fs = require('fs');

function inventory(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  console.log('===== ' + file + ' 总行数: ' + lines.length + ' =====');
  lines.forEach((l, i) => {
    const m = l.match(/\/\* =+([^*]*)/);
    if (m && m[1] && m[1].trim()) console.log(i + 1 + ': ' + m[1].trim().slice(0, 58));
  });
}

inventory('www/styles.css');
