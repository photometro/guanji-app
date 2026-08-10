// v88 验证：#103 toast 缩短 + #104 导入列表
(async () => {
  const out = {};
  out.cssVer = document.querySelector('link[rel="stylesheet"]') ? document.querySelector('link[rel="stylesheet"]').href.split('v=')[1] : null;
  // #103：明文导出 toast 文案（缩短）
  records = [{ id: 't1', offset: 0, time: '10:00', moods: ['平静'], triggers: ['工作'], duration: 10, media: false, note: 'x' }];
  renderHome();
  document.querySelector('.tab[data-screen="me"]')?.click();
  await new Promise((r) => setTimeout(r, 300));
  document.getElementById('exportBtn').click();
  await new Promise((r) => setTimeout(r, 1500));
  const t = document.querySelector('.toast');
  out.exportToast = t ? t.textContent : null;
  out.toastMaxW = t ? getComputedStyle(t).maxWidth : null;
  out.toastWrap = t ? getComputedStyle(t).whiteSpace : null;
  // #104：导入弹窗打开 → 下载目录备份列表
  document.getElementById('secureImportBtn')?.click();
  await new Promise((r) => setTimeout(r, 800));
  out.filesBoxShown = !document.getElementById('secImportFiles').classList.contains('hidden');
  out.fileChips = [...document.querySelectorAll('#secImportFileList .chip')].map((c) => c.textContent.trim());
  out.browseLabel = document.getElementById('secImportFileLabel').textContent;
  document.getElementById('secImportCancel')?.click();
  return JSON.stringify(out);
})();
