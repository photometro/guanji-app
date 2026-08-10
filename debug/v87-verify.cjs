// #102 验证：GuanjiSave 插件 + 导出保存到 Downloads
(async () => {
  const out = {};
  out.hasPlugin = !!(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.GuanjiSave);
  if (out.hasPlugin) out.methods = Object.keys(Capacitor.Plugins.GuanjiSave);
  records = [{ id: 't1', offset: 0, time: '10:00', moods: ['平静'], triggers: ['工作'], duration: 10, media: false, note: 'x' }];
  renderHome();
  document.querySelector('.tab[data-screen="me"]')?.click();
  await new Promise((r) => setTimeout(r, 300));
  document.getElementById('exportBtn').click();
  await new Promise((r) => setTimeout(r, 1500));
  const t = document.querySelector('.toast');
  out.toast = t ? t.textContent : null;
  return JSON.stringify(out);
})();
