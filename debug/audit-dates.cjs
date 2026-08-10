// 日期偏移模式全面审计：列出所有 localStorage 键 + 所有日期相关函数 + 存储值类型
const fs = require('fs');
const files = fs.readdirSync('www/js').filter((f) => f.endsWith('.js'));

console.log('===== 1. 所有 localStorage 键（setItem 调用点）=====');
files.forEach((f) => {
  const lines = fs.readFileSync('www/js/' + f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    const m = l.match(/localStorage\.setItem\(\s*['"]([^'"]+)['"]/);
    if (m) console.log(f + ':' + (i + 1) + ' 键=' + m[1] + ' | ' + l.trim().slice(0, 80));
    const m2 = l.match(/localStorage\.getItem\(\s*['"]([^'"]+)['"]/);
    if (m2 && !m) console.log(f + ':' + (i + 1) + ' 读=' + m2[1]);
  });
});

console.log('\n===== 2. 所有 new Date() 与 offset/日期相关 =====');
files.forEach((f) => {
  const lines = fs.readFileSync('www/js/' + f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (/new Date\(/.test(l) && /offset|Date|time|startTime|today|day/.test(l)) {
      console.log(f + ':' + (i + 1) + ' | ' + l.trim().slice(0, 90));
    }
  });
});

console.log('\n===== 3. offset 的读写点（持久化/计算交互）=====');
files.forEach((f) => {
  const lines = fs.readFileSync('www/js/' + f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (/\.offset/.test(l) && /records|r\.offset|\.offset =|offset:/ .test(l)) {
      console.log(f + ':' + (i + 1) + ' | ' + l.trim().slice(0, 90));
    }
  });
});
