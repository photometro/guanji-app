// footer 极端数据压测
(async () => {
  const out = {};
  // 极端：本月 100+ 次、对比 +500%
  records = [];
  for (let i = 0; i < 100; i++) records.push({ id: 'x' + i, offset: -(i % 30), time: '10:00', moods: ['平静'], triggers: [], duration: 10, media: false, note: '' });
  renderHome();
  const ms = document.getElementById('monthSummary');
  const seg = document.getElementById('chartSeg');
  const msR = ms.getBoundingClientRect(), segR = seg.getBoundingClientRect();
  out.text = ms.textContent.trim().replace(/\s+/g, ' ');
  out.msOverflow = ms.scrollWidth > ms.clientWidth;
  out.gapBetween = Math.round(segR.left - msR.right);
  out.overlap = !(msR.right <= segR.left);
  // 无数据场景
  records = [];
  renderHome();
  out.emptyText = document.getElementById('monthSummary').textContent.trim().replace(/\s+/g, ' ');
  out.emptyOverflow = document.getElementById('monthSummary').scrollWidth > document.getElementById('monthSummary').clientWidth;
  return JSON.stringify(out);
})();
