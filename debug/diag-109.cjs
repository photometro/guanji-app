// 诊断：玻璃态下 .sheet blur 为什么没生效——检查加载的 glass.css 规则
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const html = document.documentElement;
  const before = localStorage.getItem('guanji_liquid_glass');

  // 确保玻璃模式开
  const myBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '我的');
  if (myBtn) myBtn.click();
  await sleep(500);
  const switchEl = document.getElementById('liquidGlassSwitch');
  if (switchEl && !html.classList.contains('liquid-glass')) { switchEl.click(); await sleep(700); }

  // 找 glass.css 里的 .sheet 规则
  const rules = [];
  for (const ss of document.styleSheets) {
    let href = '';
    try { href = ss.href || 'inline'; } catch (e) { href = 'err'; }
    if (!href.includes('glass')) continue;
    try {
      for (const r of ss.cssRules) {
        if (r.selectorText && r.selectorText.includes('.sheet')) {
          rules.push({ sel: r.selectorText, blur: r.style.backdropFilter || r.style.webkitBackdropFilter });
        }
      }
    } catch (e) { rules.push({ sel: 'unreadable', err: String(e) }); }
  }

  // 打开记录面板再测
  const homeBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '首页');
  if (homeBtn) homeBtn.click();
  await sleep(600);
  const recordBtn = Array.from(document.querySelectorAll('button')).find((b) => b.classList.contains('record-btn') || b.textContent.trim() === '记录');
  let openedWhat = 'none';
  if (recordBtn) { recordBtn.click(); await sleep(700); openedWhat = recordBtn.className || recordBtn.textContent.trim(); }
  const sheet = document.querySelector('.sheet');
  const cs = sheet ? getComputedStyle(sheet) : null;

  return JSON.stringify({
    htmlClass: html.className.slice(0, 80),
    glassRules: rules,
    openedWhat,
    sheetExists: !!sheet,
    sheetBlur: cs ? (cs.backdropFilter || cs.webkitBackdropFilter) : null,
    sheetHidden: sheet ? sheet.classList.contains('hidden') || getComputedStyle(sheet).display === 'none' : null
  });
})()
