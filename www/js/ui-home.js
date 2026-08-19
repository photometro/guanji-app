// 观己 App · ui-home（P1 搬移式拆分，2026-08-09——函数原样搬移，零逻辑改动）
/* ---------- 数字滚动（count-up） ---------- */

function countUp(el, to, dur = 500) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to; return; }
  const t0 = performance.now();
  function tick(t) {
    const p = Math.min((t - t0) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(to * e);
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = to;
  }
  requestAnimationFrame(tick);
}

/* ---------- 渲染：首页 ---------- */

let chartDays = 14;   // 面积图/热力图范围：近 14 / 30 天
let chartView = 'curve';   // #88：次数趋势视图（curve 面积图 / heat 热力图）

function renderHome() {
  checkDayRollover();   // v3.6.1：App 驻留跨天时归一化记录日期
  const today = new Date();
  $('todayLabel').textContent =
    `${today.getMonth() + 1}月${today.getDate()}日 · ${WEEKDAYS[today.getDay()]}`;

  const todayCount = countRange(0, 0);
  $('todayStatus').textContent = todayCount ? `今天 · 已记录 ${todayCount} 次` : '今天 · 尚未记录';

  // 温和正向反馈（#17）：达到 7 / 30 天里程碑时替换副文案；开关关闭时恢复原逻辑
  let sub = todayCount ? '记录本身就是觉察' : '一切如常，无需评判';
  if (positiveEnabled()) {
    const m = milestoneText(countStreak());
    if (m) sub = m;
  }
  $('todaySub').textContent = sub;
  countUp($('todayNumVal'), todayCount);
  renderGreeting();

  const cur = countRange(-6, 0);
  const prev = countRange(-13, -7);
  countUp($('weekCount'), cur);
  const deltaEl = $('weekDelta');
  if (prev > 0) {
    const delta = Math.round((cur - prev) / prev * 100);
    deltaEl.textContent = (delta > 0 ? '+' : '') + delta + '%';
    deltaEl.classList.remove('plain');
    deltaEl.classList.toggle('down', delta <= 0);
  } else {
    deltaEl.textContent = '—';
    deltaEl.classList.remove('down');
    deltaEl.classList.add('plain');
  }
  countUp($('streakNum'), countStreak());

  renderChart(chartDays);
  renderMonthSummary();
  renderRingDist();
  renderRecentRecords();
}

/* #88：次数趋势视图分发（曲线 / 热力图） */
function renderChart(days) {
  if (chartView === 'heat') renderHeatmap(days);
  else renderAreaChart(days);
}

/* #88：热力图（固定行数网格——14 天恒 2 行、30 天恒 5 行；连续天数排列，蓝系色阶） */
function renderHeatmap(days) {
  const now = new Date();
  const rows = Math.ceil(days / 7);   // 固定行数：不按自然周切行，避免起始日导致多出空行
  // 最近 days 天（旧→新，行主序：每 rows*7 格）
  let cells = '';
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const off = dayDiff(date, now);
    const cnt = countRange(off, off);
    const level = cnt <= 0 ? 0 : cnt <= 2 ? 1 : cnt <= 5 ? 2 : 3;
    const label = `${date.getMonth() + 1}月${date.getDate()}日`;
    cells += `<span class="heat-cell heat-${level}" title="${label} · ${cnt} 次"></span>`;
  }
  const legend = `
    <div class="heat-legend">
      <span>少</span>
      <span class="heat-cell heat-0"></span><span class="heat-cell heat-1"></span>
      <span class="heat-cell heat-2"></span><span class="heat-cell heat-3"></span>
      <span>多</span>
    </div>`;
  $('areaChart').innerHTML = `
    <div class="heatmap">
      <div class="heat-grid" style="grid-template-rows: repeat(${rows}, 1fr)">${cells}</div>
    </div>
    ${legend}`;
}

/* ---------- 次数趋势：平滑面积图（近 14 / 30 天可切换） ---------- */

function smoothPath(pts) {
  let d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 8, c1y = p1[1] + (p2[1] - p0[1]) / 8;
    const c2x = p2[0] - (p3[0] - p1[0]) / 8, c2y = p2[1] - (p3[1] - p1[1]) / 8;
    d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function renderAreaChart(days) {
  const W = 336, H = 112, TOP = 14, BOT = 16, TOP_PAD = 16;
  const counts = [];
  let max = 0;
  for (let i = 0; i < days; i++) {
    const c = countRange(i - (days - 1), i - (days - 1));
    counts.push(c);
    if (c > max) max = c;
  }
  const pts = counts.map((c, i) => {
    const x = 4 + i * ((W - 8) / (days - 1));
    const y = c > 0 ? TOP + (1 - c / max) * (H - TOP - BOT) : H - BOT;
    return [x, y];
  });
  const lineD = smoothPath(pts);
  const areaD = lineD + ` L ${pts[days - 1][0].toFixed(1)},${H - BOT} L ${pts[0][0].toFixed(1)},${H - BOT} Z`;

  let labels = '';
  const valColor = cssVar('--ink-2') || '#8E8E93';
  const dateColor = cssVar('--ink-3') || '#C7C7CC';
  const labelEvery = days >= 30 ? 6 : 4;   // 30 天时标签间隔放宽，避免拥挤
  counts.forEach((c, i) => {
    if (c > 0) {
      labels += `<text class="chart-val" x="${pts[i][0].toFixed(1)}" y="${(pts[i][1] - 12).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="600" fill="${valColor}">${c}</text>`;
    }
    const d = dateWithOffset(i - (days - 1));
    const isToday = i === days - 1;
    if (i % labelEvery === 0 || isToday) {
      labels += `<text x="${pts[i][0].toFixed(1)}" y="${(H - 2).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="${dateColor}">${isToday ? '今' : (d.getMonth() + 1) + '/' + d.getDate()}</text>`;
    }
  });

  const accent = cssVar('--accent') || '#007AFF';
  $('areaChart').innerHTML = `
    <svg viewBox="0 ${-TOP_PAD} ${W} ${H + TOP_PAD}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="${accent}" stop-opacity="0.015"/>
        </linearGradient>
      </defs>
      <path d="${areaD}" fill="url(#areaGrad)" class="area-fill"/>
      <path d="${lineD}" class="area-line" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>
      ${labels}
    </svg>`;

  const line = document.querySelector('#areaChart .area-line');
  requestAnimationFrame(() => {
    line.style.transition = 'stroke-dashoffset 0.9s cubic-bezier(0.22, 1, 0.36, 1)';
    line.style.strokeDashoffset = '0';
  });
}

/* ---------- 月度汇总（#15）：本月 vs 上月（次数 / 日均 / 环比） ---------- */

function renderMonthSummary() {
  const now = new Date();
  const firstOff = dayDiff(new Date(now.getFullYear(), now.getMonth(), 1), now);   // 本月 1 号 offset（≤0）
  const prevFirst = dayDiff(new Date(now.getFullYear(), now.getMonth() - 1, 1), now);
  const prevLast = dayDiff(new Date(now.getFullYear(), now.getMonth(), 0), now);    // 上月最后一天 offset

  const curCount = countRange(firstOff, 0);
  const prevCount = countRange(prevFirst, prevLast);
  const daysElapsed = 1 - firstOff;   // 本月已过天数（含今天）
  const daily = curCount ? curCount / daysElapsed : 0;

  let deltaText = '—';
  let deltaClass = 'plain';
  if (prevCount > 0) {
    const delta = Math.round((curCount - prevCount) / prevCount * 100);
    deltaText = (delta > 0 ? '+' : '') + delta + '%';
    deltaClass = delta <= 0 ? 'down' : 'up';   // 次数减少 → 绿色（与周环比同语义）
  }

  $('monthSummary').innerHTML = `
    <span class="ms-item">本月 <b>${curCount}</b> 次</span>
    <span class="ms-item ms-delta ${deltaClass}">${deltaText}</span>`;
}

// 面积图范围切换（#21：滑块跟随）
$('chartSeg').addEventListener('click', (e) => {
  const btn = e.target.closest('.seg');
  if (!btn) return;
  chartDays = parseInt(btn.dataset.days, 10);
  document.querySelectorAll('#chartSeg .seg').forEach((s) => s.classList.toggle('active', s === btn));
  moveSegSlide($('chartSeg'), $('chartSegSlide'), btn);
  renderChart(chartDays);
  renderMonthSummary();
});

// #88：次数趋势视图切换（曲线 / 热力图）
$('chartViewSeg').addEventListener('click', (e) => {
  const btn = e.target.closest('.seg');
  if (!btn) return;
  chartView = btn.dataset.view;
  document.querySelectorAll('#chartViewSeg .seg').forEach((s) => s.classList.toggle('active', s === btn));
  moveSegSlide($('chartViewSeg'), $('chartViewSlide'), btn);
  renderChart(chartDays);
});

/* ---------- 通用 seg 滑块（#21/#22）：初始化定位 + 切换跟随 ---------- */

function moveSegSlide(rowEl, slideEl, segEl) {
  const r = rowEl.getBoundingClientRect();
  const s = segEl.getBoundingClientRect();
  slideEl.style.left = (s.left - r.left) + 'px';
  slideEl.style.width = s.width + 'px';
}

function initSegSlide(rowId, slideId) {
  const row = $(rowId), slide = $(slideId);
  if (!row || !slide) return;
  const seg = row.querySelector('.seg.active') || row.querySelector('.seg');
  moveSegSlide(row, slide, seg);
}

/* ---------- 时段分布：5 段分段环（一天 100%） ---------- */

/* 读取 CSS 变量（随主题切换，深色模式下自动提亮） */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* 分段环配色来自 CSS 变量：--ring-1..5（浅色蓝系渐变 / 深色提亮系） */
function ringColors() {
  return [1, 2, 3, 4, 5].map((i) => cssVar('--ring-' + i));
}

function renderRingDist() {
  const buckets = BUCKETS.map((b) => ({ key: b.key, n: 0 }));
  records.forEach((r) => {
    const h = hourOf(r);
    BUCKETS.forEach((b, i) => { if (b.test(h)) buckets[i].n++; });
  });
  const total = records.length;
  const hot = [...buckets].sort((a, b) => b.n - a.n)[0].key;
  const hotPct = total ? Math.round((buckets.find((b) => b.key === hot).n / total) * 100) : 0;
  const COLORS = ringColors();
  const ringBase = cssVar('--line') || '#E5E5EA';

  const R = 45, C = 2 * Math.PI * R, GAP = 4;   // C：真实周长 2πr（曾误用 πr 导致弧长减半、dash 周期重叠断裂）

  if (!total) {
    $('ringChart').innerHTML = `
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="${R}" fill="none" stroke="${ringBase}" stroke-width="12"
          stroke-dasharray="${C.toFixed(1)} ${C.toFixed(1)}"/>
      </svg>
      <div class="ring-center">
        <span class="ring-num">—</span>
        <span class="ring-label">暂无记录</span>
      </div>`;
  } else {
    // 5 段弧：起点 12 点方向，顺时针按时间顺序排列
    let arcs = '', acc = 0;
    buckets.forEach((b, i) => {
      const pct = b.n / total;
      const segLen = pct > 0 ? Math.max(pct * C - GAP, 0.5) : 0;
      arcs += `<circle class="ring-seg seg-${i}" cx="60" cy="60" r="${R}" fill="none"
        stroke="${COLORS[i]}" stroke-width="12" stroke-linecap="butt"
        stroke-dasharray="0 ${C.toFixed(1)}"
        transform="rotate(${(-90 + (acc / C) * 360).toFixed(1)} 60 60)"/>`;
      acc += pct * C;
    });
    $('ringChart').innerHTML = `
      <svg viewBox="0 0 120 120">${arcs}</svg>
      <div class="ring-center">
        <span class="ring-num">${hotPct}%</span>
        <span class="ring-label">${hot}</span>
      </div>`;

    // staggered 生长动画（按时段顺序依次展开）
    buckets.forEach((b, i) => {
      const seg = document.querySelector(`.seg-${i}`);
      const pct = b.n / total;
      const segLen = pct > 0 ? Math.max(pct * C - GAP, 0.5) : 0;
      setTimeout(() => {
        seg.style.transition = 'stroke-dasharray 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
        seg.style.strokeDasharray = `${segLen.toFixed(1)} ${C.toFixed(1)}`;
      }, i * 110);
    });
  }

  // 明细列表（带色点图例，与环段颜色一一对应）
  $('ringList').innerHTML = buckets.map((b, i) => `
    <div class="ring-item${b.key === hot && total ? ' hot' : ''}">
      <span class="r-key"><span class="ring-dot" style="background:${total ? COLORS[i] : ringBase}"></span>${b.key}</span>
      <span class="r-val">${b.n} 次 · ${total ? Math.round(b.n / total * 100) : 0}%</span>
    </div>`).join('');
}


/* ---------- 最近记录 ---------- */

function renderRecentRecords() {
  const recent = [...records]
    .sort((a, b) => (b.offset - a.offset) || b.time.localeCompare(a.time))
    .slice(0, 7);

  if (!recent.length) {
    $('recentList').innerHTML =
      '<p class="recent-empty">还没有记录。点「记录」记下第一次，<br>或去「我的 → 恢复演示数据」看看效果。</p>';
    return;
  }

  $('recentList').innerHTML = recent.map((r) => `
    <div class="recent-item">
      <div class="recent-main">
        <p class="recent-time">${fmtDateShort(r.offset)} ${r.time}</p>
        <p class="recent-tags">${displayRecordTags(r).join(' · ')}${r.duration ? ` · ${r.duration} 分钟` : ''}</p>
      </div>
      <div class="recent-actions">
        <button class="recent-edit" data-id="${r.id}" title="编辑这条记录" aria-label="编辑">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2.6 11.4l.6-2.4 6-6a1.4 1.4 0 0 1 2 2l-6 6-2.6.4z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="recent-del" data-id="${r.id}" title="删除这条记录" aria-label="删除">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>`).join('');
}

// 删除记录（事件委托）
$('recentList').addEventListener('click', (e) => {
  const editBtn = e.target.closest('.recent-edit');
  if (editBtn) { openEditRecord(editBtn.dataset.id); return; }
  const btn = e.target.closest('.recent-del');
  if (!btn) return;
  records = records.filter((r) => r.id !== btn.dataset.id);
  Storage.saveRecords(records);
  afterRecordsChanged();
  toast('已删除这条记录');
  renderHome();
});

