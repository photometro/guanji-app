// 检查 app.js 是否可加载 + 是否存在语法/运行时错误
(async () => {
  const out = {};
  try {
    const res = await fetch('app.js?v=61');
    out.status = res.status;
    const text = await res.text();
    out.len = text.length;
    out.head = text.slice(0, 120);
    // 尝试在页面执行 app.js 内容找错误（不改数据——先检查语法）
    try {
      new Function(text);
      out.parseOk = true;
    } catch (e) {
      out.parseErr = String(e && e.message || e).slice(0, 200);
    }
  } catch (e) {
    out.fetchErr = String(e);
  }
  return JSON.stringify(out);
})();
