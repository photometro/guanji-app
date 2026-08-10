// 趋势卡 footer 冲突定位：真实布局测量（重叠/溢出/间距）
(async () => {
  const out = {};
  // 先造真实感数据（演示数据 + 长百分比）
  records = buildDemoRecords();
  renderHome();
  const ms = document.getElementById('monthSummary');
  const seg = document.getElementById('chartSeg');
  const footer = document.querySelector('.chart-footer');
  const card = footer.closest('.card');
  const r = (el) => { const b = el.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height) }; };
  out.msText = ms.textContent.trim().replace(/\s+/g, ' ');
  out.ms = r(ms);
  out.seg = r(seg);
  out.footer = r(footer);
  out.card = r(card);
  out.gapBetween = Math.round(seg.getBoundingClientRect().left - ms.getBoundingClientRect().right);
  // 重叠检测
  const msR = ms.getBoundingClientRect(), segR = seg.getBoundingClientRect();
  out.overlap = !(msR.right <= segR.left || segR.right <= msR.left || msR.bottom <= segR.top || segR.bottom <= msR.top);
  // 溢出检测
  out.msOverflow = ms.scrollWidth > ms.clientWidth;
  out.segOverflow = seg.scrollWidth > seg.clientWidth;
  // footer 子元素清单
  out.footerChildren = [...footer.children].map((c) => c.id || c.className);
  // 视口
  out.viewport = window.innerWidth + 'x' + window.innerHeight;
  return JSON.stringify(out);
})();
