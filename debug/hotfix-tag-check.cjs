// 检查 app.js script 标签 DOM 状态 + 执行状态
(async () => {
  const out = {};
  const tag = document.querySelector('script[src*="app.js"]');
  out.tagExists = !!tag;
  if (tag) {
    out.src = tag.src;
    out.type = tag.type || 'none';
    out.async = tag.async;
    out.defer = tag.defer;
  }
  out.allScripts = [...document.scripts].map((s) => s.src || '(inline)');
  out.readyState = document.readyState;
  // 尝试手动执行 app.js 找运行时错误
  try {
    const res = await fetch('app.js?v=61');
    const text = await res.text();
    try {
      new Function(text)();
      out.execOk = true;
    } catch (e) {
      out.execErr = String(e && e.message || e).slice(0, 300);
    }
  } catch (e) {
    out.fetchErr = String(e);
  }
  return JSON.stringify(out);
})();
