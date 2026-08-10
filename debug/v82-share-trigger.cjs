// 分步：writeFile await 确认成功 → Share 触发（不 await）→ 立即返回让截图
(async () => {
  const out = {};
  try {
    const res = await Capacitor.Plugins.Filesystem.writeFile({ path: 'share-test2.txt', data: 'hello', directory: 'CACHE', encoding: 'UTF8' });
    out.writeOk = true;
    out.uri = res.uri;
    // Share 触发但不 await（面板弹出后保持）
    if (window.Capacitor && Capacitor.Plugins.Share) {
      out.shareCalled = true;
      Capacitor.Plugins.Share.share({ title: '测试分享', files: [res.uri], dialogTitle: '测试分享面板' }).then(() => { out.shareDone = true; }).catch((e) => { out.shareErr = String(e && e.message || e); });
    }
  } catch (e) {
    out.writeErr = String(e && e.message || e);
  }
  return JSON.stringify(out);
})();
