// 测量 month-summary 溢出量 + 各段宽度（确定修复幅度）
(async () => {
  const out = {};
  records = buildDemoRecords();
  renderHome();
  const ms = document.getElementById('monthSummary');
  const items = [...ms.children];
  out.msClientW = ms.clientWidth;
  out.msScrollW = ms.scrollWidth;
  out.overflowPx = ms.scrollWidth - ms.clientWidth;
  out.items = items.map((el) => {
    const b = el.getBoundingClientRect();
    return { cls: el.className, text: el.textContent.trim().replace(/\s+/g, ' '), w: Math.round(b.width) };
  });
  // 各文本实际渲染宽度（span 内容）
  out.itemScroll = items.map((el) => ({ cls: el.className, scrollW: el.scrollWidth, clientW: el.clientWidth }));
  // delta 文案缩略后的宽度估算
  const test = document.createElement('span');
  test.style.cssText = 'position:absolute;visibility:hidden;font-size:12px;white-space:nowrap;';
  document.body.appendChild(test);
  const measure = (t) => { test.textContent = t; return Math.round(test.getBoundingClientRect().width); };
  out.widths = {
    '本月 10 次 · 日均 1.0': measure('本月 10 次 · 日均 1.0'),
    '较上月 +67%': measure('较上月 +67%'),
    '较上月+67%': measure('较上月+67%'),
    '↑ 67%': measure('↑ 67%'),
    '较上月↑67%': measure('较上月↑67%'),
  };
  test.remove();
  return JSON.stringify(out);
})();
