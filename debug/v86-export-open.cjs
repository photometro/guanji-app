// 实测导出流程：触发导出 → 检查面板选项（不 await 让面板停留）
(async () => {
  const out = {};
  records = [{ id: 't1', offset: 0, time: '10:00', moods: ['平静'], triggers: ['工作'], duration: 10, media: false, note: 'x' }];
  renderHome();
  document.querySelector('.tab[data-screen="me"]')?.click();
  await new Promise((r) => setTimeout(r, 300));
  document.getElementById('exportBtn').click();
  await new Promise((r) => setTimeout(r, 1200));
  out.clicked = true;
  return JSON.stringify(out);
})();
