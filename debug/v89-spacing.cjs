// 数据卡两种状态间距测量
(async () => {
  const out = {};
  function measure(tag) {
    const card = document.getElementById('secureStatus').closest('.card');
    const els = ['secureStatus', 'secureEnableBtn', 'secureActions', 'secureChangeBtn', 'secureDisableBtn', 'exportBtn', 'secureImportBtn', 'clearBtn', 'restoreBtn'];
    const pos = {};
    els.forEach((id) => {
      const el = card.querySelector('#' + id);
      if (el && !el.closest('.hidden')) {
        const r = el.getBoundingClientRect();
        pos[id] = Math.round(r.top);
      }
    });
    return pos;
  }
  document.querySelector('.tab[data-screen="me"]')?.click();
  await new Promise((r) => setTimeout(r, 300));
  out.plain = measure();
  // 开启加密
  document.getElementById('secureEnableBtn').click();
  document.getElementById('secPass1').value = 'spacing-test-pass-123';
  document.getElementById('secPass2').value = 'spacing-test-pass-123';
  document.getElementById('secConfirm').click();
  await new Promise((r) => setTimeout(r, 4000));
  out.encrypted = measure();
  // 关闭还原
  document.getElementById('secureDisableBtn').click();
  document.getElementById('secPass1').value = 'spacing-test-pass-123';
  document.getElementById('secPass2').value = 'spacing-test-pass-123';
  document.getElementById('secConfirm').click();
  await new Promise((r) => setTimeout(r, 4000));
  out.modeAfter = localStorage.getItem('guanji_sec_mode');
  return JSON.stringify(out);
})();
