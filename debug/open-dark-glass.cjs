// 真机深色玻璃截图准备：开玻璃 + 深色 + 首页
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const html = document.documentElement;
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '我的').click();
  await sleep(700);
  if (!html.classList.contains('liquid-glass')) { document.getElementById('liquidGlassSwitch').click(); await sleep(700); }
  document.querySelectorAll('.chip').forEach((c) => { if (c.textContent.trim() === '深色') c.click(); });
  await sleep(700);
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '首页').click();
  await sleep(800);
  return JSON.stringify({ glass: html.classList.contains('liquid-glass'), theme: html.getAttribute('data-theme') });
})()
