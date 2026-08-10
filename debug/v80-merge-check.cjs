// 数据卡合并真机验证
(async () => {
  const out = {};
  out.cssVer = document.querySelector('link[rel="stylesheet"]') ? document.querySelector('link[rel="stylesheet"]').href.split('v=')[1] : null;
  document.querySelector('.tab[data-screen="me"]')?.click();
  await new Promise((r) => setTimeout(r, 300));
  // 结构：单卡内三区块
  const card = document.getElementById('secureStatus').closest('.card');
  out.cardTitle = card.querySelector('.card-title').textContent;
  out.buttons = [...card.querySelectorAll('button')].map((b) => b.id || b.textContent.trim().slice(0, 6));
  out.dividers = card.querySelectorAll('.card-section-divider').length;
  out.hasExport = !!card.querySelector('#exportBtn');
  out.hasClear = !!card.querySelector('#clearBtn');
  out.hasRestore = !!card.querySelector('#restoreBtn');
  out.hasEnable = !!card.querySelector('#secureEnableBtn');
  out.secureExportGone = !card.querySelector('#secureExportBtn');
  // 开启加密后 actions 显隐
  document.getElementById('secureEnableBtn').click();
  document.getElementById('secPass1').value = 'merge-test-pass-123';
  document.getElementById('secPass2').value = 'merge-test-pass-123';
  document.getElementById('secConfirm').click();
  await new Promise((r) => setTimeout(r, 4000));
  out.actionsShown = !document.getElementById('secureActions').classList.contains('hidden');
  out.status = document.getElementById('secureStatus').textContent.slice(0, 20);
  // 关闭加密还原
  document.getElementById('secureDisableBtn').click();
  document.getElementById('secPass1').value = 'merge-test-pass-123';
  document.getElementById('secPass2').value = 'merge-test-pass-123';
  document.getElementById('secConfirm').click();
  await new Promise((r) => setTimeout(r, 4000));
  out.modeAfter = localStorage.getItem('guanji_sec_mode');
  return JSON.stringify(out);
})();
