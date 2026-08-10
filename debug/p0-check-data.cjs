// P0 检查：真机数据状态（enable 迁移 bug 是否损坏数据）+ SECURE 键运行时验证
(async () => {
  const out = {};
  // 1. SECURE 常量运行时验证
  out.keys = Object.keys(SECURE);
  out.modeKey = SECURE.MODE_KEY;
  out.encKey = SECURE.RECORDS_ENC_KEY;
  out.envKey = SECURE.ENVELOPE_KEY;
  // 2. 数据状态检查
  const plainRaw = localStorage.getItem('guanji_records_v1');
  out.plainExists = plainRaw !== null;
  if (plainRaw) {
    try { const p = JSON.parse(plainRaw); out.plainIsArray = Array.isArray(p); out.plainCount = Array.isArray(p) ? p.length : 'NOT-ARRAY:' + typeof p; } catch (e) { out.plainIsArray = 'PARSE-ERR'; }
  }
  const mode = localStorage.getItem('guanji_sec_mode');
  out.mode = mode;
  out.encStored = !!localStorage.getItem('guanji_records_enc_v1');
  return JSON.stringify(out);
})();
