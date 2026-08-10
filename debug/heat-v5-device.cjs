// 热力图固定行数真机验证
(async () => {
  const out = {};
  out.cssVer = document.querySelector('link[rel="stylesheet"]') ? document.querySelector('link[rel="stylesheet"]').href.split('v=')[1] : null;
  records = buildDemoRecords();
  renderHome();
  document.querySelector('#chartViewSeg .seg[data-view="heat"]')?.click();
  document.querySelector('#chartSeg .seg[data-days="14"]')?.click();
  await new Promise((r) => setTimeout(r, 300));
  out.d14rows = getComputedStyle(document.querySelector('.heat-grid')).gridTemplateRows.split(' ').length;
  out.d14cells = document.querySelectorAll('.heat-grid .heat-cell').length;
  out.noHead = !document.querySelector('.heat-head');
  document.querySelector('#chartSeg .seg[data-days="30"]')?.click();
  await new Promise((r) => setTimeout(r, 300));
  out.d30rows = getComputedStyle(document.querySelector('.heat-grid')).gridTemplateRows.split(' ').length;
  out.d30cells = document.querySelectorAll('.heat-grid .heat-cell').length;
  return JSON.stringify(out);
})();
