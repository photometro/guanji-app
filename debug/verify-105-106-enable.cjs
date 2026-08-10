// 开启加密（供截图），保持加密态
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  document.getElementById('secureEnableBtn').click();
  await sleep(400);
  document.getElementById('secPass1').value = 'v37-verify-pass-2026';
  document.getElementById('secPass2').value = 'v37-verify-pass-2026';
  document.getElementById('secConfirm').click();
  await sleep(2500);
  return JSON.stringify({ mode: secureMode() });
})()
