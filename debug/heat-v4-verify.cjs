// 热力图 v4 真机验证（7 列布局 + footer 间距 + 30 天）
(async () => {
  const out = {};
  records = buildDemoRecords();
  renderHome();
  document.querySelector('#chartViewSeg .seg[data-view="heat"]')?.click();
  await new Promise((r) => setTimeout(r, 300));
  const grid = document.querySelector('.heat-grid');
  const chart = document.getElementById('areaChart');
  out.head7 = [...document.querySelectorAll('.heat-head span')].length === 7;
  out.fillPct = Math.round((grid.getBoundingClientRect().width / chart.getBoundingClientRect().width) * 100);
  out.cell = Math.round(document.querySelector('.heat-grid .heat-cell:not(.heat-empty)').getBoundingClientRect().width);
  out.gap = Math.round(document.getElementById('chartSeg').getBoundingClientRect().left - document.getElementById('monthSummary').getBoundingClientRect().right);
  // 30 天
  document.querySelector('#chartSeg .seg[data-days="30"]')?.click();
  await new Promise((r) => setTimeout(r, 300));
  out.fill30 = document.querySelectorAll('.heat-grid .heat-cell:not(.heat-empty)').length;
  out.empty30 = document.querySelectorAll('.heat-empty').length;
  return JSON.stringify(out);
})();
