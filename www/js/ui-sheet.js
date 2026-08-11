// 观己 App · ui-sheet（P1 搬移式拆分，2026-08-09——函数原样搬移，零逻辑改动）
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
  const provider = document.querySelector('#providerSeg .seg.active').dataset.provider;
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

// 回显配置（按 active 提供商）
(function initAIUI() {
  setProviderSeg(aiStore.active);
  const p = aiStore.providers[aiStore.active];
  $('aiBaseUrlInput').value = p.baseUrl || '';
  $('aiModelInput').value = p.model || '';
  $('apiKeyInput').value = p.apiKey || '';
})();

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

// 我的页：导出数据（#96：按模式自适应——明文 CSV / 加密密文备份文件）
$('exportBtn').addEventListener('click', async () => {
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
  // #102/#103：优先保存到公共 Downloads（MediaStore 原生桥，用户文件管理器直接可见）；失败降级 Share/剪贴板
  if (window.Capacitor && Capacitor.Plugins.GuanjiSave) {
    try {
      const fname = 'guanji-export-' + fmtDateKey(new Date()) + '.csv';
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
      const fname = 'guanji-export-' + fmtDateKey(new Date()) + '.csv';
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
});

// #117：恢复数据统一入口（来源选择：本机文件 / 服务器备份）
$('restoreDataBtn').addEventListener('click', () => {
  $('restoreSourceBackdrop').classList.remove('hidden');
});
$('restoreLocalBtn').addEventListener('click', () => {
  $('restoreSourceBackdrop').classList.add('hidden');
  $('secureImportBtn').click();   // 触发原导入弹窗（#111 自适逻辑）
});
$('restoreServerBtn').addEventListener('click', () => {
  $('restoreSourceBackdrop').classList.add('hidden');
  $('wdRestoreBtn').click();      // 触发原服务器恢复弹窗（#115 三模式）
});
$('restoreSourceCancel').addEventListener('click', () => $('restoreSourceBackdrop').classList.add('hidden'));

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
  Storage.saveRecords(records);
  afterRecordsChanged();
  $('dialogBackdrop').classList.add('hidden');
  toast(secureMode() === 'encrypted' ? '已清除全部数据（密文存储）' : '已清除全部数据');
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
  toast(secureMode() === 'encrypted' ? '已恢复演示数据（加密存储）' : '已恢复演示数据');
  renderHome();
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

