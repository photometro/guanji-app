// 定位导出分享不弹面板：分步测试 Filesystem/Share
(async () => {
  const out = {};
  out.hasFS = !!(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Filesystem);
  out.hasShare = !!(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Share);
  if (out.hasFS) out.fsMethods = Object.keys(Capacitor.Plugins.Filesystem);
  if (out.hasShare) out.shareMethods = Object.keys(Capacitor.Plugins.Share);
  // 1. 写文件测试（Capacitor 8：写字符串必须带 encoding: UTF8，否则按二进制校验失败）
  if (out.hasFS) {
    try {
      const res = await Capacitor.Plugins.Filesystem.writeFile({ path: 'share-test.txt', data: 'hello', directory: 'CACHE', encoding: 'UTF8' });
      out.writeOk = true;
      out.uri = res.uri;
    } catch (e) {
      out.writeErr = String(e && e.message || e);
    }
  }
  // 2. Share 测试（不弹面板——检查参数是否被接受）
  if (out.hasShare && out.writeOk) {
    try {
      const r = await Capacitor.Plugins.Share.share({ title: 'test', files: [out.uri], dialogTitle: 'test' });
      out.shareOk = true;
      out.shareResult = JSON.stringify(r);
    } catch (e) {
      out.shareErr = String(e && e.message || e);
    }
  }
  return JSON.stringify(out);
})();
