// 观己 App · liquid-glass（P1 搬移式拆分，2026-08-09——函数原样搬移，零逻辑改动）
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

/* #124：外观单选 seg 滑块同步（chips → seg，与加密同款） */
function setThemeSeg(mode) {
  const seg = $('themeSeg');
  if (!seg) return;
  seg.querySelectorAll('.seg').forEach((c) => c.classList.toggle('active', c.dataset.themeMode === mode));
  if (typeof moveSegSlide === 'function') {
    const active = seg.querySelector('.seg.active') || seg.querySelector('.seg');
    moveSegSlide(seg, $('themeSegSlide'), active);
  }
}

function initTheme() {
  const mode = localStorage.getItem(THEME_KEY) || 'system';
  applyTheme(mode);
  setThemeSeg(mode);
}

// 设置页外观切换（#124：seg 滑块）
$('themeSeg').addEventListener('click', (e) => {
  const btn = e.target.closest('.seg');
  if (!btn) return;
  const mode = btn.dataset.themeMode;
  localStorage.setItem(THEME_KEY, mode);
  setThemeSeg(mode);
  applyTheme(mode);
  renderHome();   // 重绘图表（环色/面积图随主题）
});

/* #72：玻璃效果实验开关（我的 → 外观，localStorage 持久化）
   #116：新用户默认关（经典样式）——仅显式开启才玻璃；老用户设置保留 */
const LG_KEY = 'guanji_liquid_glass';
/* #113：磨砂强度（blur 0-10px，默认 3，深浅共用；持久化 guanji_glass_blur） */
const LG_BLUR_KEY = 'guanji_glass_blur';
const LG_BLUR_DEFAULT = 3;

function applyGlassBlur(v) {
  const raw = parseInt(v, 10);
  const px = Math.max(0, Math.min(10, Number.isNaN(raw) ? LG_BLUR_DEFAULT : raw));   // 注意：0 是合法值，不能用 || 兜底
  if (px === LG_BLUR_DEFAULT) document.documentElement.style.removeProperty('--lg-blur');
  else document.documentElement.style.setProperty('--lg-blur', px + 'px');
  const slider = $('glassBlurSlider'), val = $('glassBlurVal');
  if (slider) slider.value = px;
  if (val) val.textContent = px + ' px';
}

function initLiquidGlass() {
  const on = (localStorage.getItem(LG_KEY) || 'off') !== 'off';   // #116：默认关——新用户经典样式，老用户 on 保留
  document.documentElement.classList.toggle('liquid-glass', on);
  $('liquidGlassSwitch').classList.toggle('on', on);
  // #113：读取磨砂强度设置（无值走默认 3）
  applyGlassBlur(localStorage.getItem(LG_BLUR_KEY) || LG_BLUR_DEFAULT);
}

$('liquidGlassSwitch').addEventListener('click', () => {
  const on = $('liquidGlassSwitch').classList.toggle('on');
  localStorage.setItem(LG_KEY, on ? 'on' : 'off');
  document.documentElement.classList.toggle('liquid-glass', on);
  renderHome();   // 背景/卡片随玻璃态重绘
});

/* #113：磨砂强度滑块——拖动实时生效 + 持久化（玻璃关着也能调，下次开启生效） */
$('glassBlurSlider').addEventListener('input', (e) => {
  const px = parseInt(e.target.value, 10);
  localStorage.setItem(LG_BLUR_KEY, String(px));
  applyGlassBlur(px);
});

// 跟随系统模式：系统主题变化时自动切换
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const mode = localStorage.getItem(THEME_KEY) || 'system';
  if (mode === 'system') {
    applyTheme('system');
    renderHome();
  }
});

