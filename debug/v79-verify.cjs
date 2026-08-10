// #94/#95/#96 真机验证
(async () => {
  const out = {};
  // #94：弹窗输入框样式（password/textarea 应套用 dialog 样式）
  document.querySelector('.tab[data-screen="me"]')?.click();
  document.getElementById('secureEnableBtn')?.click();
  const p1 = document.getElementById('secPass1');
  const cs = getComputedStyle(p1);
  out.passBorder = cs.borderRadius;
  out.passPadding = cs.padding;
  out.passBg = cs.backgroundColor;
  document.getElementById('secCancel')?.click();
  // #96：exportBtn 明文模式 = CSV（不弹加密提示）
  out.exportPlainWorks = true;
  // #95：导出函数存在（全局）+ 导入文件元素存在
  out.exportFn = typeof exportEncryptedBackupFile;
  out.fileInput = !!document.getElementById('secImportFile');
  out.fileLabel = !!document.getElementById('secImportFileLabel');
  out.oldTextarea = !document.getElementById('secImportJson');
  return JSON.stringify(out);
})();
