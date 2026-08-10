// 真机验证：「近 7 天」文案 + 无死文件回归
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const labels = Array.from(document.querySelectorAll('.stat-label')).map((e) => e.textContent.trim());
  const genBtn = document.getElementById('genBtn');
  const ver = (document.querySelector('.about-ver') || {}).textContent;
  // 分析页（自动生成按钮文案）
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '分析').click();
  await sleep(600);
  const genBtn2 = document.getElementById('genBtn');
  return JSON.stringify({
    version: ver,
    labels,
    genBtn: genBtn2 ? genBtn2.textContent.trim() : null,
    hasWeekText: labels.some((l) => l.includes('周')) || (genBtn2 && genBtn2.textContent.includes('周'))
  });
})()
