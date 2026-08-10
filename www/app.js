/* ============================================================
   观己 · 正式版逻辑
   本地持久化（localStorage，WebView 私有存储）· DeepSeek AI
   ============================================================ */

const $ = (id) => document.getElementById(id);

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MOODS = ['平静', '放松', '愉悦', '无聊', '焦虑', '压力'];
const TRIGGERS = ['压力大', '睡不着', '睡前习惯', '无聊', '看了片', '无特别诱因'];
const BUCKETS = [
  { key: '清晨', test: (h) => h >= 6 && h < 9 },
  { key: '上午', test: (h) => h >= 9 && h < 12 },
  { key: '下午', test: (h) => h >= 12 && h < 18 },
  { key: '傍晚', test: (h) => h >= 18 && h < 22 },
  { key: '深夜', test: (h) => h >= 22 || h < 6 },
];

/* ---------- 本地存储（数据只存在这台设备） ---------- */

const Storage = {
  KEY_RECORDS: 'guanji_records_v1',
  KEY_API: 'guanji_api_key_v1',

  loadRecords() {
    try {
      const raw = localStorage.getItem(this.KEY_RECORDS);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },
  saveRecords(list) {
    localStorage.setItem(this.KEY_RECORDS, JSON.stringify(list));
  },
  loadApiKey() {
    return localStorage.getItem(this.KEY_API) || '';
  },
  saveApiKey(key) {
    localStorage.setItem(this.KEY_API, key);
  },
};

let records = [];
let apiKey = '';

function newRecordId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ---------- 演示数据（「恢复演示数据」用） ---------- */

const DAY_COUNTS = {
  '-13': 2, '-12': 1, '-11': 1, '-10': 2, '-9': 1, '-8': 0, '-7': 2,
  '-6': 1, '-5': 2, '-4': 0, '-3': 1, '-2': 2, '-1': 1, '0': 0,
};

/* 确定性伪随机：同一索引每次结果一致 */
function seeded(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/* 预置记录的时段模式：保证深夜时段主导（17 条） */
const TIME_PATTERN = [
  '深夜', '深夜', '傍晚', '深夜', '深夜', '傍晚', '深夜', '下午', '深夜',
  '深夜', '傍晚', '深夜', '下午', '深夜', '深夜', '傍晚', '深夜',
];
const SLOT_HOUR = { '深夜': [22, 23, 0, 1], '傍晚': [19, 20, 21], '下午': [13, 14, 15, 16], '清晨': [7, 8] };

function buildDemoRecords() {
  const list = [];
  let seq = 0;
  for (const [off, n] of Object.entries(DAY_COUNTS)) {
    for (let k = 0; k < n; k++) {
      const idx = parseInt(off) * 10 + k;
      const slot = TIME_PATTERN[seq % TIME_PATTERN.length];
      const hours = SLOT_HOUR[slot];
      const h = hours[Math.floor(seeded(idx + 2) * hours.length)];
      const hh = h === 24 ? 0 : h;
      const mm = Math.floor(seeded(idx + 6) * 60);
      seq++;

      let trigger;
      const t = seeded(idx + 9);
      if (hh >= 22 || hh < 6) {
        trigger = t < 0.45 ? '睡不着' : t < 0.75 ? '睡前习惯' : t < 0.9 ? '看了片' : '压力大';
      } else if (hh >= 18 && hh < 22) {
        trigger = t < 0.5 ? '压力大' : t < 0.8 ? '无聊' : '看了片';
      } else {
        trigger = t < 0.5 ? '无聊' : '压力大';
      }

      const moodMap = {
        '压力大': '压力', '睡不着': '焦虑', '睡前习惯': '平静',
        '无聊': '无聊', '看了片': '愉悦', '无特别诱因': '放松',
      };

      list.push({
        id: newRecordId('demo'),
        dateKey: fmtDateKey(dateWithOffset(parseInt(off))),   // v3.6.1：演示数据也写绝对日期
        offset: parseInt(off),
        time: String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'),
        duration: Math.floor(seeded(idx + 7) * 25 + 5) * 5,
        moods: [moodMap[trigger]],
        triggers: [trigger],
        media: seeded(idx + 10) > 0.55,
        note: '',
      });
    }
  }
  return list;
}

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

let chartDays = 14;   // 面积图范围：近 14 / 30 天

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

  renderAreaChart(chartDays);
  renderMonthSummary();
  renderRingDist();
  renderRecentRecords();
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
    <span class="ms-item">本月 <b>${curCount}</b> 次 · 日均 ${daily.toFixed(1)}</span>
    <span class="ms-item ms-delta ${deltaClass}">较上月 ${deltaText}</span>`;
}

// 面积图范围切换（#21：滑块跟随）
$('chartSeg').addEventListener('click', (e) => {
  const btn = e.target.closest('.seg');
  if (!btn) return;
  chartDays = parseInt(btn.dataset.days, 10);
  document.querySelectorAll('#chartSeg .seg').forEach((s) => s.classList.toggle('active', s === btn));
  moveSegSlide($('chartSeg'), $('chartSegSlide'), btn);
  renderAreaChart(chartDays);
  renderMonthSummary();
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

/* ---------- 历史记录日历视图 ---------- */

let calMonthOffset = 0;   // 相对当前月的月份偏移
let calSelected = 0;      // 选中日的 offset（相对今天）

function openCalendar() {
  calMonthOffset = 0;
  calSelected = 0;
  resetSheetStyle($('calendarSheet'));
  $('calendarSheet').classList.remove('hidden');
  $('sheetBackdrop').classList.remove('hidden');
  renderCalendar();
}

/* ---------- #29：弹层退场动画 + 小横杠拖拽关闭（通用） ---------- */

/* 打开时重置内联样式（清除拖拽/退场残留），让 sheetUp 动画重播 */
function resetSheetStyle(sheetEl) {
  sheetEl.style.transition = '';
  sheetEl.style.transform = '';
  sheetEl.style.opacity = '';
  sheetEl.style.animation = '';
  sheetEl.style.backdropFilter = '';        // #44：恢复 CSS 毛玻璃
  sheetEl.style.webkitBackdropFilter = '';
  sheetEl.style.background = '';            // #44：恢复 CSS 半透明玻璃背景
}

/* 退场：遮罩与卡片同步平滑退出（#49：统一 easeOutCubic 曲线 + 同速淡出 + 微缩放，一体感） */
function animateSheetClose(sheetEl, backdropEl, doHide) {
  // #72：若弹出弹簧仍在播放，先暂停（避免 anime 每帧重写 transform 与退场过渡冲突）
  if (sheetOpenAnim) { sheetOpenAnim.pause(); sheetOpenAnim = null; }
  // #44：退场转不透明 + 关闭毛玻璃
  sheetEl.style.backdropFilter = 'none';
  sheetEl.style.webkitBackdropFilter = 'none';
  sheetEl.style.background = 'var(--card)';
  const CURVE = 'cubic-bezier(0.33, 1, 0.68, 1)';
  // 下滑 + 微缩 + 同步淡出（两属性同曲线同速——此前「先透明卡顿」根因是曲线不同步）
  sheetEl.style.transition = `transform 0.3s ${CURVE}, opacity 0.3s ${CURVE}`;
  sheetEl.style.transform = 'translateY(100%) scale(0.98)';
  sheetEl.style.opacity = '0';
  backdropEl.style.transition = `opacity 0.3s ${CURVE}`;
  backdropEl.style.opacity = '0';
  setTimeout(() => {
    doHide();
    resetSheetStyle(sheetEl);
    backdropEl.style.transition = '';
    backdropEl.style.opacity = '';
  }, 320);
}

/* 拖拽热区：Pointer Events 统一鼠标/触摸，超过阈值关闭，否则回弹 */
function initSheetDrag(grabId, sheetEl, backdropEl, closeFn) {
  const grab = $(grabId);
  let startY = 0, dragging = false, currentDy = 0;

  grab.addEventListener('pointerdown', (e) => {
    if (sheetEl.classList.contains('hidden')) return;
    dragging = true;
    startY = e.clientY;
    currentDy = 0;
    sheetEl.style.animation = 'none';   // 让位给 inline transform
    sheetEl.style.transition = 'none';
    try { grab.setPointerCapture(e.pointerId); } catch { /* 忽略捕获失败 */ }
  });

  grab.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dy = e.clientY - startY;
    currentDy = dy;
    if (dy > 0) {
      sheetEl.style.transform = `translateY(${dy}px)`;
      backdropEl.style.opacity = String(Math.max(0, 1 - dy / 500));
    }
  });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    if (currentDy > 90) {
      closeFn();   // 超过阈值：走退场动画关闭
    } else {
      sheetEl.style.transition = 'transform 0.3s var(--ease-spring)';
      sheetEl.style.transform = '';
      backdropEl.style.transition = 'opacity 0.3s ease';
      backdropEl.style.opacity = '';
      setTimeout(() => {
        sheetEl.style.transition = '';
        backdropEl.style.transition = '';
      }, 330);
    }
  };

  grab.addEventListener('pointerup', endDrag);
  grab.addEventListener('pointercancel', endDrag);
}

function closeCalendar() {
  animateSheetClose($('calendarSheet'), $('sheetBackdrop'), () => {
    $('calendarSheet').classList.add('hidden');
    $('sheetBackdrop').classList.add('hidden');
  });
}

function renderCalendar() {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + calMonthOffset, 1);
  const daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const firstWeekday = (target.getDay() + 6) % 7;   // 周一开始（周一=0）

  $('calTitle').textContent = `${target.getFullYear()}年${target.getMonth() + 1}月`;

  // 校准选中日：若当前选中不在本月，选今天（今天在本月时）或 1 号
  const selDate = dateWithOffset(calSelected);
  if (selDate.getFullYear() !== target.getFullYear() || selDate.getMonth() !== target.getMonth()) {
    const today = new Date();
    calSelected = (today.getFullYear() === target.getFullYear() && today.getMonth() === target.getMonth())
      ? 0 : dayDiff(target, new Date(now.getFullYear(), now.getMonth(), 1));
  }

  let cells = '';
  for (let i = 0; i < firstWeekday; i++) cells += '<span class="cal-cell empty"></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(target.getFullYear(), target.getMonth(), d);
    const off = dayDiff(date, now);
    const cnt = countRange(off, off);
    const isToday = off === 0;
    const isSel = off === calSelected;
    const isFuture = off > 0;   // #80：未来日期不可补记（灰显禁用）
    cells += `
      <button class="cal-cell${cnt > 0 ? ' has' : ''}${isToday ? ' today' : ''}${isSel ? ' sel' : ''}${isFuture ? ' future' : ''}" data-off="${off}" ${isFuture ? 'disabled' : ''}>
        <span class="cal-daynum">${d}</span>
        ${cnt > 0 ? `<span class="cal-badge">${cnt}</span>` : ''}
      </button>`;
  }
  $('calGrid').innerHTML = cells;

  renderCalDayDetail();
}

function renderCalDayDetail() {
  const dayRecs = records
    .filter((r) => r.offset === calSelected)
    .sort((a, b) => b.time.localeCompare(a.time));

  const d = dateWithOffset(calSelected);
  const title = dayRecs.length
    ? `${d.getMonth() + 1}月${d.getDate()}日 · ${dayRecs.length} 条记录`
    : `${d.getMonth() + 1}月${d.getDate()}日 · 这一天没有记录`;

  $('calDayDetail').innerHTML = `
    <p class="cal-detail-title">${title}</p>
    ${dayRecs.length ? dayRecs.map((r) => `
      <div class="recent-item">
        <div class="recent-main">
          <p class="recent-time">${r.time}</p>
          <p class="recent-tags">${[...r.moods, ...r.triggers].join(' · ')}${r.duration ? ` · <b class="dur">${r.duration} 分钟</b>` : ''}${r.media ? ' · 看片' : ''}</p>
        </div>
        <div class="recent-actions">
          <button class="recent-edit" data-id="${r.id}" title="编辑这条记录" aria-label="编辑">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2.6 11.4l.6-2.4 6-6a1.4 1.4 0 0 1 2 2l-6 6-2.6.4z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="recent-del" data-id="${r.id}" title="删除这条记录" aria-label="删除">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>`).join('') : '<p class="recent-empty">还没有记录，可以补记这一天的。</p>'}`;
}

// 日历事件
$('backfillBtn').addEventListener('click', openCalendar);
$('calClose').addEventListener('click', closeCalendar);
$('calPrev').addEventListener('click', () => { calMonthOffset--; renderCalendar(); });
$('calNext').addEventListener('click', () => { calMonthOffset++; renderCalendar(); });
$('calToday').addEventListener('click', () => { calMonthOffset = 0; calSelected = 0; renderCalendar(); });
$('calGrid').addEventListener('click', (e) => {
  const cell = e.target.closest('.cal-cell');
  if (!cell || !cell.dataset.off) return;
  calSelected = parseInt(cell.dataset.off, 10);
  renderCalendar();
});
$('calDayDetail').addEventListener('click', (e) => {
  const editBtn = e.target.closest('.recent-edit');
  if (editBtn) { openEditRecord(editBtn.dataset.id); return; }
  const btn = e.target.closest('.recent-del');
  if (!btn) return;
  records = records.filter((r) => r.id !== btn.dataset.id);
  Storage.saveRecords(records);
  afterRecordsChanged();
  toast('已删除这条记录');
  renderHome();
  renderCalendar();
});
$('calAddBtn').addEventListener('click', () => {
  closeCalendar();
  openSheet('backfill', dateWithOffset(calSelected));
});

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
        <p class="recent-tags">${[...r.moods, ...r.triggers].join(' · ')}${r.duration ? ` · ${r.duration} 分钟` : ''}${r.media ? ' · 看片' : ''}</p>
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

/* ---------- 记录面板 ---------- */

let sheetMode = 'now';
let editingId = null;   // #38：编辑模式目标记录 id（null = 新增）

/* #38：编辑一条记录——关闭日历（若开着）→ 打开面板 → 预填原数据 */
function openEditRecord(id) {
  const rec = records.find((r) => r.id === id);
  if (!rec) return;
  editingId = id;
  if (!$('calendarSheet').classList.contains('hidden')) closeCalendar();
  openSheet('edit', dateWithOffset(rec.offset));
  $('pickTime').value = rec.time;

  // 预填情绪/诱因（自定义项也在 chips 容器中，按文本匹配激活，支持多选）
  const matchChip = (box, text) =>
    [...box.querySelectorAll('.chip:not(.chip-add)')].find((c) => c.textContent === text);
  rec.moods.forEach((m) => { const c = matchChip($('moodChips'), m); if (c) c.classList.add('active'); });
  rec.triggers.forEach((t) => { const c = matchChip($('triggerChips'), t); if (c) c.classList.add('active'); });
  if (rec.duration) {
    // 滑块范围 max=60，超出时顶格显示（时长以 durLabel 为准，避免 clamp 丢数据）
    $('durSlider').value = Math.min(rec.duration, 60);
    $('durLabel').textContent = `${rec.duration} 分钟`;
  }
  $('mediaSwitch').classList.toggle('on', !!rec.media);
  $('noteInput').value = rec.note || '';
  updateTimeDisplay();

  // #46：编辑直达详情（单页编辑）——stepTime 保留可见（时间 seg 可调），详情直接展开，无需「下一步」
  $('stepDetails').classList.remove('hidden');
  $('nextBtn').classList.add('hidden');
  $('prevBtn').classList.add('hidden');
  $('saveBtn').classList.remove('hidden');
}

function openSheet(mode, presetDate) {
  sheetMode = mode;
  if (mode !== 'edit') editingId = null;   // 新增/补记重置编辑目标
  // #48：面板打开时清除触发按钮焦点（触摸聚焦按钮，拖拽退出路径不转移焦点会残留高亮）
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  resetSheetStyle($('recordSheet'));   // #29：清除退场/拖拽残留，sheetUp 重播
  $('moodChips').querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  $('triggerChips').querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
  $('durSlider').value = 0;
  $('durLabel').textContent = '未记录';
  $('mediaSwitch').classList.remove('on');
  $('noteInput').value = '';

  const now = new Date();
  if ((mode === 'backfill' || mode === 'edit') && presetDate) {
    $('pickDate').value = fmtDateInput(presetDate);
    $('pickTime').value = fmtTime(now);
  } else {
    $('pickDate').value = fmtDateInput(now);
    $('pickTime').value = fmtTime(now);
  }

  if (mode === 'backfill' || mode === 'edit') {
    $('nowSeg').classList.remove('active');
    $('customSeg').classList.add('active');
    $('pickerRow').classList.remove('hidden');
    showClassicStep1();   // #51：补记/编辑为经典步骤一（无计时器）
    if (mode === 'edit') $('timeSegRow').classList.add('hidden');   // #56：编辑=改已存在记录的时间，无「就现在/补记」概念
  } else {
    $('customSeg').classList.remove('active');
    $('nowSeg').classList.add('active');
    $('pickerRow').classList.add('hidden');
    setupNowStep();   // #51：按「记录方式」偏好分流（计时器态 / 经典流程）
  }
  updateTimeDisplay();

  $('stepTime').classList.remove('hidden');
  $('stepDetails').classList.add('hidden');
  $('nextBtn').classList.remove('hidden');
  $('prevBtn').classList.add('hidden');
  $('saveBtn').classList.add('hidden');

  $('sheetBackdrop').classList.remove('hidden');
  $('recordSheet').classList.remove('hidden');
  playSheetOpen();   // #72：anime 弹簧弹出（vendor 缺失/减弱动效时回退 CSS sheetUp）
  initSegSlide('timeSegRow', 'timeSegSlide');   // #22：面板显示后滑块定位到当前选中
}

/* #72：面板弹出回弹动画试点——anime v3.2（vendor 缺失/减弱动效回退 CSS sheetUp）。
   easeOutBack(1.4) 实现克制的 overshoot 回弹（CSS cubic-bezier 无法回弹）：
   v3 的 spring easing 时长被固定 ~1s 不可调（源码无条件覆盖 duration），对弹出太拖沓，
   故用 easeOutBack + 550ms（回弹幅度 ~7%）。只动画 transform，不碰布局属性（#66 教训） */
let sheetOpenAnim = null;

function playSheetOpen() {
  const sheet = $('recordSheet');
  if (!window.anime || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  sheet.style.animation = 'none';               // 关闭 CSS sheetUp，避免与 anime 双动画
  sheet.style.transform = 'translateY(100%)';
  sheetOpenAnim = anime({
    targets: sheet,
    translateY: ['100%', '0%'],
    easing: 'easeOutBack(1.4)',
    duration: 550,
    changeComplete: () => {
      sheetOpenAnim = null;
      sheet.style.transform = '';
      // animation 保持 'none' 不回恢复——恢复会让 CSS sheetUp 重新播放（实测弹完再滑一次）；
      // 下次 openSheet 的 resetSheetStyle 会清空该内联值
    }
  });
}

function closeSheet() {
  if (timerState.running) {   // #51：计时中关闭面板 = 取消计时不保存（温和提示）
    cancelTimer();
    toast('已取消本次计时');
  }
  animateSheetClose($('recordSheet'), $('sheetBackdrop'), () => {
    $('recordSheet').classList.add('hidden');
    $('sheetBackdrop').classList.add('hidden');
  });
}

function fmtDateInput(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTime(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* 自然日差：以本地日历日计算，跨午夜也精确 */
function dayDiff(a, b) {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((da - db) / 864e5);
}

/* ============ v3.6.1 hotfix：记录绝对日期（修复跨天日期漂移） ============
   根因：offset 是「相对保存当天」的偏移，跨天后基准漂移，旧记录被归到错误日期。
   修复：记录同时存绝对日期 dateKey（yyyy-mm-dd）；每次启动/数据变更/跨天后
   用 dateKey 重算 offset（相对当前今天）；旧记录（无 dateKey）用 id 内嵌的
   base36 毫秒时间戳精确恢复绝对日期。 */

function fmtDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalizeOffsets() {
  const today = new Date();
  let changed = false;
  records.forEach((r) => {
    let d = null;
    if (r.dateKey) {
      const p = String(r.dateKey).split('-');
      if (p.length === 3) d = new Date(+p[0], +p[1] - 1, +p[2]);
    } else if (r.id) {
      // 旧记录：id 形如 rec_<base36毫秒时间戳>_<随机>——可精确还原记录时刻的日期
      const ts = parseInt(String(r.id).split('_')[1], 36);
      if (!isNaN(ts)) d = new Date(ts);
    }
    if (d && !isNaN(d.getTime())) {
      const off = dayDiff(d, today);
      if (r.offset !== off) { r.offset = off; changed = true; }
      if (!r.dateKey) { r.dateKey = fmtDateKey(d); changed = true; }
    }
  });
  if (changed) Storage.saveRecords(records);
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
  const moods = [...$('moodChips').querySelectorAll('.chip.active')].map((c) => c.textContent);
  const triggers = [...$('triggerChips').querySelectorAll('.chip.active')].map((c) => c.textContent);
  // 时长以 durLabel 为数据源（滑块 max=60，超长记录预填后靠 label 保真，避免 clamp 丢数据）
  const durMatch = /^(\d+)/.exec($('durLabel').textContent);
  const duration = durMatch ? parseInt(durMatch[1], 10) : 0;
  const media = $('mediaSwitch').classList.contains('on');
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
      duration: duration || null,
      moods, triggers, media, note,
    };
  } else {
    records.push({
      id: newRecordId('rec'),
      dateKey: fmtDateKey(date), offset, time,
      duration: duration || null,
      moods, triggers, media, note,
    });
  }
  Storage.saveRecords(records);
  afterRecordsChanged();   // #32：同步小组件统计；#38：触发报告自动重生成

  editingId = null;   // 编辑结束复位，避免影响后续新增
  closeSheet();
  toast(isEdit ? '已更新 ✓' : '已记录 ✓');
  renderHome();
  if (!$('calendarSheet').classList.contains('hidden')) renderCalendar();
}

/* ---------- AI 分析（DeepSeek 真实接入） ---------- */

const AI_SYSTEM_PROMPT =
  '你是一位温和、非评判的健康习惯观察者。用户记录了自己手淫习惯的数据（频率、时段、情绪、诱因）。' +
  '你的任务是帮助用户理解自己的行为模式：态度平静温暖，绝不评判、绝不羞辱、绝不给道德压力，' +
  '不做医学诊断，不提供医疗建议。频率本身没有对错，重点是模式与觉察。' +
  '涉及情绪关联时，只描述数据中呈现的关联，不做因果断言，更不评判情绪本身。' +
  '用中文回答。';

const AI_JSON_INSTRUCTION =
  '\n\n请严格只返回以下 JSON（不要有任何其他文字、不要用 markdown 代码块）：\n' +
  '{"overview":"一句话概览（呼应本周数据）","patterns":["模式1","模式2","模式3"],' +
  '"moodInsight":"情绪观察一句话（描述情绪与频率/诱因的关联，如「压力较大的日子频率略高，这只是观察，无关对错」；情绪数据不足时返回空字符串）",' +
  '"triggers":[{"name":"诱因名","pct":整数百分比}],"suggestions":["建议1（具体可执行）","建议2","建议3"]}';

function buildAggregatePayload() {
  const cur = countRange(-6, 0);
  const prev = countRange(-13, -7);
  const curRecs = records.filter((r) => r.offset >= -6 && r.offset <= 0);

  const bucketCount = {};
  curRecs.forEach((r) => {
    const h = hourOf(r);
    BUCKETS.forEach((b) => { if (b.test(h)) bucketCount[b.key] = (bucketCount[b.key] || 0) + 1; });
  });

  const trigCount = {};
  curRecs.forEach((r) => r.triggers.forEach((t) => { trigCount[t] = (trigCount[t] || 0) + 1; }));

  // 情绪分布 + 情绪×诱因组合（#16，只发聚合特征）
  const moodCount = {};
  const comboCount = {};
  curRecs.forEach((r) => {
    (r.moods || []).forEach((m) => { moodCount[m] = (moodCount[m] || 0) + 1; });
    (r.moods || []).forEach((m) => (r.triggers || []).forEach((t) => {
      const k = m + ' + ' + t;
      comboCount[k] = (comboCount[k] || 0) + 1;
    }));
  });
  const topCombos = Object.entries(comboCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k} ${v}次`);

  return {
    '本周记录数': cur,
    '上周记录数': prev,
    '日均': cur ? +(cur / 7).toFixed(1) : 0,
    '本周时段分布': bucketCount,
    '本周诱因分布': trigCount,
    '本周情绪分布': moodCount,
    '情绪×诱因组合(前3)': topCombos,
    '连续记录天数': countStreak(),
    '本周含看片的记录占比': curRecs.length ? Math.round(curRecs.filter((r) => r.media).length / curRecs.length * 100) : 0,
  };
}

/* ---------- AI 提供商配置（#27/#43：默认 DeepSeek，密钥按提供商分别保存） ---------- */

const AI_CONFIG_KEY = 'guanji_ai_config_v2';        // #43：per-provider 结构
const AI_CONFIG_KEY_V1 = 'guanji_ai_config_v1';     // 旧版单份配置（迁移用）
const AI_PROVIDERS = {
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  custom: { label: '自定义', baseUrl: '', model: '' },
};

/* 每个提供商的完整配置（默认值 + 用户填写，互不干扰） */
const DEFAULT_PROVIDERS = {
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', apiKey: '' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKey: '' },
  custom: { baseUrl: '', model: '', apiKey: '' },
};

/* per-provider 存储：{ providers: { deepseek: {...}, ... }, active: 'deepseek' } */
let aiStore = loadAIStore();

function loadAIStore() {
  try {
    const s = JSON.parse(localStorage.getItem(AI_CONFIG_KEY) || 'null');
    if (s && s.providers) {
      return { providers: { ...JSON.parse(JSON.stringify(DEFAULT_PROVIDERS)), ...s.providers }, active: s.active || 'deepseek' };
    }
  } catch { /* 损坏配置走迁移/默认 */ }
  // #43：v1 单份配置迁移（旧 key 归入原 provider）
  const providers = JSON.parse(JSON.stringify(DEFAULT_PROVIDERS));
  let active = 'deepseek';
  try {
    const v1 = JSON.parse(localStorage.getItem(AI_CONFIG_KEY_V1) || 'null');
    if (v1 && v1.baseUrl) {
      const p = v1.provider && providers[v1.provider] ? v1.provider : 'deepseek';
      providers[p] = { baseUrl: v1.baseUrl, model: v1.model || DEFAULT_PROVIDERS[p].model, apiKey: v1.apiKey || '' };
      active = p;
    }
  } catch { /* 忽略损坏 v1 */ }
  // 迁移：旧版独立 apiKey → deepseek
  if (!providers.deepseek.apiKey) providers.deepseek.apiKey = Storage.loadApiKey();
  const store = { providers, active };
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(store));   // 立即写 v2，后续直接读 v2
  return store;
}

function saveAIStore() {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(aiStore));
}

/* 同步 active 提供商的扁平视图（askAI/getDailyTip 等读取 aiConfig/apiKey） */
function syncActiveConfig() {
  aiConfig = { ...aiStore.providers[aiStore.active], provider: aiStore.active };
  apiKey = aiConfig.apiKey;
}

/* 保存当前 active 提供商配置（保存按钮调用） */
function saveAIConfig(cfg) {
  aiStore.providers[aiStore.active] = { baseUrl: cfg.baseUrl, model: cfg.model, apiKey: cfg.apiKey };
  saveAIStore();
  syncActiveConfig();
}

let aiConfig = { ...aiStore.providers[aiStore.active], provider: aiStore.active };
apiKey = aiConfig.apiKey;

/* OpenAI 兼容端点：Base URL 去尾斜杠 + /chat/completions */
function aiEndpoint(cfg) {
  return (cfg.baseUrl || '').replace(/\/+$/, '') + '/chat/completions';
}

async function askAI(userContent, signal) {
  const cfg = aiConfig;
  if (!cfg.apiKey) throw new Error('NO_KEY');
  if (!cfg.baseUrl || !cfg.model) throw new Error('NO_CONFIG');
  const res = await fetch(aiEndpoint(cfg), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.7,
      max_tokens: 1200,
      stream: false,
    }),
    signal,
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('KEY_INVALID');
    throw new Error('API_ERROR');
  }
  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  if (!content) throw new Error('API_EMPTY');
  return content;
}

/* 从 AI 回复中提取 JSON（容错：可能夹带说明文字） */
function extractJSON(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function renderAIReport(data) {
  const cur = countRange(-6, 0);
  const patterns = (data.patterns || []).map((p) => `
    <div class="pattern-row"><span class="p-bullet"></span><span>${esc(p)}</span></div>`).join('');
  const trigBars = (data.triggers || []).map((t) => `
    <div class="bar-row">
      <span class="bar-label">${esc(t.name || '')}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, t.pct || 0)}%"></div></div>
      <span class="bar-val">${t.pct || 0}%</span>
    </div>`).join('');
  const suggs = (data.suggestions || []).map((s, i) => `
    <div class="pattern-row"><span class="suggest-num">0${i + 1}</span><span>${esc(s)}</span></div>`).join('');
  // 情绪观察卡（#16）：AI 有返回才显示
  const moodCard = data.moodInsight ? `
    <div class="report-card">
      <span class="report-tag">情绪观察</span>
      <div class="report-body" style="margin-top:10px"><p>${esc(data.moodInsight)}</p></div>
    </div>` : '';

  $('analysisResult').innerHTML = `
    <div class="report-card">
      <span class="report-tag">本周概览</span>
      <p class="overview-num">${cur}<small> 次 · 日均 ${(cur / 7).toFixed(1)} 次</small></p>
      <div class="report-body" style="margin-top:10px"><p>${esc(data.overview || '')}</p></div>
    </div>

    <div class="report-card">
      <span class="report-tag">模式识别</span>
      ${patterns || '<p class="report-body" style="color:var(--ink-2)">AI 没有返回模式分析。</p>'}
    </div>

    ${moodCard}

    <div class="report-card">
      <span class="report-tag">诱因分布</span>
      ${trigBars || '<p class="report-body" style="color:var(--ink-2)">暂无诱因数据。</p>'}
    </div>

    <div class="report-card">
      <span class="report-tag">温和建议</span>
      ${suggs || '<p class="report-body" style="color:var(--ink-2)">AI 没有返回建议。</p>'}
    </div>

    <p class="disclaimer">以上内容由 AI 基于聚合统计生成（仅上传每周次数、时段分布、情绪分布等特征，不含单条记录），仅作习惯参考，不构成医疗诊断或建议。如有持续困扰，建议与专业医生或心理咨询师聊聊。</p>
    <button class="btn-primary" id="regenBtn" style="width:100%;margin-bottom:16px">重新生成分析</button>`;

  const regen = document.getElementById('regenBtn');
  // 直接绑定事件对象：#39 让生成期间禁用按钮、结束后恢复（防重复点击）
  if (regen) regen.addEventListener('click', generateAnalysis);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function aiErrorToast(err) {
  if (err && err.message === 'NO_KEY') toast('请先在「我的 → AI 设置」填入 DeepSeek 密钥');
  else if (err && err.message === 'KEY_INVALID') toast('密钥无效，请检查后重试');
  else if (err && err.name === 'AbortError') toast('AI 响应超时，请稍后重试');
  else toast('AI 服务暂时不可用，请检查网络后重试');
}

/* 自动模式失败后展示给用户的错误说明 */
function aiErrorMessage(err) {
  if (err && err.message === 'KEY_INVALID') return '密钥无效，请检查「我的 → AI 设置」中的配置';
  if (err && err.name === 'AbortError') return '响应超时，请检查网络后重试';
  if (err && err.message === 'API_ERROR') return 'AI 服务暂时不可用，请稍后重试';
  return '发生未知错误，请稍后重试';
}

/* ---------- AI 分析：自动生成 + 指纹 + 重试 ---------- */

const REPORT_FP_KEY = 'guanji_report_fingerprint';
const RETRY_DELAYS = [2000, 4000, 8000];   // 自动重试退避（3 次）

/* 数据指纹：日期 + 记录数 + 最新 id + 全量内容摘要——数据未变则不重复调用；
   #38：摘要覆盖情绪/诱因/时长/看片等影响聚合的字段（note 不影响聚合特征，不参与），
   编辑记录内容后指纹变化 → 报告自动过期刷新（保证时效性与可信度） */
function reportFingerprint() {
  const latest = [...records].sort((a, b) => (b.offset - a.offset) || b.time.localeCompare(a.time))[0];
  const digest = records.map((r) =>
    `${r.offset}|${r.time}|${(r.moods || []).join(',')}|${(r.triggers || []).join(',')}|${r.duration || ''}|${r.media ? '1' : ''}`
  ).join(';');
  return JSON.stringify({ date: fmtDateInput(new Date()), count: records.length, latestId: latest ? latest.id : '', digest });
}

/* ---------- #38：报告过期检测 + 自动重生成 ---------- */

let analysisBusy = false;          // 生成中防重入
let reportRefreshTimer = null;     // 防抖定时器

/* 报告是否过期：已生成过（指纹存在）且当前数据指纹 ≠ 生成时指纹 */
function reportStale() {
  const fp = localStorage.getItem(REPORT_FP_KEY);
  return fp !== null && fp !== reportFingerprint();
}

/* 数据变更 → 分析页可见时防抖自动重生成（连续操作合并一次 AI 调用；不在分析页则交给切回时） */
function scheduleReportRefresh() {
  if (analysisBusy) return;
  const onAnalysis = !document.getElementById('screen-analysis').classList.contains('hidden');
  if (!onAnalysis) return;   // 用户不在分析页：不烧 API，切回时 maybeAutoGenerate 处理
  clearTimeout(reportRefreshTimer);
  reportRefreshTimer = setTimeout(() => {
    reportRefreshTimer = null;
    if (analysisBusy || !reportStale()) return;
    refreshReport();
  }, 1500);
}

/* 刷新：不清空旧报告，顶部提示条；成功替换（提示条随 innerHTML 重绘消失），失败保留旧报告 */
function refreshReport() {
  if (analysisBusy) return;
  // 与 generateAnalysis 前置条件一致：无 key/无数据时不触发，避免刷新条残留
  if (!records.length || !apiKey || countRange(-6, 0) < 3) return;
  analysisBusy = true;
  const bar = document.createElement('div');
  bar.className = 'report-refresh-bar';
  bar.textContent = '数据已更新，正在刷新分析…';
  $('analysisResult').prepend(bar);
  generateAnalysis(null, { auto: true, refresh: true });
}

function hideRefreshBar() {
  const bar = document.querySelector('.report-refresh-bar');
  if (bar) bar.remove();
}

function generateAnalysis(ev, opts) {
  const auto = !!(opts && opts.auto);
  const refresh = !!(opts && opts.refresh);   // #38：报告已存在时的自动刷新
  if (!records.length) { if (!auto) toast('还没有记录，先去记录一次吧'); return; }
  if (!apiKey) { if (!auto) toast('请先在「我的 → AI 设置」填入 DeepSeek 密钥'); return; }
  if (auto && countRange(-6, 0) < 3) return;   // 自动模式要求本周 ≥3 条

  const btn = (ev && ev.currentTarget) ? ev.currentTarget : null;
  if (btn) btn.disabled = true;
  if (!refresh) {
    $('analysisEmpty').innerHTML = `
      <div class="loading-box">
        <div class="spinner"></div>
        <span>AI 正在读你的记录…</span>
      </div>`;
  }

  let succeeded = false;
  let rawContent = '';
  let attemptNo = 0;

  const runAttempt = () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    askAI(
      `以下是用户过去两周手淫习惯的聚合统计（注意：只有聚合数据，没有单条记录）：\n` +
      JSON.stringify(buildAggregatePayload(), null, 2) + AI_JSON_INSTRUCTION,
      controller.signal
    ).then((content) => {
      rawContent = content;
      const data = extractJSON(content);
      if (!data) throw new Error('PARSE_FAIL');
      renderAIReport(data);
      succeeded = true;
      localStorage.setItem(REPORT_FP_KEY, reportFingerprint());   // 成功后更新指纹
    }).catch((err) => {
      // 可重试：网络/超时/解析失败（密钥无效属配置问题，重试无意义；刷新模式不重试，避免多次调用）
      const retriable = err && (err.name === 'AbortError' || err.message === 'API_ERROR' || err.message === 'PARSE_FAIL');
      if (auto && !refresh && retriable && attemptNo < 3) {
        attemptNo++;
        $('analysisEmpty').innerHTML = `
          <div class="loading-box">
            <div class="spinner"></div>
            <span>AI 正在读你的记录…（重试 ${attemptNo}/3）</span>
          </div>`;
        setTimeout(runAttempt, RETRY_DELAYS[attemptNo - 1]);
        return;
      }
      if (err && err.message === 'PARSE_FAIL') {
        $('analysisResult').innerHTML = `
          <div class="report-card">
            <span class="report-tag">AI 回复</span>
            <div class="report-body"><p>${esc(rawContent)}</p></div>
          </div>
          <p class="disclaimer">以上内容由 AI 生成，仅作习惯参考，不构成医疗诊断或建议。</p>`;
        succeeded = true;
        localStorage.setItem(REPORT_FP_KEY, reportFingerprint());
        return;
      }
      if (refresh) {
        // #38：保留旧报告 + 温和提示，不打扰（不更新指纹，下次变更/进页仍会尝试）
        hideRefreshBar();
        toast('报告刷新失败，仍显示上次结果');
      } else if (auto) {
        // 自动模式 3 次全失败：把报错展示给用户
        toast('AI 生成失败，已自动重试 3 次');
        $('analysisEmpty').classList.remove('hidden');
        $('analysisEmpty').innerHTML = `
          <p class="empty-text">AI 生成失败，请稍后重试。<br>${aiErrorMessage(err)}</p>
          <button class="btn-primary" id="genBtn2">重新生成分析</button>`;
        bindGenBtn();
      } else {
        aiErrorToast(err);
        $('analysisEmpty').classList.remove('hidden');
        $('analysisEmpty').innerHTML = emptyStateHTML();
        bindGenBtn();
      }
    }).finally(() => {
      clearTimeout(timer);
      if (btn) btn.disabled = false;   // #39：失败/成功后恢复按钮（成功时旧按钮已脱离 DOM，无害）
      if (refresh) analysisBusy = false;   // #38：刷新结束复位防重入
      if (succeeded) {
        $('analysisEmpty').classList.add('hidden');
        $('analysisResult').classList.remove('hidden');
        $('askSection').classList.remove('hidden');
      }
    });
  };

  runAttempt();
}

/* 自动生成：切换至分析页时触发（#38：报告已存在但数据过期 → 也自动刷新，保证时效性） */
function maybeAutoGenerate() {
  if (!records.length || !apiKey || countRange(-6, 0) < 3) return;    // 前置条件
  if (!$('analysisResult').classList.contains('hidden')) {
    // 已有报告：数据过期则自动刷新（修改/删除记录后保证报告时效性与可信度）
    if (reportStale()) refreshReport();
    return;
  }
  if (localStorage.getItem(REPORT_FP_KEY) === reportFingerprint()) return;  // 数据未变
  generateAnalysis(null, { auto: true });
}

function emptyStateHTML() {
  return `
    <p class="empty-text">让 AI 看看你这段时间的节奏，<br>找出藏在数据里的模式。</p>
    <button class="btn-primary" id="genBtn2">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5v13M1.5 8h13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      生成本周分析
    </button>`;
}

/* ---------- 追问（真实对话） ---------- */

const ASK_PRESETS = {
  '我的频率算高吗？': '用户问：「我的频率算高吗？」请基于聚合数据温和回应：医学上没有标准频率，重点是是否影响生活与自我感受。',
  '怎么减少深夜看片？': '用户问：「怎么减少深夜看片？」请给出温和、可执行的建议，不评判。',
  '压力大时怎么办？': '用户问：「压力大时怎么办？」请结合数据中压力相关诱因，给出温和建议。',
};

/* #19：追问回复结构约束——1 句回应 + 编号建议列表 + 温和收尾 */
const ASK_FORMAT_INSTRUCTION =
  '\n\n请严格按以下结构回复：\n' +
  '1) 第一行：1 句直接回应（不超过 40 字）\n' +
  '2) 接着给 2-4 条建议，每条单独一行，用 "1. " "2. " 编号开头（每条不超过 60 字）\n' +
  '3) 最后 1 句温和收尾（不超过 30 字）\n' +
  '关键词语可以用 **文字** 加粗（全文不超过 3 处）。';

/* #19：轻量 markdown 子集渲染（加粗 / 有序无序列表 / 分段），不引第三方库 */
function renderMarkdown(text) {
  const lines = String(text ?? '').split('\n');
  let html = '';
  let listTag = null;
  const closeList = () => { if (listTag) { html += `</${listTag}>`; listTag = null; } };
  const inline = (s) => s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    const ol = line.match(/^(\d+)[.、]\s*(.*)$/);
    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ol) {
      if (listTag !== 'ol') { closeList(); html += '<ol class="ask-list">'; listTag = 'ol'; }
      html += `<li>${inline(esc(ol[2]))}</li>`;
    } else if (ul) {
      if (listTag !== 'ul') { closeList(); html += '<ul class="ask-list">'; listTag = 'ul'; }
      html += `<li>${inline(esc(ul[1]))}</li>`;
    } else {
      closeList();
      html += `<p>${inline(esc(line))}</p>`;
    }
  }
  closeList();
  return html;
}

function askQuestion(q) {
  const ans = $('askAnswer');
  ans.innerHTML = `<p class="ask-q">${esc(q)}</p><p class="card-sub">正在思考…</p>`;
  ans.classList.remove('hidden');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  askAI(
    `以下是用户两周习惯的聚合统计：\n` + JSON.stringify(buildAggregatePayload(), null, 2) +
    `\n\n${ASK_PRESETS[q] || `用户问：「${q}」请温和回应。`}` + ASK_FORMAT_INSTRUCTION,
    controller.signal
  ).then((content) => {
    ans.innerHTML = `<p class="ask-q">${esc(q)}</p>` + renderMarkdown(content);
  }).catch((err) => {
    ans.innerHTML = `<p class="ask-q">${esc(q)}</p><p style="color:var(--ink-2)">${err && err.message === 'NO_KEY' ? '请先在「我的 → AI 设置」填入密钥' : 'AI 暂时不可用，稍后再试'}</p>`;
  }).finally(() => clearTimeout(timer));
}

/* ---------- 问候语（时间问候 + AI 健康提醒组合） ---------- */

const GREETINGS = {
  '清晨': ['清晨好，今天感觉如何？', '清晨好，新的一天，慢慢来。'],
  '上午': ['上午好，今天感觉如何？'],
  '下午': ['下午好，今天感觉如何？'],
  '傍晚': ['傍晚好，今天感觉如何？', '傍晚好，今天辛苦啦。'],
  '深夜': ['夜深了，今天感觉如何？', '夜深了，照顾好自己。'],
};

function getGreeting() {
  const h = new Date().getHours();
  const key = BUCKETS.find((b) => b.test(h)).key;
  const cands = GREETINGS[key];
  return cands[new Date().getDate() % cands.length];
}

/* 组合模式前缀：「下午好，今天感觉如何？」→「下午好。」（v1.7 拆层后不再使用） */

/* 每日 AI 提醒句：当日缓存，条件不满足或失败时返回空串（静默降级） */
let tipPending = false;

function getDailyTip() {
  return new Promise((resolve) => {
    const today = fmtDateInput(new Date());
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem('guanji_daily_tip') || 'null'); } catch { cached = null; }
    if (cached && cached.date === today && cached.tip) { resolve(cached.tip); return; }
    if (tipPending) { resolve(''); return; }
    if (!apiKey || countRange(-6, 0) < 3) { resolve(''); return; }

    tipPending = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    askAI(
      `以下是用户本周手淫习惯的聚合统计（只有聚合数据，没有单条记录）：\n` +
      JSON.stringify(buildAggregatePayload(), null, 2) +
      `\n\n请基于以上数据生成 1 句（不超过 20 字）温和的健康提醒，直接输出提醒内容` +
      `（如「今晚试试提前 30 分钟放下手机」）。` +
      `不要包含问候语、不要任何前缀、不要引号、不要评判、不要命令式口吻。`,
      controller.signal
    ).then((content) => {
      let tip = content.trim().replace(/^["「『]|["」』]$/g, '').trim();
      if (tip.length > 30) tip = tip.slice(0, 16) + '…';   // 兜底截断（方案 A 第二道保险）
      if (tip) localStorage.setItem('guanji_daily_tip', JSON.stringify({ date: today, tip }));
      resolve(tip || '');
    }).catch(() => resolve('')).finally(() => {
      clearTimeout(timer);
      tipPending = false;
    });
  });
}

/* 渲染问候语（v1.7 拆层）：标题固定一行时段问候，AI 提醒句渲染到下方小字，
   标题永不截断（≤13 字一行），提醒完整可见不丢失 */
function renderGreeting() {
  $('greetingTitle').textContent = getGreeting();
  getDailyTip().then((tip) => {
    const tipEl = $('greetingTip');
    if (tip) {
      tipEl.textContent = tip;
      tipEl.classList.remove('hidden');
    } else {
      tipEl.classList.add('hidden');
    }
  });
}

/* ---------- 温和正向反馈（#17：连续记录里程碑肯定，非戒断语境） ---------- */

const POSITIVE_KEY = 'guanji_positive';   // 默认开启，'0' 为关闭

const POSITIVE_MILESTONES = {
  30: ['30 天持续记录，这本身就是一种对自己的关注。', '整整一个月，你一直在认真观察自己。'],
  7: ['连续观察 7 天，你对自己更了解了。', '7 天的持续记录，是很温柔的坚持。'],
};

function positiveEnabled() {
  return localStorage.getItem(POSITIVE_KEY) !== '0';
}

/* 按日期确定性选文案（当天内稳定不闪变） */
function milestoneText(streak) {
  if (streak < 7) return '';
  const arr = streak >= 30 ? POSITIVE_MILESTONES[30] : POSITIVE_MILESTONES[7];
  return arr[new Date().getDate() % arr.length];
}

/* ---------- 每日记录提醒（#13：仅本机通知，默认关闭） ---------- */

const REMINDER_KEY = 'guanji_reminder';   // JSON { enabled, time }
const REMINDER_TEXT = [
  '今天感觉如何？想记录就记一下，不想也没关系。',
  '睡前留一分钟：今天有什么想记下的吗？',
  '记或不记，都由你决定。',
];

function isNativeApp() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

function loadReminder() {
  try {
    return JSON.parse(localStorage.getItem(REMINDER_KEY) || '{"enabled":false,"time":"21:00"}');
  } catch { return { enabled: false, time: '21:00' }; }
}
function saveReminder(s) {
  localStorage.setItem(REMINDER_KEY, JSON.stringify(s));
}

/* 调度/取消本地通知（浏览器环境静默跳过，只保存设置） */
async function applyReminderSchedule(s) {
  const LN = isNativeApp() ? window.Capacitor.Plugins.LocalNotifications : null;
  if (!LN) return;
  try {
    if (s.enabled) {
      const [h, m] = s.time.split(':').map(Number);
      const body = REMINDER_TEXT[new Date().getDate() % REMINDER_TEXT.length];
      await LN.schedule({
        notifications: [{
          id: 1,
          title: '观己',
          body,
          schedule: { on: { hour: h, minute: m }, allowWhileIdle: true },
          sound: null,
        }],
      });
    } else {
      await LN.cancel({ notifications: [{ id: 1 }] });
    }
  } catch (err) {
    console.warn('reminder schedule failed', err);
  }
}

/* 设置页 UI 回显 */
function initReminderUI() {
  const s = loadReminder();
  $('reminderSwitch').classList.toggle('on', s.enabled);
  $('reminderTimeRow').classList.toggle('hidden', !s.enabled);
  $('reminderTime').value = s.time;
}

/* ---------- Toast ---------- */

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}

/* ---------- 深色模式（跟随系统 + 手动覆盖） ---------- */

const THEME_KEY = 'guanji_theme';   // system | light | dark

function applyTheme(mode) {
  const dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

function initTheme() {
  const mode = localStorage.getItem(THEME_KEY) || 'system';
  applyTheme(mode);
  document.querySelectorAll('#themeChips .chip').forEach((c) => {
    c.classList.toggle('active', c.dataset.themeMode === mode);
  });
}

// 设置页外观切换
$('themeChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const mode = chip.dataset.themeMode;
  localStorage.setItem(THEME_KEY, mode);
  document.querySelectorAll('#themeChips .chip').forEach((c) => c.classList.toggle('active', c.dataset.themeMode === mode));
  applyTheme(mode);
  renderHome();   // 重绘图表（环色/面积图随主题）
});

/* #72：液态玻璃实验开关（我的 → 外观，localStorage 持久化，默认开） */
const LG_KEY = 'guanji_liquid_glass';

function initLiquidGlass() {
  const on = (localStorage.getItem(LG_KEY) || 'on') !== 'off';
  document.documentElement.classList.toggle('liquid-glass', on);
  $('liquidGlassSwitch').classList.toggle('on', on);
}

$('liquidGlassSwitch').addEventListener('click', () => {
  const on = $('liquidGlassSwitch').classList.toggle('on');
  localStorage.setItem(LG_KEY, on ? 'on' : 'off');
  document.documentElement.classList.toggle('liquid-glass', on);
  renderHome();   // 背景/卡片随玻璃态重绘
});

// 跟随系统模式：系统主题变化时自动切换
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const mode = localStorage.getItem(THEME_KEY) || 'system';
  if (mode === 'system') {
    applyTheme('system');
    renderHome();
  }
});

/* ---------- 事件绑定 ---------- */

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

// Tab 切换
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    ['home', 'analysis', 'me'].forEach((name) => {
      $('screen-' + name).classList.toggle('hidden', name !== tab.dataset.screen);
    });
    if (tab.dataset.screen === 'analysis') maybeAutoGenerate();
    moveTabSlide(tab, $('tabSlide'));
    liquidTabPulse();
  });
});

// 初始滑块定位（首页）
moveTabSlide(document.querySelector('.tab.active'), $('tabSlide'));

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

/* ---------- #28：记录面板两步切换高度过渡动画 ---------- */

let sheetHeightTimer = null;

/* #66：步骤切换高度过渡（from = 切换前高度，调用方先测）。
   修复前：to 误取 step 自身高度（不含 grab/标题/按钮区 chrome ≈188px）→
   过渡反向收缩 + 400ms 固定定时器在动画尾段清 inline →「弹一部分卡一下显示完整」；
   修复后：目标 = 切换后 sheet 自然全高，清理改 transitionend（兜底定时器防 display:none 场景） */
function transitionSheetHeight(from) {
  const sheet = $('recordSheet');
  clearTimeout(sheetHeightTimer);
  const to = sheet.getBoundingClientRect().height;   // 步骤已切换完，此为自然全高（含 chrome）
  if (Math.abs(from - to) < 1) return;
  sheet.style.height = from + 'px';   // 先设高度再装过渡——before-change 样式无过渡，此赋值不触发动画
  sheet.style.transition = 'height 0.22s cubic-bezier(0.33, 1, 0.68, 1)';
  sheet.style.overflow = 'hidden';
  requestAnimationFrame(() => { sheet.style.height = to + 'px'; });
  const cleanup = () => {
    clearTimeout(sheetHeightTimer);
    sheet.style.height = '';
    sheet.style.transition = '';
    sheet.style.overflow = '';
    sheet.removeEventListener('transitionend', onEnd);
  };
  const onEnd = (e) => { if (e.target === sheet && e.propertyName === 'height') cleanup(); };
  sheet.addEventListener('transitionend', onEnd);
  sheetHeightTimer = setTimeout(cleanup, 600);   // 兜底（关闭面板/display:none 时 transitionend 不触发）
}

/* #51：步骤切换（计时态下「下一步」= 开始/结束计时） */
function goToDetails() {
  const from = $('recordSheet').getBoundingClientRect().height;   // #66：切换前高度（过渡起点）
  $('stepTime').classList.add('hidden');
  $('stepDetails').classList.remove('hidden');
  $('nextBtn').classList.add('hidden');
  $('prevBtn').classList.remove('hidden');
  $('saveBtn').classList.remove('hidden');
  transitionSheetHeight(from);
}

function goToTime() {
  const from = $('recordSheet').getBoundingClientRect().height;   // #66：切换前高度（过渡起点）
  $('stepDetails').classList.add('hidden');
  $('stepTime').classList.remove('hidden');
  $('saveBtn').classList.add('hidden');
  $('prevBtn').classList.add('hidden');
  $('nextBtn').classList.remove('hidden');
  if (sheetMode === 'now') setupNowStep();   // 回到步骤一：恢复计时器态/经典流程
  transitionSheetHeight(from);
}

$('nextBtn').addEventListener('click', () => {
  // #51：以「当前面板的计时器态」分流（不能依赖偏好——quick 偏好 + 杀进程恢复计时时，
  // 恢复面板处于计时态但 loadRecordMode() 为 quick，若按偏好判断将无法结束计时）
  if (sheetMode === 'now') {
    if (timerState.running) { finishTimedRecord(); return; }
    if (!$('timerBox').classList.contains('hidden')) { startTimedRecord(); return; }
  }
  goToDetails();
});
$('prevBtn').addEventListener('click', goToTime);
$('saveBtn').addEventListener('click', saveRecord);

// 选项 chips（#24：支持自定义添加，chips 尾部有「+ 添加」）
const CUSTOM_MOODS_KEY = 'guanji_custom_moods';
const CUSTOM_TRIGGERS_KEY = 'guanji_custom_triggers';

function loadCustomList(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function saveCustomList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function makeChip(text) {
  const b = document.createElement('button');
  b.className = 'chip';
  b.textContent = text;
  b.dataset.text = text;   // #47：× 子元素会混入 textContent，用 dataset 存纯净文本
  b.addEventListener('click', () => b.classList.toggle('active'));
  return b;
}

function makeAddChip(group) {
  const b = document.createElement('button');
  b.className = 'chip chip-add';
  b.textContent = '+ 添加';
  b.addEventListener('click', () => openAddDialog(group));
  return b;
}

/* #47（方案 A）：自定义项右上角 × 删除按钮（长按方案已弃用——Android 系统长按菜单抢占） */
function attachChipDelete(b) {
  const x = document.createElement('span');
  x.className = 'chip-x';
  x.textContent = '×';
  x.setAttribute('aria-label', '删除这个选项');
  x.addEventListener('click', (e) => {
    e.stopPropagation();   // 不触发 chip 选中
    openDeleteDialog(b);
  });
  b.appendChild(x);
}

/* 删除确认弹层（#47） */
let delTarget = null;
let delGroup = 'mood';

function openDeleteDialog(chip) {
  // #62：面板与汇总两个 chips 容器（id 含 Mood/Trigger 区分）
  delGroup = chip.closest('.chips').id.includes('Mood') ? 'mood' : 'trigger';
  delTarget = chip.dataset.text || chip.textContent;   // #47：用 dataset 文本（排除 × 子元素）
  $('delDialogText').textContent = `「${delTarget}」将从选项列表中移除，已保存的记录不受影响。`;
  $('delBackdrop').classList.remove('hidden');
}

function closeDeleteDialog() {
  animateDialogClose($('delBackdrop'));
}

$('delCancel').addEventListener('click', closeDeleteDialog);
$('delConfirm').addEventListener('click', () => {
  const key = delGroup === 'mood' ? CUSTOM_MOODS_KEY : CUSTOM_TRIGGERS_KEY;
  saveCustomList(key, loadCustomList(key).filter((t) => t !== delTarget));
  closeDeleteDialog();
  if (delGroup === 'mood') { renderMoodChips(); renderMoodChips(null, $('summaryMoodChips')); }
  else { renderTriggerChips(); renderTriggerChips(null, $('summaryTriggerChips')); }
  toast('已删除：' + delTarget);
});
$('delBackdrop').addEventListener('click', (e) => { if (e.target === $('delBackdrop')) closeDeleteDialog(); });

function renderMoodChips(selectText, box = $('moodChips')) {
  box.innerHTML = '';
  [...MOODS, ...loadCustomList(CUSTOM_MOODS_KEY)].forEach((t) => {
    const b = makeChip(t);
    if (!MOODS.includes(t)) { b.dataset.custom = '1'; attachChipDelete(b); }   // #47：自定义项可删除
    if (t === selectText) b.classList.add('active');
    box.appendChild(b);
  });
  box.appendChild(makeAddChip('mood'));
}

function renderTriggerChips(selectText, box = $('triggerChips')) {
  box.innerHTML = '';
  [...TRIGGERS, ...loadCustomList(CUSTOM_TRIGGERS_KEY)].forEach((t) => {
    const b = makeChip(t);
    if (!TRIGGERS.includes(t)) { b.dataset.custom = '1'; attachChipDelete(b); }   // #47：自定义项可删除
    if (t === selectText) b.classList.add('active');
    box.appendChild(b);
  });
  box.appendChild(makeAddChip('trigger'));
}

// 添加自定义项
let addTarget = 'mood';

function openAddDialog(group) {
  addTarget = group;
  $('addDialogTitle').textContent = group === 'mood' ? '添加情绪' : '添加诱因';
  $('addInput').value = '';
  $('addCount').textContent = '';      // #47：清空字数提示
  $('addPreview').textContent = '';    // #47：清空「将添加」预览（残留修复）
  $('addBackdrop').classList.remove('hidden');
  setTimeout(() => $('addInput').focus(), 120);
}

/* #47/#65：输入时实时字数提示 + 「将添加」预览——合并单行（消除重叠与跳动） */
$('addInput').addEventListener('input', () => {
  const text = $('addInput').value.trim();
  const n = text.length;
  $('addCount').textContent = '';
  $('addPreview').textContent = n ? `${n}/6 · 将添加：${text}` : '';
});

function closeAddDialog() {
  animateDialogClose($('addBackdrop'));
}

/* #47/#49：对话框退场动画（与 sheet 同曲线，淡出 + 轻微下移，0.25s 后隐藏）——不再瞬间消失 */
function animateDialogClose(backdropEl) {
  const dialog = backdropEl.querySelector('.dialog');
  if (!dialog) { backdropEl.classList.add('hidden'); return; }
  dialog.style.animation = 'none';   // fadeUp 动画层会覆盖内联 transform/opacity
  const CURVE = 'cubic-bezier(0.33, 1, 0.68, 1)';
  backdropEl.style.transition = `opacity 0.25s ${CURVE}`;
  backdropEl.style.opacity = '0';
  dialog.style.transition = `transform 0.25s ${CURVE}, opacity 0.25s ${CURVE}`;
  dialog.style.transform = 'translateY(12px)';
  dialog.style.opacity = '0';
  setTimeout(() => {
    backdropEl.classList.add('hidden');
    backdropEl.style.transition = '';
    backdropEl.style.opacity = '';
    dialog.style.transition = '';
    dialog.style.transform = '';
    dialog.style.opacity = '';
    dialog.style.animation = '';
  }, 270);
}

function confirmAddCustom() {
  const text = $('addInput').value.trim();
  if (!text) { toast('请输入名称'); return; }
  if (text.length > 6) { toast('名称最多 6 个字'); return; }
  const key = addTarget === 'mood' ? CUSTOM_MOODS_KEY : CUSTOM_TRIGGERS_KEY;
  const list = loadCustomList(key);
  if (list.includes(text)) { toast('已存在这个选项'); closeAddDialog(); return; }
  list.push(text);
  saveCustomList(key, list);
  closeAddDialog();
  if (addTarget === 'mood') renderMoodChips(text); else renderTriggerChips(text);
  toast('已添加：' + text);
}

$('addBackdrop').addEventListener('click', (e) => { if (e.target === $('addBackdrop')) closeAddDialog(); });
$('addCancel').addEventListener('click', closeAddDialog);
$('addConfirm').addEventListener('click', confirmAddCustom);
// #47：移除 Enter 直接提交——「退出键盘就完成添加」的困惑根源，必须点「添加」按钮确认
// $('addInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmAddCustom(); });

// 时长滑块
$('durSlider').addEventListener('input', () => {
  const v = parseInt($('durSlider').value, 10);
  $('durLabel').textContent = v ? v + ' 分钟' : '未记录';
});

// 看片开关
$('mediaSwitch').addEventListener('click', () => {
  $('mediaSwitch').classList.toggle('on');
});

// AI 分析生成
$('genBtn').addEventListener('click', generateAnalysis);

function bindGenBtn() {
  const g = $('genBtn2');
  if (g) g.addEventListener('click', generateAnalysis);
}

// 追问
document.querySelectorAll('#askChips .chip').forEach((chip) => {
  chip.addEventListener('click', () => askQuestion(chip.dataset.q));
});

// 我的页：AI 设置（#27：提供商 / Base URL / 模型 / 密钥 / 连接测试）

/* 从当前输入读取配置（保存前测试用） */
function readAIConfigFromInputs() {
  const provider = document.querySelector('#providerChips .chip.active').dataset.provider;
  return {
    provider,
    baseUrl: $('aiBaseUrlInput').value.trim(),
    model: $('aiModelInput').value.trim(),
    apiKey: $('apiKeyInput').value.trim(),
  };
}

/* #43：切换提供商 → 回显该提供商的完整配置（Base URL/模型/密钥），记忆 active */
function switchProvider(provider) {
  if (!AI_PROVIDERS[provider]) return;
  aiStore.active = provider;
  saveAIStore();
  syncActiveConfig();
  const p = aiStore.providers[provider];
  $('aiBaseUrlInput').value = p.baseUrl || '';
  $('aiModelInput').value = p.model || '';
  $('apiKeyInput').value = p.apiKey || '';
}

// 回显配置（按 active 提供商）
(function initAIUI() {
  document.querySelectorAll('#providerChips .chip').forEach((c) => {
    c.classList.toggle('active', c.dataset.provider === aiStore.active);
  });
  const p = aiStore.providers[aiStore.active];
  $('aiBaseUrlInput').value = p.baseUrl || '';
  $('aiModelInput').value = p.model || '';
  $('apiKeyInput').value = p.apiKey || '';
})();

// 提供商切换 → 回显该提供商配置（#43）
$('providerChips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  document.querySelectorAll('#providerChips .chip').forEach((c) => c.classList.toggle('active', c === chip));
  switchProvider(chip.dataset.provider);
});

// 保存配置（含密钥）
$('apiKeySave').addEventListener('click', () => {
  const cfg = readAIConfigFromInputs();
  if (!cfg.apiKey) { toast('请输入密钥'); return; }
  if (!cfg.baseUrl || !cfg.model) { toast('请填写 Base URL 和模型'); return; }
  aiConfig = { ...cfg };
  saveAIConfig(aiConfig);
  toast('AI 配置已保存（仅存本机）');
});

// 连接测试：发最小请求验证
$('aiTestBtn').addEventListener('click', async () => {
  const cfg = readAIConfigFromInputs();
  const statusEl = $('aiTestStatus');
  if (!cfg.apiKey) { statusEl.textContent = '请先填写 API 密钥再测试'; return; }
  if (!cfg.baseUrl || !cfg.model) { statusEl.textContent = '请先填写 Base URL 和模型'; return; }
  statusEl.textContent = '正在测试连接…';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(aiEndpoint(cfg), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (res.ok) {
      statusEl.textContent = `✓ 连接成功 · 模型 ${cfg.model}`;
    } else if (res.status === 401) {
      statusEl.textContent = '✗ 密钥无效（401），请检查 API 密钥';
    } else if (res.status === 404) {
      statusEl.textContent = '✗ 接口路径错误（404），请检查 Base URL';
    } else {
      statusEl.textContent = `✗ 请求失败（HTTP ${res.status}）`;
    }
  } catch (err) {
    if (err.name === 'AbortError') statusEl.textContent = '✗ 连接超时，请检查网络或 Base URL';
    else statusEl.textContent = '✗ 网络错误，请检查 Base URL 是否可访问';
  } finally {
    clearTimeout(timer);
  }
});

// 我的页：每日记录提醒开关（#13）
$('reminderSwitch').addEventListener('click', async () => {
  const s = loadReminder();
  s.enabled = !s.enabled;
  if (s.enabled && isNativeApp()) {
    try {
      const perm = await window.Capacitor.Plugins.LocalNotifications.requestPermissions();
      if (perm.display !== 'granted') {
        toast('通知权限被拒绝，提醒无法开启（可在系统设置中开启）');
        s.enabled = false;
        saveReminder(s);
        initReminderUI();
        return;
      }
    } catch { /* 旧系统无权限概念，继续调度 */ }
  }
  saveReminder(s);
  initReminderUI();
  applyReminderSchedule(s);
  toast(s.enabled ? `每日提醒已开启（${s.time}）` : '每日提醒已关闭');
});

// 提醒时间变更 → 重排调度
$('reminderTime').addEventListener('change', () => {
  // #31：清空后自动恢复显示默认 21:00（与存储一致）
  if (!$('reminderTime').value) $('reminderTime').value = '21:00';
  const s = loadReminder();
  s.time = $('reminderTime').value || '21:00';
  saveReminder(s);
  applyReminderSchedule(s);
  toast('提醒时间已更新');
});

// 我的页：正向反馈开关（#17）
$('positiveSwitch').addEventListener('click', () => {
  const on = positiveEnabled();
  localStorage.setItem(POSITIVE_KEY, on ? '0' : '1');
  $('positiveSwitch').classList.toggle('on', !on);
  renderHome();
  toast(on ? '正向反馈已关闭' : '正向反馈已开启');
});

// 我的页：导出 CSV（复制到剪贴板）
$('exportBtn').addEventListener('click', () => {
  if (!records.length) { toast('还没有记录可导出'); return; }
  const rows = [['日期', '时间', '时长(分)', '情绪', '诱因', '看片', '备注']];
  [...records]
    .sort((a, b) => (a.offset - b.offset) || a.time.localeCompare(b.time))
    .forEach((r) => {
      const d = dateWithOffset(r.offset);
      rows.push([
        `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`,
        r.time,
        r.duration || '',
        r.moods.join('|'),
        r.triggers.join('|'),
        r.media ? '是' : '否',
        r.note || '',
      ]);
    });
  const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const doCopy = () => navigator.clipboard.writeText(csv)
    .then(() => toast(`已复制 ${records.length} 条记录到剪贴板`))
    .catch(() => toast('复制失败，请手动复制（文件导出将在后续版本提供）'));
  if (navigator.clipboard && navigator.clipboard.writeText) doCopy();
  else {
    const ta = document.createElement('textarea');
    ta.value = csv;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('已复制到剪贴板'); } catch { toast('复制失败'); }
    ta.remove();
  }
});

// 我的页：清除 / 恢复
$('clearBtn').addEventListener('click', () => {
  $('dialogBackdrop').classList.remove('hidden');
});
$('dialogCancel').addEventListener('click', () => {
  $('dialogBackdrop').classList.add('hidden');
});
$('dialogConfirm').addEventListener('click', () => {
  records = [];
  Storage.saveRecords(records);
  afterRecordsChanged();
  $('dialogBackdrop').classList.add('hidden');
  toast('已清除全部数据');
  renderHome();
  $('analysisResult').classList.add('hidden');
  $('askSection').classList.add('hidden');
  $('analysisEmpty').classList.remove('hidden');
  $('analysisEmpty').innerHTML = emptyStateHTML();
  bindGenBtn();
});

$('restoreBtn').addEventListener('click', () => {
  records = buildDemoRecords();
  Storage.saveRecords(records);
  afterRecordsChanged();
  toast('已恢复演示数据');
  renderHome();
  $('analysisResult').classList.add('hidden');
  $('askSection').classList.add('hidden');
  $('analysisEmpty').classList.remove('hidden');
  $('analysisEmpty').innerHTML = emptyStateHTML();
  bindGenBtn();
});

/* ---------- #51：「就现在」计时（计时记录模式 + 实况通知） ---------- */

/* 「记录方式」偏好（设置页「记录方式」卡）：timer = 计时记录（默认）/ quick = 快速记录 */
function loadRecordMode() {
  try { return localStorage.getItem('guanji_record_mode') || 'timer'; } catch (e) { return 'timer'; }
}
function saveRecordMode(m) {
  try { localStorage.setItem('guanji_record_mode', m); } catch (e) {}
}

const TIMER_STORE_KEY = 'guanji_timer_v1';
let timerState = { startTime: null, running: false, intervalId: null };

function fmtElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0'), ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/* 纯时间戳差值渲染：后台 JS 挂起不影响数值，切回前台由 visibilitychange 校正 */
function renderTimerTick() {
  if (!timerState.running) return;
  const t = fmtElapsed(Date.now() - timerState.startTime);
  const td = $('timerDisplay');
  if (td) td.textContent = t;
  const tb = $('timerBigDisplay');
  if (tb) tb.textContent = t;
}

/* ---------- #54：全屏沉浸式计时页（运动 App 风格） ---------- */

let timerBackHandler = null;   // 全屏页返回键拦截（popstate）

function showTimerScreen() {
  hideTimerSummary();   // #62：计时开始确保汇总视图隐藏
  $('timerScreen').classList.remove('hidden');
  $('timerStartedLabel').textContent = `开始于 ${fmtTime(new Date(timerState.startTime))}`;
  renderTimerTick();
  // 返回键：全屏页按返回 = 取消计时 + 温和提示（#54 已确认）
  history.pushState({ timerScreen: true }, '');
  timerBackHandler = () => {
    if (timerState.running) cancelFromTimerScreen();
  };
  window.addEventListener('popstate', timerBackHandler);
}

/* ---------- #62/#63：全屏汇总视图（计时结束同容器切换，运动 App 风格） ---------- */

let summaryDuration = 0;
let summaryStartTime = null;   // #63：误触结束时可「继续计时」恢复

function showTimerSummary(duration) {
  summaryDuration = duration;
  $('timerScreen').classList.remove('hidden');
  $('timerRunView').classList.add('hidden');
  $('timerSummaryView').classList.remove('hidden');
  $('summaryDuration').textContent = `已计时 ${duration} 分钟`;
  $('summaryMeta').textContent = summaryStartTime ? `开始于 ${fmtTime(new Date(summaryStartTime))}` : '';
  renderMoodChips(null, $('summaryMoodChips'));
  renderTriggerChips(null, $('summaryTriggerChips'));
}

function hideTimerSummary() {
  $('timerSummaryView').classList.add('hidden');
  $('timerRunView').classList.remove('hidden');
}

/* #63：误触结束后继续计时——用原 startTime 恢复（秒数/通知/AOD 时长连续） */
function resumeTimer() {
  if (!summaryStartTime) return;
  timerState.startTime = summaryStartTime;
  timerState.running = true;
  timerState.intervalId = setInterval(renderTimerTick, 1000);
  renderTimerTick();
  try { localStorage.setItem(TIMER_STORE_KEY, String(timerState.startTime)); } catch (e) {}
  notifyStartTimer(timerState.startTime);   // 通知恢复（chronometer 从原 startTime 起）
  summaryStartTime = null;
  hideTimerSummary();
  showTimerScreen();
}

/* 保存汇总（时长自动落库，情绪/诱因可补选；media 由「看了片」诱因推导——#63 删看片开关） */
function saveTimedSummary() {
  if (!summaryDuration) return;
  const moods = [...$('summaryMoodChips').querySelectorAll('.chip.active')].map((c) => c.textContent);
  const triggers = [...$('summaryTriggerChips').querySelectorAll('.chip.active')].map((c) => c.textContent);
  const media = triggers.includes('看了片');   // 看片语义由诱因承担（与面板开关二选一，汇总页删开关）
  records.push({
    id: newRecordId('rec'),
    offset: 0,
    time: fmtTime(new Date()),
    duration: summaryDuration,
    moods, triggers, media, note: '',
  });
  Storage.saveRecords(records);
  afterRecordsChanged();
  summaryStartTime = null;
  hideTimerScreen();
  closeSheet();
  toast('已记录 ✓');
  renderHome();
}

/* 放弃本次计时结果（不保存） */
function abandonSummary() {
  summaryStartTime = null;
  hideTimerScreen();
  closeSheet();
  toast('已放弃本次计时');
}

function hideTimerScreen() {
  if (timerBackHandler) {
    window.removeEventListener('popstate', timerBackHandler);
    timerBackHandler = null;
    // 弹出 pushState 的历史项（监听已移除，不触发取消）
    if (history.state && history.state.timerScreen) history.back();
  }
  $('timerScreen').classList.add('hidden');
}

/* 全屏页取消：取消计时 + 关面板 + 温和提示（与「计时中关闭面板」一致） */
function cancelFromTimerScreen() {
  cancelTimer();
  hideTimerScreen();
  closeSheet();
  toast('已取消本次计时');
}

/* 原生实况通知（非原生环境静默跳过，模式同 syncWidgetStats） */
function notifyStartTimer(startTimeMs) {
  try {
    const P = window.Capacitor && window.Capacitor.Plugins;
    if (P && P.TimerLiveUpdate) P.TimerLiveUpdate.startTimer({ startTimeMs });
  } catch (e) { /* 非原生/插件不可用 */ }
}
function notifyStopTimer() {
  try {
    const P = window.Capacitor && window.Capacitor.Plugins;
    if (P && P.TimerLiveUpdate) P.TimerLiveUpdate.stopTimer();
  } catch (e) { /* 非原生/插件不可用 */ }
}

function startTimedRecord() {
  timerState.startTime = Date.now();
  timerState.running = true;
  timerState.intervalId = setInterval(renderTimerTick, 1000);
  renderTimerTick();
  try { localStorage.setItem(TIMER_STORE_KEY, String(timerState.startTime)); } catch (e) {}
  $('nextBtn').textContent = '结束记录';
  $('modeLink').classList.add('hidden');   // 计时中不可跳过
  notifyStartTimer(timerState.startTime);
  showTimerScreen();   // #54：开始计时 → 全屏沉浸式计时页
}

function finishTimedRecord() {
  clearInterval(timerState.intervalId);
  const elapsed = Date.now() - timerState.startTime;
  const duration = Math.max(1, Math.floor(elapsed / 60000));   // 分钟取整，不足 1 分钟按 1
  summaryStartTime = timerState.startTime;   // #63：暂存原开始时刻（误触结束可继续计时）
  timerState.running = false;
  timerState.startTime = null;
  try { localStorage.removeItem(TIMER_STORE_KEY); } catch (e) {}
  notifyStopTimer();
  $('durLabel').textContent = `${duration} 分钟`;
  $('durSlider').value = Math.min(duration, 60);
  showTimerSummary(duration);   // #62：全屏同容器切换到汇总视图（无页面跳变，替代 hideTimerScreen + goToDetails）
}

function cancelTimer() {
  if (!timerState.running) return;
  clearInterval(timerState.intervalId);
  timerState.running = false;
  timerState.startTime = null;
  try { localStorage.removeItem(TIMER_STORE_KEY); } catch (e) {}
  notifyStopTimer();
  $('timerDisplay').textContent = '00:00';
}

/* 步骤一布局：计时器态（timer 模式 / 计时中）vs 经典流程（quick 模式） */
function setupNowStep() {
  if (timerState.running) {
    // #55：计时中隐藏 seg（不可切换模式，只能结束/取消）
    $('timeSegRow').classList.add('hidden');
    $('pickerRow').classList.add('hidden');
    $('timerBox').classList.remove('hidden');
    $('nextBtn').textContent = '结束记录';
    $('modeLink').classList.add('hidden');
    renderTimerTick();
    return;
  }
  if (loadRecordMode() === 'quick') {
    $('timeSegRow').classList.remove('hidden');
    $('timerBox').classList.add('hidden');
    $('timeDisplay').classList.remove('hidden');   // #75：经典流程保留日期时间
    $('nextBtn').textContent = '下一步';
    $('modeLink').textContent = '想要精准计时？开始计时';
    $('modeLink').classList.remove('hidden');
  } else {
    // #55：未计时时恢复 seg 显示——「就现在」= 计时器态，「补记」= 经典流程（补记入口回归）
    $('timeSegRow').classList.remove('hidden');
    $('nowSeg').classList.add('active');
    $('customSeg').classList.remove('active');
    $('pickerRow').classList.add('hidden');
    $('timerBox').classList.remove('hidden');
    $('timeDisplay').classList.add('hidden');   // #75：就现在计时态不显示日期时间（更简洁紧凑）
    $('nextBtn').textContent = '开始记录';
    $('modeLink').textContent = '不想计时？直接填写';
    $('modeLink').classList.remove('hidden');
    $('timerDisplay').textContent = '00:00';
  }
}

/* 补记/编辑：经典步骤一（seg + 时间显示，无计时器） */
function showClassicStep1() {
  $('timeSegRow').classList.remove('hidden');
  $('timerBox').classList.add('hidden');
  $('timeDisplay').classList.remove('hidden');   // #75：经典流程（补记/编辑）显示日期时间
  $('modeLink').classList.add('hidden');
  $('nextBtn').textContent = '下一步';
}

/* 计时模式 ⇄ 经典流程 会话级切换（不改变设置页偏好） */
$('modeLink').addEventListener('click', () => {
  if (sheetMode !== 'now' || timerState.running) return;
  if (loadRecordMode() === 'quick') {
    $('timeSegRow').classList.remove('hidden');
    $('timerBox').classList.remove('hidden');
    $('timeDisplay').classList.add('hidden');   // #75：切回计时器态隐藏日期时间
    $('nextBtn').textContent = '开始记录';
    $('modeLink').textContent = '不想计时？直接填写';
    $('timerDisplay').textContent = '00:00';
  } else {
    goToDetails();   // 「不想计时？直接填写」→ 直接进详情（时长滑块照旧）
  }
});

/* #54/#62/#63：全屏计时页按钮 */
$('timerFinishBtn').addEventListener('click', () => {
  if (timerState.running) finishTimedRecord();
});
$('timerQuitBtn').addEventListener('click', cancelFromTimerScreen);
$('summarySaveBtn').addEventListener('click', saveTimedSummary);
$('summaryResumeBtn').addEventListener('click', resumeTimer);
$('summaryAbandonBtn').addEventListener('click', abandonSummary);

/* 后台挂起校正：切回前台立即重渲染（数值由时间戳保证） */
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && timerState.running) renderTimerTick();
});

/* 设置页「记录方式」偏好 UI */
function initRecordModeUI() {
  const chips = [...$('recordModeChips').querySelectorAll('.chip')];
  chips.forEach((c) => c.classList.toggle('active', c.dataset.recordMode === loadRecordMode()));
  chips.forEach((c) => c.addEventListener('click', () => {
    saveRecordMode(c.dataset.recordMode);
    chips.forEach((x) => x.classList.toggle('active', x === c));
  }));
}

/* 设置页「实况通知」测试（分级提示 + 内联状态区） */
async function testLiveUpdate() {
  const P = window.Capacitor && window.Capacitor.Plugins;
  if (!P || !P.TimerLiveUpdate) {
    $('liveTestStatus').textContent = '当前是浏览器预览环境，实况通知需要在安卓手机上测试。';
    return;
  }
  try {
    let st = await P.TimerLiveUpdate.getLiveUpdateStatus();
    let rows = [
      `系统：Android ${st.sdkInt}`,
      `通知权限：${st.permissionGranted ? '已开启' : '未开启'}`,
      st.supported ? '实况通知：支持 · 已提升' : '实况通知：不支持提升（系统低于 Android 16，将以普通通知显示）',
    ];
    $('liveTestStatus').innerHTML = rows.join('<br>');
    if (!st.permissionGranted) {
      const res = await P.TimerLiveUpdate.requestNotificationPermission();
      if (!res.granted) { toast('未获得通知权限，计时仍可用，只是没有通知'); return; }
      st = await P.TimerLiveUpdate.getLiveUpdateStatus();
      rows = [
        `系统：Android ${st.sdkInt}`,
        '通知权限：已开启',
        st.supported ? '实况通知：支持 · 已提升' : '实况通知：不支持提升（系统低于 Android 16，将以普通通知显示）',
      ];
      $('liveTestStatus').innerHTML = rows.join('<br>');
    }
    P.TimerLiveUpdate.testLiveUpdate({ seconds: 15 });
    toast('已发送测试通知，请查看锁屏/通知栏');
  } catch (e) {
    $('liveTestStatus').textContent = '测试失败：' + e.message;
  }
}
$('liveTestBtn').addEventListener('click', testLiveUpdate);

/* 通知被划掉（原生 deleteIntent 广播标记）→ 温和提示一次，不强行拉起 App */
window.__guanjiTimerDismissed = () => { toast('计时已从通知移除，计时仍在继续'); return 'ok'; };

/* #57：实况通知操作按钮（原生 Action / 魅族胶囊展开按钮触发） */
window.__guanjiTimerFinish = () => {
  // 「结束并记录」→ 结束计时 → 全屏退出 → 详情预填（用户可调时长后保存）
  if (timerState.running) finishTimedRecord();
  return 'ok';
};
window.__guanjiTimerCancel = () => {
  // 「取消」→ 取消计时 + 关面板 + 温和提示（与全屏页取消一致）
  if (timerState.running) cancelFromTimerScreen();
  return 'ok';
};

/* 杀进程恢复：ongoing 通知不随进程消亡，启动检测未完成计时 → 恢复并打开面板收尾 */
(function restoreTimer() {
  let raw = null;
  try { raw = localStorage.getItem(TIMER_STORE_KEY); } catch (e) {}
  if (!raw) return;
  const startTime = parseInt(raw, 10);
  if (!startTime || isNaN(startTime) || startTime > Date.now()) {
    try { localStorage.removeItem(TIMER_STORE_KEY); } catch (e) {}
    return;
  }
  timerState.startTime = startTime;
  timerState.running = true;
  timerState.intervalId = setInterval(renderTimerTick, 1000);
  renderTimerTick();
  notifyStartTimer(startTime);   // 幂等重建（通知可能已被系统移除）
  openSheet('now');
  // #61：延迟显示全屏——通知按钮（finish/cancel）意图在途时，全屏从未显示直接进详情/关闭，避免「先计时页再详情页」割裂
  setTimeout(() => {
    if (timerState.running) showTimerScreen();
  }, 400);
  toast('上次的计时仍在继续');
})();

/* ---------- #32-#36：小组件联动（快速记录 + 统计同步） ---------- */

/* 一键快速记录（桌面小组件触发）：自动保存「就现在」默认记录 */
function quickRecord() {
  records.push({
    id: newRecordId('quick'),
    offset: 0,
    time: fmtTime(new Date()),
    duration: null,
    moods: [], triggers: [], media: false, note: '',
  });
  Storage.saveRecords(records);
  toast('已快速记录 ✓');
  renderHome();
  syncWidgetStats();
}

window.__guanjiQuickRecord = () => quickRecord();

/* 聚合统计同步到原生（widget 展示），非原生环境静默跳过。
   格式：管道分隔字符串（避免原生 org.json 依赖）
   todayCount|weekCount|streak|weekDelta(空=无)|近7天counts(逗号)|monthCount|monthDelta(空=无) */
function syncWidgetStats() {
  try {
    const P = window.Capacitor && window.Capacitor.Plugins;
    if (!P || !P.WidgetStats) return;
    const week = [];
    for (let i = 6; i >= 0; i--) week.push(countRange(-i, -i));
    const cur = countRange(-6, 0);
    const prev = countRange(-13, -7);
    const now = new Date();
    const firstOff = dayDiff(new Date(now.getFullYear(), now.getMonth(), 1), now);
    const pf = dayDiff(new Date(now.getFullYear(), now.getMonth() - 1, 1), now);
    const pl = dayDiff(new Date(now.getFullYear(), now.getMonth(), 0), now);
    const pc = countRange(pf, pl);
    const mc = countRange(firstOff, 0);
    const stats = [
      countRange(0, 0),                        // todayCount
      cur,                                     // weekCount
      countStreak(),                           // streak
      prev > 0 ? Math.round((cur - prev) / prev * 100) : '',   // weekDelta
      week.join(','),                          // 近 7 天
      mc,                                      // monthCount
      pc > 0 ? Math.round((mc - pc) / pc * 100) : '',          // monthDelta
    ].join('|');
    P.WidgetStats.syncStats({ stats });
  } catch (e) { /* 非原生/插件不可用时忽略 */ }
}

/* 记录变化 → 同步小组件（保存/删除/快速记录/清除/恢复后）+ 报告自动重生成（#38） */
function afterRecordsChanged() {
  syncWidgetStats();
  scheduleReportRefresh();
}

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

records = Storage.loadRecords();
normalizeOffsets();   // v3.6.1：启动即恢复旧记录绝对日期（id 时间戳）并重算 offset
localStorage.setItem(LAST_DATE_KEY, fmtDateKey(new Date()));   // 初始化跨天检测基准
// 密钥回显由 initAIUI 按 active 提供商负责（#43 per-provider），这里保持配置同步
syncActiveConfig();
initTheme();                       // 深色模式初始化（head 内联脚本已做初值，这里同步 UI）
initLiquidGlass();                 // #72：液态玻璃实验开关同步 UI（head 内联脚本已应用类）
initReminderUI();                  // 提醒设置回显（#13）
initRecordModeUI();                // #51：记录方式偏好回显
applyReminderSchedule(loadReminder());   // 重启后恢复/更新调度（幂等）
$('positiveSwitch').classList.toggle('on', positiveEnabled());   // 正向反馈开关回显（#17）

// 桌面小组件「一键记录」入口（#14：原生 WebView 调用）
window.__guanjiOpenRecord = () => openSheet('now');

initSegSlide('chartSeg', 'chartSegSlide');   // #21：图表卡滑块初始定位
renderMoodChips();                           // #24：渲染情绪 chips（含自定义与添加入口）
renderTriggerChips();                        // #24：渲染诱因 chips

// #29：小横杠拖拽关闭（记录面板 + 日历）
initSheetDrag('recordGrab', $('recordSheet'), $('sheetBackdrop'), closeSheet);
initSheetDrag('calendarGrab', $('calendarSheet'), $('sheetBackdrop'), closeCalendar);

syncWidgetStats();   // #32：启动时同步小组件统计

renderHome();

