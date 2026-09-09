/* #225/#229/#231：个人基线输入适配器。
   只把本地记录压缩为按天计数和持续时间分布，供 Kotlin 行为模型使用；
   不传递单条记录、备注、观察原文或精确时间线。#229 额外传递已聚合的
   发生前状况组合计数，让原生模型可以统一输出“共同出现”关系；模型算法由
   原生 core.behavior 计算，WebView 仅负责提供同一 StatsSnapshot 对应的聚合输入。 */
(function installBehaviorModelInput(global) {
  const BASELINE_DAYS = 56;
  const CURRENT_WINDOW_DAYS = 28;

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function meaningfulObservationValues(record) {
    let values = [];
    if (typeof global.recordObservationValues === 'function') {
      values = global.recordObservationValues(record);
    } else if (record && Array.isArray(record.observations)) {
      values = record.observations;
    } else if (record && record.observation) {
      values = [record.observation];
    }
    const normalized = (Array.isArray(values) ? values : [values])
      .map((value) => String(value || '').trim())
      .filter((value) => value && value !== 'none' && value !== 'unsure')
      /* 自定义/旧文本可能包含用户原话；不进入原生模型桥，只统计稳定预设 key。 */
      .filter((value) => !value.startsWith('legacy:') && !value.startsWith('custom:'));
    return Array.from(new Set(normalized));
  }

  function recordsForContext(context) {
    if (context && Array.isArray(context.source)) return context.source;
    const list = Array.isArray(global.records)
      ? global.records
      : (typeof records !== 'undefined' && Array.isArray(records) ? records : []);
    return list.map((record) => ({ record, dateKey: recordDateKeyForStats(record), offset: null }));
  }

  function timeBucketForRecord(record) {
    const raw = String(record?.time || '').trim();
    const match = raw.match(/(?:^|T|\s)(\d{1,2})(?::\d{2})?/);
    let hour = match ? Number(match[1]) : NaN;
    if (!Number.isFinite(hour) && Number.isFinite(Number(record?.occurredAtMs))) {
      try { hour = new Date(Number(record.occurredAtMs)).getHours(); } catch { hour = NaN; }
    }
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
    if (hour < 6) return '深夜';
    if (hour < 12) return '上午';
    if (hour < 18) return '下午';
    if (hour < 22) return '傍晚';
    return '深夜';
  }

  function buildBehaviorModelInput(statsSnapshot = null) {
    const snapshot = statsSnapshot || (typeof global.buildStatsSnapshot === 'function'
      ? global.buildStatsSnapshot()
      : null);
    if (!snapshot || typeof shiftDateKey !== 'function') return null;
    const context = snapshot.__statsContext || null;
    const todayKey = String(snapshot.todayKey || context?.todayKey || '');
    if (!todayKey) return null;
    const startKey = shiftDateKey(todayKey, -(BASELINE_DAYS - 1));
    const currentStartKey = shiftDateKey(todayKey, -(CURRENT_WINDOW_DAYS - 1));
    const source = recordsForContext(context);
    const inRange = source.filter((item) => item && item.dateKey
      && item.dateKey >= startKey && item.dateKey <= todayKey);
    const byDate = new Map();
    const observationCounts = {};
    const currentObservationCounts = {};
    const timeBucketCounts = {};
    const currentTimeBucketCounts = {};
    const observationPairCounts = {};
    inRange.forEach((item) => {
      const key = String(item.dateKey);
      const bucket = byDate.get(key) || { dateKey: key, count: 0, durationValues: [] };
      bucket.count += 1;
      const duration = finiteNumber(item.record && item.record.duration);
      if (duration !== null && duration >= 0 && duration <= 24 * 60) bucket.durationValues.push(duration);
      const timeBucket = timeBucketForRecord(item.record);
      if (timeBucket) {
        timeBucketCounts[timeBucket] = (timeBucketCounts[timeBucket] || 0) + 1;
        if (key >= currentStartKey) currentTimeBucketCounts[timeBucket] = (currentTimeBucketCounts[timeBucket] || 0) + 1;
      }
      const allValues = meaningfulObservationValues(item.record).sort();
      allValues.forEach((value) => { observationCounts[value] = (observationCounts[value] || 0) + 1; });
      if (key >= currentStartKey) {
        const values = allValues;
        values.forEach((value) => { currentObservationCounts[value] = (currentObservationCounts[value] || 0) + 1; });
        for (let i = 0; i < values.length; i += 1) {
          for (let j = i + 1; j < values.length; j += 1) {
            const pair = `${values[i]}\u0000${values[j]}`;
            observationPairCounts[pair] = (observationPairCounts[pair] || 0) + 1;
          }
        }
      }
      byDate.set(key, bucket);
    });

    const dailySeries = [];
    for (let index = BASELINE_DAYS - 1; index >= 0; index -= 1) {
      const dateKey = shiftDateKey(todayKey, -index);
      const bucket = byDate.get(dateKey);
      dailySeries.push({
        dateKey,
        daysAgo: index,
        observed: !!bucket,
        count: bucket ? bucket.count : 0,
        durationValues: bucket ? bucket.durationValues.slice() : [],
      });
    }

    const baselineDurationValues = [];
    const currentDurationValues = [];
    let oldestKey = '';
    let coverageDays = 0;
    let currentCoverageDays = 0;
    let recordCount = 0;
    inRange.forEach((item) => {
      const key = String(item.dateKey);
      if (!oldestKey || key < oldestKey) oldestKey = key;
      recordCount += 1;
      const duration = finiteNumber(item.record && item.record.duration);
      if (duration !== null && duration >= 0 && duration <= 24 * 60) {
        baselineDurationValues.push(duration);
        if (key >= currentStartKey) currentDurationValues.push(duration);
      }
    });
    dailySeries.forEach((day) => {
      if (!day.observed) return;
      coverageDays += 1;
      if (day.daysAgo < CURRENT_WINDOW_DAYS) currentCoverageDays += 1;
    });
    /* 只报告“记录跨度”，不把未记录日期解释为没有发生。 */
    const historySpanDays = oldestKey && typeof dateKeyDiff === 'function'
      ? Math.max(1, Math.min(BASELINE_DAYS, dateKeyDiff(todayKey, oldestKey) + 1))
      : 0;
    const quality = typeof buildDataQuality === 'function'
      ? buildDataQuality(source, source.filter((item) => item && item.dateKey && item.dateKey <= todayKey), todayKey, BASELINE_DAYS)
      : null;
    return {
      inputVersion: 1,
      baselineDays: BASELINE_DAYS,
      currentWindowDays: CURRENT_WINDOW_DAYS,
      windowStartKey: startKey,
      windowEndKey: todayKey,
      currentWindowStartKey: currentStartKey,
      historySpanDays,
      recordCount,
      coverageDays,
      currentCoverageDays,
      dailySeries,
      /* 这是持续时间的数值分布，不含发生时间或记录标识。 */
      baselineDurationValues,
      currentDurationValues,
      /* #229：只传组合计数和样本数，不传单条事件或精确时间。 */
      observationCounts,
      currentObservationCounts,
      /* #231：时段也只传离散桶计数，供个人特征计算，不传精确发生时间。 */
      timeBucketCounts,
      currentTimeBucketCounts,
      observedDateKeys: dailySeries.filter((day) => day.observed).map((day) => day.dateKey),
      generatedAtMs: Number(snapshot.generatedAtMs) || Date.now(),
      timezone: String(snapshot.timezone || 'local'),
      observationPairCounts: Object.entries(observationPairCounts)
        .map(([pair, count]) => {
          const [from, to] = pair.split('\u0000');
          return { from, to, count, sampleCount: inRange.filter((item) => String(item.dateKey) >= currentStartKey).length };
        })
        .sort((a, b) => b.count - a.count || `${a.from}+${a.to}`.localeCompare(`${b.from}+${b.to}`, 'zh-CN'))
        .slice(0, 12),
      dataQuality: quality,
    };
  }

  global.buildBehaviorModelInput = buildBehaviorModelInput;
  global.BEHAVIOR_BASELINE_DAYS = BASELINE_DAYS;
  global.BEHAVIOR_CURRENT_WINDOW_DAYS = CURRENT_WINDOW_DAYS;
})(window);
