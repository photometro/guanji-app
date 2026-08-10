// P2 真机验证：#88 热力图 + #87 插件 + #93 加密链路
(async () => {
  const out = {};
  out.hasSecureStorage = !!(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SecureStorage);
  out.hasApp = !!(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.App);
  out.mode = localStorage.getItem('guanji_sec_mode');
  // 热力图
  out.cards = document.querySelectorAll('.card').length;
  const heatBtn = document.querySelector('#chartViewSeg .seg[data-view="heat"]');
  if (heatBtn) { heatBtn.click(); await new Promise((r) => setTimeout(r, 300)); }
  out.heatCells = document.querySelectorAll('.heatmap .heat-cell').length;
  const curveBtn = document.querySelector('#chartViewSeg .seg[data-view="curve"]');
  if (curveBtn) curveBtn.click();
  // backButton 函数存在（真机已注册 listener）
  out.backFn = typeof handleBackButton;
  // 加密链路：开启 → 密文 → 解密加载 → 关闭
  try {
    await secureEnable('device-test-pass-123');
    out.enc = {
      mode: localStorage.getItem('guanji_sec_mode'),
      plainGone: localStorage.getItem('guanji_records_v1') === null,
      env: !!localStorage.getItem('guanji_dek_envelope'),
    };
    const loaded = await Storage.loadRecords();
    out.encLoadedCount = loaded.length;
    await secureDisable();
    out.plainRestored = localStorage.getItem('guanji_records_v1') !== null;
  } catch (e) {
    out.encErr = String(e && e.message || e);
  }
  return JSON.stringify(out);
})();
