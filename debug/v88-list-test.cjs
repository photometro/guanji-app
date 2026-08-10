// 直接测 listBackupFiles / readDownloadedFile
(async () => {
  const out = {};
  out.hasPlugin = !!(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.GuanjiSave);
  if (out.hasPlugin) out.methods = Object.keys(Capacitor.Plugins.GuanjiSave);
  try {
    const res = await Capacitor.Plugins.GuanjiSave.listBackupFiles();
    out.list = res;
  } catch (e) {
    out.listErr = String(e && e.message || e);
  }
  if (out.list && out.list.files && out.list.files.length) {
    try {
      const r = await Capacitor.Plugins.GuanjiSave.readDownloadedFile({ filename: out.list.files[0] });
      out.readLen = r.data ? r.data.length : 0;
      out.readHead = r.data ? r.data.slice(0, 60) : null;
    } catch (e) {
      out.readErr = String(e && e.message || e);
    }
  }
  return JSON.stringify(out);
})();
