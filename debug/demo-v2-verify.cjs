// 演示数据 v2 覆盖验证
(async () => {
  const out = {};
  records = buildDemoRecords();
  // 1. 热力图色阶覆盖（按每日次数分档）
  const dayCounts = {};
  records.forEach((r) => { dayCounts[r.offset] = (dayCounts[r.offset] || 0) + 1; });
  const levels = { 0: 0, 1: 0, 2: 0, 3: 0 };
  Object.values(dayCounts).forEach((c) => { const lv = c <= 0 ? 0 : c <= 2 ? 1 : c <= 5 ? 2 : 3; levels[lv]++; });
  out.levels = levels;
  // 2. 窗口覆盖
  out.minOff = Math.min(...records.map((r) => r.offset));
  out.maxOff = Math.max(...records.map((r) => r.offset));
  out.total = records.length;
  // 3. 最近 7 天连续
  out.streak7 = [-6, -5, -4, -3, -2, -1, 0].every((off) => (dayCounts[off] || 0) > 0);
  // 4. 时段分布覆盖
  const slots = {};
  records.forEach((r) => {
    const h = parseInt(r.time.split(':')[0], 10);
    const k = h >= 6 && h < 9 ? '清晨' : h >= 9 && h < 12 ? '上午' : h >= 12 && h < 18 ? '下午' : h >= 18 && h < 22 ? '傍晚' : '深夜';
    slots[k] = (slots[k] || 0) + 1;
  });
  out.slots = slots;
  // 5. 备注/看片
  out.withNote = records.filter((r) => r.note).length;
  out.withMedia = records.filter((r) => r.media).length;
  // 6. 触发词/情绪覆盖
  out.triggers = [...new Set(records.map((r) => r.triggers[0]))];
  out.moods = [...new Set(records.map((r) => r.moods[0]))];
  // 7. 渲染
  renderHome();
  out.msText = document.getElementById('monthSummary').textContent.trim().replace(/\s+/g, ' ');
  return JSON.stringify(out);
})();
