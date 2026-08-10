// v81 数据卡布局验证：备份区块两按钮 + divider 对称 + 明文导出文件分支
(async () => {
  const out = {};
  document.querySelector('.tab[data-screen="me"]')?.click();
  await new Promise((r) => setTimeout(r, 300));
  const card = document.getElementById('secureStatus').closest('.card');
  // 备份区块：exportBtn 与 secureImportBtn 相邻（中间无 divider）
  const exportBtn = card.querySelector('#exportBtn');
  const importBtn = card.querySelector('#secureImportBtn');
  const clearBtn = card.querySelector('#clearBtn');
  const exportR = exportBtn.getBoundingClientRect();
  const importR = importBtn.getBoundingClientRect();
  const clearR = clearBtn.getBoundingClientRect();
  // divider 数量与位置（应在 export 上方一条、import 下方一条）
  const dividers = [...card.querySelectorAll('.card-section-divider')].map((d) => Math.round(d.getBoundingClientRect().top));
  out.dividers = dividers;
  out.exportTop = Math.round(exportR.top);
  out.importBottom = Math.round(importR.bottom);
  out.clearTop = Math.round(clearR.top);
  out.between = {
    exportToImportGap: Math.round(importR.top - exportR.bottom),   // 两按钮间距（无 divider 应 < 20）
    importToClearGap: Math.round(clearR.top - importR.bottom),     // import 与危险区之间有 divider
  };
  // 明文导出走文件分支（patch）
  let fileBranch = 0;
  const origWrite = window.Capacitor && Capacitor.Plugins.Filesystem ? Capacitor.Plugins.Filesystem.writeFile : null;
  if (origWrite) {
    Capacitor.Plugins.Filesystem.writeFile = async (o) => { fileBranch++; return { uri: 'file://test/' + o.path }; };
  }
  records = [{ id: 't1', offset: 0, time: '10:00', moods: ['平静'], triggers: ['工作'], duration: 10, media: false, note: '' }];
  document.getElementById('exportBtn').click();
  await new Promise((r) => setTimeout(r, 500));
  out.plainFileBranch = fileBranch;
  if (origWrite) Capacitor.Plugins.Filesystem.writeFile = origWrite;
  return JSON.stringify(out);
})();
