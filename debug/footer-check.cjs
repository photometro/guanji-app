// 真机现状：footer 实际间距（不注入数据，用真实数据状态）
(async () => {
  const out = {};
  const ms = document.getElementById('monthSummary');
  const seg = document.getElementById('chartSeg');
  const footer = document.querySelector('.chart-footer');
  if (!ms || !seg) return JSON.stringify({ missing: true });
  out.msText = ms.textContent.trim().replace(/\s+/g, ' ');
  out.msW = Math.round(ms.getBoundingClientRect().width);
  out.segW = Math.round(seg.getBoundingClientRect().width);
  out.footerW = Math.round(footer.getBoundingClientRect().width);
  out.gapBetween = Math.round(seg.getBoundingClientRect().left - ms.getBoundingClientRect().right);
  out.footerGap = getComputedStyle(footer).gap;
  out.msOneLine = Math.round(ms.getBoundingClientRect().height) <= 18;
  // seg 是否被挤压
  out.segShrink = getComputedStyle(seg).flexShrink;
  return JSON.stringify(out);
})();
