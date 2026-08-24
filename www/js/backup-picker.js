/* 观己 · 备份任务面板共用视图（#177）
 * 结构与 backup-restore-card-panels-v2.html 的 A 方案一一对应：
 * 当前任务卡片 → 更早文件列表 → 固定底部操作区。
 * 业务层只负责文件数据、选择和按钮回调，本文件不改变数据流。
 */
(function () {
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[c]));
  }

  // 与最终原型保持同一组 20×20 线性图标路径，避免各面板各画一套近似图标。
  const ICONS = {
    file: '<path d="M5.5 2.8h5.2l3.8 3.8v10.6H5.5a1.4 1.4 0 0 1-1.4-1.4V4.2a1.4 1.4 0 0 1 1.4-1.4Z" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/><path d="M10.5 2.9v4h3.8M7.1 10h5.8M7.1 13h4.1" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/>',
    encrypted: '<rect x="4.2" y="8.3" width="11.6" height="8.6" rx="1.7" stroke="currentColor" stroke-width="1.45"/><path d="M6.7 8.1V6.4a3.3 3.3 0 0 1 6.6 0v1.7M10 11.3v2.5" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/>',
    csv: '<path d="M5.5 2.8h5.2l3.8 3.8v10.6H5.5a1.4 1.4 0 0 1-1.4-1.4V4.2a1.4 1.4 0 0 1 1.4-1.4Z" stroke="currentColor" stroke-width="1.45" stroke-linejoin="round"/><path d="M10.5 2.9v4h3.8M7 10h6M7 13h6" stroke="currentColor" stroke-width="1.35" stroke-linecap="round"/>',
    cloud: '<path d="M6.3 15.8h7.2a3.1 3.1 0 0 0 .4-6.2A4.5 4.5 0 0 0 5.2 8.3a3.8 3.8 0 0 0 1.1 7.5Z" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/>',
    import: '<path d="M10 3.1v8.1M6.8 8.2 10 11.4l3.2-3.2M4.3 12.6v2.1a1.5 1.5 0 0 0 1.5 1.5h8.4a1.5 1.5 0 0 0 1.5-1.5v-2.1" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/>',
    check: '<path d="m4.2 10.3 3.5 3.5 8.1-8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  };

  function icon(name, className) {
    const body = ICONS[name] || ICONS.file;
    const cls = className ? ` class="${escapeHtml(className)}"` : '';
    return `<svg${cls} viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  function defaultPrimary(file, index, opts) {
    if (!file) {
      return `<div class="primary-card"><div class="primary-line"><span class="file-icon">${icon('file')}</span><div class="primary-copy"><strong>尚未选择文件</strong><span>从本机文件列表中选择一份，或浏览其他位置</span></div><span class="badge">待选择</span></div><div class="primary-meta"><span>支持 <b>加密 JSON / CSV</b></span><span>导入规则 <b>合并去重</b></span></div></div>`;
    }
    const local = opts.task === 'local';
    const label = local && file.label === 'CSV 明文' ? '明文' : '可用';
    return `<div class="primary-card"><div class="primary-line"><span class="file-icon">${icon(file.icon || (local ? 'file' : 'encrypted'))}</span><div class="primary-copy"><strong>${local ? '当前选择文件' : '当前选择备份'}</strong><span>${escapeHtml(file.date || '')} · ${escapeHtml(file.name || '')}</span></div><span class="badge">${label}</span></div><div class="primary-meta"><span>类型 <b>${escapeHtml(file.label || '')}</b></span><span>${local ? '导入规则' : '大小'} <b>${local ? '合并去重' : escapeHtml(file.sizeLabel || '128 KB')}</b></span></div></div>`;
  }

  function defaultHistory(file, index, opts) {
    const active = opts.task === 'local' && index === opts.selectedIndex;
    const action = opts.task === 'manage'
      ? '<button class="select" type="button" data-download>下载</button>'
      : `<button class="select${active ? ' active' : ''}" type="button" data-select="${index}">${active ? '已选择' : '选择'}</button>`;
    return `<div class="history-row"><span class="file-icon">${icon(file.icon || (opts.task === 'local' ? 'file' : 'encrypted'))}</span><div class="history-copy"><strong>${escapeHtml(file.name || '')}</strong><span>${escapeHtml(file.date || '')} · ${escapeHtml(file.label || '')}</span></div>${action}</div>`;
  }

  function renderList(files, options) {
    const opts = options || {};
    const list = Array.isArray(files) ? files : [];
    const task = opts.task || 'server';
    const selectedIndex = Number.isInteger(opts.selectedIndex) ? opts.selectedIndex : null;
    const renderPrimary = typeof opts.renderPrimary === 'function' ? opts.renderPrimary : defaultPrimary;
    const renderHistory = typeof opts.renderHistory === 'function' ? opts.renderHistory : defaultHistory;
    if (!list.length) {
      if (task === 'local' && opts.showEmptyPrimary) {
        const title = opts.historyTitle || '本机文件';
        return `${renderPrimary(null, null, { ...opts, task })}<div class="section-label"><span>${escapeHtml(title)}</span><span>共 <strong>0</strong> 个</span></div><div class="history-list"><div class="backup-picker-empty"><span>暂无本机备份文件</span></div></div>`;
      }
      return `<div class="backup-picker-empty"><span>${escapeHtml(opts.emptyText || '暂无备份文件')}</span></div>`;
    }
    const primaryFile = selectedIndex == null ? null : list[selectedIndex] || null;
    const history = task === 'local'
      ? list.map((file, index) => ({ file, index }))
      : list.map((file, index) => ({ file, index })).filter((item) => item.index !== selectedIndex);
    const title = opts.historyTitle || (task === 'local' ? '本机文件' : '更早备份');
    // 外层 CSS 以约 3 行高度限制可见区；不截断数据，更多历史由列表内部滚动承接。
    const historyRows = history.map(({ file, index }) => renderHistory(file, index, { ...opts, task, selectedIndex })).join('');
    return `${renderPrimary(primaryFile, selectedIndex, { ...opts, task })}
      <div class="section-label"><span>${escapeHtml(title)}</span><span>共 <strong>${history.length}</strong> 个</span></div>
      <div class="history-list">${historyRows}</div>`;
  }

  window.backupPicker = { escapeHtml, icon, renderList, renderPrimary: defaultPrimary, renderHistory: defaultHistory };
})();
