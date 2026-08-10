// 真机验证 #112：深色玻璃 ::before 去光带 + 浅色光带保留
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const html = document.documentElement;
  const css = (el, pseudo) => getComputedStyle(el, pseudo);

  // 我的页（玻璃模式真机当前 off——先开）
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '我的').click();
  await sleep(700);
  if (!html.classList.contains('liquid-glass')) {
    document.getElementById('liquidGlassSwitch').click();
    await sleep(700);
  }
  out.glass = html.classList.contains('liquid-glass');

  // 深色
  document.querySelectorAll('.chip').forEach((c) => { if (c.textContent.trim() === '深色') c.click(); });
  await sleep(700);
  const card = document.querySelector('.card');
  out.dark = {
    theme: html.getAttribute('data-theme'),
    cardBefore: css(card, '::before').backgroundImage.slice(0, 30),
    tabbarBefore: css(document.querySelector('.tabbar'), '::before').backgroundImage.slice(0, 30),
    cardAfterOk: css(card, '::after').backgroundImage.length > 10
  };

  // 浅色回归
  document.querySelectorAll('.chip').forEach((c) => { if (c.textContent.trim() === '浅色') c.click(); });
  await sleep(700);
  out.light = {
    theme: html.getAttribute('data-theme'),
    cardBefore: css(document.querySelector('.card'), '::before').backgroundImage.slice(0, 60)
  };

  // 还原深色（用户原设置 system——保留原状，不额外改动；玻璃还原 off）
  document.querySelectorAll('.chip').forEach((c) => { if (c.textContent.trim() === '跟随系统') c.click(); });
  await sleep(500);
  if (html.classList.contains('liquid-glass')) {
    document.getElementById('liquidGlassSwitch').click();
    await sleep(500);
  }
  out.restored = { glass: html.classList.contains('liquid-glass'), theme: html.getAttribute('data-theme') };
  return JSON.stringify(out, null, 2);
})()
