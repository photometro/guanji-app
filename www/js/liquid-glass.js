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

