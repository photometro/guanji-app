// P0 真机验证：清理损坏数据 + 修复后迁移保真
(async () => {
  const out = {};
  // 1. 清理损坏的 {} 数据（若存在）
  const plainRaw = localStorage.getItem('guanji_records_v1');
  if (plainRaw) {
    try { const p = JSON.parse(plainRaw); if (!Array.isArray(p)) { localStorage.setItem('guanji_records_v1', '[]'); out.cleaned = true; } } catch (e) { localStorage.setItem('guanji_records_v1', '[]'); out.cleaned = 'parse-err'; }
  }
  // 2. 注入 2 条记录 → 开启加密 → 保真 → 关闭
  records = [];
  records.push({ id: 'd1', offset: 0, time: '10:00', duration: 12, moods: ['平静'], triggers: ['工作'], media: false, note: '真机保真1' });
  records.push({ id: 'd2', offset: -1, time: '23:00', duration: 30, moods: ['放松'], triggers: ['看了片'], media: true, note: '真机保真2' });
  Storage.saveRecords(records);
  await new Promise((r) => setTimeout(r, 400));
  out.before = records.length;
  await secureEnable('device-p0-pass-123');
  const loaded = await Storage.loadRecords();
  out.afterEncrypt = loaded.length;
  out.note1 = loaded.find((r) => r.id === 'd1')?.note;
  await secureDisable();
  const plain = JSON.parse(localStorage.getItem('guanji_records_v1'));
  out.afterDisable = plain.length;
  out.isArray = Array.isArray(plain);
  return JSON.stringify(out);
})();
