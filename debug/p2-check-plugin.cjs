// 检查 SecureStorage 插件实际 API
(async () => {
  const out = {};
  out.scripts = [...document.scripts].filter((s) => s.src.includes('secure')).map((s) => s.src.split('/').pop());
  if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SecureStorage) {
    out.methods = Object.keys(Capacitor.Plugins.SecureStorage);
    out.proto = Object.getOwnPropertyNames(Object.getPrototypeOf(Capacitor.Plugins.SecureStorage) || {});
  }
  out.plugins = window.Capacitor ? Object.keys(Capacitor.Plugins) : null;
  return JSON.stringify(out);
})();
