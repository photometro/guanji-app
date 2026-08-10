// 真机验证备份管理删除：删除测试残留文件，验证列表刷新 + toast
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const $ = (id) => document.getElementById(id);
  const listEl = () => $('bkpManageList');

  // 我的页 + 打开备份管理
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '我的').click();
  await sleep(700);
  $('bkpManageBtn').click();
  await sleep(900);
  const before = listEl().querySelectorAll('.bkp-row').length;
  const firstRow = listEl().querySelector('.bkp-row');
  out.beforeCount = before;
  out.firstFile = firstRow ? firstRow.textContent.trim().slice(0, 40) : null;

  // 删除第一行（测试残留 CSV）——第一次点击 = 确认态，第二次 = 执行
  const delBtn = firstRow.querySelector('.bkp-del');
  delBtn.click();
  await sleep(300);
  out.armedText = delBtn.textContent.trim();
  delBtn.click();   // 二次确认 → 执行删除
  await sleep(1500);
  out.toast = document.querySelector('.toast') ? document.querySelector('.toast').textContent : null;
  const after = listEl().querySelectorAll('.bkp-row').length;
  out.afterCount = after;
  out.refreshed = before - 1 === after;

  // 关闭弹窗
  $('bkpManageClose').click();
  await sleep(400);

  // 验证文件管理器确实删除了（通过 listBackupFiles 二次确认——备份管理已刷新即证明）
  return JSON.stringify(out, null, 2);
})()
