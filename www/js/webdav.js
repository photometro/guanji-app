// 观己 App · webdav（#115 P5：WebDAV 备份通道——配置/测试/上传/列表/下载/删除/自动备份）
// 设计定稿：#115 全流程 + 冲击分析 + 自我拷问修正（2026-08-10）
// 依赖：secure.js（secureMode/secureExportPackage）、storage.js（newRecordId）、records.js（fmtDateKey）

/* ---------- WebDAV 常量与配置 ---------- */

const WD = {
  CFG_KEY: 'guanji_webdav_cfg',      // { url, username, dir }（dir 如 'guanji'；密码独立存安全存储）
  PASS_KEY: 'guanji_webdav_pass',    // Keystore（@aparajita 同款 internal API）；浏览器降级 localStorage
  STAT_KEY: 'guanji_webdav_stat',    // { lastBackup, lastStatus, lastError, lastErrorTime, fingerprint, autoState }
  AUTO_KEY: 'guanji_webdav_auto',    // 'on' | 'off'（打开 App 时自动备份，默认 off——上传需明确授权）
  DEVICE_KEY: 'guanji_device_id',    // 设备短标识（文件名防多设备撞车）
  DIR: 'guanji',                     // 服务器子目录（自动建）
  TIMEOUT: 20000,
};

// #187：未配置时从“备份与恢复”进入配置页，关闭后回到该任务首页。
let wdConfigReturnToBackupHub = false;

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

/* #175/#185：服务器备份使用统一类型标识；同一任务的重试由调用方复用同名文件。 */
function wdBackupFilename(date = new Date()) {
  return buildGuanjiFilename('server', 'json', date);
}

/* 同一秒跨设备生成同名文件时顺延序号；列举失败不阻断上传，避免把列表服务故障变成无法备份。 */
async function wdUniqueBackupFilename(base) {
  try {
    const files = await wdList();
    const names = new Set(files.map((file) => file.name));
    if (!names.has(base)) return base;
    const dot = base.lastIndexOf('.json');
    const stem = dot > 0 ? base.slice(0, dot) : base;
    for (let i = 2; i <= 99; i += 1) {
      const candidate = `${stem}-${i}.json`;
      if (!names.has(candidate)) return candidate;
    }
  } catch (e) { /* 列表不可用时仍尝试使用稳定主文件名 */ }
  return base;
}

/* 上传密文包 */
async function wdUpload(pkgJson, fname) {
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

function wdCanonical(value) {
  if (Array.isArray(value)) return value.map((item) => wdCanonical(item));
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = wdCanonical(value[key]);
      return out;
    }, {});
  }
  return value;
}

/* #175：全量稳定内容摘要，覆盖新增、编辑、删除、导入/恢复及情绪/诱因/备注变化。 */
async function wdFingerprint() {
  const payload = wdCanonical({
    schema: 2,
    mode: secureMode(),
    records: Array.isArray(records) ? records : [],
  });
  const raw = JSON.stringify(payload);
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    try {
      const bytes = new TextEncoder().encode(raw);
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
      return 'sha256:' + hex;
    } catch (e) { /* WebView 不支持 subtle 时使用稳定 JSON 回退 */ }
  }
  return 'v2:' + raw;
}

/* 手动备份（#115：复用加密包逻辑，内存生成不落盘） */
async function wdBackupNow(options = {}) {
  if (secureMode() !== 'encrypted') throw new Error('WebDAV 备份需要开启加密（明文模式不上传）');
  if (!records.length) throw new Error('还没有记录可备份');
  const task = options.task || {};
  const fingerprint = options.fingerprint || await wdFingerprint();
  const pkg = await secureExportPackage();
  const json = JSON.stringify(pkg);
  if (!task.filename) task.filename = await wdUniqueBackupFilename(wdBackupFilename());
  const fname = await wdUpload(json, task.filename);
  const stat = wdLoadStat();
  stat.lastBackup = new Date().toISOString();
  stat.lastStatus = 'ok';
  stat.lastError = '';
  stat.lastErrorTime = '';
  stat.lastFilename = fname;
  stat.fingerprint = fingerprint;
  stat.autoState = 'success';
  stat.autoRetryCount = 0;
  wdSaveStat(stat);
  return { filename: fname, count: pkg.recordCount };
}

let wdAutoBackupPending = false;
let wdAutoBackupTimer = null;
const WD_AUTO_RETRY_DELAYS = [1000, 3000, 8000];

function wdIsOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function wdSetAutoState(state, error = '', retryCount = 0) {
  const stat = wdLoadStat();
  stat.autoState = state;
  stat.autoRetryCount = retryCount;
  if (state === 'waiting') {
    stat.lastStatus = 'waiting';
    stat.lastError = String(error || '等待网络恢复后自动上传').slice(0, 120);
    stat.lastErrorTime = new Date().toISOString();
  } else if (state === 'retrying') {
    // 重试中不是最终失败，保留入口行的“已配置/上次成功”状态。
    stat.lastError = String(error || '自动备份失败').slice(0, 120);
    stat.lastErrorTime = new Date().toISOString();
  } else if (error) {
    stat.lastStatus = 'error';
    stat.lastError = String(error).slice(0, 120);
    stat.lastErrorTime = new Date().toISOString();
  } else if (state === 'uploading' || state === 'retrying' || state === 'waiting') {
    stat.lastStatus = state === 'waiting' ? 'waiting' : stat.lastStatus || 'never';
  }
  wdSaveStat(stat);
  if (typeof wdRender === 'function') wdRender();
}

function wdDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* #175：前台自动备份有限重试。每次任务复用同一文件名，避免超时后重复生成备份。 */
async function wdAutoBackup() {
  if (!wdAutoEnabled()) return;
  if (secureMode() !== 'encrypted') return;
  if (!records.length) return;
  if (wdIsOffline()) {
    wdSetAutoState('waiting', '等待网络恢复后自动上传');
    return;
  }
  const fp = await wdFingerprint();
  const stat = wdLoadStat();
  if (stat.fingerprint === fp) return;   // 自上次备份无变化
  if (wdAutoBackupPending) return;       // 冷启动与前台事件重叠时只上传一次
  wdAutoBackupPending = true;
  const task = { filename: null };
  let lastError = null;
  try {
    wdSetAutoState('uploading');
    for (let attempt = 0; attempt <= WD_AUTO_RETRY_DELAYS.length; attempt += 1) {
      try {
        await wdBackupNow({ fingerprint: fp, task });
        lastError = null;
        break;
      } catch (e) {
        lastError = e;
        if (attempt >= WD_AUTO_RETRY_DELAYS.length) break;
        if (wdIsOffline()) {
          wdSetAutoState('waiting', '等待网络恢复后自动上传', attempt + 1);
          return;
        }
        wdSetAutoState('retrying', (e && e.message) || '自动备份失败', attempt + 1);
        await wdDelay(WD_AUTO_RETRY_DELAYS[attempt]);
      }
    }
    if (lastError) {
      wdSetAutoState(wdIsOffline() ? 'waiting' : 'error', (lastError && lastError.message) || '自动备份失败', WD_AUTO_RETRY_DELAYS.length);
    }
  } finally {
    wdAutoBackupPending = false;
    if (typeof wdRender === 'function') wdRender();
  }
}

/* WebView 恢复后的短暂等待；离线时挂起，online/前台事件会重新调度。 */
function wdScheduleAutoBackup(reason = 'foreground') {
  if (wdAutoBackupTimer) clearTimeout(wdAutoBackupTimer);
  if (!wdAutoEnabled()) return;
  if (wdIsOffline()) {
    wdSetAutoState('waiting', '等待网络恢复后自动上传');
    return;
  }
  wdAutoBackupTimer = setTimeout(() => {
    wdAutoBackupTimer = null;
    wdAutoBackup().catch(() => {});
  }, 800);
}

/* ---------- WebDAV 卡 UI（#115） ---------- */

function wdRender() {
  const enc = secureMode() === 'encrypted';
  const cfg = wdLoadCfg();
  const stat = wdLoadStat();
  const st = $('wdStatus');
  const formatLast = () => {
    if (!stat.lastBackup) return '尚未备份';
    const d = new Date(stat.lastBackup), pad = (n) => String(n).padStart(2, '0');
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  };
  const syncSummary = !enc ? '开启加密后可用'
    : !cfg ? '未配置服务器'
    : stat.autoState === 'uploading' ? '正在同步…'
    : stat.autoState === 'retrying' ? '同步重试中…'
    : stat.autoState === 'waiting' ? '等待网络恢复'
    : stat.lastStatus === 'error' ? '上次同步失败'
    : '服务器已连接 · ' + formatLast() + ' · 自动同步' + (wdAutoEnabled() ? '已开启' : '已关闭');
  const syncSub = $('backupSyncSub'), syncStatus = $('backupSyncStatus'), autoSwitch = $('wdAutoSwitch');
  const manualBackup = $('backupSyncNowBtn');
  if (syncSub) syncSub.textContent = syncSummary;
  if (syncStatus && (!$('backupSyncBackdrop') || $('backupSyncBackdrop').dataset.backupHubView === 'home')) syncStatus.textContent = syncSummary;
  if (autoSwitch) autoSwitch.classList.toggle('on', wdAutoEnabled());
  if (manualBackup) manualBackup.disabled = !(enc && cfg);
  // #117：入口行副标题（未配置/已配置+状态）——服务器备份行
  const cfgSub = $('wdCfgSub');
  if (cfgSub) {
    cfgSub.textContent = !enc ? '开启加密后可用'
      : !cfg ? '未配置'
      : stat.lastStatus === 'error' ? '上次备份失败'
      : stat.lastBackup ? '已配置 · 上次备份 ' + ((new Date(stat.lastBackup)).getMonth() + 1) + '月' + (new Date(stat.lastBackup)).getDate() + '日'
      : '已配置';
  }
  if (st) {
    if (!enc) {
      st.textContent = '开启加密后可用——备份上传的是密文，只有你的口令能解开。';
      return;
    }
    if (!cfg) {
      st.textContent = '配置你的 WebDAV 服务器（如坚果云、群晖、Nextcloud）。备份只发往你配置的服务器——观己不提供任何云服务。';
      return;
    }
    if (stat.autoState === 'uploading') {
      st.textContent = '正在上传自动备份…';
    } else if (stat.autoState === 'retrying') {
      st.textContent = '自动备份遇到网络波动，正在重试…';
    } else if (stat.autoState === 'waiting') {
      st.textContent = '等待网络恢复后自动上传。';
    } else if (stat.lastStatus === 'error') {
      st.textContent = '上次备份失败：' + (stat.lastError || '未知错误') + '（' + ((stat.lastErrorTime || '').slice(0, 10)) + '）';
    } else if (stat.lastBackup) {
      const d = new Date(stat.lastBackup);
      const pad = (n) => String(n).padStart(2, '0');
      st.textContent = '上次备份：' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' ✓';
    } else {
      st.textContent = '已配置，尚未备份。';
    }
  }
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
    $('wdCfgBackdrop').classList.add('hidden');
    wdConfigReturnToBackupHub = false;
    const openManage = () => {
      if (typeof window.openBackupHubServerManage === 'function') {
        if (typeof window.isBackupHubOpen !== 'function' || !window.isBackupHubOpen()) window.openBackupHub();
        window.openBackupHubServerManage();
      }
      loadWdManage();
    };
    openManage();
    // 首次配置后询问自动备份（数据离开设备需明确授权）
    if (localStorage.getItem(WD.AUTO_KEY) === null) {
      localStorage.setItem(WD.AUTO_KEY, 'off');
      toast('已保存配置。可在「备份与同步」中开启自动同步');
    } else {
      toast('配置已保存 ✓');
    }
  });

  $('wdTestBtn').addEventListener('click', async () => {
    try { await wdTestConnection(); toast('连接成功 ✓'); }
    catch (e) { toast((e && e.message) || '连接失败'); }
  });

  async function performManualBackup() {
    try {
      const r = await wdBackupNow();
      toast('已备份到服务器：' + r.filename);
    } catch (e) {
      toast((e && e.message) || '备份失败');
    }
    wdRender();
  }
  $('wdBackupBtn').addEventListener('click', performManualBackup);
  $('backupSyncNowBtn').addEventListener('click', performManualBackup);

  $('backupSyncBtn').addEventListener('click', () => {
    wdRender();
    if (typeof window.openBackupHub === 'function') window.openBackupHub();
    else openSheetPanel('backupSyncBackdrop');
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
        listEl.innerHTML = backupPicker.renderList([], { emptyText: '服务器上没有备份——先「立即备份」一次。' });
        $('wdRestoreConfirm').disabled = true;
        return;
      }
      $('wdRestoreConfirm').disabled = false;
      const renderRestorePrimary = (file) => {
        if (!file) return '';
        return `<div class="primary-card"><div class="primary-line"><span class="file-icon">${backupPicker.icon('encrypted')}</span><div class="primary-copy"><strong>当前选择备份</strong><span>${backupPicker.escapeHtml(file.date || '服务器备份')} · ${backupPicker.escapeHtml(file.name || '')}</span></div><span class="badge">可用</span></div><div class="primary-meta"><span>类型 <b>加密 JSON</b></span><span>大小 <b>${backupPicker.escapeHtml(file.sizeLabel || '128 KB')}</b></span></div></div>`;
      };
      const renderRestoreRow = (file, index, options) => {
        const active = options.selectedIndex === index;
        return `<div class="history-row" data-backup-index="${index}" role="button" tabindex="0"><span class="file-icon">${backupPicker.icon('encrypted')}</span><div class="history-copy"><strong>${backupPicker.escapeHtml(file.name || '')}</strong><span>${backupPicker.escapeHtml(file.date || '服务器备份')} · 加密 JSON</span></div><button class="select${active ? ' active' : ''}" type="button" data-select="${index}">${active ? '已选择' : '选择'}</button></div>`;
      };
      const render = (selectedIndex) => {
        listEl.innerHTML = backupPicker.renderList(files, {
          task: 'server',
          selectedIndex,
          historyTitle: '更早备份',
          renderPrimary: renderRestorePrimary,
          renderHistory: renderRestoreRow,
        });
        listEl.querySelectorAll('.history-row[data-backup-index]').forEach((row) => {
          const pick = () => {
            const index = parseInt(row.dataset.backupIndex, 10);
            wdRestoreName = files[index].name;
            render(index);
          };
          row.addEventListener('click', (event) => {
            if (event.target.closest('button')) event.preventDefault();
            pick();
          });
          row.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pick(); } });
        });
      };
      wdRestoreName = files[0].name;
      render(0);
    } catch (e) {
      listEl.innerHTML = '<p class="dialog-hint">读取失败：' + ((e && e.message) || '') + '</p>';
    }
  }
  window.openServerRestore = () => {
    wdRestoreName = null;
    $('wdRestorePass').value = '';
    $('wdRestoreInfo').textContent = '';
    $('wdRestoreInfo').classList.add('hidden');
    if (typeof window.openBackupHubServer === 'function') window.openBackupHubServer();
    loadWdRestoreList();
  };
  $('wdRestoreBtn').addEventListener('click', () => window.openServerRestore());
  $('wdRestoreCancel').addEventListener('click', () => {
    if (typeof window.backupHubBack === 'function') window.backupHubBack();
  });
  $('wdRestoreConfirm').addEventListener('click', async () => {
    const info = $('wdRestoreInfo');
    try {
      if (!wdRestoreName) { info.textContent = '请先选择一个备份'; info.classList.remove('hidden'); return; }
      const text = await wdDownload(wdRestoreName);
      const pkg = JSON.parse(text);
      const pass = $('wdRestorePass').value;
      if (!pass) { info.textContent = '请输入创建该备份时设置的口令'; info.classList.remove('hidden'); return; }
      const list = await secureImportPackage(pkg, pass);
      if (!Array.isArray(list)) throw new Error('备份数据格式异常');
      if (wdRestoreMode === 'overwrite') {
        // 覆盖前自动备份当前数据到本机 Downloads（防覆盖后想找回）
        if (records.length && window.Capacitor && Capacitor.Plugins.GuanjiSave) {
          try {
            const cur = JSON.stringify(await secureExportPackage());
            await Capacitor.Plugins.GuanjiSave.saveToDownloads({ filename: await uniqueGuanjiFilename('restore', 'json'), data: cur });
          } catch (e) { /* 本机备份失败不阻断恢复 */ }
        }
        // #202：覆盖恢复替换整套数据，旧数据集的 AI 洞察不可继续复用。
        if (typeof invalidateInsightCache === 'function') invalidateInsightCache();
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
      const statsSnapshot = typeof commitRecordChanges === 'function'
        ? commitRecordChanges()
        : (Storage.saveRecords(records), afterRecordsChanged());
      if (typeof window.closeBackupHub === 'function') window.closeBackupHub();
      toast('已从服务器恢复 ' + list.length + ' 条记录');
      renderHome(statsSnapshot);
      wdRender();
    } catch (e) {
      info.textContent = '恢复失败：' + ((e && e.message) || '口令错误或数据损坏');
      info.classList.remove('hidden');
    }
  });

  // #117：服务器备份入口——未配置→配置弹窗；已配置→服务器管理弹窗
  $('wdCfgBtn').addEventListener('click', () => {
    if (secureMode() !== 'encrypted') { toast('开启加密后可用——服务器备份是加密通道'); return; }
    if (wdLoadCfg()) {
      const openManage = () => {
        if (typeof window.openBackupHubServerManage === 'function') {
          if (typeof window.isBackupHubOpen !== 'function' || !window.isBackupHubOpen()) window.openBackupHub();
          window.openBackupHubServerManage();
        }
        loadWdManage();
      };
      openManage();
    } else {
      $('wdStatus').textContent = '配置你的 WebDAV 服务器（如坚果云、群晖、Nextcloud）。备份只发往你配置的服务器——观己不提供任何云服务。';
      const openConfig = () => $('wdCfgBackdrop').classList.remove('hidden');
      const backupHubOpen = typeof window.isBackupHubOpen === 'function' && window.isBackupHubOpen();
      wdConfigReturnToBackupHub = backupHubOpen;
      if (backupHubOpen && typeof closeSheetPanel === 'function') {
        // 先完成父 Sheet 的关闭动画，避免两个同层级 backdrop 同时拦截点击。
        closeSheetPanel('backupSyncBackdrop', openConfig);
      } else {
        openConfig();
      }
    }
  });
  function closeWdConfigAndReturn() {
    $('wdCfgBackdrop').classList.add('hidden');
    const shouldReturn = wdConfigReturnToBackupHub;
    wdConfigReturnToBackupHub = false;
    if (shouldReturn && typeof window.openBackupHub === 'function') window.openBackupHub();
  }
  window.closeWdConfigAndReturn = closeWdConfigAndReturn;
  $('wdCfgCancel').addEventListener('click', closeWdConfigAndReturn);

  // 服务器管理弹窗（#117：测试连接/立即上传/列表删除/清除配置）
  let wdManageTimer = null;
  async function loadWdManage() {
    const listEl = $('wdManageList');
    try {
      const manageHint = $('wdManageHint');
      if (manageHint) { manageHint.dataset.state = 'loading'; manageHint.textContent = '正在读取…'; }
      const files = await wdList();
      const stat = wdLoadStat();
      const lastUpload = stat.lastBackup
        ? (() => { const d = new Date(stat.lastBackup); const pad = (n) => String(n).padStart(2, '0'); return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); })()
        : (files[0] && files[0].date) || '尚未上传';
      if (manageHint) { manageHint.dataset.state = 'ready'; manageHint.textContent = '已连接 · 最近上传 ' + lastUpload; }
      if (!files.length) { listEl.innerHTML = backupPicker.renderList([], { emptyText: '服务器上没有备份。' }); return; }
      const renderManagePrimary = (file) => `<div class="primary-card"><div class="primary-line"><span class="file-icon">${backupPicker.icon('check')}</span><div class="primary-copy"><strong>最近一次备份</strong><span>${backupPicker.escapeHtml(file.date || '服务器备份')} · ${backupPicker.escapeHtml(file.name || '')}</span></div></div><div class="primary-meta"><span>远端文件 <b>${files.length} 份</b></span><span>文件类型 <b>加密 JSON</b></span></div></div>`;
      const renderManageRow = (file, index) => `<div class="history-row" data-backup-index="${index}"><span class="file-icon">${backupPicker.icon('encrypted')}</span><div class="history-copy"><strong>${backupPicker.escapeHtml(file.name || '')}</strong><span>${backupPicker.escapeHtml(file.date || '服务器备份')} · 加密 JSON</span></div><button type="button" class="select" data-wd-delete-index="${index}">删除</button></div>`;
      listEl.innerHTML = backupPicker.renderList(files, {
        task: 'manage',
        selectedIndex: 0,
        historyTitle: '更早备份',
        renderPrimary: renderManagePrimary,
        renderHistory: renderManageRow,
      });
      listEl.querySelectorAll('.select[data-wd-delete-index]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (btn.dataset.armed !== '1') {
            btn.dataset.armed = '1';
            btn.textContent = '确认删除？';
            clearTimeout(wdManageTimer);
            wdManageTimer = setTimeout(() => {
              listEl.querySelectorAll('.select[data-wd-delete-index]').forEach((b) => { b.dataset.armed = ''; b.textContent = '删除'; });
            }, 3000);
            return;
          }
          const name = files[parseInt(btn.dataset.wdDeleteIndex, 10)].name;
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
      const manageHint = $('wdManageHint');
      if (manageHint) { manageHint.dataset.state = 'error'; manageHint.textContent = '读取失败'; }
      listEl.innerHTML = '<p class="dialog-hint">读取失败：' + ((e && e.message) || '') + '</p>';
    }
  }
  // #184：服务器管理留在同一数据保护 Sheet 内，返回首页而不是退出到“我的”。
  $('wdManageClose').addEventListener('click', () => {
    if (typeof window.backupHubBack === 'function') window.backupHubBack();
  });

  // 打开 App 时自动备份开关（默认关——上传需明确授权）
  $('wdAutoSwitch').addEventListener('click', () => {
    if (secureMode() !== 'encrypted' || !wdLoadCfg()) {
      toast(secureMode() !== 'encrypted' ? '开启加密后可用——自动同步上传的是密文' : '请先配置服务器');
      wdRender();
      return;
    }
    const on = $('wdAutoSwitch').classList.toggle('on');
    localStorage.setItem(WD.AUTO_KEY, on ? 'on' : 'off');
    toast(on ? '自动同步已开启' : '已关闭自动同步');
    wdRender();   // #119：入口行副标题同步
  });

  // 清除配置（#117：清除后回到配置弹窗态）
  $('wdResetBtn').addEventListener('click', () => {
    localStorage.removeItem(WD.CFG_KEY);
    localStorage.removeItem(WD.STAT_KEY);
    localStorage.removeItem(WD.AUTO_KEY);
    wdSavePass('');
    $('wdPass').value = '';
    toast('服务器配置已清除');
    wdRender();
    if (typeof window.backupHubBack === 'function') window.backupHubBack();
  });

  // #128：冷启动与回到前台均在稳定的前台窗口备份；不再在后台切换时请求网络。
  wdScheduleAutoBackup();
  window.addEventListener('online', () => wdScheduleAutoBackup('online'));
  if (window.Capacitor && Capacitor.Plugins.App) {
    try {
      Capacitor.Plugins.App.addListener('appStateChange', (state) => {
        if (state && state.isActive) wdScheduleAutoBackup();
      });
    } catch (e) { /* 旧版本无 appStateChange 事件时仍保留冷启动自动备份 */ }
  }
}
