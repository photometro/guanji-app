// 深度审计：计时存储格式 / 每日提示读取 / 提醒调度 / async-await 模式
const fs = require('fs');
const files = fs.readdirSync('www/js').filter((f) => f.endsWith('.js'));

console.log('===== TIMER_STORE_KEY 相关（计时状态持久化）=====');
fs.readFileSync('www/js/ui-timer.js', 'utf8').split('\n').forEach((l, i) => {
  if (/TIMER_STORE_KEY|timerState\.startTime|setItem|getItem/.test(l)) console.log('ui-timer:' + (i + 1) + ' | ' + l.trim().slice(0, 100));
});

console.log('\n===== guanji_daily_tip 读取/写入逻辑（ai.js 495-525）=====');
const aiLines = fs.readFileSync('www/js/ai.js', 'utf8').split('\n');
for (let i = 494; i < 526 && i < aiLines.length; i++) console.log('ai:' + (i + 1) + ' | ' + aiLines[i].trim().slice(0, 100));

console.log('\n===== 提醒调度（applyReminderSchedule 定义与调用）=====');
files.forEach((f) => {
  const lines = fs.readFileSync('www/js/' + f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (/applyReminderSchedule|setInterval|schedule/.test(l)) console.log(f + ':' + (i + 1) + ' | ' + l.trim().slice(0, 100));
  });
});

console.log('\n===== async 函数中可能的 await 遗漏（调用 async 函数未 await 的位置）=====');
files.forEach((f) => {
  const lines = fs.readFileSync('www/js/' + f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    // 调用 secure/Storage async 方法但行首无 await
    if (/secure(Enable|Disable|Change|Load|Save|Export|Import|GetDEK|OpenEnvelope|BuildEnvelope)\(/.test(l) && !/await /.test(l) && !/function |=>/.test(l)) {
      console.log(f + ':' + (i + 1) + ' | ' + l.trim().slice(0, 110));
    }
  });
});
