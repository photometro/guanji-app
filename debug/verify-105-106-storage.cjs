// 盘点真机存储：localStorage 键 + Preferences 键
(async () => {
  const lsKeys = Object.keys(window.localStorage);
  const prefs = await Capacitor.Plugins.Preferences.keys();
  const prefInfo = {};
  for (const k of (prefs.keys || [])) {
    const v = await Capacitor.Plugins.Preferences.get({ key: k });
    const s = String(v.value || '');
    prefInfo[k] = s.length > 80 ? s.slice(0, 80) + '…(' + s.length + ')' : s;
  }
  const lsInfo = {};
  for (const k of lsKeys) {
    const s = String(window.localStorage.getItem(k) || '');
    lsInfo[k] = s.length > 80 ? s.slice(0, 80) + '…(' + s.length + ')' : s;
  }
  return JSON.stringify({ ls: lsInfo, prefs: prefInfo });
})()
