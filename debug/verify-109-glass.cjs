// 真机补验 #109：开启玻璃模式 → 记录面板 blur → 还原玻璃开关
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const before = localStorage.getItem('guanji_liquid_glass');
  const html = document.documentElement;

  // 打开玻璃模式（设置页开关；当前在我的页）
  const switchEl = document.getElementById('liquidGlassSwitch');
  if (switchEl) { switchEl.click(); await sleep(600); }
  const isGlass = html.classList.contains('liquid-glass');

  // 回首页打开记录面板
  const homeBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '首页');
  if (homeBtn) homeBtn.click();
  await sleep(600);
  const recordBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '记录' || b.classList.contains('record-btn'));
  if (recordBtn) { recordBtn.click(); await sleep(600); }
  const sheet = document.querySelector('.sheet');
  const cs = sheet ? getComputedStyle(sheet) : null;
  const tabbar = getComputedStyle(document.querySelector('.tabbar'));

  // 关闭面板 + 还原玻璃开关
  const backdrop = document.querySelector('.backdrop:not(.hidden)');
  if (backdrop) backdrop.click();
  await sleep(500);
  const myBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '我的');
  if (myBtn) myBtn.click();
  await sleep(600);
  const switchAgain = document.getElementById('liquidGlassSwitch');
  if (switchAgain && html.classList.contains('liquid-glass')) { switchAgain.click(); await sleep(500); }

  return JSON.stringify({
    before: before,
    isGlass: isGlass,
    sheetBlur: cs ? (cs.backdropFilter || cs.webkitBackdropFilter) : 'sheet-not-open',
    tabbarBlur: tabbar.backdropFilter || tabbar.webkitBackdropFilter,
    restored: localStorage.getItem('guanji_liquid_glass'),
    htmlGlassRestored: !html.classList.contains('liquid-glass')
  });
})()
