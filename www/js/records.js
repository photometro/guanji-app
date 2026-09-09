// 观己 App · records（P1 搬移式拆分，2026-08-09——函数原样搬移，零逻辑改动）

/* ============ v3.60：记录时间模型与严格日期迁移 ============
   旧 offset/dateKey 继续兼容；新记录增加 occurredAtMs、zoneId 和 localDateKey。
   迁移时不把 JavaScript 可解析但不合理的日期（例如 4709-12-18）当成可信值，
   无法无损推导的历史记录保留原始字段并隔离到统计之外。 */
function fmtDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function strictDateFromKey(key) {
  if (!isValidDateKey(key)) return null;
  const p = String(key).split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2] ? d : null;
}

function plausibleTimestamp(value) {
  // Room 旧记录投影可能明确返回 null；Number(null) === 0，不能把它当作 Unix epoch。
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  const ms = Number(value);
  return Number.isFinite(ms) && ms > 0 && ms <= 4102444800000;
}

/* #254：4.1.4 已把部分旧记录错误写成 1970-01-01；这些记录保留等待
   可信备份修复，启动归一化不能再次把它们当作正常日期写回。 */
function isEpochPlaceholder(record) {
  if (!record || typeof record !== 'object') return false;
  return String(record.dateKey || '') === '1970-01-01'
    && !plausibleTimestamp(record.occurredAtMs)
    && Number.isFinite(Number(record.offset))
    && Number(record.offset) < -10000;
}

/* #254：供备份/同步层读取的异常日期边界。
   只要存在无法还原的 Unix epoch 占位记录，就不能让自动备份把它覆盖到
   服务器；恢复必须由用户选择更新前的可信备份并输入口令完成。 */
function hasSuspiciousEpochRecords() {
  return Array.isArray(records) && records.some(isEpochPlaceholder);
}
window.hasSuspiciousEpochRecords = hasSuspiciousEpochRecords;

/* #224：把记录来源和测量质量归一化为可统计字段。
   旧记录没有这些字段时只补元数据，不改写原始备注/观察值；未知来源归入
   legacy，避免把历史数据误判成“现在记录”或“补记”。 */
const RECORD_SOURCE_VALUES = new Set(['now', 'timer', 'backfill', 'quick', 'import', 'legacy', 'demo']);
function normalizeRecordQualityMetadata(record, dateKey = '') {
  if (!record || typeof record !== 'object') return false;
  let changed = false;
  const source = String(record.source || '').trim();
  const normalizedSource = RECORD_SOURCE_VALUES.has(source)
    ? source
    : (record.backfill === true ? 'backfill' : (source ? 'legacy' : 'legacy'));
  if (record.source !== normalizedSource) { record.source = normalizedSource; changed = true; }
  const backfill = record.backfill === true || normalizedSource === 'backfill';
  if (record.backfill !== backfill) { record.backfill = backfill; changed = true; }
  if (dateKey && record.localDate !== dateKey) { record.localDate = dateKey; changed = true; }
  if (dateKey && record.localDateKey !== dateKey) { record.localDateKey = dateKey; changed = true; }
  const precision = ['minute', 'second', 'unknown'].includes(String(record.timePrecision || ''))
    ? String(record.timePrecision)
    : (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(String(record.time || '')) ? 'minute' : 'unknown');
  if (record.timePrecision !== precision) { record.timePrecision = precision; changed = true; }
  return changed;
}

function normalizeOffsets() {
  const today = new Date();
  const before = records.map((record) => {
    try { return JSON.stringify(record); } catch { return ''; }
  });
  let changed = false;
  records.forEach((r) => {
    if (!r || typeof r !== 'object') return;
    if (isEpochPlaceholder(r)) {
      // 不猜测真实日期；恢复由更新前可信备份完成。
      if (normalizeRecordQualityMetadata(r)) changed = true;
      return;
    }
    let d = null;
    if (plausibleTimestamp(r.occurredAtMs)) {
      d = new Date(Number(r.occurredAtMs));
    } else if (r.dateKey) {
      d = strictDateFromKey(r.dateKey);
      if (!d && !r.legacyDateKey) {
        r.legacyDateKey = String(r.dateKey);
        r.invalidDateKey = true;
        changed = true;
      }
    } else if (r.id) {
      const ts = parseInt(String(r.id).split('_')[1], 36);
      if (plausibleTimestamp(ts)) d = new Date(ts);
    }
    if (d && !isNaN(d.getTime())) {
      const off = dayDiff(d, today);
      if (r.offset !== off) { r.offset = off; changed = true; }
      const dateKey = fmtDateKey(d);
      if (r.dateKey !== dateKey) { r.dateKey = dateKey; changed = true; }
      if (r.invalidDateKey) { delete r.invalidDateKey; changed = true; }
      if (!r.zoneId) { r.zoneId = systemTimeZone(); changed = true; }
      if (normalizeRecordQualityMetadata(r, dateKey)) changed = true;
    } else if (normalizeRecordQualityMetadata(r)) {
      changed = true;
    }
  });
  if (changed) {
    // 任何记录在一次归一化中被改成 Unix epoch 都属于危险批量写回，
    // 恢复原对象并阻止 Room/旧加密镜像被覆盖。
    const epochMutations = records.reduce((count, record, index) => {
      if (!record || String(record.dateKey || '') !== '1970-01-01') return count;
      let original = null;
      try { original = before[index] ? JSON.parse(before[index]) : null; } catch { original = null; }
      if (!original || String(original.dateKey || '') !== '1970-01-01') return count + 1;
      return count;
    }, 0);
    if (epochMutations > 0) {
      records.forEach((record, index) => {
        if (!record || !before[index]) return;
        try {
          const original = JSON.parse(before[index]);
          Object.keys(record).forEach((key) => { if (!Object.prototype.hasOwnProperty.call(original, key)) delete record[key]; });
          Object.assign(record, original);
        } catch { /* 单条快照损坏时不扩大写回范围 */ }
      });
      console.warn('[#254] blocked suspicious epoch date normalization', { epochMutations, recordCount: records.length });
      return;
    }
    Storage.saveRecords(records);
  }
}

/* 跨天检测：App 驻留跨过午夜时，重新归一化所有记录的 offset */
const LAST_DATE_KEY = 'guanji_last_date_key';
function checkDayRollover() {
  const key = fmtDateKey(new Date());
  if (localStorage.getItem(LAST_DATE_KEY) !== key) {
    localStorage.setItem(LAST_DATE_KEY, key);
    normalizeOffsets();
  }
}

function updateTimeDisplay() {
  // #26：空/非法日期时间一律回退当前时间，永不显示 NaN
  let d = null;
  if (sheetMode === 'backfill') {
    const dv = $('pickDate').value, tv = $('pickTime').value;
    if (dv && tv) {
      const parsed = new Date(dv + 'T' + tv);
      if (!isNaN(parsed.getTime())) d = parsed;
    }
  } else {
    d = new Date();
  }
  if (!d) d = new Date();
  $('timeDisplay').textContent =
    `${d.getMonth() + 1}月${d.getDate()}日 ${fmtTime(d)}`;
}

function saveRecord() {
  normalizeOffsets();   // v3.6.1：跨天驻留时先归一化旧记录，再读表单
  // #132/#137/#138：普通详情页保存完整的“发生前状况”多选数组，并保留首项 observation 别名兼容旧逻辑。
  const observations = typeof readObservationSelections === 'function'
    ? normalizeObservationValues(readObservationSelections($('observationChips')))
    : [];
  const observation = observations[0] || '';
  // 时长以 durLabel 为数据源（滑块 max=60，超长记录预填后靠 label 保真，避免 clamp 丢数据）
  const durMatch = /^(\d+)/.exec($('durLabel').textContent);
  const duration = durMatch ? parseInt(durMatch[1], 10) : 0;
  // v3.19/#136 + #132：成人内容影响由统一观察标签推导 media，避免重复入口。
  const media = observations.some(isAdultContentObservation);
  const note = $('noteInput').value.trim();

  const base = new Date();
  let date, offset, time;
  if (sheetMode === 'now') {
    date = new Date();
    offset = 0;
    time = fmtTime(date);
  } else {
    const dv = $('pickDate').value, tv = $('pickTime').value;
    // #26：日期时间为空/非法时拦截保存，避免产生坏数据
    if (!dv || !tv) { toast('请选择日期和时间'); return; }
    const parts = dv.split('-');
    const t = tv.split(':');
    date = new Date(+parts[0], +parts[1] - 1, +parts[2], +t[0], +t[1]);
    if (isNaN(date.getTime())) { toast('日期或时间无效，请重新选择'); return; }
    offset = dayDiff(date, base);
    // #80：未来日期不可补记（温和拦截，非评判）
    if (offset > 0) { toast('未来的日期还没到哦，先记录今天吧'); return; }
    time = fmtTime(date);
  }

  // #38：编辑模式原地更新（保持 id），否则新增（v3.6.1：同时写入绝对日期 dateKey）
  const isEdit = editingId !== null;
  if (isEdit) {
    const idx = records.findIndex((r) => r.id === editingId);
    if (idx < 0) { closeSheet(); toast('记录不存在'); return; }
    records[idx] = {
      ...records[idx],   // 保留 id 等原字段
      dateKey: fmtDateKey(date), offset, time,
      occurredAtMs: date.getTime(),
      zoneId: systemTimeZone(),
      localDate: fmtDateKey(date),
      localDateKey: fmtDateKey(date),
      timePrecision: 'minute',
      source: records[idx].source || (sheetMode === 'backfill' ? 'backfill' : 'now'),
      backfill: records[idx].backfill === true || sheetMode === 'backfill',
      updatedAtMs: Date.now(),
      duration: duration || null,
      // 旧 moods/triggers 原样保留，统一字段作为新语义来源。
      observations,
      observation: observation || null,
      media, note,
    };
  } else {
    records.push({
      id: newRecordId('rec'),
      dateKey: fmtDateKey(date), offset, time,
      occurredAtMs: date.getTime(),
      zoneId: systemTimeZone(),
      localDate: fmtDateKey(date),
      localDateKey: fmtDateKey(date),
      timePrecision: 'minute',
      source: sheetMode === 'backfill' ? 'backfill' : 'now',
      backfill: sheetMode === 'backfill',
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      duration: duration || null,
      observations,
      observation: observation || null,
      moods: [], triggers: [], media, note,
    });
  }
  const statsSnapshot = commitRecordChanges();   // #211 N4：普通记录与计时汇总共用同一提交/刷新入口

  editingId = null;   // 编辑结束复位，避免影响后续新增
  closeSheet();
  toast(isEdit ? '已更新 ✓' : '已记录 ✓');
  // commitRecordChanges 已完成首页与日历刷新，避免两套记录流程出现刷新差异。
}

/* #211 N4：记录流程的唯一提交入口。
   两套记录入口（普通详情页、计时汇总页）都先落库，再生成同一份统计快照，
   最后刷新当前视图；这样不会出现“已保存但首页仍显示旧数据”的短暂分叉。
   不负责 toast、关闭面板或清理编辑状态，调用方可保留各自交互反馈。 */
function commitRecordChanges() {
  Storage.saveRecords(records);
  const statsSnapshot = afterRecordsChanged();
  if (typeof renderHome === 'function') renderHome(statsSnapshot);
  const calendar = $('calendarSheet');
  if (calendar && !calendar.classList.contains('hidden') && typeof renderCalendar === 'function') {
    renderCalendar();
  }
  return statsSnapshot;
}


/* ---------- #32-#36：小组件联动（快速记录 + 统计同步） ---------- */

/* 一键快速记录（桌面小组件触发）：自动保存「就现在」默认记录 */
function quickRecord() {
  const now = new Date();
  records.push({
    id: newRecordId('quick'),
    dateKey: fmtDateKey(now),
    offset: 0,
    time: fmtTime(now),
    occurredAtMs: now.getTime(),
    zoneId: systemTimeZone(),
    localDate: fmtDateKey(now),
    localDateKey: fmtDateKey(now),
    timePrecision: 'minute',
    source: 'now',
    backfill: false,
    createdAtMs: now.getTime(),
    updatedAtMs: now.getTime(),
    duration: null,
    observations: [],
    observation: null,
    moods: [], triggers: [], media: false, note: '',
  });
  Storage.saveRecords(records);
  const statsSnapshot = afterRecordsChanged();
  toast('已快速记录 ✓');
  renderHome(statsSnapshot);
}

window.__guanjiQuickRecord = () => quickRecord();

/* #196/#200：聚合统计同步到原生（widget 展示），非原生环境静默跳过。
   新协议为版本化 JSON；原生端仍保留旧管道格式解析，便于旧 APK 回滚。
   同步是非阻塞的：等待原生结果只用于判断是否需要一次受控重试，不影响保存反馈。 */
async function syncWidgetStats(snapshot = null, options = {}) {
  const retry = options.retry !== false;
  try {
    const P = window.Capacitor && window.Capacitor.Plugins;
    if (!P || !P.WidgetStats) return { ok: false, accepted: false, reason: 'unavailable' };
    const statsSnapshot = snapshot || buildStatsSnapshot();
    const stats = JSON.stringify({
      protocolVersion: 2,
      schemaVersion: statsSnapshot.schemaVersion,
      statsRuleVersion: statsSnapshot.statsRuleVersion,
      generationId: statsSnapshot.generationId,
      revision: statsSnapshot.revision,
      generatedAtMs: statsSnapshot.generatedAtMs,
      timezone: statsSnapshot.timezone,
      todayKey: statsSnapshot.todayKey,
      weekStartKey: statsSnapshot.weekStartKey,
      todayCount: statsSnapshot.todayCount,
      weekCount: statsSnapshot.weekCount,
      streak: statsSnapshot.streak,
      weekDelta: statsSnapshot.weekDelta,
      week: statsSnapshot.weekCounts,
      weekDayIndex: statsSnapshot.weekDayIndex,
      monthCount: statsSnapshot.monthCount,
      monthDelta: statsSnapshot.monthDelta,
      freshness: statsSnapshot.freshness,
      excludedInvalidRecords: statsSnapshot.excludedInvalidRecords,
    });
    const result = await P.WidgetStats.syncStats({ stats });
    /* 旧插件只返回 {ok:true}；只有明确 rejected 才进入兼容重试路径。 */
    if (result && result.accepted === false && retry && result.reason !== 'stale') {
      await new Promise((resolve) => setTimeout(resolve, 180));
      return syncWidgetStats(statsSnapshot, { retry: false });
    }
    return result || { ok: true, accepted: true, legacy: true };
  } catch (e) {
    /* 原生桥短暂不可用时只重试一次，绝不阻塞记录保存或页面渲染。 */
    if (retry) {
      await new Promise((resolve) => setTimeout(resolve, 180));
      return syncWidgetStats(snapshot, { retry: false });
    }
    return { ok: false, accepted: false, reason: 'bridge_error' };
  }
}

/* #211 N10：把聚合快照写入原生 SharedPreferences；原始记录仍只在 WebView
   存储中，写入失败静默降级，不阻塞记录保存。 */
async function syncNativeHomeSnapshot(snapshot = null) {
  try {
    const bridge = window.GuanjiNative?.homeSnapshot;
    if (!bridge || typeof bridge.write !== 'function') return { ok: false, reason: 'unavailable' };
    const value = snapshot || buildStatsSnapshot();
    return await bridge.write({ snapshot: JSON.stringify({
      protocolVersion: 1,
      schemaVersion: value.schemaVersion,
      statsRuleVersion: value.statsRuleVersion,
      revision: value.revision,
      generatedAtMs: value.generatedAtMs,
      timezone: value.timezone,
      todayKey: value.todayKey,
      weekCount: value.weekCount,
      todayCount: value.todayCount,
      streak: value.streak,
      weekDelta: value.weekDelta,
      monthCount: value.monthCount,
      monthDelta: value.monthDelta,
      week: value.weekCounts,
      weekDayIndex: value.weekDayIndex,
    }) });
  } catch { return { ok: false, reason: 'bridge_error' }; }
}
window.syncNativeHomeSnapshot = syncNativeHomeSnapshot;

/* #147：记录变化 → 同步小组件 + 刷新洞察事实；洞察页可见时按旧版逻辑防抖自动更新 AI。 */
let widgetSyncTimer = null;
function afterRecordsChanged() {
  const statsSnapshot = buildStatsSnapshot();
  scheduleReportRefresh(statsSnapshot);
  /* 让当前页面先完成渲染，再把同一快照交给原生小组件，避免阻塞保存反馈。 */
  clearTimeout(widgetSyncTimer);
  widgetSyncTimer = setTimeout(() => {
    widgetSyncTimer = null;
    syncWidgetStats(statsSnapshot);
  }, 0);
  setTimeout(() => syncNativeHomeSnapshot(statsSnapshot), 0);
  return statsSnapshot;
}

