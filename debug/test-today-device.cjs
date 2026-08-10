// 真机抽查：修改口令流程 + 导入弹窗下载列表 + 深色圆点 + 数据完整性
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const css = (el) => (el ? getComputedStyle(el) : null);
  const pass = (p) => { document.getElementById('secPass1').value = p; document.getElementById('secPass2').value = p; };
  const waitMode = async (want, tries = 30) => { for (let i = 0; i < tries; i++) { if (secureMode() === want) return true; await sleep(500); } return false; };

  const countRecords = async () => {
    const v = window.localStorage.getItem('guanji_records_v1');
    if (v) { try { return JSON.parse(v).length; } catch (e) { return -1; } }
    // Preferences 兜底
    try {
      const r = await Capacitor.Plugins.Preferences.get({ key: 'guanji_records_v1' });
      if (r.value) return JSON.parse(r.value).length;
    } catch (e) {}
    return -1;
  };

  const beforeCount = await countRecords();

  // 我的页
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '我的').click();
  await sleep(600);

  // 1) 开启加密（真实 Keystore 路径）
  document.getElementById('secureEnableBtn').click();
  await sleep(400);
  pass('device-test-2026'); document.getElementById('secConfirm').click();
  const encOk = await waitMode('encrypted');
  out.enable = { encOk, dotBg: css(document.querySelector('#secureStatus .sec-dot')) ? css(document.querySelector('#secureStatus .sec-dot')).backgroundColor : null };

  // 2) 修改口令（Keystore 免解锁）
  document.getElementById('secureChangeBtn').click();
  await sleep(400);
  pass('device-test-2026b'); document.getElementById('secConfirm').click();
  await sleep(2500);
  const toast = document.querySelector('.toast');
  out.changePass = { toast: toast ? toast.textContent : null, mode: secureMode() };

  // 3) 深色模式圆点
  document.querySelectorAll('.chip').forEach((c) => { if (c.textContent.trim() === '深色') c.click(); });
  await sleep(700);
  const ddot = document.querySelector('#secureStatus .sec-dot');
  out.darkDot = css(ddot) ? css(ddot).backgroundColor : null;
  document.querySelectorAll('.chip').forEach((c) => { if (c.textContent.trim() === '浅色') c.click(); });
  await sleep(500);

  // 4) 导入弹窗（GuanjiSave 下载列表）
  document.getElementById('secureImportBtn').click();
  await sleep(700);
  const filesBox = document.getElementById('secImportFiles');
  const list = document.getElementById('secImportFileList');
  const chips = list ? Array.from(list.querySelectorAll('button, .chip, .row-btn')).map((b) => b.textContent.trim()) : [];
  out.import = {
    dialogOpen: !document.getElementById('secImportBackdrop').classList.contains('hidden'),
    filesBoxHidden: filesBox ? filesBox.classList.contains('hidden') : null,
    fileChips: chips.slice(0, 5),
    info: document.getElementById('secImportInfo') ? document.getElementById('secImportInfo').textContent : null
  };
  // 关闭导入
  Array.from(document.querySelectorAll('#secImportBackdrop .dialog-actions button')).find((b) => b.textContent.trim() === '取消').click();
  await sleep(400);

  // 5) 关闭加密（顶部大按钮）恢复 + 数据完整
  document.getElementById('secureDisableBtn').click();
  await sleep(400);
  pass('device-test-2026b');
  document.getElementById('secConfirm').click();
  const plainOk = await waitMode('plain');
  const afterCount = await countRecords();
  out.disable = { plainOk, mode: secureMode(), beforeCount, afterCount, countIntact: beforeCount === afterCount };

  return JSON.stringify(out, null, 2);
})()
