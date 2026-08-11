// 观己 App · webdav（#115 P5：WebDAV 备份通道——配置/测试/上传/列表/下载/删除/自动备份）
// 设计定稿：#115 全流程 + 冲击分析 + 自我拷问修正（2026-08-10）
// 依赖：secure.js（secureMode/secureExportPackage）、storage.js（newRecordId）、records.js（fmtDateKey）

/* ---------- WebDAV 常量与配置 ---------- */

const WD = {
  CFG_KEY: 'guanji_webdav_cfg',      // { url, username, dir }（dir 如 'guanji'；密码独立存安全存储）
  PASS_KEY: 'guanji_webdav_pass',    // Keystore（@aparajita 同款 internal API）；浏览器降级 localStorage
  STAT_KEY: 'guanji_webdav_stat',    // { lastBackup, lastStatus:'ok'|'error'|'never', lastError, lastErrorTime, fingerprint }
  AUTO_KEY: 'guanji_webdav_auto',    // 'on' | 'off'（切后台自动备份，默认 off——数据离开设备需明确授权）
  DEVICE_KEY: 'guanji_device_id',    // 设备短标识（文件名防多设备撞车）
  DIR: 'guanji',                     // 服务器子目录（自动建）
  TIMEOUT: 20000,
};

function wdIsNative() {
  return !!(window.Capacitor && Capacitor.Plugins.SecureStorage);
}
function wdHasDavBridge() {
  return !!(window.Capacitor && Capacitor.Plugins.GuanjiDav);
}

/* 设备短标识：首次生成（时间戳 base36 + 随机 4 位），随配置文件持久 */
function wdDeviceId() {
  let id = localStorage.getItem(WD.DEVICE_KEY);
  if (!id) {
    id = Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6);
    localStorage.setItem(WD.DEVICE_KEY, id);
  }
  return id;
}

/* ---------- 配置存取 ---------- */

function wdLoadCfg() {
  try { return JSON.parse(localStorage.getItem(WD.CFG_KEY) || 'null'); } catch (e) { return null; }
}
function wdSaveCfg(cfg) {
  localStorage.setItem(WD.CFG_KEY, JSON.stringify(cfg));
}
async function wdLoadPass() {
  if (wdIsNative()) {
    try {
      const r = await Capacitor.Plugins.SecureStorage.internalGetItem({ prefixedKey: 'capacitor-storage_' + WD.PASS_KEY, sync: false });
      if (r && r.data) return r.data;
    } catch (e) { /* 落空走降级 */ }
  }
  return localStorage.getItem(WD.PASS_KEY) || '';
}
async function wdSavePass(pass) {
  if (wdIsNative()) {
    try {
      await Capacitor.Plugins.SecureStorage.internalSetItem({ prefixedKey: 'capacitor-storage_' + WD.PASS_KEY, data: pass, sync: false });
      localStorage.removeItem(WD.PASS_KEY);   // 迁移后不留明文副本
      return;
    } catch (e) { /* 降级 localStorage */ }
  }
  localStorage.setItem(WD.PASS_KEY, pass);
}

function wdLoadStat() {
  try { return JSON.parse(localStorage.getItem(WD.STAT_KEY) || 'null') || {}; } catch (e) { return {}; }
}
function wdSaveStat(stat) {
  localStorage.setItem(WD.STAT_KEY, JSON.stringify(stat));
}
function wdAutoEnabled() {
  return localStorage.getItem(WD.AUTO_KEY) === 'on';
}

/* ---------- WebDAV 请求（#115：原生桥 GuanjiDav 优先——WebView fetch 受 CORS 限制；浏览器降级 fetch） ---------- */

async function wdAuth() {
  const cfg = wdLoadCfg();
  if (!cfg || !cfg.url || !cfg.username) return null;
  const pass = await wdLoadPass();
  if (!pass) return null;
  return { cfg, pass };
}

function wdBase(cfg, pass) {
  const url = cfg.url.replace(/\/+$/, '');
  return {
    url,
    headers: { Authorization: 'Basic ' + btoa(cfg.username + ':' + pass) },
  };
}

async function wdRequest(method, path, { body, headers, timeout = WD.TIMEOUT } = {}) {
  const auth = await wdAuth();
  if (!auth) throw new Error('请先配置 WebDAV');
  const b = wdBase(auth.cfg, auth.pass);
  if (wdHasDavBridge()) {
    const res = await Capacitor.Plugins.GuanjiDav.request({
      method,
      url: b.url + path,
      username: auth.cfg.username,
      password: auth.pass,
      body: body || null,
      depth: headers && headers.Depth ? parseInt(headers.Depth, 10) : null,
    });
    return { status: res.status, text: async () => res.data || '' };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(b.url + path, {
      method,
      headers: { ...b.headers, ...headers, ...(body ? { 'Content-Type': 'application/octet-stream' } : {}) },
      body,
      signal: ctrl.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/* 连接测试：PROPFIND depth 0（目录级） */
async function wdTestConnection() {
  const res = await wdRequest('PROPFIND', '/', {});
  if (res.status === 401 || res.status === 403) throw new Error('账号或应用密码不正确');
  if (res.status >= 200 && res.status < 300) return true;
  throw new Error('连接失败（HTTP ' + res.status + '）');
}

/* 确保子目录存在（MKCOL；405 = 已存在） */
async function wdEnsureDir() {
  const res = await wdRequest('MKCOL', '/' + WD.DIR, {});
  if (res.status === 201 || res.status === 405 || (res.status >= 200 && res.status < 300)) return;
  throw new Error('创建目录失败（HTTP ' + res.status + '）');
}

/* 上传密文包 */
async function wdUpload(pkgJson) {
  const fname = 'guanji-' + wdDeviceId() + '-backup-' + fmtDateKey(new Date()) + '-' + Date.now().toString(36) + '.json';
  await wdEnsureDir();
  const res = await wdRequest('PUT', '/' + WD.DIR + '/' + encodeURIComponent(fname), { body: pkgJson });
  if (res.status === 201 || (res.status >= 200 && res.status < 300)) return fname;
  throw new Error('上传失败（HTTP ' + res.status + '）');
}

/* 解析 PROPFIND 响应（多响应 XML）→ 文件名列表 */
function wdParsePropfind(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const out = [];
  doc.querySelectorAll('response').forEach((resp) => {
    const hrefEl = resp.querySelector('href');
    if (!hrefEl) return;
    let href = hrefEl.textContent.trim();
    const name = decodeURIComponent(href.split('/').filter(Boolean).pop() || '');
    if (!name || name === WD.DIR) return;   // 跳过目录本身
    const sizeEl = resp.querySelector('getcontentlength');
    const dateEl = resp.querySelector('getlastmodified');
    out.push({
      name,
      size: sizeEl ? parseInt(sizeEl.textContent, 10) || 0 : 0,
      date: dateEl ? dateEl.textContent : '',
    });
  });
  return out.sort((a, b) => (a.name < b.name ? 1 : -1));
}

/* 列出服务器备份（按名称倒序≈新在上） */
async function wdList() {
  const res = await wdRequest('PROPFIND', '/' + WD.DIR + '/', { headers: { Depth: '1' } });
  if (res.status === 404) return [];   // 目录还没建 = 无备份
  if (res.status !== 207 && !(res.status >= 200 && res.status < 300)) throw new Error('列表失败（HTTP ' + res.status + '）');
  const xml = await res.text();
  return wdParsePropfind(xml);
}

/* 下载备份文件内容 */
async function wdDownload(name) {
  const res = await wdRequest('GET', '/' + WD.DIR + '/' + encodeURIComponent(name), {});
  if (!(res.status >= 200 && res.status < 300)) throw new Error('下载失败（HTTP ' + res.status + '）');
  return res.text();
}

/* 删除服务器备份 */
async function wdDelete(name) {
  const res = await wdRequest('DELETE', '/' + WD.DIR + '/' + encodeURIComponent(name), {});
  if (res.status === 404) return false;
  if (!(res.status >= 200 && res.status < 300)) throw new Error('删除失败（HTTP ' + res.status + '）');
  return true;
}

/* ---------- 数据指纹（自动备份去重） ---------- */

function wdFingerprint() {
  const latest = records.length ? records[records.length - 1].id : '';
  return records.length + '|' + latest + '|' + secureMode();
}

/* 手动备份（#115：复用加密包逻辑，内存生成不落盘） */
async function wdBackupNow() {
  if (secureMode() !== 'encrypted') throw new Error('WebDAV 备份需要开启加密（明文模式不上传）');
  if (!records.length) throw new Error('还没有记录可备份');
  const pkg = await secureExportPackage();
  const json = JSON.stringify(pkg);
  const fname = await wdUpload(json);
  const stat = wdLoadStat();
  stat.lastBackup = new Date().toISOString();
  stat.lastStatus = 'ok';
  stat.lastError = '';
  stat.fingerprint = wdFingerprint();
  wdSaveStat(stat);
  return { filename: fname, count: pkg.recordCount };
}

/* 切后台自动备份：加密态 + 已启用 + 指纹变化 + 有数据 → 上传；失败写入 stat（必可见） */
async function wdAutoBackup() {
  if (!wdAutoEnabled()) return;
  if (secureMode() !== 'encrypted') return;
  if (!records.length) return;
  const fp = wdFingerprint();
  const stat = wdLoadStat();
  if (stat.fingerprint === fp) return;   // 自上次备份无变化
  try {
    await wdBackupNow();
  } catch (e) {
    const s = wdLoadStat();
    s.lastStatus = 'error';
    s.lastError = ((e && e.message) || '自动备份失败').slice(0, 80);
    s.lastErrorTime = new Date().toISOString();
    wdSaveStat(s);
  }
}

/* ---------- WebDAV 卡 UI（#115） ---------- */

function wdRender() {
  const enc = secureMode() === 'encrypted';
  const cfg = wdLoadCfg();
  const stat = wdLoadStat();
  const st = $('wdStatus');
  if (!enc) {
    st.textContent = '开启加密后可用——备份上传的是密文，只有你的口令能解开。';
    $('wdForm').classList.add('hidden');
    $('wdSaveBtn').classList.add('hidden');
    $('wdActions').classList.add('hidden');
    return;
  }
  $('wdForm').classList.toggle('hidden', !!cfg);
  $('wdSaveBtn').classList.toggle('hidden', !!cfg);
  $('wdActions').classList.toggle('hidden', !cfg);
  if (!cfg) {
    st.textContent = '配置你的 WebDAV 服务器（如坚果云、群晖、Nextcloud）。备份到你自己指定的服务器，不经过观己任何服务器。';
    return;
  }
  if (stat.lastStatus === 'error') {
    st.textContent = '上次备份失败：' + (stat.lastError || '未知错误') + '（' + ((stat.lastErrorTime || '').slice(0, 10)) + '）';
    st.classList.add('on');   // 复用绿色高亮样式？不——失败应警示。用原生样式
  } else if (stat.lastBackup) {
    const d = new Date(stat.lastBackup);
    const pad = (n) => String(n).padStart(2, '0');
    st.textContent = '上次备份：' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' ✓';
  } else {
    st.textContent = '已配置，尚未备份。';
  }
  $('wdAutoSwitch').classList.toggle('on', wdAutoEnabled());
}

async function initWebDAVUI() {
  if (!$('wdStatus')) return;   // 旧页面防御
  // 表单预填
  const cfg = wdLoadCfg();
  if (cfg) { $('wdUrl').value = cfg.url || ''; $('wdUser').value = cfg.username || ''; }
  wdRender();

  $('wdSaveBtn').addEventListener('click', async () => {
    const url = $('wdUrl').value.trim();
    const username = $('wdUser').value.trim();
    const pass = $('wdPass').value;
    if (!/^https:\/\//i.test(url)) { toast('服务器地址必须以 https:// 开头'); return; }
    if (!username || !pass) { toast('请填写账号与应用密码'); return; }
    wdSaveCfg({ url, username });
    await wdSavePass(pass);
    try {
      await wdTestConnection();
      toast('连接成功 ✓');
    } catch (e) {
      wdSaveCfg(null); localStorage.removeItem(WD.CFG_KEY);   // 测试失败不保存
      toast((e && e.message) || '连接失败');
      return;
    }
    wdRender();
    // 首次配置后询问自动备份（数据离开设备需明确授权）
    if (localStorage.getItem(WD.AUTO_KEY) === null) {
      localStorage.setItem(WD.AUTO_KEY, 'off');
      // 简单确认：用 toast 提示可手动开启（不打断流程）
      toast('已保存配置。可在「切后台自动备份」处开启自动备份');
    } else {
      toast('配置已保存 ✓');
    }
  });

  $('wdTestBtn').addEventListener('click', async () => {
    try { await wdTestConnection(); toast('连接成功 ✓'); }
    catch (e) { toast((e && e.message) || '连接失败'); }
  });

  $('wdBackupBtn').addEventListener('click', async () => {
    try {
      const r = await wdBackupNow();
      toast('已备份到服务器：' + r.filename);
    } catch (e) {
      toast((e && e.message) || '备份失败');
    }
    wdRender();
  });

  // 恢复三模式
  let wdRestoreMode = 'merge';
  let wdRestoreName = null;
  $('wdModeChips').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    wdRestoreMode = chip.dataset.wdMode;
    $('wdModeChips').querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
    $('wdRestoreModeHint').textContent =
      wdRestoreMode === 'merge' ? '合并：按 id 去重并入当前记录（推荐）。'
      : wdRestoreMode === 'new' ? '新增：备份记录全部追加（id 冲突自动重新生成）。'
      : '覆盖：用备份完全替换当前记录——覆盖前自动把当前数据备份到本机下载目录。';
  });
  async function loadWdRestoreList() {
    const listEl = $('wdRestoreList');
    try {
      const files = await wdList();
      if (!files.length) {
        listEl.innerHTML = '<p class="dialog-hint">服务器上没有备份——先「立即备份」一次。</p>';
        $('wdRestoreConfirm').disabled = true;
        return;
      }
      $('wdRestoreConfirm').disabled = false;
      listEl.innerHTML = files.map((f, i) =>
        `<button class="chip" data-i="${i}" style="width:100%;justify-content:flex-start;margin-bottom:6px;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">🔒 ${f.name}${f.date ? ' · ' + f.date : ''}</button>`
      ).join('');
      listEl.querySelectorAll('.chip').forEach((btn) => {
        btn.addEventListener('click', () => {
          listEl.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
          btn.classList.add('active');
          wdRestoreName = files[parseInt(btn.dataset.i, 10)].name;
        });
      });
      wdRestoreName = files[0].name;
      const first = listEl.querySelector('.chip');
      if (first) first.classList.add('active');
    } catch (e) {
      listEl.innerHTML = '<p class="dialog-hint">读取失败：' + ((e && e.message) || '') + '</p>';
    }
  }
  $('wdRestoreBtn').addEventListener('click', () => {
    $('wdRestorePass').value = '';
    $('wdRestoreInfo').textContent = '选择要恢复的备份，输入创建它时设置的口令。历史备份各用各自创建时的口令。';
    $('wdRestoreBackdrop').classList.remove('hidden');
    loadWdRestoreList();
  });
  $('wdRestoreCancel').addEventListener('click', () => $('wdRestoreBackdrop').classList.add('hidden'));
  $('wdRestoreConfirm').addEventListener('click', async () => {
    const info = $('wdRestoreInfo');
    try {
      if (!wdRestoreName) { info.textContent = '请先选择一个备份'; return; }
      const text = await wdDownload(wdRestoreName);
      const pkg = JSON.parse(text);
      const pass = $('wdRestorePass').value;
      if (!pass) { info.textContent = '请输入创建该备份时设置的口令'; return; }
      const list = await secureImportPackage(pkg, pass);
      if (!Array.isArray(list)) throw new Error('备份数据格式异常');
      if (wdRestoreMode === 'overwrite') {
        // 覆盖前自动备份当前数据到本机 Downloads（防覆盖后想找回）
        if (records.length && window.Capacitor && Capacitor.Plugins.GuanjiSave) {
          try {
            const cur = JSON.stringify(await secureExportPackage());
            await Capacitor.Plugins.GuanjiSave.saveToDownloads({ filename: 'guanji-before-restore-' + fmtDateKey(new Date()) + '.json', data: cur });
          } catch (e) { /* 本机备份失败不阻断恢复 */ }
        }
        records = list;
      } else if (wdRestoreMode === 'new') {
        const existing = new Set(records.map((r) => r.id));
        list.forEach((r) => { if (existing.has(r.id)) r.id = newRecordId('rec'); records.push(r); });
      } else {
        const byId = new Map();
        records.forEach((r) => byId.set(r.id, r));
        list.forEach((r) => { if (r && r.id) byId.set(r.id, r); });
        records = [...byId.values()];
      }
      if (typeof normalizeOffsets === 'function') normalizeOffsets();
      Storage.saveRecords(records);
      afterRecordsChanged();
      $('wdRestoreBackdrop').classList.add('hidden');
      toast('已从服务器恢复 ' + list.length + ' 条记录');
      renderHome();
      wdRender();
    } catch (e) {
      info.textContent = '恢复失败：' + ((e && e.message) || '口令错误或数据损坏');
    }
  });

  // 服务器备份管理（行内二次确认删除，同 #110 风格）
  let wdManageTimer = null;
  async function loadWdManage() {
    const listEl = $('wdManageList');
    try {
      const files = await wdList();
      if (!files.length) { listEl.innerHTML = '<p class="dialog-hint">服务器上没有备份。</p>'; return; }
      listEl.innerHTML = files.map((f, i) =>
        `<div class="bkp-row" style="display:flex;align-items:center;gap:8px;padding:10px 2px;border-bottom:1px solid var(--line)">
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">🔒 ${f.name}</span>
          <button class="bkp-del" data-i="${i}" style="flex-shrink:0;border:none;background:none;color:var(--accent-deep);font-size:12px;padding:4px 8px;cursor:pointer">删除</button>
        </div>`).join('');
      listEl.querySelectorAll('.bkp-del').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (btn.dataset.armed !== '1') {
            btn.dataset.armed = '1';
            btn.textContent = '确认删除？';
            clearTimeout(wdManageTimer);
            wdManageTimer = setTimeout(() => {
              listEl.querySelectorAll('.bkp-del').forEach((b) => { b.dataset.armed = ''; b.textContent = '删除'; });
            }, 3000);
            return;
          }
          const name = files[parseInt(btn.dataset.i, 10)].name;
          try {
            const r = await wdDelete(name);
            if (r === false) toast('文件不存在或已删除');
            else toast('已删除 ' + name);
            await loadWdManage();
          } catch (e) {
            toast('删除失败：' + ((e && e.message) || ''));
            btn.dataset.armed = ''; btn.textContent = '删除';
          }
        });
      });
    } catch (e) {
      listEl.innerHTML = '<p class="dialog-hint">读取失败：' + ((e && e.message) || '') + '</p>';
    }
  }
  $('wdManageBtn').addEventListener('click', () => {
    $('wdManageBackdrop').classList.remove('hidden');
    loadWdManage();
  });
  $('wdManageClose').addEventListener('click', () => $('wdManageBackdrop').classList.add('hidden'));

  // 切后台自动备份开关（默认关——数据离开设备需明确授权）
  $('wdAutoSwitch').addEventListener('click', () => {
    const on = $('wdAutoSwitch').classList.toggle('on');
    localStorage.setItem(WD.AUTO_KEY, on ? 'on' : 'off');
    toast(on ? '切后台自动备份已开启' : '已关闭自动备份');
  });

  // 清除配置
  $('wdResetBtn').addEventListener('click', () => {
    localStorage.removeItem(WD.CFG_KEY);
    localStorage.removeItem(WD.STAT_KEY);
    localStorage.removeItem(WD.AUTO_KEY);
    wdSavePass('');
    $('wdPass').value = '';
    toast('WebDAV 配置已清除');
    wdRender();
  });

  // 切后台自动备份（pause：WebView 存活窗口内尽力上传；失败状态下次可见）
  if (window.Capacitor && Capacitor.Plugins.App) {
    try {
      Capacitor.Plugins.App.addListener('pause', () => { wdAutoBackup().catch(() => {}); });
    } catch (e) { /* 旧版本无 pause 事件则跳过 */ }
  }
}
