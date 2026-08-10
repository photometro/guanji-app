// 验证往返后 localStorage 记录完好（guans ji_records_v1）
(async () => {
  const raw = window.localStorage.getItem('guanji_records_v1');
  let list = null, parseErr = null;
  try { list = JSON.parse(raw); } catch (e) { parseErr = String(e); }
  return JSON.stringify({
    rawLen: raw ? raw.length : 0,
    isArray: Array.isArray(list),
    count: Array.isArray(list) ? list.length : -1,
    sample: Array.isArray(list) && list.length ? { id: list[0].id, offset: list[0].offset, dateKey: list[0].dateKey } : null,
    parseErr
  });
})()
