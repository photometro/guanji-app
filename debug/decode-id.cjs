// 解码记录 id 中的 base36 时间戳，验证旧数据绝对日期可恢复
function dec(id) {
  const t = id.split('_')[1];
  const ms = parseInt(t, 36);
  const d = new Date(ms);
  return d.toLocaleString('zh-CN', { hour12: false });
}
console.log('rec_mslz0x6d_onk23q →', dec('rec_mslz0x6d_onk23q'));
console.log('rec_msmhl5ay_kk2kht →', dec('rec_msmhl5ay_kk2kht'));
console.log('now →', new Date().toLocaleString('zh-CN', { hour12: false }));
