// 观己 App · secure（#93 全链路本地加密：DEK/KEK 信封加密，Web Crypto）
// 定稿（2026-08-09）：AES-256-GCM + PBKDF2-SHA-256 600k；DEK 存 Keystore（secure-storage 插件）；
// 本机免解锁；改口令 = 信封重加密；导出/备份 = 密文 + 信封，仅口令可解；浏览器调试降级 localStorage。
// 绝不把口令/KEK/明文写入日志。

const SECURE = {
  formatVersion: 1,
  algorithm: 'AES-GCM',
  keyBits: 256,
  nonceBytes: 12,
  saltBytes: 16,
  kdf: 'PBKDF2-SHA-256',
  iterations: 600000,
  dekBytes: 32,
  // 存储键
  MODE_KEY: 'guanji_sec_mode',        // 'plain' | 'encrypted'
  ENVELOPE_KEY: 'guanji_dek_envelope', // 口令保护的信封（跨设备恢复用）
  RECORDS_ENC_KEY: 'guanji_records_enc_v1', // 加密模式下的记录密文
  KEK_DEBUG_KEY: 'guanji_dek_debug',   // 浏览器调试降级（仅非原生环境）
};

/* ---------- base64 工具 ---------- */
function secureB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}
function secureUnb64(s) {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/* ---------- PBKDF2 派生 KEK（600k 迭代） ---------- */
async function secureDeriveKey(passphrase, saltB64) {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: secureUnb64(saltB64), iterations: SECURE.iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: SECURE.keyBits },
    false,
    ['encrypt', 'decrypt']
  );
}

/* ---------- AES-GCM（每次全新 12B nonce，AEAD 自带认证防篡改） ---------- */
async function secureEncrypt(plaintext, key) {
  const nonce = crypto.getRandomValues(new Uint8Array(SECURE.nonceBytes));
  const data = new TextEncoder().encode(plaintext);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, data);
  return { nonce: secureB64(nonce), ciphertext: secureB64(ct) };
}
async function secureDecrypt(payload, key) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: secureUnb64(payload.nonce) }, key, secureUnb64(payload.ciphertext));
  return new TextDecoder().decode(pt);
}

/* ---------- 信封：DEK ← KEK（口令） ---------- */
async function secureBuildEnvelope(dekB64, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(SECURE.saltBytes));
  const kek = await secureDeriveKey(passphrase, secureB64(salt));
  const env = await secureEncrypt(dekB64, kek);
  return {
    formatVersion: SECURE.formatVersion,
    algorithm: SECURE.algorithm,
    kdf: SECURE.kdf,
    iterations: SECURE.iterations,
    salt: secureB64(salt),
    nonce: env.nonce,
    encryptedDEK: env.ciphertext,
    createdAt: new Date().toISOString(),
  };
}
/* 解信封：口令 → KEK → DEK（口令错 = decrypt 抛错 = AEAD 认证失败） */
async function secureOpenEnvelope(envelope, passphrase) {
  const kek = await secureDeriveKey(passphrase, envelope.salt);
  return secureDecrypt({ nonce: envelope.nonce, ciphertext: envelope.encryptedDEK }, kek);
}

/* ---------- DEK 存取（本机免解锁：Keystore 插件保护；浏览器调试降级） ---------- */
let secureDekCache = null;
// @aparajita/capacitor-secure-storage v8：WebView 桥暴露 internal* 系列（prefixedKey + sync），
// 公开 get/set 在 base 类上不可直接调用
const SECURE_KS_PREFIX = 'capacitor-storage_';
const SECURE_KS_KEY = 'guanji_dek';
async function secureGetDEK() {
  if (secureDekCache) return secureDekCache;
  if (window.Capacitor && Capacitor.Plugins.SecureStorage) {
    const res = await Capacitor.Plugins.SecureStorage.internalGetItem({ prefixedKey: SECURE_KS_PREFIX + SECURE_KS_KEY, sync: false });
    if (res && res.data != null) { secureDekCache = String(res.data); return String(res.data); }
    const dek = secureB64(crypto.getRandomValues(new Uint8Array(SECURE.dekBytes)));
    await Capacitor.Plugins.SecureStorage.internalSetItem({ prefixedKey: SECURE_KS_PREFIX + SECURE_KS_KEY, data: dek, sync: false });
    secureDekCache = dek;
    return dek;
  }
  // 浏览器降级（仅调试，非原生环境）
  let dek = localStorage.getItem(SECURE.KEK_DEBUG_KEY);
  if (!dek) {
    dek = secureB64(crypto.getRandomValues(new Uint8Array(SECURE.dekBytes)));
    localStorage.setItem(SECURE.KEK_DEBUG_KEY, dek);
  }
  secureDekCache = dek;
  return dek;
}
async function secureSetDEK(dekB64) {
  secureDekCache = dekB64;
  if (window.Capacitor && Capacitor.Plugins.SecureStorage) {
    await Capacitor.Plugins.SecureStorage.internalSetItem({ prefixedKey: SECURE_KS_PREFIX + SECURE_KS_KEY, data: dekB64, sync: false });
  } else {
    localStorage.setItem(SECURE.KEK_DEBUG_KEY, dekB64);
  }
}

/* ---------- 模式 ---------- */
function secureMode() {
  return localStorage.getItem(SECURE.MODE_KEY) === 'encrypted' ? 'encrypted' : 'plain';
}

/* ---------- 记录读写（密文模式：records 数组 JSON → DEK 加密） ---------- */
async function secureSaveRecords(list) {
  if (secureMode() !== 'encrypted') { localStorage.setItem(Storage.KEY_RECORDS, JSON.stringify(list)); return; }
  const dek = await secureGetDEK();
  const key = await crypto.subtle.importKey('raw', secureUnb64(dek), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  const payload = await secureEncrypt(JSON.stringify(list), key);
  localStorage.setItem(SECURE.RECORDS_ENC_KEY, JSON.stringify(payload));
}
async function secureLoadRecords() {
  if (secureMode() !== 'encrypted') {
    try { const raw = localStorage.getItem(Storage.KEY_RECORDS); return raw ? JSON.parse(raw) : []; } catch { return []; }
  }
  try {
    const dek = await secureGetDEK();
    const key = await crypto.subtle.importKey('raw', secureUnb64(dek), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    const raw = localStorage.getItem(SECURE.RECORDS_ENC_KEY);
    if (!raw) return [];
    const json = await secureDecrypt(JSON.parse(raw), key);
    return JSON.parse(json);
  } catch { return []; }
}

/* ---------- 原子迁移（临时键写入 → 验证 → 切换标记 → 删旧键） ---------- */
async function secureEnable(passphrase) {
  // 1. 读明文并校验（P0 修复：必须 await——此前未 await 会把 Promise 序列化为 {} 导致迁移写空）
  const list = await secureLoadRecords();
  // 2. 生成 DEK + 密文
  const dek = await secureGetDEK();
  const key = await crypto.subtle.importKey('raw', secureUnb64(dek), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  const payload = await secureEncrypt(JSON.stringify(list), key);
  // 3. 写临时密文键
  const tmpKey = SECURE.RECORDS_ENC_KEY + '.tmp';
  localStorage.setItem(tmpKey, JSON.stringify(payload));
  // 4. 读回验证
  const back = JSON.parse(localStorage.getItem(tmpKey));
  const check = await secureDecrypt(back, key);
  if (JSON.stringify(JSON.parse(check)) !== JSON.stringify(list)) { localStorage.removeItem(tmpKey); throw new Error('迁移校验失败'); }
  // 5. 信封（口令）
  const envelope = await secureBuildEnvelope(dek, passphrase);
  localStorage.setItem(SECURE.ENVELOPE_KEY, JSON.stringify(envelope));
  // 6. 切换标记 + 正式键
  localStorage.setItem(SECURE.RECORDS_ENC_KEY, JSON.stringify(payload));
  localStorage.removeItem(tmpKey);
  localStorage.setItem(SECURE.MODE_KEY, 'encrypted');
  // 7. 删除明文（原子迁移最后一步）
  localStorage.removeItem(Storage.KEY_RECORDS);
}
async function secureDisable() {
  // 加密 → 明文（调用前已二次确认）：解密 → 写明文 → 删密文/信封/标记
  const list = await secureLoadRecords();
  localStorage.setItem(Storage.KEY_RECORDS, JSON.stringify(list));
  localStorage.removeItem(SECURE.RECORDS_ENC_KEY);
  localStorage.removeItem(SECURE.ENVELOPE_KEY);
  localStorage.setItem(SECURE.MODE_KEY, 'plain');
}
async function secureChangePassphrase(oldPass, newPass) {
  // 验证旧口令（本机免解锁下可跳过验证——但导出/跨设备场景需口令；定稿：改口令先验证当前身份，本机已可信解锁可免
  // 实现：若提供 oldPass 则验证信封；否则视为本机可信解锁直接改）
  if (oldPass) {
    const env = JSON.parse(localStorage.getItem(SECURE.ENVELOPE_KEY) || 'null');
    if (!env) throw new Error('未找到口令信封');
    await secureOpenEnvelope(env, oldPass);   // 口令错会抛错
  }
  const dek = await secureGetDEK();
  const envelope = await secureBuildEnvelope(dek, newPass);
  localStorage.setItem(SECURE.ENVELOPE_KEY, JSON.stringify(envelope));
}

/* ---------- 密文导出包（密文 + 信封，仅口令可解） ---------- */
async function secureExportPackage() {
  const list = await secureLoadRecords();
  const env = JSON.parse(localStorage.getItem(SECURE.ENVELOPE_KEY) || 'null');
  if (secureMode() === 'encrypted') {
    // 加密模式：直接打包当前密文 + 信封
    const raw = localStorage.getItem(SECURE.RECORDS_ENC_KEY);
    return {
      formatVersion: SECURE.formatVersion,
      type: 'guanji-backup',
      createdAt: new Date().toISOString(),
      recordCount: list.length,
      mode: 'encrypted',
      envelope: env,
      ciphertext: raw,
    };
  }
  // 明文模式：无口令不可加密导出——拒绝（提示先开启加密）
  throw new Error('明文模式不支持密文导出，请先开启数据加密');
}
/* 导入：解析密文包 + 口令 → 解密数据 */
async function secureImportPackage(pkg, passphrase) {
  if (!pkg || pkg.type !== 'guanji-backup' || pkg.formatVersion !== SECURE.formatVersion) throw new Error('备份包格式无法识别');
  if (pkg.mode !== 'encrypted') throw new Error('备份包不是加密格式');
  const dek = await secureOpenEnvelope(pkg.envelope, passphrase);
  const key = await crypto.subtle.importKey('raw', secureUnb64(dek), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  const json = await secureDecrypt(JSON.parse(pkg.ciphertext), key);
  return JSON.parse(json);
}

/* ================= #93 数据加密卡 UI ================= */

/* #95/#102：导出加密备份——优先保存到公共 Downloads（MediaStore 原生桥）；失败降级 Share 文件/剪贴板 */
async function exportEncryptedBackupFile() {
  const pkg = await secureExportPackage();
  const json = JSON.stringify(pkg);
  const fname = 'guanji-backup-' + fmtDateKey(new Date()) + '.json';
  if (window.Capacitor && Capacitor.Plugins.GuanjiSave) {
    const res = await Capacitor.Plugins.GuanjiSave.saveToDownloads({ filename: fname, data: json });
    return { count: pkg.recordCount, filename: fname, path: res.path };
  }
  if (window.Capacitor && Capacitor.Plugins.Filesystem) {
    // 写 EXTERNAL（应用外部目录）——cache 的 FileProvider grant 在魅族上失败（SecurityException，面板不弹）
    const res = await Capacitor.Plugins.Filesystem.writeFile({ path: fname, data: json, directory: 'EXTERNAL', encoding: 'UTF8' });
    await Capacitor.Plugins.Share.share({ title: '观己加密备份', files: [res.uri], dialogTitle: '保存或发送加密备份' });
    return { count: pkg.recordCount, filename: fname, path: res.uri };
  }
  await navigator.clipboard.writeText(json);   // 浏览器调试降级
  return { count: pkg.recordCount, filename: fname, path: '剪贴板' };
}

let secDialogAction = null;   // 'enable' | 'change' | 'disable'

/* #111：CSV 解析（观己导出格式：日期,时间,时长(分),情绪,诱因,看片,备注）→ records */
function csvToRecords(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) throw new Error('CSV 没有可导入的数据行');
  const header = parseCsvLine(lines[0]);
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.length < 3) continue;
    const row = {};
    header.forEach((h, idx) => { row[h.trim()] = (cells[idx] || '').trim(); });
    const d = String(row['日期'] || '').split('-').map((n) => String(parseInt(n, 10)).padStart(2, '0'));
    if (d.length !== 3 || d.some((n) => !/^\d{2,4}$/.test(n)) || parseInt(d[0], 10) < 1900) continue;   // 跳过无法识别的行（年份 4 位）
    const rec = {
      id: newRecordId('csv'),
      dateKey: d.join('-'),
      time: row['时间'] || '',
      duration: row['时长(分)'] ? parseInt(row['时长(分)'], 10) : null,
      moods: row['情绪'] ? String(row['情绪']).split('|').filter(Boolean) : [],
      triggers: row['诱因'] ? String(row['诱因']).split('|').filter(Boolean) : [],
      media: row['看片'] === '是',
      note: row['备注'] || '',
    };
    out.push(rec);
  }
  return out;
}
/* 简单 CSV 行解析：支持双引号包裹与 "" 转义 */
function parseCsvLine(line) {
  const cells = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { cells.push(cur); cur = ''; }
    else cur += ch;
  }
  cells.push(cur);
  return cells;
}
/* #111：CSV 合并指纹（CSV 无 id——按 日期+时间+时长 识别同一记录，避免回导重复） */
function recordFingerprint(r) {
  return (r.dateKey || '') + '|' + (r.time || '') + '|' + (r.duration || '');
}

function secureRenderStatus() {
  const enc = secureMode() === 'encrypted';
  const st = $('secureStatus');
  st.classList.toggle('on', enc);
  st.innerHTML = enc
    ? '<span class="sec-dot on"></span>已加密 · 数据从写入那一刻起就是密文；离开设备的只有密文，只有口令能解开。'
    : '<span class="sec-dot"></span>未开启加密——数据以明文保存在本机。推荐开启加密：即使设备或备份丢失，数据也无法被读取。';
  $('secureEnableBtn').classList.toggle('hidden', enc);
  $('secureDisableBtn').classList.toggle('hidden', !enc);
  $('secureActions').classList.toggle('hidden', !enc);
  if (typeof wdRender === 'function') wdRender();   // #115：WebDAV 卡状态跟随加密模式
}

function secureOpenDialog(title, hint) {
  // 注意：secDialogAction 由调用方在打开前设置，此处不重置
  $('secDialogTitle').textContent = title;
  $('secDialogHint').textContent = hint;
  $('secPass1').value = '';
  $('secPass2').value = '';
  $('secPassHint').textContent = '';
  $('secBackdrop').classList.remove('hidden');
  $('secPass1').focus();
}

function secureCloseDialog() {
  $('secBackdrop').classList.add('hidden');
}

async function secureRunAction() {
  const p1 = $('secPass1').value;
  const p2 = $('secPass2').value;
  const hint = $('secPassHint');
  if (p1.length < 8) { hint.textContent = '口令至少 8 位'; return; }
  if (/^\d+$/.test(p1)) { hint.textContent = '不建议用纯数字口令'; return; }
  if (p1 !== p2) { hint.textContent = '两次输入不一致'; return; }
  try {
    if (secDialogAction === 'enable') {
      await secureEnable(p1);
      toast('加密已开启，数据已转为密文');
    } else if (secDialogAction === 'change') {
      await secureChangePassphrase(null, p1);
      // #115：口令衰减明示——历史备份（含服务器）仍需创建时的口令
      toast('口令已更新——历史备份（含服务器）仍需创建时的口令，如需统一可删除旧备份重新备份');
    } else if (secDialogAction === 'disable') {
      await secureDisable();
      toast('加密已关闭，数据已转为明文');
    }
    secureCloseDialog();
    secureRenderStatus();
    renderHome();
  } catch (e) {
    hint.textContent = e && e.message ? e.message : '操作失败，请重试';
  }
}

function initSecureUI() {
  if (!$('secureEnableBtn')) return;   // 元素缺失（旧页面）时静默
  secureRenderStatus();

  $('secureEnableBtn').addEventListener('click', () => {
    secDialogAction = 'enable';
    secureOpenDialog('开启加密', '设置一个口令作为唯一钥匙。忘记口令将无法恢复数据，建议存入密码管理器。');
  });
  $('secureChangeBtn').addEventListener('click', () => {
    secDialogAction = 'change';
    secureOpenDialog('修改口令', '输入新口令（本机已可信解锁，无需验证旧口令）。数据不会重新加密，秒级完成。');
  });
  // #106：关闭加密升级为顶部大按钮（与「开启加密」同位置同色对称）
  $('secureDisableBtn').addEventListener('click', () => {
    secDialogAction = 'disable';
    secureOpenDialog('关闭加密', '数据将转为明文保存在本机——设备被他人使用或数据泄露时可读性将降低保护。确认关闭？');
  });
  $('secCancel').addEventListener('click', secureCloseDialog);
  $('secConfirm').addEventListener('click', secureRunAction);

  // 导出加密备份（#95：文件形式——Filesystem + Share；浏览器降级剪贴板）
  // #96 合并卡后由「导出数据」exportBtn 模式自适应调用 exportEncryptedBackupFile

  // 导入备份（#95/#104/#111：下载目录列表 + 浏览其他位置 + 模式/类型自适——CSV 明文无需口令，加密包需口令）
  let secImportData = null;   // 点选下载目录备份时暂存的内容
  let secImportIsCsv = false; // 当前选中文件是否为 CSV（决定口令框显隐与解析路径）

  /* #111：按文件类型更新口令框显隐与提示 */
  function secImportPickFile(name) {
    secImportIsCsv = /\.csv$/i.test(name);
    const passEl = $('secImportPass');
    passEl.classList.toggle('hidden', secImportIsCsv);
    if (secImportIsCsv) passEl.value = '';
    $('secImportInfo').textContent = secImportIsCsv
      ? 'CSV 为明文导出数据，无需口令。导入按日期+时间+时长合并去重。'
      : '这是加密备份，需要创建它时设置的口令（即当时开启加密用的口令）。导入按记录 id 合并去重。';
  }
  async function loadImportFiles() {
    const box = $('secImportFiles'), list = $('secImportFileList');
    if (!window.Capacitor || !Capacitor.Plugins.GuanjiSave) { box.classList.add('hidden'); return; }
    try {
      const res = await Capacitor.Plugins.GuanjiSave.listBackupFiles();
      const files = (res.files || []).filter((f) => /\.(json|csv)$/i.test(f));
      if (!files.length) { box.classList.add('hidden'); return; }
      list.innerHTML = files.map((f, i) => {
        const isCsv = /\.csv$/i.test(f);
        return `<button class="chip" data-idx="${i}" style="width:100%;justify-content:flex-start;margin-bottom:6px;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${isCsv ? '📄 ' : '🔒 '}${f}</button>`;
      }).join('');
      box.classList.remove('hidden');
      list.querySelectorAll('.chip').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            const r = await Capacitor.Plugins.GuanjiSave.readDownloadedFile({ filename: btn.textContent.trim().replace(/^[📄🔒]\s*/, '') });
            secImportData = r.data;
            list.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
            btn.classList.add('active');
            $('secImportFileLabel').textContent = '已选：' + btn.textContent.trim().replace(/^[📄🔒]\s*/, '');
            secImportPickFile(btn.textContent.trim());
          } catch (e) {
            $('secImportInfo').textContent = '读取备份失败：' + ((e && e.message) || '');
          }
        });
      });
    } catch (e) {
      box.classList.add('hidden');
    }
  }
  $('secureImportBtn').addEventListener('click', () => {
    secImportData = null;
    secImportIsCsv = false;
    $('secImportFile').value = '';
    $('secImportPass').value = '';
    $('secImportFileLabel').textContent = '浏览其他位置';
    // #111：按模式设置默认提示——明文态说明 CSV/加密包两种选择，不再默认要求口令
    const modeText = secureMode() === 'encrypted'
      ? '可导入加密备份（需当初口令）或 CSV（无需口令）。导入后以本机加密方式保存。'
      : '可导入加密备份（需当初口令）或 CSV 明文数据（无需口令）。导入按记录合并去重。';
    $('secImportInfo').textContent = '可直接点选下载目录中的备份，或选择其他位置的文件。' + modeText;
    $('secImportPass').classList.add('hidden');
    $('secImportBackdrop').classList.remove('hidden');
    loadImportFiles();
  });
  $('secImportFile').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    $('secImportFileLabel').textContent = f ? '已选择：' + f.name : '浏览其他位置';
    if (f) secImportPickFile(f.name);
  });
  $('secImportCancel').addEventListener('click', () => $('secImportBackdrop').classList.add('hidden'));
  $('secImportConfirm').addEventListener('click', async () => {
    const info = $('secImportInfo');
    try {
      let text = secImportData;
      if (!text) {
        const file = $('secImportFile').files && $('secImportFile').files[0];
        if (!file) { info.textContent = '请先选择备份文件'; return; }
        text = await file.text();
        secImportIsCsv = /\.csv$/i.test(file.name);
      }
      // #111：CSV 明文回导（无需口令）/ 加密包（需口令）分路径
      if (secImportIsCsv || !/^\s*\{/.test(text)) {
        const csvList = csvToRecords(text);
        if (!csvList.length) throw new Error('CSV 没有可导入的数据');
        // 指纹合并：同 日期+时间+时长 视为已存在，跳过
        const existing = new Set(records.map(recordFingerprint));
        let added = 0, skipped = 0;
        csvList.forEach((r) => {
          if (existing.has(recordFingerprint(r))) { skipped++; return; }
          records.push(r); added++;
        });
        if (normalizeOffsets) normalizeOffsets();
        Storage.saveRecords(records);
        afterRecordsChanged();
        $('secImportBackdrop').classList.add('hidden');
        toast(`已导入 ${added} 条 CSV 记录${skipped ? '（跳过 ' + skipped + ' 条重复）' : ''}`);
        renderHome();
        return;
      }
      const pkg = JSON.parse(text);
      const pass = $('secImportPass').value;
      if (!pass) { info.textContent = '这是加密备份，请输入创建它时设置的口令'; return; }
      const list = await secureImportPackage(pkg, pass);
      if (!Array.isArray(list)) throw new Error('备份数据格式异常');
      // 合并去重（按 id）
      const byId = new Map();
      records.forEach((r) => byId.set(r.id, r));
      list.forEach((r) => { if (r && r.id) byId.set(r.id, r); });
      records = [...byId.values()];
      Storage.saveRecords(records);
      afterRecordsChanged();
      $('secImportBackdrop').classList.add('hidden');
      // #111：明文态导入加密包 → 数据解密后明文落盘，如实提示
      if (secureMode() !== 'encrypted') {
        toast(`已导入并合并 ${list.length} 条备份记录（当前以明文保存——建议开启加密）`);
      } else {
        toast(`已导入并合并 ${list.length} 条备份记录`);
      }
      renderHome();
    } catch (e) {
      info.textContent = '导入失败：' + ((e && e.message) || '口令错误或数据损坏');
    }
  });

  // 备份管理（#110：列出下载目录备份/导出文件 + 删除）
  let bkpConfirmTimer = null;
  async function loadBackupFiles() {
    const listEl = $('bkpManageList');
    if (!window.Capacitor || !Capacitor.Plugins.GuanjiSave) {
      listEl.innerHTML = '<p class="dialog-hint">当前环境不支持备份管理（仅真机可用）</p>';
      return;
    }
    try {
      const res = await Capacitor.Plugins.GuanjiSave.listBackupFiles();
      const files = (res.files || []).filter((f) => /\.(json|csv)$/i.test(f));
      if (!files.length) {
        listEl.innerHTML = '<p class="dialog-hint">暂无备份文件——导出数据后这里会显示。</p>';
        return;
      }
      listEl.innerHTML = files.map((f, i) => {
        const isCsv = /\.csv$/i.test(f);
        const label = isCsv ? 'CSV 明文' : '加密包';
        return `<div class="bkp-row" style="display:flex;align-items:center;gap:8px;padding:10px 2px;border-bottom:1px solid var(--line)">
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px">${isCsv ? '📄 ' : '🔒 '}${f}</span>
          <span style="font-size:10px;color:var(--ink-3);flex-shrink:0">${label}</span>
          <button class="bkp-del" data-i="${i}" style="flex-shrink:0;border:none;background:none;color:var(--accent-deep);font-size:12px;padding:4px 8px;cursor:pointer">删除</button>
        </div>`;
      }).join('');
      listEl.querySelectorAll('.bkp-del').forEach((btn) => {
        btn.addEventListener('click', async () => {
          // 行内二次确认（3 秒内再次点击才执行）
          if (btn.dataset.armed !== '1') {
            btn.dataset.armed = '1';
            btn.textContent = '确认删除？';
            btn.style.color = 'var(--accent-deep)';
            clearTimeout(bkpConfirmTimer);
            bkpConfirmTimer = setTimeout(() => {
              listEl.querySelectorAll('.bkp-del').forEach((b) => { b.dataset.armed = ''; b.textContent = '删除'; b.style.color = ''; });
            }, 3000);
            return;
          }
          const name = files[parseInt(btn.dataset.i, 10)];
          try {
            const r = await Capacitor.Plugins.GuanjiSave.deleteBackupFile({ filename: name });
            if (r && r.deleted === false) { btn.dataset.armed = ''; btn.textContent = '删除'; btn.style.color = ''; toast('文件不存在或已删除'); }
            else toast('已删除 ' + name);
            await loadBackupFiles();
          } catch (e) {
            toast('删除失败：' + ((e && e.message) || ''));
            btn.dataset.armed = ''; btn.textContent = '删除'; btn.style.color = '';
          }
        });
      });
    } catch (e) {
      listEl.innerHTML = '<p class="dialog-hint">读取备份列表失败</p>';
    }
  }
  $('bkpManageBtn').addEventListener('click', () => {
    $('bkpManageBackdrop').classList.remove('hidden');
    loadBackupFiles();
  });
  $('bkpManageClose').addEventListener('click', () => $('bkpManageBackdrop').classList.add('hidden'));

  // 加密模式下 CSV 明文导出禁用（#93 定稿：离开设备的都是密文——检查在 ui-sheet.js exportBtn 内）
}
