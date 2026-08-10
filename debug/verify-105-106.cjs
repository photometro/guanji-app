// 真机验证 #105/#106：读取数据卡当前状态（明文或加密）的结构与 computed style
(() => {
  const status = document.getElementById('secureStatus');
  const enable = document.getElementById('secureEnableBtn');
  const disable = document.getElementById('secureDisableBtn');
  const actions = document.getElementById('secureActions');
  if (!status || !enable || !disable) return JSON.stringify({ error: 'elements-missing' });
  const dot = status.querySelector('.sec-dot');
  const enc = window.secureMode ? secureMode() === 'encrypted' : null;
  return JSON.stringify({
    version: (document.querySelector('.about-ver') || {}).textContent,
    mode: enc,
    statusText: status.textContent,
    dotBg: dot ? getComputedStyle(dot).backgroundColor : null,
    statusColor: getComputedStyle(status).color,
    statusOn: status.classList.contains('on'),
    enableHidden: enable.classList.contains('hidden'),
    enableMarginBottom: getComputedStyle(enable).marginBottom,
    disableHidden: disable.classList.contains('hidden'),
    disableClass: disable.className,
    disableMarginBottom: getComputedStyle(disable).marginBottom,
    actionsChildren: actions.children.length,
    actionsText: Array.from(actions.querySelectorAll('.row-btn span')).map((s) => s.textContent)
  });
})()
