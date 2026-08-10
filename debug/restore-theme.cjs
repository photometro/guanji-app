(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '我的').click();
  await sleep(600);
  const chips = Array.from(document.querySelectorAll('.chip'));
  const sys = chips.find((c) => c.textContent.trim() === '跟随系统');
  if (sys) sys.click();
  await sleep(500);
  return JSON.stringify({ theme: localStorage.getItem('guanji_theme') });
})()
