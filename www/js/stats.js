// 观己 App · stats（P1 搬移式拆分，2026-08-09——函数原样搬移，零逻辑改动）
/* ---------- 统计工具 ---------- */

function dateWithOffset(off) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + off);
  return d;
}

function countRange(a, b) {
  return records.filter((r) => r.offset >= a && r.offset <= b).length;
}

function hourOf(r) { return parseInt(r.time.split(':')[0], 10); }

function countStreak() {
  let s = 0;
  for (let off = 0; ; off--) {
    if (off === 0) { if (countRange(0, 0) > 0) { s++; continue; } continue; }
    if (countRange(off, off) > 0) s++;
    else break;
  }
  return s;
}

function fmtDateShort(off) {
  const d = dateWithOffset(off);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/* ---------- #133：个人洞察统一事实快照 ----------
   本地只计算可核对的事实；AI 和洞察 UI 均消费同一份 snapshot，避免各处统计口径漂移。 */

function insightWindowRecords(minOffset, maxOffset) {
  return records.filter((r) => {
    const off = Number(r && r.offset);
    return Number.isFinite(off) && off >= minOffset && off <= maxOffset;
  });
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

function buildInsightWindow(minOffset, maxOffset) {
  const list = insightWindowRecords(minOffset, maxOffset);
  const timeBuckets = Object.fromEntries(BUCKETS.map((b) => [b.key, 0]));
  const labelCounts = {};
  const comboCounts = {};
  const coverage = new Set();
  let meaningfulRecordCount = 0;
  let noneCount = 0;
  let unsureCount = 0;
  let missingCount = 0;

  list.forEach((record) => {
    const off = Number(record.offset);
    coverage.add(off);
    const hour = hourOf(record);
    BUCKETS.forEach((bucket) => {
      if (bucket.test(hour)) timeBuckets[bucket.key] += 1;
    });

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

function buildInsightSnapshot({ days = 7, now = new Date() } = {}) {
  // `now` 保留在接口中，便于边界测试；当前记录已经通过 offset 归一化到今天。
  void now;
  const safeDays = Math.max(1, Math.min(90, Number(days) || 7));
  const current = buildInsightWindow(-(safeDays - 1), 0);
  const previous = buildInsightWindow(-(safeDays * 2 - 1), -safeDays);
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
      currentTopLabel,
      previousTopLabel,
    },
    clarity,
  };
}

