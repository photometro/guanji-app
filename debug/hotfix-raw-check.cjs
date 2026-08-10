// 检查 app.js 加载状态 + 原始数据 + 内存验证修复逻辑（不改任何数据）
(async () => {
  const out = {};
  out.scripts = [...document.scripts].map((s) => s.src.split('/').pop());
  // 原始数据（未被 normalize 修改——app.js 若没跑，数据还是旧的）
  const raw = localStorage.getItem('guanji_records_v1');
  out.rawExists = raw !== null;
  if (raw) {
    try {
      const list = JSON.parse(raw);
      out.rawCount = Array.isArray(list) ? list.length : 'NOT-ARRAY';
      if (Array.isArray(list)) {
        out.rawRecords = list.map((r) => ({ id: r.id, offset: r.offset, time: r.time, hasDateKey: !!r.dateKey }));
      }
    } catch (e) { out.rawParseErr = String(e); }
  }
  // 内存验证修复逻辑（用原始数据 + 手写 dayDiff/fmtDateKey 等价实现——不改数据）
  const DAY = 864e5;
  function dayDiffLocal(a, b) {
    const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((da - db) / DAY);
  }
  function fmtKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (raw) {
    const list = JSON.parse(raw);
    const today = new Date();
    out.recovered = list.map((r) => {
      const ts = parseInt(String(r.id).split('_')[1], 36);
      const d = new Date(ts);
      return {
        id: r.id.slice(0, 14),
        time: r.time,
        recoveredDate: isNaN(d.getTime()) ? null : fmtKey(d),
        newOffset: isNaN(d.getTime()) ? null : dayDiffLocal(d, today),
        oldOffset: r.offset,
      };
    });
  }
  return JSON.stringify(out);
})();
