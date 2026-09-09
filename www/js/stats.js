// 观己 App · stats（v3.60：统一统计快照与自然周期）
/*
 * 统计事实统一从这里产生：首页、洞悉、AI 和 Android 小组件都消费同一份
 * StatsSnapshot。旧的 offset/dateKey 读取仍保留兼容，新的统计优先使用可信
 * occurredAtMs，并对异常日期进行隔离。
 */

function dateWithOffset(off, base = new Date()) {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + Number(off || 0));
  return d;
}

function dateKeyParts(key) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''));
  return m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : null;
}

function dateKeyFromParts(year, month, day) {
  const key = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return isValidDateKey(key) ? key : '';
}

function dateKeyDiff(a, b) {
  const pa = dateKeyParts(a), pb = dateKeyParts(b);
  if (!pa || !pb) return null;
  const da = Date.UTC(pa.year, pa.month - 1, pa.day);
  const db = Date.UTC(pb.year, pb.month - 1, pb.day);
  return Math.round((da - db) / 864e5);
}

function shiftDateKey(key, amount) {
  const p = dateKeyParts(key);
  if (!p) return '';
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day + Number(amount || 0)));
  return dateKeyFromParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

function shiftMonthKey(key, amount) {
  const p = dateKeyParts(key);
  if (!p) return '';
  const d = new Date(Date.UTC(p.year, p.month - 1 + Number(amount || 0), 1));
  return dateKeyFromParts(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

function daysInMonthKey(key) {
  const p = dateKeyParts(key);
  if (!p) return 0;
  return new Date(Date.UTC(p.year, p.month, 0)).getUTCDate();
}

function localDateKeyForStats(date = new Date()) {
  return dateKeyFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function recordDateKeyForStats(record, zoneId = preferredStatsTimeZone()) {
  if (!record || typeof record !== 'object') return '';
  const timestamp = Number(record.occurredAtMs);
  if (Number.isFinite(timestamp)) {
    const key = dateKeyFromTimestamp(timestamp, zoneId);
    if (key) return key;
  }
  const local = String(record.localDate || record.localDateKey || '');
  if (isValidDateKey(local)) return local;
  const legacy = String(record.dateKey || '');
  return isValidDateKey(legacy) ? legacy : '';
}

function statsRecordOffset(record, nowMs = Date.now(), zoneId = preferredStatsTimeZone(), todayKey = '', recordDateKey = '') {
  const currentKey = todayKey || dateKeyFromTimestamp(nowMs, zoneId);
  const key = recordDateKey || recordDateKeyForStats(record, zoneId);
  const diff = key && currentKey ? dateKeyDiff(key, currentKey) : null;
  if (Number.isFinite(diff)) return diff;
  const oldOffset = Number(record && record.offset);
  return Number.isFinite(oldOffset) ? oldOffset : null;
}

function statsSourceRecords(nowMs = Date.now(), zoneId = preferredStatsTimeZone()) {
  const safeNow = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  const todayKey = dateKeyFromTimestamp(safeNow, zoneId);
  return (Array.isArray(records) ? records : []).map((record) => {
    const dateKey = recordDateKeyForStats(record, zoneId);
    return { record, dateKey, offset: statsRecordOffset(record, safeNow, zoneId, todayKey, dateKey) };
  });
}

/* #224：质量指标只描述“这批数据有多完整”，不把缺失记录解释为未发生。
   统计窗口固定为最近 7 个自然日；来源和补记比例只基于可归类、非未来记录。 */
function buildDataQuality(source, valid, todayKey, windowDays = 7) {
  const safeDays = Math.max(1, Number(windowDays) || 7);
  const startKey = shiftDateKey(todayKey, -(safeDays - 1));
  const windowItems = (Array.isArray(valid) ? valid : []).filter((item) => item && item.dateKey >= startKey && item.dateKey <= todayKey);
  const sourceCounts = {};
  const precisionCounts = {};
  const covered = new Set();
  let backfillCount = 0;
  let metadataCompleteCount = 0;
  windowItems.forEach((item) => {
    const record = item.record || {};
    covered.add(item.dateKey);
    const sourceKey = String(record.source || 'legacy');
    sourceCounts[sourceKey] = (sourceCounts[sourceKey] || 0) + 1;
    const precision = String(record.timePrecision || 'unknown');
    precisionCounts[precision] = (precisionCounts[precision] || 0) + 1;
    if (record.backfill === true || sourceKey === 'backfill') backfillCount += 1;
    if (Number.isFinite(Number(record.occurredAtMs)) && String(record.zoneId || '').trim()
      && isValidDateKey(String(record.localDate || record.localDateKey || item.dateKey))) {
      metadataCompleteCount += 1;
    }
  });
  const recordCount = windowItems.length;
  const coverageDays = covered.size;
  const coverageRatio = +(coverageDays / safeDays).toFixed(4);
  const completenessRatio = recordCount ? +(metadataCompleteCount / recordCount).toFixed(4) : 0;
  const status = recordCount === 0 ? 'insufficient' : (coverageRatio < 0.5 || completenessRatio < 0.5 ? 'partial' : 'usable');
  const invalidCount = (Array.isArray(source) ? source : []).filter((item) => !item || !item.dateKey).length;
  const futureCount = (Array.isArray(source) ? source : []).filter((item) => item && item.dateKey && item.dateKey > todayKey).length;
  return {
    windowDays: safeDays,
    windowStartKey: startKey,
    windowEndKey: todayKey,
    recordCount,
    coverageDays,
    coverageRatio,
    sourceCounts,
    backfillCount,
    backfillRatio: recordCount ? +(backfillCount / recordCount).toFixed(4) : 0,
    timePrecisionCounts: precisionCounts,
    metadataCompleteCount,
    completenessRatio,
    status,
    excludedInvalidRecords: invalidCount,
    excludedFutureRecords: futureCount,
    excludedRecords: invalidCount + futureCount,
  };
}

/* #198：一次性建立统计上下文，后续日期计数只读 Map，不重复扫描 records。 */
function createStatsContext({ nowMs = Date.now(), zoneId = preferredStatsTimeZone() } = {}) {
  const safeNow = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  const safeZone = zoneId || preferredStatsTimeZone();
  const todayKey = dateKeyFromTimestamp(safeNow, safeZone) || localDateKeyForStats(new Date(safeNow));
  const source = statsSourceRecords(safeNow, safeZone);
  const valid = source.filter((item) => !!item.dateKey && item.dateKey <= todayKey);
  const dateCounts = new Map();
  valid.forEach((item) => dateCounts.set(item.dateKey, (dateCounts.get(item.dateKey) || 0) + 1));
  return {
    nowMs: safeNow,
    zoneId: safeZone,
    todayKey,
    source,
    valid,
    dateCounts,
    dateSet: new Set(valid.map((item) => item.dateKey)),
  };
}

function countDateKey(key, nowMs = Date.now(), zoneId = preferredStatsTimeZone(), context = null) {
  if (!isValidDateKey(key)) return 0;
  const ctx = context || createStatsContext({ nowMs, zoneId });
  const todayKey = ctx.todayKey;
  if (todayKey && key > todayKey) return 0;
  return ctx.dateCounts.get(key) || 0;
}

function countDateRange(startKey, endKey, nowMs = Date.now(), zoneId = preferredStatsTimeZone(), context = null) {
  if (!isValidDateKey(startKey) || !isValidDateKey(endKey)) return 0;
  const ctx = context || createStatsContext({ nowMs, zoneId });
  const todayKey = ctx.todayKey;
  const boundedEnd = todayKey && endKey > todayKey ? todayKey : endKey;
  if (boundedEnd < startKey) return 0;
  let total = 0;
  for (const [key, count] of ctx.dateCounts) {
    if (key >= startKey && key <= boundedEnd) total += count;
  }
  return total;
}

/* 旧调用兼容：日历和旧入口仍使用 offset，但日期优先按统一统计时区推导。 */
function countRange(a, b) {
  const min = Number(a), max = Number(b);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
  const nowMs = Date.now();
  const zoneId = preferredStatsTimeZone();
  return statsSourceRecords(nowMs, zoneId)
    .filter((item) => !!item.dateKey && Number.isFinite(item.offset) && item.offset >= min && item.offset <= max)
    .length;
}

function hourOf(record) {
  const value = record && record.time;
  const parsed = parseInt(String(value || '').split(':')[0], 10);
  if (Number.isFinite(parsed)) return Math.max(0, Math.min(23, parsed));
  const timestamp = Number(record && record.occurredAtMs);
  return Number.isFinite(timestamp) ? new Date(timestamp).getHours() : 0;
}

function fmtDateShort(off) {
  const d = dateWithOffset(off);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function validStatsDateSet(nowMs = Date.now(), zoneId = preferredStatsTimeZone()) {
  return createStatsContext({ nowMs, zoneId }).dateSet;
}

function countStreakForDateSet(dateSet, todayKey) {
  if (!todayKey) return 0;
  let cursor = todayKey;
  /* 今天尚未结束且没有记录时，不提前清零；从昨天开始判断。 */
  if (!dateSet.has(cursor)) cursor = shiftDateKey(cursor, -1);
  let streak = 0;
  while (cursor && dateSet.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

function countStreak(snapshot = null) {
  if (snapshot && Number.isFinite(Number(snapshot.streak))) return Number(snapshot.streak);
  const nowMs = Date.now();
  const zoneId = preferredStatsTimeZone();
  const todayKey = dateKeyFromTimestamp(nowMs, zoneId);
  return countStreakForDateSet(validStatsDateSet(nowMs, zoneId), todayKey);
}

function mondayOfWeek(todayKey) {
  const p = dateKeyParts(todayKey);
  if (!p) return '';
  const day = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return shiftDateKey(todayKey, -(day === 0 ? 6 : day - 1));
}

function snapshotSignature(nowMs, zoneId, todayKey, context = null) {
  const sourceRecords = context ? context.source : statsSourceRecords(nowMs, zoneId);
  const items = sourceRecords
    .map((item) => {
      const r = item.record || {};
      return `${r.id || ''}:${item.dateKey || ''}:${r.time || ''}:${r.updatedAtMs || r.occurredAtMs || ''}`;
    })
    .sort()
    .join('|');
  let hash = 2166136261;
  const signatureSource = `${zoneId}|${todayKey}|${items}`;
  for (let i = 0; i < signatureSource.length; i += 1) {
    hash ^= signatureSource.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function nextStatsRevision(signature) {
  let state = null;
  try { state = JSON.parse(localStorage.getItem(STATS_REVISION_KEY) || 'null'); } catch { state = null; }
  if (state && state.signature === signature && Number.isFinite(Number(state.revision))) return Number(state.revision);
  const previous = state && Number.isFinite(Number(state.revision)) ? Number(state.revision) : 0;
  const revision = Math.max(Date.now(), previous + 1);
  try { localStorage.setItem(STATS_REVISION_KEY, JSON.stringify({ signature, revision })); } catch { /* 只读环境 */ }
  return revision;
}

function buildStatsSnapshot({ nowMs = Date.now(), zoneId = preferredStatsTimeZone(), context = null } = {}) {
  const ctx = context || createStatsContext({ nowMs, zoneId });
  const safeNow = ctx.nowMs;
  const safeZone = ctx.zoneId;
  const todayKey = ctx.todayKey;
  const weekStartKey = mondayOfWeek(todayKey);
  const monthStartKey = `${todayKey.slice(0, 7)}-01`;
  const source = ctx.source;
  const valid = ctx.valid;
  /* 未来日期会留在数据源中但不参与当前周期；这里只统计真正无法归类的
     异常记录，避免把用户误填的未来记录冒充成 3.6.1 异常日期。 */
  const excludedInvalidRecords = source.filter((item) => !item.dateKey).length;
  const excludedFutureRecords = source.filter((item) => item.dateKey && item.dateKey > todayKey).length;
  const weekDayIndex = Math.max(0, Math.min(6, dateKeyDiff(todayKey, weekStartKey) || 0));
  const weekEndKey = shiftDateKey(weekStartKey, 6);
  const weekCounts = Array.from({ length: 7 }, (_, index) => countDateKey(shiftDateKey(weekStartKey, index), safeNow, safeZone, ctx));
  const weekCount = weekCounts.reduce((sum, value) => sum + value, 0);

  const previousWeekStartKey = shiftDateKey(weekStartKey, -7);
  const previousWeekEndKey = shiftDateKey(previousWeekStartKey, weekDayIndex);
  const previousWeekCount = countDateRange(previousWeekStartKey, previousWeekEndKey, safeNow, safeZone, ctx);

  const monthDayIndex = Math.max(0, (dateKeyParts(todayKey) || {}).day - 1);
  const monthCount = countDateRange(monthStartKey, todayKey, safeNow, safeZone, ctx);
  const previousMonthStartKey = shiftMonthKey(monthStartKey, -1);
  const previousMonthDays = daysInMonthKey(previousMonthStartKey);
  const previousMonthEndKey = shiftDateKey(previousMonthStartKey, Math.min(monthDayIndex, previousMonthDays - 1));
  const previousMonthCount = countDateRange(previousMonthStartKey, previousMonthEndKey, safeNow, safeZone, ctx);

  const rolling = {};
  [7, 14, 30].forEach((days) => {
    const startKey = shiftDateKey(todayKey, -(days - 1));
    rolling[days] = Array.from({ length: days }, (_, index) => countDateKey(shiftDateKey(startKey, index), safeNow, safeZone, ctx));
  });
  const dateSet = ctx.dateSet;
  const signature = snapshotSignature(safeNow, safeZone, todayKey, ctx);
  const revision = nextStatsRevision(signature);

  const snapshot = {
    schemaVersion: STATS_SCHEMA_VERSION,
    statsRuleVersion: STATS_RULE_VERSION,
    generationId: `${todayKey}:${safeZone}:${revision}`,
    revision,
    generatedAtMs: safeNow,
    timezone: safeZone,
    todayKey,
    weekStartKey,
    weekEndKey,
    monthStartKey,
    todayCount: countDateKey(todayKey, safeNow, safeZone, ctx),
    weekCount,
    weekCounts,
    weekDayIndex,
    weekDelta: previousWeekCount > 0 ? Math.round((weekCount - previousWeekCount) / previousWeekCount * 100) : null,
    previousWeekCount,
    monthCount,
    monthDelta: previousMonthCount > 0 ? Math.round((monthCount - previousMonthCount) / previousMonthCount * 100) : null,
    previousMonthCount,
    streak: countStreakForDateSet(dateSet, todayKey),
    rolling7Count: rolling[7].reduce((sum, value) => sum + value, 0),
    rolling14: rolling[14],
    rolling30: rolling[30],
    freshness: 'fresh',
    excludedInvalidRecords,
    excludedFutureRecords,
    dataQuality: buildDataQuality(source, valid, todayKey, 7),
  };
  /* 内部调用可共享源数据；不可枚举，避免污染 WidgetStats/AI JSON 协议。 */
  Object.defineProperty(snapshot, '__statsContext', { value: ctx, enumerable: false });
  return snapshot;
}

function recentCount(days = 7, options = {}) {
  const safeDays = Math.max(1, Math.min(90, Number(days) || 7));
  const snapshot = options.statsSnapshot || buildStatsSnapshot(options);
  if (safeDays === 7) return snapshot.rolling7Count;
  if (snapshot[`rolling${safeDays}`]) return snapshot[`rolling${safeDays}`].reduce((sum, value) => sum + value, 0);
  const nowMs = options.nowMs || Date.now();
  const zoneId = options.zoneId || preferredStatsTimeZone();
  const todayKey = dateKeyFromTimestamp(nowMs, zoneId);
  return countDateRange(shiftDateKey(todayKey, -(safeDays - 1)), todayKey, nowMs, zoneId);
}

/* ---------- 个人洞察统一事实快照 ---------- */

function insightWindowRecords(minOffset, maxOffset, context = {}) {
  const nowMs = Number.isFinite(Number(context.nowMs)) ? Number(context.nowMs) : Date.now();
  const zoneId = context.zoneId || preferredStatsTimeZone();
  const source = context.statsContext && Array.isArray(context.statsContext.source)
    ? context.statsContext.source
    : statsSourceRecords(nowMs, zoneId);
  return source.filter((item) => !!item.dateKey && Number.isFinite(item.offset) && item.offset >= minOffset && item.offset <= maxOffset);
}

function insightLabelMeta(key) {
  const meta = (typeof OBSERVATION_OPTIONS !== 'undefined' ? OBSERVATION_OPTIONS : [])
    .find((o) => o.key === key);
  if (meta) return meta;
  return { key, label: observationLabelFromValue(key), dimension: 'custom', order: 999, custom: true };
}

function insightMeaningfulValues(record) {
  return [...new Set(recordObservationValues(record))]
    .filter((key) => key && key !== 'none' && key !== 'unsure');
}

function buildInsightWindow(minOffset, maxOffset, context = {}) {
  const list = insightWindowRecords(minOffset, maxOffset, context);
  const timeBuckets = Object.fromEntries(BUCKETS.map((b) => [b.key, 0]));
  const labelCounts = {};
  const comboCounts = {};
  const coverage = new Set();
  let meaningfulRecordCount = 0;
  let noneCount = 0;
  let unsureCount = 0;
  let missingCount = 0;

  list.forEach((item) => {
    const record = item.record;
    const dateKey = item.dateKey;
    if (dateKey) coverage.add(dateKey);
    const hour = hourOf(record);
    BUCKETS.forEach((bucket) => { if (bucket.test(hour)) timeBuckets[bucket.key] += 1; });

    const allValues = [...new Set(recordObservationValues(record))];
    if (!allValues.length) missingCount += 1;
    if (allValues.includes('none')) noneCount += 1;
    if (allValues.includes('unsure')) unsureCount += 1;

    const values = insightMeaningfulValues(record);
    if (values.length) meaningfulRecordCount += 1;
    values.forEach((key) => { labelCounts[key] = (labelCounts[key] || 0) + 1; });
    for (let i = 0; i < values.length; i += 1) {
      for (let j = i + 1; j < values.length; j += 1) {
        const pair = [values[i], values[j]].sort().join(' + ');
        comboCounts[pair] = (comboCounts[pair] || 0) + 1;
      }
    }
  });

  const recordCount = list.length;
  const labels = Object.entries(labelCounts)
    .map(([key, count]) => {
      const meta = insightLabelMeta(key);
      return {
        key,
        label: meta.label || observationLabelFromValue(key),
        dimension: meta.dimension || 'custom',
        custom: !!meta.custom || key.indexOf('custom:') === 0 || key.indexOf('legacy:') === 0,
        count,
        ratio: recordCount ? +(count / recordCount).toFixed(4) : 0,
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'));

  const cooccurrence = Object.entries(comboCounts)
    .map(([pair, count]) => ({ pair, count, ratio: recordCount ? +(count / recordCount).toFixed(4) : 0 }))
    .sort((a, b) => b.count - a.count || a.pair.localeCompare(b.pair, 'zh-CN'));

  return {
    recordCount,
    coverageDays: coverage.size,
    timeBuckets,
    labels,
    cooccurrence,
    meaningfulRecordCount,
    observationCoverage: recordCount ? +(meaningfulRecordCount / recordCount).toFixed(4) : 0,
    noneCount,
    unsureCount,
    missingCount,
  };
}

function insightTopEntry(map) {
  return Object.entries(map || {}).sort((a, b) => b[1] - a[1])[0] || null;
}

function insightClarity(current, previous, days) {
  const reasons = [];
  const coverageTarget = Math.min(days, 7);
  const meaningful = current.observationCoverage;
  const hasEnoughHistory = previous.recordCount >= 3;
  const currentTopTime = insightTopEntry(current.timeBuckets);
  const previousTopTime = insightTopEntry(previous.timeBuckets);
  const currentTopLabel = current.labels[0] ? current.labels[0].key : '';
  const previousTopLabel = previous.labels[0] ? previous.labels[0].key : '';
  const stableTop = hasEnoughHistory && currentTopTime && previousTopTime && currentTopTime[0] === previousTopTime[0]
    && (!currentTopLabel || !previousTopLabel || currentTopLabel === previousTopLabel);

  let stage = 'insufficient';
  let label = '数据不足';
  if (current.recordCount < 3 || current.coverageDays < 2) {
    reasons.push('至少需要几条记录，并覆盖不止一天，才适合观察模式。');
  } else if (current.recordCount < 7 || current.coverageDays < 4) {
    stage = 'outline';
    label = '初步轮廓';
    reasons.push(`当前有 ${current.recordCount} 条记录，覆盖 ${current.coverageDays} 天。`);
  } else if (current.recordCount < 12 || current.coverageDays < coverageTarget || meaningful < 0.5) {
    stage = 'emerging';
    label = '逐渐清晰';
    reasons.push(`当前有 ${current.recordCount} 条记录，覆盖 ${current.coverageDays} 天。`);
    if (meaningful < 0.5) reasons.push('仍有较多记录没有明确的发生前状况。');
  } else if (!stableTop) {
    stage = 'emerging';
    label = '逐渐清晰';
    reasons.push('样本量已经可以观察模式，但相邻窗口的主要模式还在变化。');
  } else {
    stage = 'stable';
    label = '相对稳定';
    reasons.push(`近 ${days} 天的记录覆盖和主要模式相对稳定。`);
  }

  if (current.recordCount && current.noneCount + current.unsureCount + current.missingCount > 0) {
    reasons.push(`其中 ${current.noneCount + current.unsureCount + current.missingCount} 条记录没有明确的普通状况标签。`);
  }

  return { stage, label, reasons, stableTop };
}

function buildInsightSnapshot({ days = 7, now = new Date(), zoneId = preferredStatsTimeZone(), statsSnapshot = null, context = null } = {}) {
  const safeDays = Math.max(1, Math.min(90, Number(days) || 7));
  const nowMs = statsSnapshot && Number.isFinite(Number(statsSnapshot.generatedAtMs))
    ? Number(statsSnapshot.generatedAtMs)
    : (now instanceof Date ? now.getTime() : Number(now));
  const safeStats = statsSnapshot || buildStatsSnapshot({ nowMs, zoneId, context });
  const statsContext = context || safeStats.__statsContext || { nowMs, zoneId: safeStats.timezone };
  const windowContext = { nowMs: statsContext.nowMs, zoneId: statsContext.zoneId, statsContext };
  const current = buildInsightWindow(-(safeDays - 1), 0, windowContext);
  const previous = buildInsightWindow(-(safeDays * 2 - 1), -safeDays, windowContext);
  const currentTopTime = insightTopEntry(current.timeBuckets);
  const previousTopTime = insightTopEntry(previous.timeBuckets);
  const currentTopLabel = current.labels[0] || null;
  const previousTopLabel = previous.labels[0] || null;
  const clarity = insightClarity(current, previous, safeDays);
  const recordDelta = current.recordCount - previous.recordCount;
  const recordDeltaPct = previous.recordCount ? Math.round(recordDelta / previous.recordCount * 100) : null;
  const timeChanges = BUCKETS.map((bucket) => ({
    key: bucket.key,
    current: current.timeBuckets[bucket.key],
    previous: previous.timeBuckets[bucket.key],
    currentRatio: current.recordCount ? +(current.timeBuckets[bucket.key] / current.recordCount).toFixed(4) : 0,
    previousRatio: previous.recordCount ? +(previous.timeBuckets[bucket.key] / previous.recordCount).toFixed(4) : 0,
  }));

  return {
    schemaVersion: safeStats.schemaVersion,
    statsRuleVersion: safeStats.statsRuleVersion,
    generationId: safeStats.generationId,
    revision: safeStats.revision,
    timezone: safeStats.timezone,
    days: safeDays,
    recordCount: current.recordCount,
    coverageDays: current.coverageDays,
    observationCoverage: current.observationCoverage,
    meaningfulRecordCount: current.meaningfulRecordCount,
    timeBuckets: current.timeBuckets,
    labels: current.labels,
    cooccurrence: current.cooccurrence,
    noneCount: current.noneCount,
    unsureCount: current.unsureCount,
    missingCount: current.missingCount,
    previous: {
      recordCount: previous.recordCount,
      coverageDays: previous.coverageDays,
      observationCoverage: previous.observationCoverage,
      timeBuckets: previous.timeBuckets,
      labels: previous.labels,
    },
    changes: {
      recordDelta,
      recordDeltaPct,
      timeChanges,
      currentTopTime: currentTopTime ? { key: currentTopTime[0], count: currentTopTime[1] } : null,
      previousTopTime: previousTopTime ? { key: previousTopTime[0], count: previousTopTime[1] } : null,
    },
    currentTopLabel,
    previousTopLabel,
    clarity,
    stats: safeStats,
  };
}

window.buildStatsSnapshot = buildStatsSnapshot;
window.recordDateKeyForStats = recordDateKeyForStats;
window.countDateKey = countDateKey;
window.recentCount = recentCount;
