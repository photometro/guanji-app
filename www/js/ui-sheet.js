// 观己 App · ui-sheet（P1 搬移式拆分，2026-08-09——函数原样搬移，零逻辑改动）
/* ---------- #29/#199：统一 Sheet 生命周期与可中断拖拽 ---------- */

const sheetMotionStates = new WeakMap();
let sheetOpenAnim = null; // 兼容旧调用点；真实状态按 Sheet 隔离

/* #199：所有根级 Sheet 共享记录页的空间方向与运动节奏。
   .sheet--task 仍只负责布局/固定 footer，不再决定根动画。 */
const ROOT_SHEET_MOTION = Object.freeze({
  openDuration: 550,
  closeDuration: 300,
  openFromY: '100%',
  openFromScale: 0.98,
  closeToY: '100%',
  closeToScale: 0.98,
  openAnimeEasing: 'cubicBezier(0.34,1.56,0.64,1)',
  openCssEasing: 'cubic-bezier(0.34,1.56,0.64,1)',
  closeCssEasing: 'cubic-bezier(0.33,1,0.68,1)',
});

function sheetMotionState(sheetEl) {
  let state = sheetMotionStates.get(sheetEl);
  if (!state) {
    state = { openAnim: null, closeTimer: null, heightTimer: null, heightSeq: 0, motionSeq: 0 };
    sheetMotionStates.set(sheetEl, state);
  }
  return state;
}

function stopSheetOpen(sheetEl) {
  const state = sheetMotionState(sheetEl);
  if (state.openAnim && typeof state.openAnim.pause === 'function') state.openAnim.pause();
  if (sheetOpenAnim === state.openAnim) sheetOpenAnim = null;
  state.openAnim = null;
  state.motionSeq += 1;
}

function resetSheetStyle(sheetEl) {
  if (!sheetEl) return;
  const state = sheetMotionState(sheetEl);
  stopSheetOpen(sheetEl);
  if (state.closeTimer) { clearTimeout(state.closeTimer); state.closeTimer = null; }
  state.motionSeq += 1;
  sheetEl.style.transition = '';
  sheetEl.style.transform = '';
  sheetEl.style.opacity = '';
  sheetEl.style.animation = '';
  sheetEl.style.backdropFilter = '';        // #44：恢复 CSS 毛玻璃
  sheetEl.style.webkitBackdropFilter = '';
  sheetEl.style.background = '';            // #44：恢复 CSS 半透明玻璃背景
}

function reducedMotionEnabled() {
  return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/* #199：所有根级 Sheet 沿统一的记录页空间路径退场。 */
function animateSheetClose(sheetEl, backdropEl, doHide) {
  if (!sheetEl || !backdropEl) return;
  const state = sheetMotionState(sheetEl);
  stopSheetOpen(sheetEl);
  if (state.closeTimer) clearTimeout(state.closeTimer);
  const token = ++state.motionSeq;
  const reduced = reducedMotionEnabled();
  // #44：退场转不透明 + 关闭毛玻璃（保留既有残影 workaround）
  sheetEl.style.backdropFilter = 'none';
  sheetEl.style.webkitBackdropFilter = 'none';
  sheetEl.style.background = 'var(--card)';
  const duration = reduced ? 0.01 : ROOT_SHEET_MOTION.closeDuration / 1000;
  const curve = reduced ? 'linear' : ROOT_SHEET_MOTION.closeCssEasing;
  sheetEl.style.transition = `transform ${duration}s ${curve}, opacity ${duration}s ${curve}`;
  sheetEl.style.transform = reduced
    ? ''
    : `translateY(${ROOT_SHEET_MOTION.closeToY}) scale(${ROOT_SHEET_MOTION.closeToScale})`;
  sheetEl.style.opacity = '0';
  backdropEl.style.transition = `opacity ${duration}s ${curve}`;
  backdropEl.style.opacity = '0';
  state.closeTimer = setTimeout(() => {
    if (state.motionSeq !== token) return;
    state.closeTimer = null;
    doHide();
    resetSheetStyle(sheetEl);
    backdropEl.style.transition = '';
    backdropEl.style.opacity = '';
  }, reduced ? 20 : ROOT_SHEET_MOTION.closeDuration + 20);
}

/* #199：所有根级 Sheet 共享记录页的下方进入 + 微缩放入场。
   #216：日历可在同一生命周期内请求旧版无超调参数，不改变其他 Sheet 默认值。 */
function playSheetOpen(sheet = $('recordSheet'), options = {}) {
  if (!sheet) return;
  const state = sheetMotionState(sheet);
  if (state.closeTimer) { clearTimeout(state.closeTimer); state.closeTimer = null; }
  stopSheetOpen(sheet);
  const token = ++state.motionSeq;
  const reduced = reducedMotionEnabled();
  const noBounce = options && options.noBounce === true;
  const openDuration = noBounce ? 320 : ROOT_SHEET_MOTION.openDuration;
  const openFromScale = noBounce ? 1 : ROOT_SHEET_MOTION.openFromScale;
  // 复用 theme.css 的 --ease-spring 实值，保证日历入场不越过终点。
  const openAnimeEasing = noBounce
    ? 'cubicBezier(0.22,1,0.36,1)'
    : ROOT_SHEET_MOTION.openAnimeEasing;
  const openCssEasing = noBounce
    ? 'cubic-bezier(0.22,1,0.36,1)'
    : ROOT_SHEET_MOTION.openCssEasing;
  sheet.style.animation = 'none';
  if (reduced) {
    sheet.style.transform = '';
    sheet.style.opacity = '';
    return;
  }
  const start = `translateY(${ROOT_SHEET_MOTION.openFromY}) scale(${openFromScale})`;
  const duration = openDuration;
  sheet.style.transform = start;
  if (!window.anime) {
    requestAnimationFrame(() => {
      if (state.motionSeq !== token) return;
      sheet.style.transition = `transform ${duration}ms ${openCssEasing}`;
      sheet.style.transform = '';
      state.openAnim = { pause: () => {} };
      setTimeout(() => {
        if (state.motionSeq !== token) return;
        state.openAnim = null;
        sheet.style.transition = '';
        sheet.style.transform = '';
      }, duration + 20);
    });
    return;
  }
  const animation = anime({
    targets: sheet,
    translateY: [ROOT_SHEET_MOTION.openFromY, '0%'],
    scale: [openFromScale, 1],
    easing: openAnimeEasing,
    duration,
    complete: () => {
      if (state.motionSeq !== token) return;
      state.openAnim = null;
      if (sheetOpenAnim === animation) sheetOpenAnim = null;
      sheet.style.transform = '';
    },
  });
  state.openAnim = animation;
  sheetOpenAnim = animation;
}

/* 拖拽热区：Pointer Events 统一鼠标/触摸；距离 + 速度判定，支持中断接续。 */
function initSheetDrag(grabId, sheetEl, backdropEl, closeFn) {
  const grab = $(grabId);
  if (!grab || !sheetEl || !backdropEl) return;
  let startY = 0, lastY = 0, lastTime = 0, dragging = false, currentDy = 0, velocity = 0;

  grab.addEventListener('pointerdown', (e) => {
    if (sheetEl.classList.contains('hidden')) return;
    stopSheetOpen(sheetEl);
    dragging = true;
    startY = lastY = e.clientY;
    lastTime = performance.now();
    currentDy = 0;
    velocity = 0;
    sheetEl.style.animation = 'none';
    sheetEl.style.transition = 'none';
    try { grab.setPointerCapture(e.pointerId); } catch { /* 忽略捕获失败 */ }
  });

  grab.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const now = performance.now();
    const dy = Math.max(0, e.clientY - startY);
    const dt = Math.max(1, now - lastTime);
    velocity = Math.max(0, (e.clientY - lastY) / dt);
    currentDy = dy;
    lastY = e.clientY;
    lastTime = now;
    sheetEl.style.transform = `translateY(${dy}px)`;
    backdropEl.style.opacity = String(Math.max(0, 1 - dy / 500));
  });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    const shouldClose = currentDy >= 90 || (currentDy >= 32 && velocity >= 0.6);
    if (shouldClose) {
      closeFn();
      return;
    }
    sheetEl.style.transition = 'transform 0.22s var(--ease-spring)';
    sheetEl.style.transform = '';
    backdropEl.style.transition = 'opacity 0.22s var(--ease-spring)';
    backdropEl.style.opacity = '';
    setTimeout(() => {
      sheetEl.style.transition = '';
      backdropEl.style.transition = '';
    }, 240);
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

  // #132/#137/#138：旧记录与多选记录统一回填为 observation key 数组；原字段仍保留。
  renderObservationChips(recordObservationValues(rec), $('observationChips'));
  if (rec.duration) {
    // 滑块范围 max=60，超出时顶格显示（时长以 durLabel 为准，避免 clamp 丢数据）
    $('durSlider').value = Math.min(rec.duration, 60);
    $('durLabel').textContent = `${rec.duration} 分钟`;
  }
  $('noteInput').value = rec.note || '';
  updateTimeDisplay();

  // #46：编辑直达详情（单页编辑）——stepTime 保留可见（时间 seg 可调），详情直接展开，无需「下一步」
  $('stepDetails').classList.remove('hidden');
  $('recordSheet').classList.add('details-active');
  $('sheetContentScroll').scrollTop = 0;
  requestAnimationFrame(updateDetailsScrollState);
  $('nextBtn').classList.add('hidden');
  $('prevBtn').classList.add('hidden');
  $('saveBtn').classList.remove('hidden');
}

function openSheet(mode, presetDate) {
  sheetMode = mode;
  if (mode !== 'edit') editingId = null;   // 新增/补记重置编辑目标
  // #48：面板打开时清除触发按钮焦点（触摸聚焦按钮，拖拽退出路径不转移焦点会残留高亮）
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  resetSheetStyle($('recordSheet'));   // #29/#199：清除退场/拖拽残留，统一根级动效重播
  $('recordSheet').classList.remove('details-active');
  renderObservationChips([], $('observationChips'));
  $('sheetContentScroll').scrollTop = 0;
  $('durSlider').value = 0;
  $('durLabel').textContent = '未记录';
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
  playSheetOpen();   // #199：记录页基准根级动效（vendor 缺失时回退同规格 CSS transition）
  initSegSlide('timeSegRow', 'timeSegSlide');   // #22：面板显示后滑块定位到当前选中
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


/* ---------- #28：记录面板两步切换高度过渡动画 ---------- */

/* #66：步骤切换高度过渡（from = 切换前高度，调用方先测）。
   修复前：to 误取 step 自身高度（不含 grab/标题/按钮区 chrome ≈188px）→
   过渡反向收缩 + 400ms 固定定时器在动画尾段清 inline →「弹一部分卡一下显示完整」；
   修复后：目标 = 切换后 sheet 自然全高，清理改 transitionend（兜底定时器防 display:none 场景） */
function transitionSheetHeight(sheet, from, afterTransition) {
  if (!sheet) return;
  const state = sheetMotionState(sheet);
  if (state.heightTimer) clearTimeout(state.heightTimer);
  state.heightSeq += 1;
  const sequence = state.heightSeq;
  const to = sheet.getBoundingClientRect().height;   // 步骤已切换完，此为自然全高（含 chrome）
  if (Math.abs(from - to) < 1) return;
  const previousTransition = sheet.style.transition;
  const previousOverflow = sheet.style.overflow;
  sheet.style.height = from + 'px';   // 先设高度再装过渡——before-change 样式无过渡，此赋值不触发动画
  sheet.style.transition = previousTransition
    ? `${previousTransition}, height 0.22s cubic-bezier(0.33, 1, 0.68, 1)`
    : 'height 0.22s cubic-bezier(0.33, 1, 0.68, 1)';
  sheet.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    if (state.heightSeq === sequence) sheet.style.height = to + 'px';
  });
  const cleanup = () => {
    if (state.heightSeq !== sequence) return;
    clearTimeout(state.heightTimer);
    state.heightTimer = null;
    sheet.style.height = '';
    sheet.style.transition = previousTransition;
    sheet.style.overflow = previousOverflow;
    sheet.removeEventListener('transitionend', onEnd);
    if (afterTransition) requestAnimationFrame(afterTransition);
  };
  const onEnd = (e) => { if (e.target === sheet && e.propertyName === 'height') cleanup(); };
  sheet.addEventListener('transitionend', onEnd);
  state.heightTimer = setTimeout(cleanup, 600);   // 兜底（关闭面板/display:none 时 transitionend 不触发）
}

/* #51：步骤切换（计时态下「下一步」= 开始/结束计时） */
function goToDetails() {
  const from = $('recordSheet').getBoundingClientRect().height;   // #66：切换前高度（过渡起点）
  $('stepTime').classList.add('hidden');
  $('stepDetails').classList.remove('hidden');
  $('recordSheet').classList.add('details-active');
  $('sheetContentScroll').scrollTop = 0;
  requestAnimationFrame(updateDetailsScrollState);
  $('nextBtn').classList.add('hidden');
  $('prevBtn').classList.remove('hidden');
  $('saveBtn').classList.remove('hidden');
  transitionSheetHeight($('recordSheet'), from, updateDetailsScrollState);
}

function goToTime() {
  const from = $('recordSheet').getBoundingClientRect().height;   // #66：切换前高度（过渡起点）
  $('stepDetails').classList.add('hidden');
  $('stepTime').classList.remove('hidden');
  $('recordSheet').classList.remove('details-active');
  $('saveBtn').classList.add('hidden');
  $('prevBtn').classList.add('hidden');
  $('nextBtn').classList.remove('hidden');
  if (sheetMode === 'now') setupNowStep();   // 回到步骤一：恢复计时器态/经典流程
  transitionSheetHeight($('recordSheet'), from, updateDetailsScrollState);
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

// #132/#137/#138：统一“发生前状况”多选 chips（支持自定义添加，尾部有「+ 添加」）。
const CUSTOM_OBSERVATIONS_KEY = 'guanji_custom_observations';
// 旧自定义列表保留用于兼容旧记录的显示映射，不再作为新记录的两个独立入口。
const CUSTOM_MOODS_KEY = 'guanji_custom_moods';
const CUSTOM_TRIGGERS_KEY = 'guanji_custom_triggers';

function loadCustomList(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function saveCustomList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function makeChip(text, displayText = text, onClick) {
  const b = document.createElement('button');
  b.className = 'chip';
  b.textContent = displayText;
  b.dataset.text = text;   // #47：× 子元素会混入 textContent，用 dataset 存纯净文本
  b.addEventListener('click', () => onClick ? onClick(b) : b.classList.toggle('active'));
  return b;
}

function makeAddChip(group, box) {
  const b = document.createElement('button');
  b.className = 'chip chip-add';
  b.textContent = '+ 添加';
  b.addEventListener('click', () => openAddDialog(group, box));
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
let delBox = null;

function openDeleteDialog(chip) {
  delGroup = 'observation';
  delBox = chip.closest('.observation-picker');
  delTarget = chip.dataset.text || chip.textContent;   // #47：用 dataset 文本（排除 × 子元素）
  $('delDialogText').textContent = `「${delTarget}」将从选项列表中移除，已保存的记录不受影响。`;
  $('delBackdrop').classList.remove('hidden');
}

function closeDeleteDialog() {
  animateDialogClose($('delBackdrop'));
}

$('delCancel').addEventListener('click', closeDeleteDialog);
$('delConfirm').addEventListener('click', () => {
  const key = CUSTOM_OBSERVATIONS_KEY;
  saveCustomList(key, loadCustomList(key).filter((t) => t !== delTarget));
  closeDeleteDialog();
  const deletedKey = `custom:${delTarget}`;
  [$('observationChips'), $('summaryObservationChips')].forEach((box) => {
    if (!box) return;
    const selected = selectedObservationValues(box);
    selected.delete(deletedKey);
    renderObservationChips(selected, box);
  });
  delBox = null;
  toast('已删除：' + delTarget);
});
$('delBackdrop').addEventListener('click', (e) => { if (e.target === $('delBackdrop')) closeDeleteDialog(); });

function selectedChipTexts(box) {
  return new Set([...box.querySelectorAll('.chip.active')].map((chip) => chip.dataset.text || chip.textContent));
}

function selectedObservationValues(box) {
  if (!box) return new Set();
  return new Set([...box.querySelectorAll('.chip.active')]
    .map((chip) => chip.dataset.observation || chip.dataset.text || chip.textContent)
    .filter(Boolean));
}

function normaliseChipSelection(selectText) {
  const values = selectText instanceof Set ? [...selectText] : selectText;
  return new Set(normalizeObservationValues(values));
}

function hasSelectedChip(selected, text) {
  return selected.has(text) || [...selected].some((value) => displayTrigger(value) === displayTrigger(text));
}

function isTimerSummaryVisible() {
  const screen = $('timerScreen');
  const summary = $('timerSummaryView');
  return !!(screen && summary && !screen.classList.contains('hidden') && !summary.classList.contains('hidden'));
}

/* #127/#132：汇总页使用独立容器，但和普通详情页共用同一套观察标签。 */
function refreshSummaryChips(group, addedText) {
  if (group !== 'observation') return;
  if (!isTimerSummaryVisible()) return;
  const box = $('summaryObservationChips');
  const selected = selectedObservationValues(box);
  if (addedText) selected.add(observationKeyFromValue(addedText));
  renderObservationChips(selected, box);
}

function observationOptionsForSelection(selected) {
  const options = OBSERVATION_OPTIONS.map((o) => ({ ...o, custom: false }));
  loadCustomList(CUSTOM_OBSERVATIONS_KEY).forEach((label) => {
    if (!options.some((o) => o.label === label)) {
      options.push({ key: `custom:${label}`, label, custom: true, deletable: true, section: 'more', order: 100 });
    }
  });
  // 旧记录可能存在不在新默认列表中的标签；只在该标签被回填时临时展示，避免数据语义丢失。
  [...selected].forEach((value) => {
    const key = observationKeyFromValue(value);
    const label = observationLabelFromValue(value);
    if (key && label && !options.some((o) => o.key === key || o.label === label)) {
      options.push({ key, label, custom: true, legacy: true, section: 'more', order: 110 });
    }
  });
  return options.sort((a, b) => (a.order || 999) - (b.order || 999));
}

function makeObservationChip(option, box) {
  const b = makeChip(option.label, option.label, (chip) => {
    const selected = selectedObservationValues(box);
    const wasActive = selected.has(option.key);
    if (wasActive) selected.delete(option.key);
    else selected.add(option.key);
    // #186：通过统一归一化处理维度互斥；“原因不确定”可与事实并存。
    renderObservationChips(normalizeObservationValues([...selected]), box);
  });
  b.dataset.observation = option.key;
  if (option.custom) b.dataset.custom = '1';
  if (option.deletable) attachChipDelete(b);
  return b;
}

function renderObservationChips(selectText, box = $('observationChips')) {
  if (!box) return;
  const selected = normaliseChipSelection(selectText);
  const scroller = box.closest('.sheet-content-scroll, .summary-scroll');
  const previousScrollTop = scroller ? scroller.scrollTop : 0;
  box.innerHTML = '';
  box.classList.add('observation-picker');

  // #143：默认项、自定义项与添加入口全部直接展示，顺序仍由统一选项源决定。
  observationOptionsForSelection(selected).forEach((option) => {
    const b = makeObservationChip(option, box);
    if (hasSelectedChip(selected, option.key) || hasSelectedChip(selected, option.label)) b.classList.add('active');
    box.appendChild(b);
  });
  box.appendChild(makeAddChip('observation', box));
  if (scroller) requestAnimationFrame(() => {
    scroller.scrollTop = previousScrollTop;
    if (box === $('observationChips')) updateDetailsScrollState();
  });
}

/* #181/#199：任务 Sheet 与记录 Sheet 复用同一套样式复位和根级开关动画。 */
function taskPanel(backdropId) {
  const backdrop = $(backdropId);
  const panel = backdrop && backdrop.querySelector('.sheet--task');
  return { backdrop, panel };
}

function openSheetPanel(backdropId, _options = {}) {
  const { backdrop, panel } = taskPanel(backdropId);
  if (!backdrop || !panel) return;
  resetSheetStyle(panel);
  backdrop.classList.remove('hidden');
  panel.classList.remove('hidden');
  /* 兼容旧入口传入 presentation:'detail'：根级 Sheet 不再切换横向动效。 */
  playSheetOpen(panel);
}

function closeSheetPanel(backdropId, afterClose) {
  const { backdrop, panel } = taskPanel(backdropId);
  if (!backdrop || !panel || backdrop.classList.contains('hidden')) return;
  animateSheetClose(panel, backdrop, () => {
    backdrop.classList.add('hidden');
    backdrop.style.zIndex = '';
    if (afterClose) afterClose();
  });
}

/* #183/#184：数据保护中心内的恢复步骤共享同一张 Sheet；不再叠加第二遮罩或横向详情页。 */
let backupHubView = 'home';
const backupHubCopy = {
  home: { title: '备份与恢复', subtitle: null },
  source: { title: '恢复数据', subtitle: '选择要恢复的数据来源' },
  local: { title: '从本机文件恢复', subtitle: '从下载目录或其他位置导入数据' },
  server: { title: '从服务器恢复', subtitle: '选择一份备份恢复到本机' },
  localManage: { title: '本机文件管理', subtitle: '下载目录中的备份与导出文件' },
  serverManage: { title: '服务器备份', subtitle: '管理服务器上的加密备份' },
};
/* #211 N7：显式声明备份中心的导航树。恢复来源是 home 的子页，
   本机/服务器恢复是 source 的子页；两个管理页则直接从 home 进入。
   统一由这一张 Sheet 承载，避免入口被误当作同级页面而丢失返回路径。 */
const BACKUP_HUB_PARENT = Object.freeze({
  home: null,
  source: 'home',
  local: 'source',
  server: 'source',
  localManage: 'home',
  serverManage: 'home',
});

function isBackupHubOpen() {
  const backdrop = $('backupSyncBackdrop');
  return !!backdrop && !backdrop.classList.contains('hidden');
}

function setBackupHubView(view, { animate = true } = {}) {
  const backdrop = $('backupSyncBackdrop');
  const sheet = $('backupHubSheet');
  if (!backdrop || !sheet || !backupHubCopy[view]) return;
  const from = sheet.getBoundingClientRect().height;
  backupHubView = view;
  backdrop.dataset.backupHubView = view;
  document.querySelectorAll('[data-backup-hub-view]').forEach((section) => {
    if (section === backdrop) return;
    const active = section.dataset.backupHubView === view;
    section.classList.toggle('hidden', !active);
    section.setAttribute('aria-hidden', active ? 'false' : 'true');
  });
  document.querySelectorAll('[data-backup-hub-footer]').forEach((footer) => {
    const active = footer.dataset.backupHubFooter === view;
    footer.classList.toggle('hidden', !active);
    footer.setAttribute('aria-hidden', active ? 'false' : 'true');
  });
  $('backupHubTitle').textContent = backupHubCopy[view].title;
  if (backupHubCopy[view].subtitle) $('backupSyncStatus').textContent = backupHubCopy[view].subtitle;
  else if (typeof wdRender === 'function') wdRender();
  $('backupHubBody').scrollTop = 0;
  if (animate && isBackupHubOpen()) requestAnimationFrame(() => transitionSheetHeight(sheet, from));
}

function openBackupHub() {
  setBackupHubView('home', { animate: false });
  openSheetPanel('backupSyncBackdrop');
}

function closeBackupHub() { closeSheetPanel('backupSyncBackdrop'); }

function backupHubBack() {
  if (backupHubView === 'home') { closeBackupHub(); return; }
  const parentView = BACKUP_HUB_PARENT[backupHubView] || 'home';
  setBackupHubView(parentView);
}

window.openBackupHub = openBackupHub;
window.closeBackupHub = closeBackupHub;
window.backupHubBack = backupHubBack;
window.openBackupHubRestore = () => setBackupHubView('source');
window.openBackupHubLocal = () => setBackupHubView('local');
window.openBackupHubServer = () => setBackupHubView('server');
window.openBackupHubLocalManage = () => setBackupHubView('localManage');
window.openBackupHubServerManage = () => setBackupHubView('serverManage');
window.isBackupHubOpen = isBackupHubOpen;

/* #145：内容不足时不把详情滚动区强行撑满；内容超出时仅标记为可滚动。
   CSS 负责实际的高度约束，这个状态用于在新增/删除标签、键盘和旋转后重新计算。 */
function updateDetailsScrollState() {
  const sheet = $('recordSheet');
  const scroller = $('sheetContentScroll');
  if (!sheet || !scroller) return;
  const active = sheet.classList.contains('details-active');
  const scrollable = active && scroller.scrollHeight > scroller.clientHeight + 1;
  scroller.classList.toggle('is-scrollable', scrollable);
  sheet.dataset.contentOverflow = scrollable ? 'true' : 'false';
}

window.addEventListener('resize', () => requestAnimationFrame(updateDetailsScrollState));

/* #138：新代码读取完整数组；保留旧函数返回首项，兼容旧验证脚本和外部调用。 */
function readObservationSelections(box) {
  return [...selectedObservationValues(box)];
}

function readObservationSelection(box) {
  return readObservationSelections(box)[0] || '';
}

// 兼容旧验证脚本的函数名：生产界面只渲染统一观察标签。
function renderMoodChips(selectText, box) { renderObservationChips(selectText, box || $('observationChips')); }
function renderTriggerChips(selectText, box) { renderObservationChips(selectText, box || $('observationChips')); }

// 添加自定义观察标签
let addTarget = 'observation';
let addBox = null;

function openAddDialog(group = 'observation', box = $('observationChips')) {
  addTarget = 'observation';
  addBox = box;
  $('addDialogTitle').textContent = '添加发生前状况';
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
  const key = CUSTOM_OBSERVATIONS_KEY;
  const list = loadCustomList(key);
  if (list.includes(text)) { toast('已存在这个选项'); closeAddDialog(); return; }
  list.push(text);
  saveCustomList(key, list);
  closeAddDialog();
  const targetBox = addBox || $('observationChips');
  const selected = selectedObservationValues(targetBox);
  selected.delete('none');
  selected.delete('unsure');
  selected.add(`custom:${text}`);
  renderObservationChips(selected, targetBox);
  addBox = null;
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
  const provider = document.querySelector('#providerSeg .seg.active').dataset.provider;
  return {
    provider,
    baseUrl: $('aiBaseUrlInput').value.trim(),
    model: $('aiModelInput').value.trim(),
    apiKey: $('apiKeyInput').value.trim(),
  };
}

function syncAIInputPlaceholders(provider) {
  const defaults = AI_PROVIDERS[provider] || AI_PROVIDERS.custom;
  const baseInput = $('aiBaseUrlInput');
  const modelInput = $('aiModelInput');
  if (baseInput) baseInput.placeholder = defaults.baseUrl || 'https://api.example.com/v1';
  if (modelInput) modelInput.placeholder = defaults.model || '模型名称';
}

function renderAIModelMigrationHint(provider, model, showHint = true) {
  const hint = $('aiModelMigrationHint');
  if (!hint) return;
  const legacy = showHint && provider === 'deepseek' && (model === 'deepseek-chat' || model === 'deepseek-reasoner');
  hint.classList.toggle('hidden', !legacy);
  hint.textContent = legacy
    ? `当前模型 ${model} 已进入迁移期，建议改用 deepseek-v4-flash。点击“更换”后可修改。`
    : '';
}

/* #43：切换提供商 → 回显该提供商的完整配置（Base URL/模型/密钥），记忆 active */
function switchProvider(provider) {
  if (!AI_PROVIDERS[provider]) return;
  aiStore.active = provider;
  saveAIStore();
  syncActiveConfig();
  clearAISettingsInputEdits();
  syncAISettingsInputs({ force: true });
  aiKeyEditing = false;
  renderAISettingsUI();
}

/* #124：AI 提供商 seg 滑块同步（chips → seg，与加密同款） */
function setProviderSeg(provider) {
  const seg = $('providerSeg');
  if (!seg) return;
  seg.querySelectorAll('.seg').forEach((c) => c.classList.toggle('active', c.dataset.provider === provider));
  if (typeof moveSegSlide === 'function') {
    const active = seg.querySelector('.seg.active') || seg.querySelector('.seg');
    moveSegSlide(seg, $('providerSegSlide'), active);
  }
}

let aiKeyEditing = false;

// #212：SecureStorage 的恢复是异步的，统一把恢复后的配置安全地回填到编辑字段。
// 用户正在输入或主动清空的值不被后台 hydrate/render 覆盖，切换提供商时才强制刷新整组字段。
function markAISettingsInputEdited(event) {
  if (event && event.currentTarget) event.currentTarget.dataset.userEdited = '1';
}

function clearAISettingsInputEdits() {
  ['aiBaseUrlInput', 'aiModelInput', 'apiKeyInput'].forEach((id) => {
    const input = $(id);
    if (input) delete input.dataset.userEdited;
  });
}

function syncAISettingsInputs(options = {}) {
  const provider = aiStore.active;
  const p = aiStore.providers[provider] || {};
  const force = !!options.force;
  const values = {
    aiBaseUrlInput: p.baseUrl || '',
    aiModelInput: p.model || '',
    apiKeyInput: p.apiKey || '',
  };
  Object.entries(values).forEach(([id, value]) => {
    const input = $(id);
    if (!input) return;
    const focused = document.activeElement === input;
    const userEdited = input.dataset.userEdited === '1';
    if (force || (!focused && !userEdited)) input.value = value;
  });
  syncAIInputPlaceholders(provider);
}

/* #163/#167/#168/#169：AI 设置标题表达整体状态；保存态只显示提供商+模型摘要，编辑态恢复完整字段。 */
function renderAISettingsUI(statusOverride) {
  const provider = aiStore.active;
  const p = aiStore.providers[provider] || {};
  syncAISettingsInputs();
  const hasKey = !!p.apiKey;
  const showEditableConfig = !hasKey || aiKeyEditing;
  const baseField = $('aiBaseUrlField');
  const baseInput = $('aiBaseUrlInput');
  const modelField = $('aiModelField');
  if (baseField) baseField.classList.toggle('hidden', !showEditableConfig);
  if (baseInput) {
    baseInput.readOnly = !showEditableConfig;
    baseInput.setAttribute('aria-readonly', String(!showEditableConfig));
    baseInput.classList.toggle('settings-text-input-readonly', !showEditableConfig);
  }
  if (modelField) modelField.classList.toggle('hidden', !showEditableConfig);
  syncAIInputPlaceholders(provider);
  renderAIModelMigrationHint(provider, p.model || '', showEditableConfig);

  const hasConfig = hasKey && !!p.baseUrl && !!p.model;
  const statusEl = $('aiConfigStatus');
  if (statusEl) {
    const state = statusOverride || (hasConfig ? 'ready' : (hasKey ? 'error' : 'idle'));
    statusEl.dataset.state = state;
    statusEl.textContent = state === 'ready' ? '已配置' : (state === 'error' ? '配置异常' : '未配置');
  }

  const providerLabel = (AI_PROVIDERS[provider] && AI_PROVIDERS[provider].label) || provider;
  const summaryEl = $('aiConfigSummary');
  if (summaryEl) {
    summaryEl.textContent = hasConfig
      ? `${providerLabel} · ${p.model}`
      : `${providerLabel} · 配置未完成`;
    summaryEl.title = summaryEl.textContent;
  }

  const editField = $('apiKeyEditField');
  const editRow = $('apiKeyEditRow');
  const savedRow = $('apiKeySavedRow');
  if (editField) editField.classList.toggle('hidden', !showEditableConfig);
  if (editRow) editRow.classList.toggle('hidden', hasKey && !aiKeyEditing);
  if (savedRow) savedRow.classList.toggle('hidden', !hasKey || aiKeyEditing);
}

// 回显配置（按 active 提供商）
(function initAIUI() {
  setProviderSeg(aiStore.active);
  const p = aiStore.providers[aiStore.active];
  $('aiBaseUrlInput').value = p.baseUrl || '';
  $('aiModelInput').value = p.model || '';
  $('apiKeyInput').value = p.apiKey || '';
  clearAISettingsInputEdits();
  syncAIInputPlaceholders(aiStore.active);
  renderAISettingsUI();
  if (typeof renderAIDailyTipSetting === 'function') renderAIDailyTipSetting();
})();

['aiBaseUrlInput', 'aiModelInput', 'apiKeyInput'].forEach((id) => {
  const input = $(id);
  if (input) input.addEventListener('input', markAISettingsInputEdited);
});

// 提供商切换 → 回显该提供商配置（#43/#124：seg 滑块）
$('providerSeg').addEventListener('click', (e) => {
  const btn = e.target.closest('.seg');
  if (!btn) return;
  setProviderSeg(btn.dataset.provider);
  switchProvider(btn.dataset.provider);
});

// 保存配置（含密钥）
$('apiKeySave').addEventListener('click', () => {
  const cfg = readAIConfigFromInputs();
  if (!cfg.apiKey) { toast('请输入密钥'); return; }
  if (!cfg.baseUrl || !cfg.model) { toast('请填写 Base URL 和模型'); return; }
  aiConfig = { ...cfg };
  saveAIConfig(aiConfig);
  aiKeyEditing = false;
  clearAISettingsInputEdits();
  renderAISettingsUI('ready');
  $('aiTestStatus').textContent = '尚未测试连接';
  renderAIDailyTipSetting();
  toast('AI 配置已保存（仅存本机）');
});

$('apiKeyChange').addEventListener('click', () => {
  aiKeyEditing = true;
  renderAISettingsUI();
});

// #174：连接测试不再只看 HTTP 200；发送一个极小的真实请求并校验正文可解析，
// 这样 DeepSeek V4、代理网关或错误模型配置不会被误报为“连接成功”。
$('aiTestBtn').addEventListener('click', async () => {
  const cfg = readAIConfigFromInputs();
  const statusEl = $('aiTestStatus');
  if (!cfg.apiKey) { statusEl.textContent = '请先填写 API 密钥再测试'; renderAISettingsUI('error'); return; }
  if (!cfg.baseUrl || !cfg.model) { statusEl.textContent = '请先填写 Base URL 和模型'; renderAISettingsUI('error'); return; }
  statusEl.textContent = '正在测试连接…';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const content = await aiRequest(cfg, '请只返回 JSON：{"ok":true}', controller.signal, {
      structured: true,
      maxTokens: 256,
      purpose: 'connection-test',
    });
    const parsed = extractJSON(content);
    if (!parsed || parsed.ok !== true) throw new Error('API_FORMAT');
    if (content.trim()) {
      statusEl.textContent = `✓ 连接成功 · 模型 ${cfg.model}`;
      renderAISettingsUI('ready');
    }
  } catch (err) {
    statusEl.textContent = '✗ ' + (typeof aiErrorMessage === 'function'
      ? aiErrorMessage(err)
      : (err && err.name === 'AbortError' ? '连接超时，请检查网络或 Base URL' : '连接测试失败，请检查配置'));
    renderAISettingsUI('error');
  } finally {
    clearTimeout(timer);
  }
});

// #163：每日话语是首页体验开关；AI 已配置时优先增强，未配置时使用本地话语
$('aiDailyTipSwitch').addEventListener('click', () => {
  const enabled = !dailyTipEnabled();
  setDailyTipEnabled(enabled);
  renderGreeting();
  toast(enabled ? (apiKey ? '每日话语已开启' : '每日话语已开启，将使用本地话语') : '每日话语已关闭');
});
$('aiDailyTipAccept').addEventListener('click', () => {
  setAIDailyTipEnabled(true);
  setDailyTipEnabled(true);
  renderGreeting();
  toast('已继续使用 AI 每日话语');
});
$('aiDailyTipDecline').addEventListener('click', () => {
  setAIDailyTipEnabled(false);
  setDailyTipEnabled(true);
  renderGreeting();
  toast('已改用本地话语');
});

// #163：隐私摘要进入详情面板，主卡片只保留一行数据范围提示
const aiDataScopeBackdrop = $('aiDataScopeBackdrop');
const closeAIDataScope = () => aiDataScopeBackdrop?.classList.add('hidden');
$('aiDataScopeBtn').addEventListener('click', () => aiDataScopeBackdrop?.classList.remove('hidden'));
$('aiDataScopeClose').addEventListener('click', closeAIDataScope);
aiDataScopeBackdrop?.addEventListener('click', (e) => {
  if (e.target === aiDataScopeBackdrop) closeAIDataScope();
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

// 我的页：导出数据（#184：由独立导出 Sheet 明确承接，保留原有安全分流与文件实现）
async function runDataExport() {
  // #111：两种模式统一空数据提示（此前加密分支无检查，会导出空备份包）
  if (!records.length) { toast('还没有记录可导出'); return; }
  if (secureMode() === 'encrypted') {
    try {
      const r = await exportEncryptedBackupFile();
      // #100/#103：口令机制说明 + 短路径提示
      toast(`已保存加密备份：下载/${r.filename}——受你的加密口令保护`);
    } catch (e) {
      if (!/cancel/i.test((e && e.message) || '')) toast((e && e.message) || '导出失败');
      // 用户取消分享面板 = 正常操作，静默
    }
    return;
  }
  const rows = [['日期', '时间', '时长(分)', '发生前情况', '发生前状况(多选)', '情绪', '诱因', '成人内容影响', '备注']];
  [...records]
    .sort((a, b) => (a.offset - b.offset) || a.time.localeCompare(b.time))
    .forEach((r) => {
      const d = dateWithOffset(r.offset);
      rows.push([
        `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`,
        r.time,
        r.duration || '',
        recordObservationLabels(r).join('、'),
        serializeObservationCsv(recordObservationValues(r)),
        (r.moods || []).join('|'),
        (r.triggers || []).join('|'),
        r.media ? '是' : '否',
        r.note || '',
      ]);
    });
  const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const fname = await uniqueGuanjiFilename('plain', 'csv');
  // #102/#103：优先保存到公共 Downloads（MediaStore 原生桥，用户文件管理器直接可见）；失败降级 Share/剪贴板
  if (window.Capacitor && Capacitor.Plugins.GuanjiSave) {
    try {
      const res = await Capacitor.Plugins.GuanjiSave.saveToDownloads({ filename: fname, data: csv });
      toast('已保存到 下载/' + fname);
      return;
    } catch (e) {
      if (!/cancel/i.test((e && e.message) || '')) toast((e && e.message) || '导出失败');
      return;
    }
  }
  if (window.Capacitor && Capacitor.Plugins.Filesystem) {
    try {
      // 写 EXTERNAL（应用外部目录）——cache 的 FileProvider grant 在魅族上失败（SecurityException，面板不弹）
      const res = await Capacitor.Plugins.Filesystem.writeFile({ path: fname, data: csv, directory: 'EXTERNAL', encoding: 'UTF8' });
      await Capacitor.Plugins.Share.share({ title: '观己数据导出', files: [res.uri], dialogTitle: '保存或发送导出数据' });
      // #100/#101 引导：分享面板即保存位置选择器（「文件管理」= 保存入口）
      toast('导出文件已生成——在分享面板选「文件管理」即可保存到你的目录（' + fname + '）');
      return;
    } catch (e) {
      if (!/cancel/i.test((e && e.message) || '')) toast((e && e.message) || '导出失败');
      // 用户取消分享面板 = 正常操作，静默
      return;
    }
  }
  const doCopy = () => navigator.clipboard.writeText(csv)
    .then(() => toast(`已复制 ${records.length} 条记录到剪贴板`))
    .catch(() => toast('复制失败，请手动复制'));
  if (navigator.clipboard && navigator.clipboard.writeText) doCopy();
  else {
    const ta = document.createElement('textarea');
    ta.value = csv;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('已复制到剪贴板'); } catch { toast('复制失败'); }
    ta.remove();
  }
}

$('exportBtn').addEventListener('click', () => {
  if (!records.length) { toast('还没有记录可导出'); return; }
  const encrypted = secureMode() === 'encrypted';
  $('exportDialogText').textContent = encrypted ? '创建一份受口令保护、可用于恢复的本机副本' : '创建一份可在表格中查看的 CSV 数据副本';
  $('exportChoiceCard').innerHTML = `<div class="primary-line"><span class="file-icon">${backupPicker.icon(encrypted ? 'encrypted' : 'csv')}</span><div class="primary-copy"><strong>${encrypted ? '加密备份文件' : 'CSV 数据副本'}</strong><span>${encrypted ? '受当前加密口令保护，可从本机文件恢复' : '可在表格中查看，也可从本机文件恢复'}</span></div><span class="badge">本机</span></div><div class="primary-meta"><span>服务器备份 <b>备份与恢复中管理</b></span></div>`;
  $('exportRunBtn').textContent = encrypted ? '导出加密备份' : '导出 CSV';
  openSheetPanel('exportBackdrop');
});
$('exportRunBtn').addEventListener('click', async () => { await runDataExport(); closeSheetPanel('exportBackdrop'); });
$('exportCancel').addEventListener('click', () => closeSheetPanel('exportBackdrop'));
$('exportCloseTop').addEventListener('click', () => closeSheetPanel('exportBackdrop'));

// #183/#184：恢复是“备份与恢复”内部的连续状态，而非单独覆盖层。
$('backupHubRestoreBtn').addEventListener('click', () => window.openBackupHubRestore());
$('restoreLocalBtn').addEventListener('click', () => {
  if (typeof window.openLocalRestore === 'function') window.openLocalRestore();
});
$('restoreServerBtn').addEventListener('click', () => {
  if (typeof window.openServerRestore === 'function') window.openServerRestore();
});
$('restoreSourceCancel').addEventListener('click', () => window.backupHubBack());
$('backupSyncClose').addEventListener('click', () => window.closeBackupHub());
$('backupHubClose').addEventListener('click', () => window.closeBackupHub());

// 我的页：清除 / 恢复
// #115：清除可连带删除服务器备份（仅 WebDAV 已配置 + 加密态显示该选项）
$('clearBtn').addEventListener('click', () => {
  const hasWd = !!wdLoadCfg && !!wdLoadCfg() && secureMode() === 'encrypted';
  $('wdClearServerRow').classList.toggle('hidden', !hasWd);
  $('wdClearServerSwitch').classList.remove('on');
  $('dialogText').textContent = hasWd
    ? '本机记录将永久删除，且无法找回。服务器上的备份不受影响——如需彻底清除，请同时打开下方选项。'
    : '所有记录将永久删除，且无法找回。数据只在本机，清除后无法恢复。';
  $('dialogBackdrop').classList.remove('hidden');
});
$('wdClearServerSwitch').addEventListener('click', () => $('wdClearServerSwitch').classList.toggle('on'));
$('dialogCancel').addEventListener('click', () => {
  $('dialogBackdrop').classList.add('hidden');
});
$('dialogConfirm').addEventListener('click', async () => {
  // #115：先删服务器备份（成功/失败都继续本机清除，失败提示）
  if (!$('wdClearServerSwitch').classList.contains('hidden') && $('wdClearServerSwitch').classList.contains('on')) {
    try {
      const files = await wdList();
      for (const f of files) { try { await wdDelete(f.name); } catch (e) {} }
      const stat = wdLoadStat();
      stat.lastStatus = 'never'; delete stat.fingerprint; stat.lastBackup = '';
      wdSaveStat(stat);
      if (typeof wdRender === 'function') wdRender();
    } catch (e) {
      toast('服务器备份删除失败：' + ((e && e.message) || ''));
    }
  }
  records = [];
  // #202：清空整套记录后，旧数据集的 AI 洞察不可继续复用。
  if (typeof invalidateInsightCache === 'function') invalidateInsightCache();
  Storage.saveRecords(records);
  const statsSnapshot = afterRecordsChanged();
  $('dialogBackdrop').classList.add('hidden');
  toast(secureMode() === 'encrypted' ? '已清除全部数据（密文存储）' : '已清除全部数据');
  renderHome(statsSnapshot);
  $('analysisResult').classList.add('hidden');
  $('askSection').classList.add('hidden');
  $('analysisEmpty').classList.remove('hidden');
  $('analysisEmpty').innerHTML = emptyStateHTML();
  bindGenBtn();
});

$('restoreBtn').addEventListener('click', () => {
  records = buildDemoRecords();
  // #202：演示数据替换当前数据集，旧洞察必须失效。
  if (typeof invalidateInsightCache === 'function') invalidateInsightCache();
  Storage.saveRecords(records);
  const statsSnapshot = afterRecordsChanged();
  toast(secureMode() === 'encrypted' ? '已恢复演示数据（加密存储）' : '已恢复演示数据');
  renderHome(statsSnapshot);
  $('analysisResult').classList.add('hidden');
  $('askSection').classList.add('hidden');
  $('analysisEmpty').classList.remove('hidden');
  $('analysisEmpty').innerHTML = emptyStateHTML();
  bindGenBtn();
});


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

/* #124：记录方式 seg 滑块同步（chips → seg） */
function setRecordModeSeg(mode) {
  const seg = $('recordModeSeg');
  if (!seg) return;
  seg.querySelectorAll('.seg').forEach((c) => c.classList.toggle('active', c.dataset.recordMode === mode));
  if (typeof moveSegSlide === 'function') {
    const active = seg.querySelector('.seg.active') || seg.querySelector('.seg');
    moveSegSlide(seg, $('recordModeSegSlide'), active);
  }
}

/* 设置页「记录方式」偏好 UI */
function initRecordModeUI() {
  const seg = $('recordModeSeg');
  if (!seg) return;
  setRecordModeSeg(loadRecordMode());
  seg.querySelectorAll('.seg').forEach((c) => c.addEventListener('click', () => {
    saveRecordMode(c.dataset.recordMode);
    setRecordModeSeg(c.dataset.recordMode);
  }));
}

/* #172：计时通知模块状态渲染。结果使用「项目 / 状态」行，避免多段文本堆叠。 */
function renderLiveTestResult(rows, badgeText, badgeState = 'idle') {
  const result = $('liveTestStatus');
  const badge = $('liveTestBadge');
  if (!result) return;
  result.replaceChildren();
  rows.forEach(([label, value, state]) => {
    const row = document.createElement('div');
    row.className = 'live-test-result-row';
    const labelEl = document.createElement('span');
    labelEl.className = 'live-test-result-label';
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.className = `live-test-result-value${state ? ` is-${state}` : ''}`;
    valueEl.textContent = value;
    row.append(labelEl, valueEl);
    result.appendChild(row);
  });
  result.classList.remove('hidden');
  if (badge) {
    badge.textContent = badgeText;
    badge.dataset.state = badgeState;
  }
}

function setLiveTestBadge(text, state = 'idle') {
  const badge = $('liveTestBadge');
  if (!badge) return;
  badge.textContent = text;
  badge.dataset.state = state;
}

function updateTimerNotificationUI(enabled) {
  const sw = $('timerNotificationSwitch');
  const btn = $('liveTestBtn');
  const block = $('liveTestBlock');
  const hint = $('liveTestHint');
  const result = $('liveTestStatus');
  if (sw) {
    sw.classList.toggle('on', enabled);
    sw.setAttribute('aria-checked', String(enabled));
  }
  if (btn) btn.disabled = !enabled;
  if (block) block.classList.toggle('is-disabled', !enabled);
  if (hint) hint.textContent = enabled
    ? '支持的设备会显示为实况通知，其他设备使用普通通知。'
    : '开启计时通知后，可在这里检查系统权限和显示方式。';
  if (!enabled) {
    if (result) {
      result.replaceChildren();
      result.classList.add('hidden');
    }
    setLiveTestBadge('已关闭', 'off');
  } else if (!result || result.classList.contains('hidden')) {
    setLiveTestBadge('未测试', 'idle');
  }
}

function initTimerNotificationUI() {
  const sw = $('timerNotificationSwitch');
  if (!sw) return;
  updateTimerNotificationUI(timerNotificationEnabled());
  const toggle = () => {
    const enabled = !timerNotificationEnabled();
    if (!enabled) notifyStopTimer(true);
    saveTimerNotificationEnabled(enabled);
    updateTimerNotificationUI(enabled);
    if (enabled && timerState.running) notifyStartTimer(timerState.startTime);
    toast(enabled ? '计时通知已开启' : '计时通知已关闭');
  };
  sw.addEventListener('click', toggle);
  sw.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });
}

function liveTestRows(st) {
  return [
    ['系统', `Android ${st.sdkInt || '未知'}`],
    ['通知权限', st.permissionGranted ? '已开启' : '需要系统权限', st.permissionGranted ? 'ok' : 'warn'],
    ['显示方式', st.supported ? '实况通知已支持' : '普通通知 · 系统降级', st.supported ? 'ok' : 'muted'],
  ];
}

/* 设置页「实况通知」测试（分级提示 + 结构化状态区） */
async function testLiveUpdate() {
  if (!timerNotificationEnabled()) {
    toast('请先开启计时通知');
    return;
  }
  const btn = $('liveTestBtn');
  if (btn) btn.disabled = true;
  setLiveTestBadge('测试中…', 'loading');
  const P = window.Capacitor && window.Capacitor.Plugins;
  if (!P || !P.TimerLiveUpdate) {
    renderLiveTestResult([
      ['环境', '浏览器预览'],
      ['显示方式', '需要 Android 真机测试', 'muted'],
    ], '需真机', 'muted');
    $('liveTestHint').textContent = '当前环境不会发送系统通知，请在 Android 真机上测试。';
    if (btn) btn.disabled = false;
    return;
  }
  try {
    let st = await P.TimerLiveUpdate.getLiveUpdateStatus();
    if (!st.permissionGranted) {
      const res = await P.TimerLiveUpdate.requestNotificationPermission();
      if (!res.granted) {
        renderLiveTestResult([
          ['系统', `Android ${st.sdkInt || '未知'}`],
          ['通知权限', '需要系统权限', 'warn'],
          ['下一步', '请在系统设置中打开通知权限', 'warn'],
        ], '需开启权限', 'warn');
        $('liveTestHint').textContent = 'App 开关仍保持开启；打开系统通知权限后可再次测试。';
        toast('请在系统设置中打开通知权限后再测试');
        return;
      }
      st = await P.TimerLiveUpdate.getLiveUpdateStatus();
    }
    renderLiveTestResult(liveTestRows(st), st.supported ? '可用' : '普通通知', st.supported ? 'ready' : 'muted');
    $('liveTestHint').textContent = st.supported
      ? '实况通知已支持，测试通知将持续约 15 秒。'
      : '当前系统会使用普通通知显示计时，测试通知将持续约 15 秒。';
    await P.TimerLiveUpdate.testLiveUpdate({ seconds: 15 });
    toast('已发送测试通知，请查看锁屏/通知栏');
  } catch (e) {
    renderLiveTestResult([
      ['结果', '测试失败，请稍后重试', 'warn'],
    ], '测试失败', 'warn');
    $('liveTestHint').textContent = '请检查系统通知权限和观己是否允许后台运行。';
  } finally {
    if (btn) btn.disabled = !timerNotificationEnabled();
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

