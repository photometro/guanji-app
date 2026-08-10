// v84 验证：分割线移除 + 列表线自然分隔
(async () => {
  const out = {};
  document.querySelector('.tab[data-screen="me"]')?.click();
  await new Promise((r) => setTimeout(r, 300));
  const card = document.getElementById('secureStatus').closest('.card');
  out.dividers = card.querySelectorAll('.card-section-divider').length;
  const btns = [...card.querySelectorAll('button')];
  out.btnCount = btns.length;
  // row-btn 列表线检查（导出/导入/清除应有 border-bottom，恢复（最后）应无）
  const btnBorder = (id) => {
    const el = card.querySelector('#' + id);
    return el ? getComputedStyle(el).borderBottomWidth : 'missing';
  };
  out.exportBorder = btnBorder('exportBtn');
  out.importBorder = btnBorder('secureImportBtn');
  out.clearBorder = btnBorder('clearBtn');
  out.restoreBorder = btnBorder('restoreBtn');
  out.changeBorder = btnBorder('secureChangeBtn');
  return JSON.stringify(out);
})();
