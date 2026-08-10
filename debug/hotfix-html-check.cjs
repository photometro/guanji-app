// 对比页面实际 HTML 尾部与文件（找解析差异）
(async () => {
  const out = {};
  const html = document.documentElement.outerHTML;
  out.pageLen = html.length;
  out.pageTail = html.slice(-400);
  out.hasAppJsTag = html.includes('app.js');
  out.hasBodyEnd = html.includes('</body>');
  out.hasHtmlEnd = html.includes('</html>');
  // 页面是否有 lg-distort SVG（v3.6 有，我们加了？）
  out.hasLgDistort = html.includes('lg-distort');
  // 检查关键元素存在性（app.js 首段绑定的元素）
  const ids = ['tabbar', 'recordBtn', 'moodChips', 'triggerChips', 'noteInput', 'chartSeg', 'todayNumVal'];
  out.ids = {};
  ids.forEach((i) => { out.ids[i] = !!document.getElementById(i); });
  return JSON.stringify(out);
})();
