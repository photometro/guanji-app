// 测试：写 External 目录 + Share（cache 目录 grant 失败的替代）
(async () => {
  const out = {};
  try {
    const res = await Capacitor.Plugins.Filesystem.writeFile({ path: 'share-ext.txt', data: 'hello-ext', directory: 'EXTERNAL', encoding: 'UTF8' });
    out.writeOk = true;
    out.uri = res.uri;
    if (window.Capacitor && Capacitor.Plugins.Share) {
      out.shareCalled = true;
      const r = await Promise.race([
        Capacitor.Plugins.Share.share({ title: '测试分享', files: [res.uri], dialogTitle: '测试面板' }).then(() => 'done').catch((e) => 'err:' + String(e && e.message || e)),
        new Promise((res2) => setTimeout(() => res2('timeout-15s'), 15000)),
      ]);
      out.shareResult = r;
    }
  } catch (e) {
    out.writeErr = String(e && e.message || e);
  }
  return JSON.stringify(out);
})();
