// 真机加密态往返验证：开启加密 → 校验加密态 → 关闭加密 → 校验恢复明文 + 记录数一致
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const before = window.localStorage.getItem('guanji_records') ? JSON.parse(window.localStorage.getItem('guanji_records')).length : -1;

  const fillAndConfirm = async (p1, p2) => {
    document.getElementById('secPass1').value = p1;
    document.getElementById('secPass2').value = p2;
    document.getElementById('secConfirm').click();
    await sleep(2500);   // PBKDF2 600k + 迁移 + UI 刷新
  };

  const snap = () => {
    const status = document.getElementById('secureStatus');
    const dot = status.querySelector('.sec-dot');
    return {
      mode: secureMode(),
      statusText: status.textContent,
      dotBg: dot ? getComputedStyle(dot).backgroundColor : null,
      statusOn: status.classList.contains('on'),
      enableHidden: document.getElementById('secureEnableBtn').classList.contains('hidden'),
      disableHidden: document.getElementById('secureDisableBtn').classList.contains('hidden'),
      actionsChildren: document.getElementById('secureActions').children.length
    };
  };

  // 1) 开启加密
  document.getElementById('secureEnableBtn').click();
  await sleep(400);
  await fillAndConfirm('v37-verify-pass-2026', 'v37-verify-pass-2026');
  const enc = snap();
  const encCount = secureMode() === 'encrypted'
    ? Object.keys(window.localStorage).filter((k) => k === 'guanji_records_enc_v1').length > 0 ? 'enc-key-present' : 'enc-key-missing'
    : 'enable-failed';

  // 2) 关闭加密（顶部大按钮）
  document.getElementById('secureDisableBtn').click();
  await sleep(400);
  await fillAndConfirm('v37-verify-pass-2026', 'v37-verify-pass-2026');
  const after = snap();
  const afterCount = window.localStorage.getItem('guanji_records') ? JSON.parse(window.localStorage.getItem('guanji_records')).length : -1;

  return JSON.stringify({ before, enc, encCount, after, afterCount, countIntact: before === afterCount && before >= 0 });
})()
