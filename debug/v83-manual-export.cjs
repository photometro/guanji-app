// 手动执行明文导出核心（CSV + writeFile EXTERNAL）
(async () => {
  const out = {};
  records = [{ id: 't1', offset: 0, time: '10:00', moods: ['平静'], triggers: ['工作'], duration: 10, media: false, note: '测试' }];
  try {
    const rows = [['日期', '时间', '时长(分)', '情绪', '诱因', '看片', '备注']];
    [...records].forEach((r) => {
      const d = dateWithOffset(r.offset);
      rows.push([`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`, r.time, r.duration || '', r.moods.join('|'), r.triggers.join('|'), r.media ? '是' : '否', r.note || '']);
    });
    const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    out.csvLen = csv.length;
    const fname = 'guanji-export-' + fmtDateKey(new Date()) + '.csv';
    const res = await Capacitor.Plugins.Filesystem.writeFile({ path: fname, data: csv, directory: 'EXTERNAL', encoding: 'UTF8' });
    out.writeOk = true;
    out.uri = res.uri;
    const stat = await Capacitor.Plugins.Filesystem.stat({ path: fname, directory: 'EXTERNAL' });
    out.size = stat.size;
  } catch (e) {
    out.err = String(e && e.message || e);
  }
  return JSON.stringify(out);
})();
