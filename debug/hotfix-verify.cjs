// hotfix 真机验证（v3.6 单文件版）
(async () => {
  const out = {};
  out.hasRecords = typeof records !== 'undefined';
  out.hasNormalize = typeof normalizeOffsets === 'function';
  out.hasDateKeyFn = typeof fmtDateKey === 'function';
  out.ver = document.querySelector('.about-ver') ? document.querySelector('.about-ver').textContent : null;
  out.cssVer = document.querySelector('link[rel="stylesheet"]') ? document.querySelector('link[rel="stylesheet"]').href.split('v=')[1] : null;
  if (typeof records !== 'undefined') {
    out.total = records.length;
    out.records = records.map((r) => ({ id: r.id, offset: r.offset, time: r.time, dateKey: r.dateKey }));
  }
  return JSON.stringify(out);
})();
