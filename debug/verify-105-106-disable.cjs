// 关闭加密，恢复设备为明文原状
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  document.getElementById('secureDisableBtn').click();
  await sleep(400);
  document.getElementById('secPass1').value = 'v37-verify-pass-2026';
  document.getElementById('secPass2').value = 'v37-verify-pass-2026';
  document.getElementById('secConfirm').click();
  await sleep(2500);
  const raw = window.localStorage.getItem('guanji_records_v1');
  let count = -1;
  try { count = JSON.parse(raw).length; } catch (e) {}
  return JSON.stringify({ mode: secureMode(), count, statusOn: document.getElementById('secureStatus').classList.contains('on') });
})()
