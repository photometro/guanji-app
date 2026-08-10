// #86 数据问题定位：只读，不改任何数据
(async () => {
  const out = {};
  const now = new Date();
  out.today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} (${now.toLocaleString('zh-CN', { hour12: false })})`;
  // 记录总数 + 最近 10 条（含关键字段）
  out.total = records.length;
  out.recent = records.slice(-10).map((r) => ({
    id: r.id,
    offset: r.offset,
    time: r.time,
    moods: r.moods,
    note: (r.note || '').slice(0, 20),
  }));
  // 用当前基准反推每条记录的绝对日期
  out.recentDates = records.slice(-10).map((r) => {
    const d = dateWithOffset(r.offset);
    return {
      id: r.id,
      offset: r.offset,
      time: r.time,
      absDate: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`,
    };
  });
  // offset 分布（哪些天有多少条）
  const dist = {};
  records.forEach((r) => { dist[r.offset] = (dist[r.offset] || 0) + 1; });
  out.offsetDist = dist;
  // dayDiff 基准逻辑确认
  const todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0);
  const yest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12, 0);
  out.dayDiffTodayToYesterday = dayDiff(todayNoon, yest);
  return JSON.stringify(out);
})();
