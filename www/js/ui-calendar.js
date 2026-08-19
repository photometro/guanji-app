// 观己 App · ui-calendar（P1 搬移式拆分，2026-08-09——函数原样搬移，零逻辑改动）
/* ---------- 历史记录日历视图 ---------- */

let calMonthOffset = 0;   // 相对当前月的月份偏移
let calSelected = 0;      // 选中日的 offset（相对今天）

function openCalendar() {
  calMonthOffset = 0;
  calSelected = 0;
  resetSheetStyle($('calendarSheet'));
  $('calendarSheet').classList.remove('hidden');
  $('sheetBackdrop').classList.remove('hidden');
  renderCalendar();
}


function renderCalendar() {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + calMonthOffset, 1);
  const daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const firstWeekday = (target.getDay() + 6) % 7;   // 周一开始（周一=0）

  $('calTitle').textContent = `${target.getFullYear()}年${target.getMonth() + 1}月`;

  // 校准选中日：若当前选中不在本月，选今天（今天在本月时）或 1 号
  const selDate = dateWithOffset(calSelected);
  if (selDate.getFullYear() !== target.getFullYear() || selDate.getMonth() !== target.getMonth()) {
    const today = new Date();
    calSelected = (today.getFullYear() === target.getFullYear() && today.getMonth() === target.getMonth())
      ? 0 : dayDiff(target, new Date(now.getFullYear(), now.getMonth(), 1));
  }

  let cells = '';
  for (let i = 0; i < firstWeekday; i++) cells += '<span class="cal-cell empty"></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(target.getFullYear(), target.getMonth(), d);
    const off = dayDiff(date, now);
    const cnt = countRange(off, off);
    const isToday = off === 0;
    const isSel = off === calSelected;
    const isFuture = off > 0;   // #80：未来日期不可补记（灰显禁用）
    cells += `
      <button class="cal-cell${cnt > 0 ? ' has' : ''}${isToday ? ' today' : ''}${isSel ? ' sel' : ''}${isFuture ? ' future' : ''}" data-off="${off}" ${isFuture ? 'disabled' : ''}>
        <span class="cal-daynum">${d}</span>
        ${cnt > 0 ? `<span class="cal-badge">${cnt}</span>` : ''}
      </button>`;
  }
  $('calGrid').innerHTML = cells;

  renderCalDayDetail();
}

function renderCalDayDetail() {
  const dayRecs = records
    .filter((r) => r.offset === calSelected)
    .sort((a, b) => b.time.localeCompare(a.time));

  const d = dateWithOffset(calSelected);
  const title = dayRecs.length
    ? `${d.getMonth() + 1}月${d.getDate()}日 · ${dayRecs.length} 条记录`
    : `${d.getMonth() + 1}月${d.getDate()}日 · 这一天没有记录`;

  $('calDayDetail').innerHTML = `
    <p class="cal-detail-title">${title}</p>
    ${dayRecs.length ? dayRecs.map((r) => `
      <div class="recent-item">
        <div class="recent-main">
          <p class="recent-time">${r.time}</p>
          <p class="recent-tags">${displayRecordTags(r).join(' · ')}${r.duration ? ` · <b class="dur">${r.duration} 分钟</b>` : ''}</p>
        </div>
        <div class="recent-actions">
          <button class="recent-edit" data-id="${r.id}" title="编辑这条记录" aria-label="编辑">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2.6 11.4l.6-2.4 6-6a1.4 1.4 0 0 1 2 2l-6 6-2.6.4z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="recent-del" data-id="${r.id}" title="删除这条记录" aria-label="删除">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>`).join('') : '<p class="recent-empty">还没有记录，可以补记这一天的。</p>'}`;
}

// 日历事件
$('backfillBtn').addEventListener('click', openCalendar);
$('calClose').addEventListener('click', closeCalendar);
$('calPrev').addEventListener('click', () => { calMonthOffset--; renderCalendar(); });
$('calNext').addEventListener('click', () => { calMonthOffset++; renderCalendar(); });
$('calToday').addEventListener('click', () => { calMonthOffset = 0; calSelected = 0; renderCalendar(); });
$('calGrid').addEventListener('click', (e) => {
  const cell = e.target.closest('.cal-cell');
  if (!cell || !cell.dataset.off) return;
  calSelected = parseInt(cell.dataset.off, 10);
  renderCalendar();
});
$('calDayDetail').addEventListener('click', (e) => {
  const editBtn = e.target.closest('.recent-edit');
  if (editBtn) { openEditRecord(editBtn.dataset.id); return; }
  const btn = e.target.closest('.recent-del');
  if (!btn) return;
  records = records.filter((r) => r.id !== btn.dataset.id);
  Storage.saveRecords(records);
  afterRecordsChanged();
  toast('已删除这条记录');
  renderHome();
  renderCalendar();
});
$('calAddBtn').addEventListener('click', () => {
  closeCalendar();
  openSheet('backfill', dateWithOffset(calSelected));
});

