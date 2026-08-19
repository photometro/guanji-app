// 观己 App · ui-timer（P1 搬移式拆分，2026-08-09——函数原样搬移，零逻辑改动）
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

/* ---------- #62/#63/#132/#138：全屏汇总视图（计时结束同容器切换，统一观察标签） ---------- */

let summaryDuration = 0;
let summaryStartTime = null;   // #63：误触结束时可「继续计时」恢复

function showTimerSummary(duration) {
  summaryDuration = duration;
  $('timerScreen').classList.remove('hidden');
  $('timerRunView').classList.add('hidden');
  $('timerSummaryView').classList.remove('hidden');
  $('summaryDuration').textContent = `已计时 ${duration} 分钟`;
  $('summaryMeta').textContent = summaryStartTime ? `开始于 ${fmtTime(new Date(summaryStartTime))}` : '';
  renderObservationChips(null, $('summaryObservationChips'));
  const summaryScroll = $('summaryObservationChips').closest('.summary-scroll');
  if (summaryScroll) summaryScroll.scrollTop = 0;
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

/* 保存汇总（时长自动落库，发生前状况可多选；media 由统一观察标签推导） */
function saveTimedSummary() {
  if (!summaryDuration) return;
  const observations = normalizeObservationValues(readObservationSelections($('summaryObservationChips')));
  const observation = observations[0] || '';
  const media = observations.some(isAdultContentObservation);
  const now = new Date();
  records.push({
    id: newRecordId('rec'),
    dateKey: fmtDateKey(now),
    offset: 0,
    time: fmtTime(now),
    duration: summaryDuration,
    observations,
    observation: observation || null,
    moods: [], triggers: [], media, note: '',
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
  // #126：关闭父层时同步复位汇总子视图，避免下次打开时残留「父层已隐藏、汇总子视图仍显示」的失配状态。
  hideTimerSummary();
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

