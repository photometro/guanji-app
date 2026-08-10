// 打开玻璃模式 + 记录面板（供截图，随后脚本负责还原）
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const html = document.documentElement;
  const myBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '我的');
  if (myBtn) myBtn.click();
  await sleep(500);
  const sw = document.getElementById('liquidGlassSwitch');
  if (sw && !html.classList.contains('liquid-glass')) { sw.click(); await sleep(700); }
  const homeBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '首页');
  if (homeBtn) homeBtn.click();
  await sleep(600);
  const recordBtn = Array.from(document.querySelectorAll('button')).find((b) => b.classList.contains('record-btn'));
  if (recordBtn) { recordBtn.click(); await sleep(700); }
  const sheet = document.querySelector('.sheet');
  return JSON.stringify({
    htmlGlass: html.classList.contains('liquid-glass'),
    sheetBlur: sheet ? (getComputedStyle(sheet).backdropFilter || getComputedStyle(sheet).webkitBackdropFilter) : null
  });
})()
