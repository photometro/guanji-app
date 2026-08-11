// 观己 App · 入口（P1 搬移式拆分，2026-08-09）——事件绑定 + 键盘处理 + 启动
// 依赖加载顺序（index.html 中）：storage → records → stats → ai → ui-home → ui-calendar → ui-sheet → ui-timer → liquid-glass → app.js（本文件最后）
// 全局函数/变量照旧（跨文件运行时解析）；moveTabSlide/liquidTabPulse 定义随事件绑定区保留在此
// 观己 App · app（P1 搬移式拆分，2026-08-09——函数原样搬移，零逻辑改动）
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
    if (tab.dataset.screen === 'me' && typeof refreshMeSegs === 'function') refreshMeSegs();   // #121/#124：我的页全部 seg 滑块重定位（页面从隐藏变为可见）
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

// #93：记录加载异步化（加密模式需 Web Crypto 解密），其余初始化在解密后继续
(async () => {
records = await Storage.loadRecords();
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
initSegSlide('chartViewSeg', 'chartViewSlide');   // #88：图表视图滑块初始定位
renderMoodChips();                           // #24：渲染情绪 chips（含自定义与添加入口）
renderTriggerChips();                        // #24：渲染诱因 chips

// #29：小横杠拖拽关闭（记录面板 + 日历）
initSheetDrag('recordGrab', $('recordSheet'), $('sheetBackdrop'), closeSheet);
initSheetDrag('calendarGrab', $('calendarSheet'), $('sheetBackdrop'), closeCalendar);

syncWidgetStats();   // #32：启动时同步小组件统计

renderHome();

/* #87：Android 返回键/侧滑兜底——分层关闭浮层（弹窗→日历→全屏计时→记录面板），全部关闭后二次确认退出 */
let backPressedAt = 0;
function handleBackButton() {
  const isHidden = (id) => $(id).classList.contains('hidden');
  // 1. 自定义词弹窗（最上层优先）
  if (!isHidden('addBackdrop')) { closeAddDialog(); return; }
  // 2. 删除确认弹窗
  if (!isHidden('delBackdrop')) { closeDeleteDialog(); return; }
  // 3. 数据管理确认弹窗
  if (!isHidden('dialogBackdrop')) { $('dialogBackdrop').classList.add('hidden'); return; }
  // 4. 日历弹层
  if (!isHidden('calendarSheet')) { closeCalendar(); return; }
  // 5. 全屏计时/汇总页（#51/#54：全屏覆盖在面板之上，返回 = 取消计时）
  if (!isHidden('timerScreen')) { cancelFromTimerScreen(); return; }
  // 6. 记录面板（#51：计时中关闭面板 = 取消计时，closeSheet 已处理）
  if (!isHidden('recordSheet')) { closeSheet(); return; }
  // 7. 首页：二次确认退出（2 秒窗口，温和提示）
  const now = Date.now();
  if (now - backPressedAt < 2000) {
    if (window.Capacitor && Capacitor.Plugins.App) Capacitor.Plugins.App.exitApp();
    return;
  }
  backPressedAt = now;
  toast('再按一次退出');
}
if (window.Capacitor && Capacitor.Plugins.App) {
  Capacitor.Plugins.App.addListener('backButton', handleBackButton);
}

initSecureUI();   // #93：数据加密卡 UI（开启/修改口令/关闭/密文导出导入）
initWebDAVUI();   // #115：WebDAV 备份卡 UI（配置/备份/恢复/管理/切后台自动备份）
})();


