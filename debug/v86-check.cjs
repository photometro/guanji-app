// v86 验证：导出触发 + 取消面板（用 keyevent BACK 关闭）→ 检查无「share canceled」toast
(async () => {
  const out = {};
  records = [{ id: 't1', offset: 0, time: '10:00', moods: ['平静'], triggers: ['工作'], duration: 10, media: false, note: 'x' }];
  renderHome();
  document.querySelector('.tab[data-screen="me"]')?.click();
  await new Promise((r) => setTimeout(r, 300));
  document.getElementById('exportBtn').click();
  await new Promise((r) => setTimeout(r, 1200));
  out.panelOpened = !!document.querySelector('.toast');   // 面板打开时无 toast
  // 记录 toast 元素当前内容（应无「share canceled」）
  const t = document.querySelector('.toast');
  out.toastBefore = t ? t.textContent : null;
  return JSON.stringify(out);
})();
