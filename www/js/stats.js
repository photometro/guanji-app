// 观己 App · stats（P1 搬移式拆分，2026-08-09——函数原样搬移，零逻辑改动）
/* ---------- 统计工具 ---------- */

function dateWithOffset(off) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + off);
  return d;
}

function countRange(a, b) {
  return records.filter((r) => r.offset >= a && r.offset <= b).length;
}

function hourOf(r) { return parseInt(r.time.split(':')[0], 10); }

function countStreak() {
  let s = 0;
  for (let off = 0; ; off--) {
    if (off === 0) { if (countRange(0, 0) > 0) { s++; continue; } continue; }
    if (countRange(off, off) > 0) s++;
    else break;
  }
  return s;
}

function fmtDateShort(off) {
  const d = dateWithOffset(off);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

