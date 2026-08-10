// 真机验证 v3.9：备份管理（列表/删除）+ 明文 CSV 导出→导入闭环 + 口令按需
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const $ = (id) => document.getElementById(id);

  // 我的页
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '我的').click();
  await sleep(700);
  out.version = (document.querySelector('.about-ver') || {}).textContent;

  // === A. 明文态导出 CSV（真机 MediaStore 保存）===
  const beforeExport = (window.localStorage.getItem('guanji_records_v1') || '[]').length;
  $('exportBtn').click();
  await sleep(1200);
  out.exportToast = document.querySelector('.toast') ? document.querySelector('.toast').textContent : null;

  // === B. 导入弹窗：口令框默认隐藏 + 备份列表（应含刚导出的 CSV + 既有备份）===
  $('secureImportBtn').click();
  await sleep(800);
  out.import = {
    passHidden: $('secImportPass').classList.contains('hidden'),
    info: $('secImportInfo').textContent,
    filesBoxHidden: $('secImportFiles').classList.contains('hidden'),
    chips: Array.from($('secImportFileList').querySelectorAll('.chip')).map((c) => c.textContent.trim())
  };
  // 关闭导入
  $('secImportCancel').click();
  await sleep(400);

  // === C. 备份管理：列表 + 类型徽标 ===
  $('bkpManageBtn').click();
  await sleep(800);
  const rows = Array.from($('bkpManageList').querySelectorAll('.bkp-row')).map((row) => row.textContent.trim());
  out.manage = {
    open: !$('bkpManageBackdrop').classList.contains('hidden'),
    rows: rows.slice(0, 6),
    rowCount: rows.length
  };
  // 暂不删除（保留用户文件），关闭
  $('bkpManageClose').click();
  await sleep(400);

  return JSON.stringify(out, null, 2);
})()
