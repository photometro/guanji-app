// 真机验证 #113：滑块默认 3 + 拖动实时生效 + 持久化 + 0 无磨砂
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  const html = document.documentElement;
  const slider = document.getElementById('glassBlurSlider');
  const tabbarBlur = () => getComputedStyle(document.querySelector('.tabbar')).backdropFilter || getComputedStyle(document.querySelector('.tabbar')).webkitBackdropFilter;

  // 我的页（玻璃当前 off——滑块应存在且可调）
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim() === '我的').click();
  await sleep(700);
  out.sliderExists = !!slider;
  out.defaultVal = slider ? slider.value : null;
  out.defaultValText = document.getElementById('glassBlurVal') ? document.getElementById('glassBlurVal').textContent : null;
  out.glass = html.classList.contains('liquid-glass');

  // 开玻璃 → 默认 3
  if (!html.classList.contains('liquid-glass')) {
    document.getElementById('liquidGlassSwitch').click();
    await sleep(700);
  }
  out.glassOn = html.classList.contains('liquid-glass');
  out.blurDefault3 = tabbarBlur();

  // 拖到 7 → 实时
  slider.value = 7;
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(500);
  out.blur7 = { tabbar: tabbarBlur(), inline: html.style.getPropertyValue('--lg-blur'), stored: localStorage.getItem('guanji_glass_blur') };

  // 拖到 0 → 无磨砂
  slider.value = 0;
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(500);
  out.blur0 = { tabbar: tabbarBlur(), inline: html.style.getPropertyValue('--lg-blur') };

  // 还原为默认 3（清除设置）
  slider.value = 3;
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(500);
  out.restored = { tabbar: tabbarBlur(), inline: html.style.getPropertyValue('--lg-blur'), stored: localStorage.getItem('guanji_glass_blur') };

  // 还原玻璃 off（用户原状）
  if (html.classList.contains('liquid-glass')) {
    document.getElementById('liquidGlassSwitch').click();
    await sleep(500);
  }
  out.glassRestored = !html.classList.contains('liquid-glass');
  return JSON.stringify(out, null, 2);
})()
