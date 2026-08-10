// #85 补充测量：非玻璃态两态 + 玻璃态步骤切换高度
(async () => {
  const out = {};
  function measure() {
    const s = document.querySelector('.sheet');
    const r = s.getBoundingClientRect();
    return Math.round(r.height * 10) / 10;
  }
  // 非玻璃态两态
  document.documentElement.classList.remove('liquid-glass');
  openSheet('now');
  out.plainNow = measure();
  closeSheet();
  await new Promise((r) => setTimeout(r, 450));
  openSheet('backfill');
  out.plainBackfill = measure();
  closeSheet();
  await new Promise((r) => setTimeout(r, 450));
  // 玻璃态步骤切换：now 态 步骤1→2
  document.documentElement.classList.add('liquid-glass');
  openSheet('now');
  out.step1 = measure();
  const nextBtn = document.querySelector('.next-btn, #stepNext, [id*="next"], [id*="Next"]');
  out.nextBtnFound = !!nextBtn;
  if (nextBtn) nextBtn.click();
  await new Promise((r) => setTimeout(r, 650));
  out.step2 = measure();
  closeSheet();
  return JSON.stringify(out);
})();
