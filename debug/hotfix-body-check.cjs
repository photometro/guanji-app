// 查看页面 body 实际结构（找 textarea 来源）
(async () => {
  const out = {};
  out.bodyChildren = [...document.body.children].map((c) => c.tagName + '.' + (c.className || '').slice(0, 30));
  const textareas = [...document.querySelectorAll('textarea')];
  out.textareaCount = textareas.length;
  if (textareas.length) {
    const ta = textareas[0];
    out.taClass = ta.className;
    out.taId = ta.id;
    out.taLen = ta.value ? ta.value.length : 0;
    out.taStart = ta.value ? ta.value.slice(0, 100) : '';
    out.taParent = ta.parentElement ? ta.parentElement.tagName + '.' + ta.parentElement.className.slice(0, 30) : null;
  }
  out.hasMain = !!document.querySelector('main');
  out.mainChildren = document.querySelector('main') ? [...document.querySelector('main').children].map((c) => c.tagName + '.' + (c.className || '').slice(0, 25)) : null;
  return JSON.stringify(out);
})();
