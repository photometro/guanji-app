// 验证：加密模式下 exportBtn 调用文件导出分支
(async () => {
  const out = {};
  // 开启加密
  await secureEnable('v79-test-pass-123');
  out.mode = localStorage.getItem('guanji_sec_mode');
  // patch 文件导出函数计数
  let called = 0;
  const orig = window.exportEncryptedBackupFile;
  window.exportEncryptedBackupFile = async () => { called++; return 3; };
  // 点击 exportBtn
  document.getElementById('exportBtn').click();
  await new Promise((r) => setTimeout(r, 300));
  out.fileBranchCalled = called;
  window.exportEncryptedBackupFile = orig;
  // 关闭加密还原
  await secureDisable();
  out.modeAfter = localStorage.getItem('guanji_sec_mode');
  return JSON.stringify(out);
})();
