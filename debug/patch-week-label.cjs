// v3.8 内补丁：「本周」→「近 7 天」口径文案 + 删除 P1 拆分残留死文件 + 资源 bump 91
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/43124/Desktop/test/guanji-app/www';
const idx = path.join(ROOT, 'index.html');
const ai = path.join(ROOT, 'js/ai.js');

// 1) index.html 文案
let t = fs.readFileSync(idx, 'utf8');
t = t.replace('>本周次数<', '>近 7 天<');
t = t.replace('>较上周<', '>较上 7 天<');
t = t.replace('>生成本周分析<', '>生成近 7 天分析<');
t = t.replace(/\?v=90/g, '?v=91');
fs.writeFileSync(idx, t, 'utf8');

// 2) ai.js 文案（用户可见标签 + 提示词）
let a = fs.readFileSync(ai, 'utf8');
const reps = [
  ['呼应本周数据', '呼应近 7 天数据'],
  ['本周记录数', '近 7 天记录数'],
  ['本周时段分布', '近 7 天时段分布'],
  ['本周诱因分布', '近 7 天诱因分布'],
  ['本周情绪分布', '近 7 天情绪分布'],
  ['本周含看片的记录占比', '近 7 天含看片的记录占比'],
  ['>本周概览<', '>近 7 天概览<'],
  ['生成本周分析', '生成近 7 天分析'],
  ['本周手淫习惯', '近 7 天记录习惯'],
  ['要求本周', '要求近 7 天']
];
let repCount = 0;
for (const [from, to] of reps) {
  const n = a.split(from).length - 1;
  if (n > 0) { a = a.split(from).join(to); repCount += n; }
}
fs.writeFileSync(ai, a, 'utf8');

// 3) 删除死文件
let removed = [];
for (const f of ['app.js', 'styles.css']) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) { fs.unlinkSync(p); removed.push(f); }
}

// 4) 校验
const t2 = fs.readFileSync(idx, 'utf8');
const a2 = fs.readFileSync(ai, 'utf8');
console.log(JSON.stringify({
  indexWeek: /本周/.test(t2) ? 'still-has-本周' : 'clean',
  indexNear7: t2.includes('近 7 天'),
  indexYesterday: t2.includes('较上 7 天'),
  aiReplaced: repCount,
  aiWeekLeft: (a2.match(/本周/g) || []).length,
  removed,
  v91: (t2.match(/\?v=91/g) || []).length
}, null, 2));
