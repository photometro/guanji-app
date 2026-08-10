// v85 验证：#99 label 关联 + #100 文案
(async () => {
  const out = {};
  document.querySelector('.tab[data-screen="me"]')?.click();
  await new Promise((r) => setTimeout(r, 300));
  // #99：label 与 input 关联
  const label = document.getElementById('secImportFileLabel');
  const input = document.getElementById('secImportFile');
  out.labelFor = label ? label.getAttribute('for') : null;
  out.inputId = input ? input.id : null;
  out.linked = label && input && label.getAttribute('for') === input.id;
  // #100：导入弹窗打开文案
  document.getElementById('secureImportBtn')?.click();
  await new Promise((r) => setTimeout(r, 200));
  out.importInfo = document.getElementById('secImportInfo').textContent.slice(0, 60);
  out.importPlaceholder = document.getElementById('secImportPass').placeholder;
  out.title = document.querySelector('#secImportBackdrop .dialog-title').textContent;
  document.getElementById('secImportCancel')?.click();
  return JSON.stringify(out);
})();
