// v83 验证：明文导出真实流程（不 patch，直接触发——检查写文件成功 + Share 调用）
(async () => {
  const out = {};
  records = [{ id: 't1', offset: 0, time: '10:00', moods: ['平静'], triggers: ['工作'], duration: 10, media: false, note: '测试' }];
  renderHome();
  document.querySelector('.tab[data-screen="me"]')?.click();
  await new Promise((r) => setTimeout(r, 300));
  document.getElementById('exportBtn').click();
  await new Promise((r) => setTimeout(r, 1000));
  out.clicked = true;
  // Share 挂起属正常（面板等待交互）；检查文件是否已写入 External
  try {
    const stat = await Capacitor.Plugins.Filesystem.stat({ path: 'guanji-export-' + fmtDateKey(new Date()) + '.csv', directory: 'EXTERNAL' });
    out.fileWritten = true;
    out.size = stat.size;
  } catch (e) {
    out.fileErr = String(e && e.message || e);
  }
  return JSON.stringify(out);
})();
