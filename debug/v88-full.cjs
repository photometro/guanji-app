// #104 完整链路：加密导出到 Downloads → 导入列表显示 json
(async () => {
  const out = {};
  // 开启加密
  await secureEnable('v88-test-pass-123');
  out.mode = localStorage.getItem('guanji_sec_mode');
  records = [{ id: 't1', offset: 0, time: '10:00', moods: ['平静'], triggers: ['工作'], duration: 10, media: false, note: 'x' }];
  renderHome();
  // 导出（加密分支 → Downloads）
  document.querySelector('.tab[data-screen="me"]')?.click();
  await new Promise((r) => setTimeout(r, 300));
  document.getElementById('exportBtn').click();
  await new Promise((r) => setTimeout(r, 1500));
  const t = document.querySelector('.toast');
  out.exportToast = t ? t.textContent : null;
  // 打开导入弹窗 → 列表
  document.getElementById('secureImportBtn')?.click();
  await new Promise((r) => setTimeout(r, 800));
  out.filesBoxShown = !document.getElementById('secImportFiles').classList.contains('hidden');
  out.fileChips = [...document.querySelectorAll('#secImportFileList .chip')].map((c) => c.textContent.trim());
  document.getElementById('secImportCancel')?.click();
  // 关闭加密还原
  await secureDisable();
  out.modeAfter = localStorage.getItem('guanji_sec_mode');
  return JSON.stringify(out);
})();
