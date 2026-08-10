// 真机验证 #107/#108/#109：玻璃模式 blur + 文案 + 加密态分割线
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const html = document.documentElement;
  const isGlass = html.classList.contains('liquid-glass');
  const result = { version: (document.querySelector('.about-ver') || {}).textContent, isGlass };

  // #108：设置页文案
  const cardTitles = Array.from(document.querySelectorAll('.card-title')).map((t) => t.textContent);
  result.glassCardTitle = cardTitles.find((t) => t.includes('玻璃')) || null;
  result.liquidMentions = Array.from(document.querySelectorAll('span,p')).filter((e) => e.textContent.includes('液态')).length;

  // #109：打开记录面板（我的 tab 当前非记录页——先回首页点记录）
  // 真机从首页点「记录」打开 sheet
  const homeBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '首页');
  if (homeBtn) homeBtn.click();
  await sleep(600);
  const recordBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '记录' || b.classList.contains('record-btn'));
  if (recordBtn) { recordBtn.click(); await sleep(600); }
  const sheet = document.querySelector('.sheet');
  if (sheet) {
    const cs = getComputedStyle(sheet);
    result.sheetBlur = cs.backdropFilter || cs.webkitBackdropFilter;
    const tabbar = getComputedStyle(document.querySelector('.tabbar'));
    result.tabbarBlur = tabbar.backdropFilter || tabbar.webkitBackdropFilter;
  } else { result.sheetBlur = 'sheet-not-open'; }

  // 关闭面板，回设置页
  const backdrop = document.querySelector('.backdrop:not(.hidden)');
  if (backdrop) backdrop.click();
  await sleep(500);
  const myBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '我的');
  if (myBtn) myBtn.click();
  await sleep(600);

  // #107：若当前明文则开启加密验证分割线，再关闭恢复
  const enableBtn = document.getElementById('secureEnableBtn');
  if (enableBtn && !enableBtn.classList.contains('hidden')) {
    enableBtn.click();
    await sleep(400);
    document.getElementById('secPass1').value = 'v38-verify-pass-2026';
    document.getElementById('secPass2').value = 'v38-verify-pass-2026';
    document.getElementById('secConfirm').click();
    await sleep(2500);
  }
  const row = document.querySelector('#secureActions .row-btn');
  result.changePassBorder = row ? getComputedStyle(row).borderBottom : 'row-missing';
  result.mode = secureMode();
  // 关闭加密恢复原状
  if (secureMode() === 'encrypted') {
    document.getElementById('secureDisableBtn').click();
    await sleep(400);
    document.getElementById('secPass1').value = 'v38-verify-pass-2026';
    document.getElementById('secPass2').value = 'v38-verify-pass-2026';
    document.getElementById('secConfirm').click();
    await sleep(2500);
  }
  result.finalMode = secureMode();
  return JSON.stringify(result);
})()
