// 观己 App · 入口（P1 搬移式拆分，2026-08-09）——事件绑定 + 键盘处理 + 启动
// 依赖加载顺序（index.html 中）：storage → records → stats → ai → ui-home → ui-calendar → ui-sheet → ui-timer → liquid-glass → app.js（本文件最后）
// 全局函数/变量照旧（跨文件运行时解析）；moveTabSlide/liquidTabPulse 定义随事件绑定区保留在此
// 观己 App · app（P1 搬移式拆分，2026-08-09——函数原样搬移，零逻辑改动）
/* ---------- 事件绑定 ---------- */

/* #280：自定义 GuanjiSave 是原生回退链的正式插件，但 Capacitor 8
   不会因为 Java 侧 registerPlugin 就自动创建 JS proxy。显式注册一次
   让 Native 与旧 WebView 使用同一套 Downloads 数据源，而不是把“插件
   未挂载”误报成“没有本机文件”。 */
function ensureGuanjiSavePlugin() {
  const cap = window.Capacitor;
  if (!cap) return null;
  if (cap.Plugins && cap.Plugins.GuanjiSave) return cap.Plugins.GuanjiSave;
  if (typeof cap.registerPlugin !== 'function') return null;
  try { return cap.registerPlugin('GuanjiSave'); } catch (_) { return null; }
}
try { ensureGuanjiSavePlugin(); } catch (_) { /* browser preview */ }

/* Tab 滑块跟踪：跟随 tab 按钮（三等分格），圆角与容器同心 */
function moveTabSlide(target, slideEl) {
  const bar = $('tabbar');
  const barRect = bar.getBoundingClientRect();
  const tRect = target.getBoundingClientRect();
  slideEl.style.left = (tRect.left - barRect.left) + 'px';
  slideEl.style.width = tRect.width + 'px';
}

/* #81 方案 C 定稿：液态玻璃 tab 切换——SVG 液体变形脉冲
   切换瞬间 feDisplacementMap scale 0→20→0（sin 曲线 650ms）+ seed 随机换形；
   仅玻璃态生效（非玻璃态滑块无 filter，跳过）；静止时 scale=0 无变形无性能负担 */
function liquidTabPulse() {
  if (!document.documentElement.classList.contains('liquid-glass')) return;
  const disp = document.getElementById('lg-disp');
  if (!disp) return;
  const turb = document.getElementById('lg-turb');
  if (turb) turb.setAttribute('seed', Math.floor(Math.random() * 999));
  const peak = 20;
  const dur = 650;
  const t0 = performance.now();
  function frame(t) {
    const p = Math.min((t - t0) / dur, 1);
    disp.setAttribute('scale', Math.sin(p * Math.PI) * peak);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* #218：统一 Tab 焦点来源，避免 OEM 手势返回把触摸焦点误判为 focus-visible。 */
function markTabFocusOrigin(tab, origin) {
  if (tab && tab.classList.contains('tab')) tab.dataset.focusOrigin = origin;
}

function clearTransientTabFocus(force = false) {
  const active = document.activeElement;
  if (!active || !active.classList || !active.classList.contains('tab')) return;
  if (force || active.dataset.focusOrigin !== 'keyboard') active.blur();
}

let lastInputModality = 'keyboard';
function setInputModality(origin) {
  lastInputModality = origin;
}
document.addEventListener('pointerdown', () => setInputModality('pointer'), true);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') setInputModality('keyboard');
}, true);
document.addEventListener('focusin', (e) => {
  if (e.target && e.target.classList && e.target.classList.contains('tab')) {
    markTabFocusOrigin(e.target, lastInputModality);
  }
}, true);

/* #274：原生 Tab 只接管底部职责；WebView 继续作为正文和路由事实源。 */
function notifyNativeTabRoute(routeKey) {
  try {
    if (window.GuanjiNativeTab && typeof window.GuanjiNativeTab.onRouteChanged === 'function') {
      window.GuanjiNativeTab.onRouteChanged(routeKey);
    }
  } catch (_) { /* 原生桥不可用时保持纯 WebView 路径 */ }
}

function notifyNativeTabTheme() {
  try {
    if (!window.GuanjiNativeTab) return;
    const root = document.documentElement;
    const style = getComputedStyle(root);
    const rawBlur = parseFloat(style.getPropertyValue('--lg-blur'));
    const rawSaturate = parseFloat(style.getPropertyValue('--lg-saturate'));
    const snapshot = {
      theme: root.getAttribute('data-theme') || 'light',
      liquidGlass: root.classList.contains('liquid-glass'),
      blurPx: Number.isFinite(rawBlur) ? Math.max(0, Math.min(10, rawBlur)) : 3,
      saturate: Number.isFinite(rawSaturate) ? Math.max(1, Math.min(3, rawSaturate)) : 2,
      reducedTransparency: !!(window.matchMedia && window.matchMedia('(prefers-reduced-transparency: reduce)').matches)
    };
    // #274 scope boundary: only classic mode hides the WebView Tab. Glass mode
    // remains WebView-owned until its dedicated native migration is implemented.
    const requested = window.__guanjiNativeTabRequested === true;
    const useNativeClassic = requested && !snapshot.liquidGlass;
    const bar = $('tabbar');
    if (bar) {
      bar.classList.toggle('native-tab-hidden', useNativeClassic);
      if (useNativeClassic) {
        bar.setAttribute('aria-hidden', 'true');
        bar.setAttribute('inert', '');
      } else {
        bar.removeAttribute('aria-hidden');
        bar.removeAttribute('inert');
      }
    }
    if (typeof window.GuanjiNativeTab.onMaterialChanged === 'function') {
      window.GuanjiNativeTab.onMaterialChanged(JSON.stringify(snapshot));
    } else if (typeof window.GuanjiNativeTab.onThemeChanged === 'function') {
      window.GuanjiNativeTab.onThemeChanged(snapshot.theme, snapshot.liquidGlass);
    }
  } catch (_) { /* 只读同步，失败不影响页面 */ }
}

/* #274 material follow-up：Tab 背景取样只在滚动结束后刷新，避免逐帧 draw WebView。 */
let nativeTabBackdropTimer = 0;
function notifyNativeTabBackdrop() {
  if (!window.GuanjiNativeTab || typeof window.GuanjiNativeTab.onBackdropChanged !== 'function') return;
  clearTimeout(nativeTabBackdropTimer);
  nativeTabBackdropTimer = setTimeout(() => {
    try { window.GuanjiNativeTab.onBackdropChanged(); } catch (_) { /* optional bridge */ }
  }, 120);
}
document.addEventListener('scroll', notifyNativeTabBackdrop, { capture: true, passive: true });

window.__guanjiSelectTab = function (screenName) {
  const tab = Array.from(document.querySelectorAll('.tab')).find((item) => item.dataset.screen === screenName);
  if (!tab) return 'pending';
  tab.click();
  return 'ok';
};

/* #278：原生“我的”只接收可渲染的设置快照；密钥、口令和原始记录永不出桥。
   所有写操作仍调用 WebView 既有函数，避免出现第二套设置存储。 */
window.__guanjiNativeSettingsContext = function () {
  const provider = (typeof aiStore !== 'undefined' && aiStore.active) || 'deepseek';
  const p = (typeof aiStore !== 'undefined' && aiStore.providers && aiStore.providers[provider]) || {};
  const reminder = typeof loadReminder === 'function' ? loadReminder() : { enabled: false, time: '21:00' };
  const secure = typeof secureMode === 'function' ? secureMode() : 'plain';
  const liveBadge = $('liveTestBadge');
  const liveResult = $('liveTestStatus');
  const liveRows = liveResult && !liveResult.classList.contains('hidden')
    ? Array.from(liveResult.querySelectorAll('.live-test-result-row')).map((row) => {
        const label = row.querySelector('.live-test-result-label')?.textContent?.trim() || '';
        const value = row.querySelector('.live-test-result-value')?.textContent?.trim() || '';
        return [label, value];
      })
    : [];
  const liveValue = (label) => liveRows.find(([key]) => key === label)?.[1] || '';
  const aboutVer = document.querySelector('.about-ver')?.textContent || '';
  const versionMatch = aboutVer.match(/v([0-9.]+)/);
  const providerLabel = (typeof AI_PROVIDERS !== 'undefined' && AI_PROVIDERS[provider]?.label) || provider;
  const recordCount = typeof records !== 'undefined' && Array.isArray(records) ? records.length : 0;
  const webDavConfig = typeof wdLoadCfg === 'function' ? wdLoadCfg() : null;
  return {
    themeMode: localStorage.getItem(typeof THEME_KEY !== 'undefined' ? THEME_KEY : 'guanji_theme') || 'system',
    glassEnabled: document.documentElement.classList.contains('liquid-glass'),
    blur: parseInt(localStorage.getItem(typeof LG_BLUR_KEY !== 'undefined' ? LG_BLUR_KEY : 'guanji_glass_blur') || '3', 10) || 0,
    recordMode: typeof loadRecordMode === 'function' ? loadRecordMode() : 'timer',
    reminderEnabled: !!reminder.enabled,
    reminderTime: reminder.time || '21:00',
    timerNotificationEnabled: typeof timerNotificationEnabled === 'function' ? timerNotificationEnabled() : true,
    positiveEnabled: typeof positiveEnabled === 'function' ? positiveEnabled() : true,
    dailyTipEnabled: typeof dailyTipEnabled === 'function' ? dailyTipEnabled() : true,
    secureMode: secure,
    // Operation feedback is deliberately transient and owned by NativeRoot;
    // do not read a persisted "clear" status into the settings row.
    clearStatus: '',
    hasRecords: recordCount > 0,
    recordCount,
    webDavConfigured: !!webDavConfig,
    canClearServer: !!webDavConfig && secure === 'encrypted',
    secureSummary: secure === 'encrypted' ? '已加密 · 数据从写入那一刻起就是密文；离开设备的只有密文，只有口令能解开。' : '未开启加密——数据以明文保存在本机。推荐开启加密：即使设备或备份丢失，数据也无法被读取。',
    provider,
    providerLabel,
    baseUrl: p.baseUrl || '',
    model: p.model || '',
    hasApiKey: !!p.apiKey,
    aiConfigured: !!(p.apiKey && p.baseUrl && p.model),
    aiEditing: typeof aiKeyEditing !== 'undefined' && !!aiKeyEditing,
    aiTestStatus: $('aiTestStatus')?.textContent || '尚未测试连接',
    aiStatus: $('aiConfigStatus')?.dataset.state || 'idle',
    liveTested: !!(liveBadge && liveBadge.dataset.state && liveBadge.dataset.state !== 'idle'),
    liveBadgeText: liveBadge?.textContent || '未测试',
    liveBadgeState: liveBadge?.dataset.state || 'idle',
    liveResultText: liveResult && !liveResult.classList.contains('hidden') ? liveResult.textContent.trim() : '',
    liveSystem: liveValue('系统'),
    livePermission: liveValue('通知权限'),
    liveDisplay: liveValue('显示方式'),
    version: versionMatch ? versionMatch[1] : '4.2.7',
  };
};

/* #280：原生“我的”交给既有 WebView 弹层时，NativeRoot 需要知道何时
   可以恢复设置页所有权。只返回弹层是否可见，不跨桥传递任何业务数据。 */
window.__guanjiNativeSettingsOverlayState = function () {
  const ids = [
    'backupSyncBackdrop', 'exportBackdrop', 'dialogBackdrop',
    'aiDataScopeBackdrop', 'secBackdrop', 'wdCfgBackdrop',
    'addBackdrop', 'delBackdrop'
  ];
  const open = ids.some((id) => {
    const el = document.getElementById(id);
    return !!el && !el.classList.contains('hidden') && el.getAttribute('aria-hidden') !== 'true';
  });
  return open ? 'open' : 'closed';
};

/* #279：备份/恢复原生 Surface 的只读快照。只传文件名、日期、状态和连接
   摘要；口令、BackupEnvelope 和原始记录始终留在既有 JS/Capacitor 链。 */
window.__guanjiNativeBackupContext = async function () {
  const enc = typeof secureMode === 'function' ? secureMode() : 'plain';
  const cfg = typeof wdLoadCfg === 'function' ? wdLoadCfg() : null;
  const stat = typeof wdLoadStat === 'function' ? wdLoadStat() : {};
  const filesFromNames = (names) => (names || []).filter((name) => /\.(json|csv)$/i.test(name)).map((name) => {
    const csv = /\.csv$/i.test(name);
    const match = String(name).match(/(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})-(\d{2})/);
    return { name, date: match ? `${match[1]} ${match[2]}:${match[3]}` : '下载目录', label: csv ? 'CSV 明文' : '加密备份', sizeLabel: '' };
  });
  let localFiles = [];
  let localFilesState = 'loading';
  const savePlugin = ensureGuanjiSavePlugin();
  if (!savePlugin || typeof savePlugin.listBackupFiles !== 'function') {
    // This is not an empty Downloads directory.  It means the native file
    // bridge is not present (for example an old WebView-only build).
    localFilesState = 'legacy-unavailable';
  } else {
    try {
      const res = await savePlugin.listBackupFiles();
      if (!res || !Array.isArray(res.files)) throw new Error('invalid backup file response');
      localFiles = filesFromNames(res.files);
      localFilesState = 'ready';
    } catch (_) { localFiles = []; localFilesState = 'error'; }
  }
  let serverFiles = [];
  let serverFilesState = cfg && enc === 'encrypted'
    ? (typeof wdList === 'function' ? 'loading' : 'legacy-unavailable')
    : 'not-configured';
  if (cfg && enc === 'encrypted' && typeof wdList === 'function') {
    try {
      serverFiles = (await wdList()).map((file) => ({
        name: file.name || '', date: file.date || '服务器备份', label: '加密 JSON',
        sizeLabel: file.size ? `${Math.max(1, Math.round(file.size / 1024))} KB` : ''
      }));
      serverFilesState = 'ready';
    } catch (_) { serverFiles = []; serverFilesState = 'error'; }
  }
  const formatLast = stat.lastBackup ? (() => {
    const d = new Date(stat.lastBackup); const pad = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  })() : '尚未备份';
  const syncSummary = enc !== 'encrypted' ? '开启加密后可用' : !cfg ? '未配置服务器'
    : stat.autoState === 'uploading' ? '正在同步…' : stat.autoState === 'retrying' ? '同步重试中…'
    : stat.autoState === 'waiting' ? '等待网络恢复' : stat.autoState === 'blocked' ? '日期异常，已暂停同步'
    : stat.lastStatus === 'error' ? '上次同步失败' : `服务器已连接 · ${formatLast} · 自动同步${wdAutoEnabled() ? '已开启' : '已关闭'}`;
  return {
    secureMode: enc, webDavConfigured: !!cfg, autoSync: typeof wdAutoEnabled === 'function' && wdAutoEnabled(),
    dataState: localFilesState === 'loading' || serverFilesState === 'loading' ? 'loading'
      : localFilesState === 'error' || serverFilesState === 'error' ? 'error'
      : 'ready',
    localFilesState, serverFilesState,
    syncSummary, lastBackup: formatLast, localFiles, serverFiles,
    webDavUrl: cfg?.url || '', webDavUser: cfg?.username || ''
  };
};

/* #279：Native 只触发这些既有动作，不复制备份协议。 */
window.__guanjiNativeBackupAction = async function (type, value) {
  if (type === 'auto') {
    localStorage.setItem(WD.AUTO_KEY, value === 'on' ? 'on' : 'off');
    if (typeof wdRender === 'function') wdRender();
    return 'ok';
  }
  if (type === 'upload') {
    try { await wdBackupNow(); } catch (_) {}
    if (typeof wdRender === 'function') wdRender();
    return 'ok';
  }
  if (type === 'delete-server' && value && typeof wdDelete === 'function') {
    try { await wdDelete(value); } catch (_) {}
    return 'ok';
  }
  if (type === 'delete-local' && value && window.Capacitor?.Plugins?.GuanjiSave) {
    try { await Capacitor.Plugins.GuanjiSave.deleteBackupFile({ filename: value }); } catch (_) {}
    return 'ok';
  }
  return 'unknown';
};

/* #279：WebDAV 表单仍复用既有存储、测试和安全口令链。 */
window.__guanjiNativeWebDavSave = async function (raw) {
  let value;
  try { value = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (_) { return 'invalid'; }
  const url = String(value?.url || '').trim(); const username = String(value?.username || '').trim(); const pass = String(value?.password || '');
  if (!/^https:\/\//i.test(url) || !username || !pass) return 'invalid';
  const previous = typeof wdLoadCfg === 'function' ? wdLoadCfg() : null;
  try {
    wdSaveCfg({ url, username }); await wdSavePass(pass); await wdTestConnection();
    if (typeof wdRender === 'function') wdRender();
    return 'ok';
  } catch (error) {
    if (previous) wdSaveCfg(previous); else localStorage.removeItem(WD.CFG_KEY);
    return 'error';
  }
};

window.__guanjiNativeSettingsAction = function (rawAction) {
  let action = rawAction;
  try { if (typeof rawAction === 'string') action = JSON.parse(rawAction); } catch (_) { return 'invalid'; }
  if (!action || !action.type) return 'invalid';
  const type = String(action.type);
  const value = action.value == null ? '' : String(action.value);
  if (type === 'theme') {
    const mode = ['system', 'light', 'dark'].includes(value) ? value : 'system';
    localStorage.setItem(typeof THEME_KEY !== 'undefined' ? THEME_KEY : 'guanji_theme', mode);
    if (typeof setThemeSeg === 'function') setThemeSeg(mode);
    if (typeof applyTheme === 'function') applyTheme(mode);
    if (typeof renderHome === 'function') renderHome();
    return 'ok';
  }
  if (type === 'glass') {
    const sw = $('liquidGlassSwitch');
    if (sw && sw.classList.contains('on') !== (value === 'on')) sw.click();
    return 'ok';
  }
  if (type === 'blur') {
    const px = Math.max(0, Math.min(10, parseInt(value, 10) || 0));
    localStorage.setItem(typeof LG_BLUR_KEY !== 'undefined' ? LG_BLUR_KEY : 'guanji_glass_blur', String(px));
    if (typeof applyGlassBlur === 'function') applyGlassBlur(px);
    if (typeof notifyNativeTabTheme === 'function') notifyNativeTabTheme();
    return 'ok';
  }
  if (type === 'record-mode') {
    if (typeof saveRecordMode === 'function') saveRecordMode(value === 'quick' ? 'quick' : 'timer');
    if (typeof setRecordModeSeg === 'function') setRecordModeSeg(value === 'quick' ? 'quick' : 'timer');
    return 'ok';
  }
  if (type === 'reminder') { $('reminderSwitch')?.click(); return 'ok'; }
  if (type === 'reminder-time') { $('reminderTime')?.click(); return 'ok'; }
  if (type === 'reminder-time-set') {
    const input = $('reminderTime');
    if (input) {
      input.value = value || '21:00';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return 'ok';
  }
  if (type === 'timer-notification') { $('timerNotificationSwitch')?.click(); return 'ok'; }
  if (type === 'positive') { $('positiveSwitch')?.click(); return 'ok'; }
  if (type === 'daily-tip') { $('aiDailyTipSwitch')?.click(); return 'ok'; }
  if (type === 'secure-mode') {
    const target = document.querySelector(`#secureModeSeg .seg[data-sec-mode="${value === 'encrypted' ? 'encrypted' : 'plain'}"]`);
    target?.click();
    return 'ok';
  }
  if (type === 'ai-provider') { if (typeof switchProvider === 'function') switchProvider(value); return 'ok'; }
  if (type === 'ai-edit') {
    aiKeyEditing = true;
    if (typeof renderAISettingsUI === 'function') renderAISettingsUI();
    window.__guanjiNativeAIEditing = true;
    return 'ok';
  }
  if (type === 'ai-save') {
    let payload = {};
    try { payload = typeof value === 'string' ? JSON.parse(value) : (value || {}); } catch (_) { return 'invalid'; }
    const active = (typeof aiStore !== 'undefined' && aiStore.active) || 'deepseek';
    const current = (typeof aiStore !== 'undefined' && aiStore.providers && aiStore.providers[active]) || {};
    const key = String(payload.apiKey || '').trim() || current.apiKey || '';
    const baseUrl = String(payload.baseUrl || '').trim();
    const model = String(payload.model || '').trim();
    if (!key || !baseUrl || !model || typeof saveAIConfig !== 'function') return 'invalid';
    saveAIConfig({ provider: active, apiKey: key, baseUrl, model });
    aiKeyEditing = false;
    window.__guanjiNativeAIEditing = false;
    if (typeof clearAISettingsInputEdits === 'function') clearAISettingsInputEdits();
    if (typeof renderAISettingsUI === 'function') renderAISettingsUI('ready');
    return 'ok';
  }
  if (type === 'ai-test') { $('aiTestBtn')?.click(); return 'ok'; }
  if (type === 'data-scope') { $('aiDataScopeBtn')?.click(); return 'ok'; }
  if (type === 'live-test') { if (typeof testLiveUpdate === 'function') testLiveUpdate(); return 'ok'; }
  /* 备份、导出、危险操作和关于说明仍由原 WebView 面板承接；Java 侧会
     暂时让出 Native 正文，但不会创建第二个 Activity 或复制数据协议。 */
  const delegated = { backup: 'backupSyncBtn', export: 'exportBtn', clear: 'clearBtn', restore: 'restoreBtn', about: 'privacyBtn', 'secure-change': 'secureChangeBtn' };
  if (delegated[type]) { $(delegated[type])?.click(); return 'ok'; }
  return 'unknown';
};

/* #279：Native encrypted -> plain confirmation calls the existing business
 * owner without opening secBackdrop. Only a terminal status crosses back. */
window.__guanjiNativeSecureDisable = function () {
  if (typeof secureDisable !== 'function') return 'unavailable';
  if (window.__guanjiNativeSecureDisableState === 'running') return 'running';
  window.__guanjiNativeSecureDisableState = 'running';
  Promise.resolve()
    .then(() => secureDisable())
    .then(() => {
      try {
        if (typeof toast === 'function') toast('加密已关闭，数据已转为明文');
        if (typeof secureRenderStatus === 'function') secureRenderStatus();
        if (typeof renderHome === 'function') renderHome();
      } finally {
        window.__guanjiNativeSecureDisableState = 'success';
        try { window.GuanjiNativeSecureMode?.onResult(JSON.stringify({ status: 'completed' })); } catch (_) {}
      }
    })
    .catch(() => {
      window.__guanjiNativeSecureDisableState = 'error';
      try { window.GuanjiNativeSecureMode?.onResult(JSON.stringify({ status: 'failed' })); } catch (_) {}
    });
  return 'started';
};

/* #279：Native 未加密 → 已加密确认。密码只在 JS 内部传递，不回传到
 * Android；Native 只接收 completed/failed 终态。 */
window.__guanjiNativeSecureEnable = function (passphrase) {
  if (typeof secureEnable !== 'function') return 'unavailable';
  if (window.__guanjiNativeSecureEnableState === 'running') return 'running';
  const pass = String(passphrase || '');
  if (pass.length < 8 || /^\d+$/.test(pass)) return 'invalid';
  window.__guanjiNativeSecureEnableState = 'running';
  Promise.resolve()
    .then(() => secureEnable(pass))
    .then(() => {
      try {
        if (typeof toast === 'function') toast('加密已开启，数据已转为密文');
        if (typeof secureRenderStatus === 'function') secureRenderStatus();
        if (typeof renderHome === 'function') renderHome();
      } finally {
        window.__guanjiNativeSecureEnableState = 'success';
        try { window.GuanjiNativeSecureEnable?.onResult(JSON.stringify({ status: 'completed' })); } catch (_) {}
      }
    })
    .catch((error) => {
      window.__guanjiNativeSecureEnableState = 'error';
      try { window.GuanjiNativeSecureEnable?.onResult(JSON.stringify({ status: 'failed', message: String(error?.message || '') })); } catch (_) {}
    });
  return 'started';
};

/* #280 P0：Native “修改口令”使用既有 secureChangePassphrase owner，
 * 但不再打开 secBackdrop。口令只在 WebView 进程内经过该函数，Android
 * 只收到完成/失败状态。 */
window.__guanjiNativeSecureChange = function (passphrase) {
  if (typeof secureChangePassphrase !== 'function') return 'unavailable';
  if (window.__guanjiNativeSecureChangeState === 'running') return 'running';
  const pass = String(passphrase || '');
  if (pass.length < 8 || /^\d+$/.test(pass)) return 'invalid';
  window.__guanjiNativeSecureChangeState = 'running';
  Promise.resolve()
    .then(() => secureChangePassphrase(null, pass))
    .then(() => {
      try {
        if (typeof toast === 'function') toast('口令已更新——历史备份（含服务器）仍需使用创建时的口令');
        if (typeof secureRenderStatus === 'function') secureRenderStatus();
      } finally {
        window.__guanjiNativeSecureChangeState = 'success';
        try { window.GuanjiNativeSecureChange?.onResult(JSON.stringify({ status: 'completed' })); } catch (_) {}
      }
    })
    .catch((error) => {
      window.__guanjiNativeSecureChangeState = 'error';
      try { window.GuanjiNativeSecureChange?.onResult(JSON.stringify({ status: 'failed', message: String(error?.message || '') })); } catch (_) {}
    });
  return 'started';
};

/* #279：本机/服务器恢复共用的无 UI Restore Engine。来源适配器只负责
 * 取得文本；识别、密码验证、解密、候选构建和原子提交在这里完成。 */
function nativeRestoreError(code, message) {
  const error = new Error(message || code);
  error.code = code;
  return error;
}
function cloneNativeRecords(list) {
  return JSON.parse(JSON.stringify(Array.isArray(list) ? list : []));
}
function validateNativeRestoreRecords(list) {
  if (!Array.isArray(list) || !list.length) throw nativeRestoreError('NO_DATA', '备份中没有可恢复的记录');
  list.forEach((record, index) => {
    if (!record || typeof record !== 'object' || !String(record.id || '').trim()) {
      throw nativeRestoreError('INVALID_RECORD', `第 ${index + 1} 条记录缺少 id`);
    }
    if (!String(record.dateKey || record.localDateKey || '').trim()) {
      throw nativeRestoreError('INVALID_RECORD', `第 ${index + 1} 条记录缺少日期`);
    }
  });
}
function buildNativeRestoreCandidate(incoming, plan) {
  const current = cloneNativeRecords(records);
  const source = cloneNativeRecords(incoming);
  validateNativeRestoreRecords(source);
  const mode = ['merge', 'new', 'overwrite'].includes(plan) ? plan : 'merge';
  if (mode === 'overwrite') return source;
  if (mode === 'new') {
    const ids = new Set(current.map((record) => String(record.id)));
    return current.concat(source.map((record) => {
      const next = { ...record };
      if (ids.has(String(next.id))) next.id = newRecordId('restore');
      ids.add(String(next.id));
      return next;
    }));
  }
  const byId = new Map(current.map((record) => [String(record.id), record]));
  source.forEach((record) => byId.set(String(record.id), record));
  return Array.from(byId.values());
}
async function commitNativeRestoreCandidate(candidate) {
  const before = cloneNativeRecords(records);
  try {
    const room = window.GuanjiRoomShadow;
    if (room?.replaceRecords) {
      const result = await room.replaceRecords(candidate);
      if (!result?.ok) throw nativeRestoreError('COMMIT_FAILED', '本地数据库写入失败');
    } else if (typeof secureSaveRecords === 'function') {
      await secureSaveRecords(candidate);
      const verify = typeof secureLoadRecords === 'function' ? await secureLoadRecords() : candidate;
      if (JSON.stringify(verify) !== JSON.stringify(candidate)) throw nativeRestoreError('COMMIT_VERIFY_FAILED', '恢复后校验失败');
    } else {
      throw nativeRestoreError('STORAGE_UNAVAILABLE', '本地数据存储不可用');
    }
    records = candidate;
    if (typeof invalidateInsightCache === 'function') invalidateInsightCache();
    const snapshot = typeof afterRecordsChanged === 'function' ? afterRecordsChanged() : null;
    if (typeof renderHome === 'function') renderHome(snapshot);
    if (typeof renderCalendar === 'function') renderCalendar();
    return snapshot;
  } catch (error) {
    records = before;
    throw error;
  }
}
async function nativeRestoreText(text, filename, passphrase, plan) {
  const name = String(filename || '');
  if (name.includes('/') || name.includes('\\')) throw nativeRestoreError('INVALID_FILE', '备份文件名无效');
  const raw = String(text || '');
  const isCsv = /\.csv$/i.test(name) || !/^\s*\{/.test(raw);
  let incoming;
  if (isCsv) {
    incoming = csvToRecords(raw);
  } else {
    let pkg;
    try { pkg = JSON.parse(raw); } catch (_) { throw nativeRestoreError('CORRUPTED_BACKUP', '备份 JSON 损坏'); }
    if (pkg?.mode === 'encrypted') {
      if (!String(passphrase || '')) throw nativeRestoreError('NEED_PASSWORD', '这是加密备份，请输入创建时设置的口令');
      try { incoming = await secureImportPackage(pkg, String(passphrase)); }
      catch (_) { throw nativeRestoreError('INVALID_PASSWORD', '口令错误或备份完整性校验失败'); }
    } else {
      throw nativeRestoreError('UNSUPPORTED_BACKUP', '不支持的备份格式');
    }
  }
  validateNativeRestoreRecords(incoming);
  const candidate = buildNativeRestoreCandidate(incoming, plan);
  await commitNativeRestoreCandidate(candidate);
  return { count: incoming.length, plan: ['merge', 'new', 'overwrite'].includes(plan) ? plan : 'merge' };
}
window.__guanjiNativeRestore = function (rawRequest) {
  let request;
  try { request = typeof rawRequest === 'string' ? JSON.parse(rawRequest) : rawRequest; } catch (_) { return 'invalid'; }
  if (!request || !request.requestId || !['local', 'server'].includes(request.source)) return 'invalid';
  const notify = (payload) => { try { window.GuanjiNativeBackup?.onRestoreResult(JSON.stringify({ requestId: request.requestId, ...payload })); } catch (_) {} };
  Promise.resolve().then(async () => {
    let text;
    if (request.source === 'local') {
      const save = ensureGuanjiSavePlugin();
      if (!save?.readDownloadedFile) throw nativeRestoreError('FILES_UNAVAILABLE', '本机文件读取不可用');
      if (!String(request.name || '').trim()) throw nativeRestoreError('FILE_REQUIRED', '请先选择备份文件');
      const result = await save.readDownloadedFile({ filename: String(request.name) });
      text = result?.data;
    } else {
      if (typeof wdDownload !== 'function') throw nativeRestoreError('SERVER_UNAVAILABLE', '服务器恢复不可用');
      if (!String(request.name || '').trim()) throw nativeRestoreError('FILE_REQUIRED', '请先选择服务器备份');
      text = await wdDownload(String(request.name));
    }
    return nativeRestoreText(text, request.name, request.password, request.plan);
  }).then((result) => notify({ status: 'completed', count: result.count, plan: result.plan }))
    .catch((error) => notify({ status: 'failed', code: error?.code || 'RESTORE_FAILED', message: String(error?.message || '恢复失败') }));
  return 'started';
};

/* #275：Native 首页的编辑/删除/补记仍复用原有 Sheet 与 Room 权威链。 */
window.__guanjiOpenEditRecord = function (id) {
  if (typeof openEditRecord !== 'function') return 'pending';
  openEditRecord(String(id));
  return 'ok';
};
window.__guanjiOpenBackfillOffset = function (offset) {
  if (typeof openSheet !== 'function') return 'pending';
  openSheet('backfill', dateWithOffset(Number(offset) || 0));
  return 'ok';
};
window.__guanjiDeleteRecord = function (id) {
  const target = String(id);
  if (!Array.isArray(records)) return 'pending';
  records = records.filter((record) => String(record.id) !== target);
  Storage.saveRecords(records);
  const snapshot = afterRecordsChanged();
  renderHome(snapshot);
  if (typeof renderCalendar === 'function') renderCalendar();
  return 'ok';
};

window.__guanjiSetNativeTabEnabled = function (enabled) {
  const bar = $('tabbar');
  if (!bar) return 'pending';
  window.__guanjiNativeTabRequested = !!enabled;
  const active = bar.querySelector('.tab.active');
  const glass = document.documentElement.classList.contains('liquid-glass');
  if (enabled && !glass) {
    bar.classList.add('native-tab-hidden');
    bar.setAttribute('aria-hidden', 'true');
    bar.setAttribute('inert', '');
  } else {
    bar.classList.remove('native-tab-hidden');
    bar.removeAttribute('aria-hidden');
    bar.removeAttribute('inert');
  }
  if (active) notifyNativeTabRoute(active.dataset.screen);
  notifyNativeTabTheme();
  return 'ok';
};

// Tab 切换
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    ['home', 'analysis', 'me'].forEach((name) => {
      $('screen-' + name).classList.toggle('hidden', name !== tab.dataset.screen);
    });
    if (tab.dataset.screen === 'analysis') {
      // #147：进入洞察页时恢复旧版自动检查；满足 Key + 近 7 天 ≥3 条且报告缺失/过期才请求。
      maybeAutoGenerate();
    }
    if (tab.dataset.screen === 'me') {
      if (typeof syncAISettingsInputs === 'function') syncAISettingsInputs();
      if (typeof refreshMeSegs === 'function') refreshMeSegs();   // #121/#124：我的页全部 seg 滑块重定位（页面从隐藏变为可见）
    }
    moveTabSlide(tab, $('tabSlide'));
    liquidTabPulse();
    notifyNativeTabRoute(tab.dataset.screen);
    notifyNativeTabBackdrop();
    // 触摸点击只改变选中态，不保留按钮焦点；键盘操作仍保留 :focus-visible。
    if (tab.dataset.focusOrigin === 'pointer') {
      requestAnimationFrame(() => { if (document.activeElement === tab) tab.blur(); });
    }
  });
});

// 初始滑块定位（首页）
moveTabSlide(document.querySelector('.tab.active'), $('tabSlide'));
notifyNativeTabRoute(document.querySelector('.tab.active')?.dataset.screen || 'home');

// #146：个人洞察固定查看近 7 天；首页的 30 天趋势保持不变。
renderInsightLocal();

// 记录面板
$('recordBtn').addEventListener('click', () => openSheet('now'));
// #20：点空白关闭当前打开的面板（日历优先，其次记录面板）
$('sheetBackdrop').addEventListener('click', () => {
  if (!$('calendarSheet').classList.contains('hidden')) closeCalendar();
  else closeSheet();
});

$('nowSeg').addEventListener('click', () => {
  sheetMode = 'now';
  $('nowSeg').classList.add('active');
  $('customSeg').classList.remove('active');
  $('pickerRow').classList.add('hidden');
  $('timeDisplay').classList.add('hidden');   // #75：就现在计时态不显示日期时间
  moveSegSlide($('timeSegRow'), $('timeSegSlide'), $('nowSeg'));   // #22：滑块跟随
  // #55：timer 模式「就现在」= 计时器态
  if (loadRecordMode() === 'timer' && !timerState.running) {
    $('timerBox').classList.remove('hidden');
    $('nextBtn').textContent = '开始记录';
    $('modeLink').textContent = '不想计时？直接填写';
    $('modeLink').classList.remove('hidden');
  }
  updateTimeDisplay();
});
$('customSeg').addEventListener('click', () => {
  sheetMode = 'backfill';
  $('customSeg').classList.add('active');
  $('nowSeg').classList.remove('active');
  $('pickerRow').classList.remove('hidden');
  $('timeDisplay').classList.remove('hidden');   // #75：补记经典流程显示日期时间
  moveSegSlide($('timeSegRow'), $('timeSegSlide'), $('customSeg'));   // #22：滑块跟随
  // #55：切到「补记」= 经典流程（计时器态让位）
  $('timerBox').classList.add('hidden');
  $('nextBtn').textContent = '下一步';
  $('modeLink').classList.add('hidden');
  updateTimeDisplay();
});
$('pickDate').addEventListener('change', () => {
  // #26：清空后自动恢复为今天
  if (!$('pickDate').value) {
    const d = new Date();
    $('pickDate').value = fmtDateInput(d);
  }
  updateTimeDisplay();
});
$('pickTime').addEventListener('change', () => {
  // #26：清空后自动恢复为当前时刻
  if (!$('pickTime').value) $('pickTime').value = fmtTime(new Date());
  updateTimeDisplay();
});


/* ---------- #42/#65：软键盘处理（隐藏 tab 栏 + 冻结布局视口高度） ---------- */

/* Android adjustResize 下键盘弹出会把布局视口高度压缩（innerHeight 变小），
   而 visualViewport 与 innerHeight 同步缩小（差值恒为 0，不能作为检测依据），
   因此用「全高基准 vs 当前 innerHeight」检测键盘。
   kbBase 取历史最大值并随每次键盘收起校准——避免 WebView 崩溃重载/中途加载
   时基准被捕获成压缩后高度（实测重载瞬间内层 792 < 851 的案例） */
let kbBase = window.innerHeight;

function isKeyboardUp() {
  return kbBase - window.innerHeight > 150;
}

/* #65：键盘弹出时把 html/body 冻结为弹出前高度——真机媒体查询 .phone height:100vh
   会随视口压缩导致整页重排（面板被顶起/对话框跳动/汇总页 vh 间距全变=「拉扯」），
   冻结后 .phone 继承 body 固定高度，布局树不再随键盘变化；收起后恢复。
   仅「对话框打开 + 键盘弹出」时冻结（这正是用户抱怨的场景）；
   设置页/备注等输入保持原 adjustResize 行为。 */
function syncKbLayout() {
  const h = window.innerHeight;
  if (h > kbBase) kbBase = h;   // 视口变大（键盘收起/重载后）→ 更新全高基准
  const up = kbBase - h > 150;
  document.documentElement.style.setProperty('--kb-h', h + 'px');   // 可见高度，供对话框层跟随
  $('tabbar').classList.toggle('keyboard-up', up);
  document.body.classList.toggle('keyboard-up', up);   // 对话框层 CSS 选择器用
  const dialogOpen = ['addBackdrop', 'delBackdrop'].some((id) => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('hidden');
  });
  const root = document.documentElement;
  if (up && dialogOpen) {
    root.style.height = kbBase + 'px';
    document.body.style.height = kbBase + 'px';
  } else {
    root.style.height = '';
    document.body.style.height = '';
  }
}

window.addEventListener('resize', syncKbLayout);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncKbLayout);   // 兜底（视觉视口单独变化场景）
}

/* ---------- 启动 ---------- */

/* #208：首帧就绪只负责结束系统 Splash，不叠加产品层开屏动画。 */
function notifyStartupReady() {
  try {
    const plugin = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.StartupReady;
    if (plugin && typeof plugin.ready === 'function') {
      plugin.ready();
      return true;
    }
  } catch (e) { /* 浏览器预览或旧桥接版本没有 StartupReady 时静默降级 */ }
  return false;
}

// #93：记录加载异步化（加密模式需 Web Crypto 解密），其余初始化在解密后继续
(async () => {
records = await (window.GuanjiDataStore?.records?.load ? GuanjiDataStore.records.load() : Storage.loadRecords());
/* #280 P5：记录源完成权威加载后才允许发布 Native 首页快照。启动期间
   任何缓存/AI 回调都不能把“尚未加载”误写成真实的空数据。 */
window.__guanjiRecordsReady = true;
normalizeOffsets();   // v3.6.1：启动即恢复旧记录绝对日期（id 时间戳）并重算 offset
/* #280 P5：权威记录一旦完成加载，立即提交首个 Native 聚合快照。
   OnePlus 等设备可能没有旧的有效快照可供回显；如果等到后续设置/AI
   初始化结束才写入，Native 首页会在启动窗口内读到空值。这里仅写入
   本地聚合索引，不改变记录源，也不阻塞任何破坏性业务操作。 */
try {
  if (typeof buildStatsSnapshot === 'function' && typeof syncNativeHomeSnapshot === 'function') {
    await syncNativeHomeSnapshot(buildStatsSnapshot());
  }
} catch { /* 原生快照不可用时继续 JS 首屏初始化 */ }
// #254：无法从旧字段无损推导真实日期时，只提示用户走可信备份恢复，
// 不自动猜日期，也不阻塞首页首屏。
if (typeof hasSuspiciousEpochRecords === 'function' && hasSuspiciousEpochRecords()) {
  const pending = records.filter((record) => record && record.dateKey === '1970-01-01').length;
  setTimeout(() => toast(`发现 ${pending} 条记录需要从更新前备份恢复`), 350);
}
localStorage.setItem(LAST_DATE_KEY, fmtDateKey(new Date()));   // 初始化跨天检测基准
/* #236：Room 权威加载已在 records.load() 完成；旧桥/浏览器仅保持兼容回退。 */
setTimeout(() => { try { window.GuanjiRoomShadow?.ensureReady?.(records); } catch { /* 原生桥不可用时保持兼容主链 */ } }, 0);
// 密钥回显由 initAIUI 按 active 提供商负责（#43 per-provider），这里保持配置同步
if (typeof hydrateAISecureKeys === 'function') await hydrateAISecureKeys();
syncActiveConfig();
if (typeof renderAISettingsUI === 'function') renderAISettingsUI();
/* #202：报告缓存只做本地异步恢复，不阻塞首页、每日话语或小组件首屏。 */
if (typeof restoreInsightCache === 'function') insightCacheRestorePromise = restoreInsightCache();
initTheme();                       // 深色模式初始化（head 内联脚本已做初值，这里同步 UI）
initLiquidGlass();                 // #72：液态玻璃实验开关同步 UI（head 内联脚本已应用类）
// #274 修复：主题和材质都初始化完成后，才发送原生 Tab 的首次渲染事实。
notifyNativeTabTheme();
initReminderUI();                  // 提醒设置回显（#13）
initRecordModeUI();                // #51：记录方式偏好回显
initTimerNotificationUI();         // #172：计时通知开关与测试模块回显
applyReminderSchedule(loadReminder());   // 重启后恢复/更新调度（幂等）
$('positiveSwitch').classList.toggle('on', positiveEnabled());   // 正向反馈开关回显（#17）

// 桌面小组件「一键记录」入口（#14：原生 WebView 调用）
window.__guanjiOpenRecord = () => openSheet('now');

/* #276：Native 记录 Surface 的兼容接口。
 * 这里只提供一次性上下文和唯一提交入口；日期、观察标签、旧字段兼容、
 * Room/统计/小组件刷新仍由现有 JS/Storage 链完成，避免 Native 复制业务规则。 */
window.__guanjiNativeRecordContext = function (kind, value) {
  const mode = String(kind || 'now');
  const payload = {
    kind: mode,
    preferredMode: typeof loadRecordMode === 'function' ? loadRecordMode() : 'timer',
    // 原生记录面板只需要自定义标签字典来完成渲染；不把整库或备注过桥。
    customOptions: typeof loadCustomList === 'function' ? loadCustomList('guanji_custom_observations') : [],
  };
  if (mode === 'edit') {
    const target = Array.isArray(records) ? records.find((record) => String(record.id) === String(value || '')) : null;
    if (!target) return null;
    payload.recordId = String(target.id || '');
    payload.dateKey = String(recordDateKeyForStats(target) || target.dateKey || '');
    payload.time = String(target.time || '');
    payload.duration = Number.isFinite(Number(target.duration)) ? Number(target.duration) : 0;
    payload.observations = typeof recordObservationValues === 'function' ? recordObservationValues(target) : [];
    payload.note = String(target.note || '');
    return payload;
  }
  if (mode === 'backfill') {
    const offset = Number(value || 0);
    const date = typeof dateWithOffset === 'function' ? dateWithOffset(offset) : new Date(Date.now() - offset * 864e5);
    payload.dateKey = typeof fmtDateKey === 'function' ? fmtDateKey(date) : '';
    payload.time = typeof fmtTime === 'function' ? fmtTime(new Date()) : '';
    payload.preferredMode = 'quick';
    return payload;
  }
  payload.dateKey = typeof fmtDateKey === 'function' ? fmtDateKey(new Date()) : '';
  payload.time = typeof fmtTime === 'function' ? fmtTime(new Date()) : '';
  return payload;
};

window.__guanjiNativeCommitRecord = function (rawPayload) {
  let payload;
  try { payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload; } catch { return JSON.stringify({ ok: false, reason: 'invalid_payload' }); }
  if (!payload || typeof payload !== 'object' || !Array.isArray(records)) return JSON.stringify({ ok: false, reason: 'unavailable' });
  const kind = String(payload.kind || 'new');
  const mode = String(payload.mode || 'now');
  const now = new Date();
  let date = now;
  let offset = 0;
  let time = typeof fmtTime === 'function' ? fmtTime(now) : '';
  if (mode === 'backfill') {
    const dateKey = String(payload.dateKey || '');
    const timeText = String(payload.time || '');
    const parts = dateKey.split('-').map(Number);
    const clock = timeText.split(':').map(Number);
    if (parts.length !== 3 || clock.length < 2 || parts.some((part) => !Number.isFinite(part)) || clock.some((part) => !Number.isFinite(part))) {
      return JSON.stringify({ ok: false, reason: 'invalid_datetime' });
    }
    date = new Date(parts[0], parts[1] - 1, parts[2], clock[0], clock[1]);
    if (isNaN(date.getTime())) return JSON.stringify({ ok: false, reason: 'invalid_datetime' });
    offset = typeof dayDiff === 'function' ? dayDiff(date, now) : Math.round((date - now) / 864e5);
    if (offset > 0) return JSON.stringify({ ok: false, reason: 'future_date' });
    time = typeof fmtTime === 'function' ? fmtTime(date) : timeText;
  }
  const observations = typeof normalizeObservationValues === 'function'
    ? normalizeObservationValues(Array.isArray(payload.observations) ? payload.observations : [])
    : (Array.isArray(payload.observations) ? payload.observations : []);
  // Native 记录面板的“+ 添加”沿用 WebView 的自定义观察选项存储，
  // 这样新建的自定义项在下一次打开记录面板时仍会出现。
  try {
    if (typeof loadCustomList === 'function' && typeof saveCustomList === 'function') {
      const custom = loadCustomList('guanji_custom_observations');
      const labels = observations.filter((value) => String(value).startsWith('custom:')).map((value) => String(value).slice(7)).filter(Boolean);
      const merged = [...custom, ...labels.filter((label) => !custom.includes(label))].slice(0, 64);
      saveCustomList('guanji_custom_observations', merged);
    }
  } catch { /* 自定义标签持久化失败不应阻断记录保存 */ }
  const observation = observations[0] || '';
  const durationNumber = Number(payload.duration);
  const duration = Number.isFinite(durationNumber) ? Math.max(0, Math.round(durationNumber)) : 0;
  const media = typeof isAdultContentObservation === 'function' && observations.some(isAdultContentObservation);
  const note = String(payload.note || '').trim();
  const dateKey = typeof fmtDateKey === 'function' ? fmtDateKey(date) : String(payload.dateKey || '');
  const baseFields = {
    dateKey, offset, time,
    occurredAtMs: date.getTime(),
    zoneId: typeof systemTimeZone === 'function' ? systemTimeZone() : undefined,
    localDate: dateKey, localDateKey: dateKey, timePrecision: 'minute',
    updatedAtMs: Date.now(), duration: duration || null,
    observations, observation: observation || null, media, note,
  };
  let id = '';
  if (kind === 'edit') {
    const index = records.findIndex((record) => String(record.id) === String(payload.recordId || ''));
    if (index < 0) return JSON.stringify({ ok: false, reason: 'record_not_found' });
    records[index] = { ...records[index], ...baseFields, source: records[index].source || (mode === 'backfill' ? 'backfill' : 'now'), backfill: records[index].backfill === true || mode === 'backfill' };
    id = String(records[index].id);
  } else {
    id = typeof newRecordId === 'function' ? newRecordId('rec') : `rec_${Date.now().toString(36)}`;
    records.push({
      id, ...baseFields,
      source: mode === 'backfill' ? 'backfill' : 'now', backfill: mode === 'backfill',
      createdAtMs: Date.now(), moods: [], triggers: [],
    });
  }
  const snapshot = typeof commitRecordChanges === 'function' ? commitRecordChanges() : null;
  return JSON.stringify({ ok: true, id, revision: snapshot && snapshot.revision });
};

/* #276：Native 记录面板删除自定义观察项时复用 WebView 的同一存储键；
 * 内置项永远不进入该列表，因此不会被误删。 */
window.__guanjiDeleteCustomObservation = function (label) {
  const target = String(label || '').trim();
  if (!target || typeof loadCustomList !== 'function' || typeof saveCustomList !== 'function') return 'pending';
  const key = 'guanji_custom_observations';
  saveCustomList(key, loadCustomList(key).filter((item) => String(item) !== target));
  return 'ok';
};

/* Native 计时只复用通知能力；计时起点持久化在 MainActivity，避免 JS 恢复路径
 * 把原生记录 Surface 再次拉回 WebView。 */
window.__guanjiNativeTimerNotifyStart = function (startTimeMs) { try { notifyStartTimer(Number(startTimeMs)); return 'ok'; } catch { return 'pending'; } };
window.__guanjiNativeTimerNotifyStop = function () { try { notifyStopTimer(true); return 'ok'; } catch { return 'pending'; } };

initSegSlide('chartSeg', 'chartSegSlide');   // #21：图表卡滑块初始定位
initSegSlide('chartViewSeg', 'chartViewSlide');   // #88：图表视图滑块初始定位
renderObservationChips();                    // #132/#137/#138：统一发生前状况多选 chips（含自定义与添加入口）

// #29：小横杠拖拽关闭（记录面板 + 日历）
initSheetDrag('recordGrab', $('recordSheet'), $('sheetBackdrop'), closeSheet);
initSheetDrag('calendarGrab', $('calendarSheet'), $('sheetBackdrop'), closeCalendar);

/* #198：先完成首页首轮渲染，再把同一快照交给原生小组件，避免启动统计阻塞首屏。 */
const initialStatsSnapshot = renderHome();
setTimeout(() => syncWidgetStats(initialStatsSnapshot), 0);
/* #235：启动后请求一次完整 Kotlin 快照；成功时首页与小组件复用同一结果，
   失败则继续沿用首帧 JS 快照，不阻塞启动。 */
setTimeout(async () => {
  try {
    if (typeof requestBehaviorSnapshot !== 'function') return;
    const result = await requestBehaviorSnapshot(initialStatsSnapshot);
    const current = buildStatsSnapshot();
    if (result?.ok === true && Number(result.dataRevision) === Number(current.revision)
      && result.statsSnapshot) {
      renderHome(result.statsSnapshot);
      syncWidgetStats(result.statsSnapshot);
      syncNativeHomeSnapshot(result.statsSnapshot);
    }
  } catch { /* Kotlin 快照不可用时保留 JS 兼容链 */ }
}, 0);
setTimeout(async () => {
  /* 原生快照只在 revision 与当前 WebView 数据一致时回显，避免旧缓存覆盖新记录。 */
  try {
    const bridge = window.GuanjiNative?.homeSnapshot;
    if (!bridge || typeof bridge.read !== 'function') return;
    const result = await bridge.read();
    const nativeSnapshot = result && result.snapshot ? JSON.parse(result.snapshot) : null;
    const current = buildStatsSnapshot();
    if (nativeSnapshot && nativeSnapshot.revision === current.revision && nativeSnapshot.schemaVersion === current.schemaVersion) {
      renderHome(nativeSnapshot);
    }
  } catch { /* 原生快照不可用时保留 WebView 首次渲染 */ }
  syncNativeHomeSnapshot(initialStatsSnapshot);
}, 0);
/* 双 RAF 确保首页完成首帧布局后再结束系统 Splash；不启动任何产品层动画。 */
requestAnimationFrame(() => requestAnimationFrame(notifyStartupReady));

/* #87：Android 返回键/侧滑兜底——分层关闭浮层（弹窗→日历→全屏计时→记录面板），全部关闭后二次确认退出 */
let backPressedAt = 0;
function handleBackButton() {
  try {
    const isHidden = (id) => { const el = $(id); return !el || el.classList.contains('hidden'); };
    // 1. 自定义词弹窗（最上层优先）
    if (!isHidden('addBackdrop')) { closeAddDialog(); return; }
    // 1.5 AI 数据范围说明（#163）
    if (!isHidden('aiDataScopeBackdrop')) { $('aiDataScopeBackdrop').classList.add('hidden'); return; }
    // 2. 删除确认弹窗
    if (!isHidden('delBackdrop')) { closeDeleteDialog(); return; }
    // 3. 数据管理确认弹窗
    if (!isHidden('dialogBackdrop')) { $('dialogBackdrop').classList.add('hidden'); return; }
    // 3.5 数据保护任务：管理/恢复状态均由同一父 Sheet 逐级返回；导出仍是独立任务。
    if (!isHidden('exportBackdrop')) { closeSheetPanel('exportBackdrop'); return; }
    // #187：WebDAV 配置是父 Sheet 之上的临时表单，返回时沿用取消路径回到备份与恢复首页。
    if (!isHidden('wdCfgBackdrop')) { if (typeof window.closeWdConfigAndReturn === 'function') window.closeWdConfigAndReturn(); else $('wdCfgBackdrop').classList.add('hidden'); return; }
    if (!isHidden('backupSyncBackdrop')) { if (typeof window.backupHubBack === 'function') window.backupHubBack(); else closeSheetPanel('backupSyncBackdrop'); return; }
    // 4. 日历弹层
    if (!isHidden('calendarSheet')) { closeCalendar(); return; }
    // 5. 全屏计时/汇总页（#51/#54：全屏覆盖在面板之上，返回 = 取消计时）
    if (!isHidden('timerScreen')) { cancelFromTimerScreen(); return; }
    // 6. 记录面板（#51：计时中关闭面板 = 取消计时，closeSheet 已处理）
    if (!isHidden('recordSheet')) { closeSheet(); return; }
    // 7. 首页：二次确认退出（2 秒窗口，温和提示）
    const now = Date.now();
    if (now - backPressedAt < 2000) {
      if (window.Capacitor && Capacitor.Plugins.App) Capacitor.Plugins.App.exitApp();
      return;
    }
    backPressedAt = now;
    toast('再按一次退出');
  } finally {
    // #218：系统返回无论命中哪一层，都不把 Tab 按钮留在焦点状态。
    clearTransientTabFocus(true);
  }
}

/* #218：WebView 从后台/系统界面恢复时，清理 OEM 留下的触摸 Tab 焦点。 */
function clearTabFocusOnResume() {
  requestAnimationFrame(() => clearTransientTabFocus());
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) clearTabFocusOnResume();
});
window.addEventListener('pageshow', clearTabFocusOnResume);

if (window.Capacitor && Capacitor.Plugins.App) {
  Capacitor.Plugins.App.addListener('backButton', handleBackButton);
  /* #200：回到前台时复用同一 StatsSnapshot，修正后台期间跨天或同步失败的缓存。 */
  try {
    Capacitor.Plugins.App.addListener('appStateChange', (state) => {
      if (!state || !state.isActive) return;
      clearTabFocusOnResume();
      if (typeof checkDayRollover === 'function') checkDayRollover();
      const snapshot = buildStatsSnapshot();
      syncWidgetStats(snapshot);
    });
  } catch (e) { /* 旧 Capacitor 无 appStateChange 时保留冷启动同步 */ }
}

/* #200：App 驻留跨过本地午夜时主动刷新一次；被系统挂起/杀进程时由冷启动或前台事件兜底。 */
let widgetRolloverTimer = null;
function scheduleWidgetRolloverSync() {
  clearTimeout(widgetRolloverTimer);
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 5, 0);
  const delay = Math.max(1000, next.getTime() - now.getTime());
  widgetRolloverTimer = setTimeout(() => {
    if (typeof checkDayRollover === 'function') checkDayRollover();
    const snapshot = buildStatsSnapshot();
    syncWidgetStats(snapshot);
    scheduleWidgetRolloverSync();
  }, delay);
}
scheduleWidgetRolloverSync();

initSecureUI();   // #93：数据加密卡 UI（开启/修改口令/关闭/密文导出导入）
initWebDAVUI();   // #115：WebDAV 备份卡 UI（配置/备份/恢复/管理/切后台自动备份）
})();

