// 观己 App · records（P1 搬移式拆分，2026-08-09——函数原样搬移，零逻辑改动）

/* ============ v3.6.1 hotfix 同步：记录绝对日期（修复跨天日期漂移） ============
   根因：offset 是「相对保存当天」的偏移，跨天后基准漂移，旧记录被归到错误日期。
   修复：记录同时存绝对日期 dateKey（yyyy-mm-dd）；启动/数据变更/跨天后用 dateKey
   重算 offset（相对当前今天）；旧记录（无 dateKey）用 id 内嵌 base36 毫秒时间戳精确恢复。 */
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

