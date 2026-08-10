// 收尾：还原玻璃开关为 off（用户原状）
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const html = document.documentElement;
  // 确保在我的页
  const myBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '我的');
  if (myBtn) myBtn.click();
  await sleep(500);
  if (html.classList.contains('liquid-glass')) {
    const sw = document.getElementById('liquidGlassSwitch');
    if (sw) { sw.click(); await sleep(600); }
  }
  return JSON.stringify({
    liquidGlass: localStorage.getItem('guanji_liquid_glass'),
    htmlGlass: html.classList.contains('liquid-glass'),
    mode: secureMode()
  });
})()
