// 检查当前模式 + exportBtn 实际执行路径
(async () => {
  const out = {};
  out.mode = localStorage.getItem('guanji_sec_mode');
  out.envelope = !!localStorage.getItem('guanji_dek_envelope');
  out.recordsCount = records.length;
  // patch writeFile 记录调用
  let called = [];
  const orig = Capacitor.Plugins.Filesystem.writeFile;
  Capacitor.Plugins.Filesystem.writeFile = async (o) => { called.push(o.path + '|' + o.directory); return { uri: 'file://test/' + o.path }; };
  document.querySelector('.tab[data-screen="me"]')?.click();
  await new Promise((r) => setTimeout(r, 300));
  records = [{ id: 't1', offset: 0, time: '10:00', moods: ['平静'], triggers: ['工作'], duration: 10, media: false, note: 'x' }];
  document.getElementById('exportBtn').click();
  await new Promise((r) => setTimeout(r, 800));
  out.writeCalls = called;
  Capacitor.Plugins.Filesystem.writeFile = orig;
  return JSON.stringify(out);
})();
