// 括号平衡扫描：定位 ui-sheet.js 未闭合位置
const fs = require('fs');
const s = fs.readFileSync('www/js/ui-sheet.js', 'utf8').split('\n');
let depth = 0;
let min = 0;
let minLine = 0;
// 简化：忽略字符串/注释中的括号（逐字符粗略扫描，报告深度异常）
for (let i = 0; i < s.length; i++) {
  const line = s[i];
  // 去掉字符串字面量里的括号（粗略：去引号内容）
  const clean = line.replace(/'(?:[^'\\]|\\.)*'/g, '""').replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const ch of clean) {
    if (ch === '{' || ch === '(' || ch === '[') depth++;
    else if (ch === '}' || ch === ')' || ch === ']') depth--;
  }
  if (depth < min) { min = depth; minLine = i + 1; }
}
console.log('最终深度:', depth, '最小深度:', min, '（负数=某处多闭合）');
// 输出深度突变的行附近
let d2 = 0;
for (let i = 0; i < s.length; i++) {
  const clean = s[i].replace(/'(?:[^'\\]|\\.)*'/g, '""').replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/`(?:[^`\\]|\\.)*`/g, '``').replace(/\/\*[\s\S]*?\*\//g, '');
  let before = d2;
  for (const ch of clean) { if (ch === '{' || ch === '(' || ch === '[') d2++; else if (ch === '}' || ch === ')' || ch === ']') d2--; }
  if (i < 5 || d2 !== before) console.log((i + 1) + ' depth=' + d2 + ': ' + s[i].slice(0, 50));
}
