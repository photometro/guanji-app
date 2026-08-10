// 补验：真机数据完整性——Preferences 中明文记录数（当前已关闭加密回明文）
(async () => {
  const rec = await Capacitor.Plugins.Preferences.get({ key: 'guanji_records' });
  const list = rec.value ? JSON.parse(rec.value) : [];
  const mode = await Capacitor.Plugins.Preferences.get({ key: 'guanji_sec_mode' });
  return JSON.stringify({
    mode: mode.value || null,
    count: Array.isArray(list) ? list.length : -1,
    firstId: Array.isArray(list) && list.length ? list[0].id : null,
    firstDateKey: Array.isArray(list) && list.length ? list[0].dateKey : null
  });
})()
