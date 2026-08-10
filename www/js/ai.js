// 观己 App · ai（P1 搬移式拆分，2026-08-09——函数原样搬移，零逻辑改动）
/* ---------- AI 分析（DeepSeek 真实接入） ---------- */

const AI_SYSTEM_PROMPT =
  '你是一位温和、非评判的健康习惯观察者。用户记录了自己手淫习惯的数据（频率、时段、情绪、诱因）。' +
  '你的任务是帮助用户理解自己的行为模式：态度平静温暖，绝不评判、绝不羞辱、绝不给道德压力，' +
  '不做医学诊断，不提供医疗建议。频率本身没有对错，重点是模式与觉察。' +
  '涉及情绪关联时，只描述数据中呈现的关联，不做因果断言，更不评判情绪本身。' +
  '用中文回答。';

const AI_JSON_INSTRUCTION =
  '\n\n请严格只返回以下 JSON（不要有任何其他文字、不要用 markdown 代码块）：\n' +
  '{"overview":"一句话概览（呼应近 7 天数据）","patterns":["模式1","模式2","模式3"],' +
  '"moodInsight":"情绪观察一句话（描述情绪与频率/诱因的关联，如「压力较大的日子频率略高，这只是观察，无关对错」；情绪数据不足时返回空字符串）",' +
  '"triggers":[{"name":"诱因名","pct":整数百分比}],"suggestions":["建议1（具体可执行）","建议2","建议3"]}';

function buildAggregatePayload() {
  const cur = countRange(-6, 0);
  const prev = countRange(-13, -7);
  const curRecs = records.filter((r) => r.offset >= -6 && r.offset <= 0);

  const bucketCount = {};
  curRecs.forEach((r) => {
    const h = hourOf(r);
    BUCKETS.forEach((b) => { if (b.test(h)) bucketCount[b.key] = (bucketCount[b.key] || 0) + 1; });
  });

  const trigCount = {};
  curRecs.forEach((r) => r.triggers.forEach((t) => { trigCount[t] = (trigCount[t] || 0) + 1; }));

  // 情绪分布 + 情绪×诱因组合（#16，只发聚合特征）
  const moodCount = {};
  const comboCount = {};
  curRecs.forEach((r) => {
    (r.moods || []).forEach((m) => { moodCount[m] = (moodCount[m] || 0) + 1; });
    (r.moods || []).forEach((m) => (r.triggers || []).forEach((t) => {
      const k = m + ' + ' + t;
      comboCount[k] = (comboCount[k] || 0) + 1;
    }));
  });
  const topCombos = Object.entries(comboCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k} ${v}次`);

  return {
    '近 7 天记录数': cur,
    '上 7 天记录数': prev,
    '日均': cur ? +(cur / 7).toFixed(1) : 0,
    '近 7 天时段分布': bucketCount,
    '近 7 天诱因分布': trigCount,
    '近 7 天情绪分布': moodCount,
    '情绪×诱因组合(前3)': topCombos,
    '连续记录天数': countStreak(),
    '近 7 天含看片的记录占比': curRecs.length ? Math.round(curRecs.filter((r) => r.media).length / curRecs.length * 100) : 0,
  };
}

/* ---------- AI 提供商配置（#27/#43：默认 DeepSeek，密钥按提供商分别保存） ---------- */

const AI_CONFIG_KEY = 'guanji_ai_config_v2';        // #43：per-provider 结构
const AI_CONFIG_KEY_V1 = 'guanji_ai_config_v1';     // 旧版单份配置（迁移用）
const AI_PROVIDERS = {
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  custom: { label: '自定义', baseUrl: '', model: '' },
};

/* 每个提供商的完整配置（默认值 + 用户填写，互不干扰） */
const DEFAULT_PROVIDERS = {
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', apiKey: '' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKey: '' },
  custom: { baseUrl: '', model: '', apiKey: '' },
};

/* per-provider 存储：{ providers: { deepseek: {...}, ... }, active: 'deepseek' } */
let aiStore = loadAIStore();

function loadAIStore() {
  try {
    const s = JSON.parse(localStorage.getItem(AI_CONFIG_KEY) || 'null');
    if (s && s.providers) {
      return { providers: { ...JSON.parse(JSON.stringify(DEFAULT_PROVIDERS)), ...s.providers }, active: s.active || 'deepseek' };
    }
  } catch { /* 损坏配置走迁移/默认 */ }
  // #43：v1 单份配置迁移（旧 key 归入原 provider）
  const providers = JSON.parse(JSON.stringify(DEFAULT_PROVIDERS));
  let active = 'deepseek';
  try {
    const v1 = JSON.parse(localStorage.getItem(AI_CONFIG_KEY_V1) || 'null');
    if (v1 && v1.baseUrl) {
      const p = v1.provider && providers[v1.provider] ? v1.provider : 'deepseek';
      providers[p] = { baseUrl: v1.baseUrl, model: v1.model || DEFAULT_PROVIDERS[p].model, apiKey: v1.apiKey || '' };
      active = p;
    }
  } catch { /* 忽略损坏 v1 */ }
  // 迁移：旧版独立 apiKey → deepseek
  if (!providers.deepseek.apiKey) providers.deepseek.apiKey = Storage.loadApiKey();
  const store = { providers, active };
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(store));   // 立即写 v2，后续直接读 v2
  return store;
}

function saveAIStore() {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(aiStore));
}

/* 同步 active 提供商的扁平视图（askAI/getDailyTip 等读取 aiConfig/apiKey） */
function syncActiveConfig() {
  aiConfig = { ...aiStore.providers[aiStore.active], provider: aiStore.active };
  apiKey = aiConfig.apiKey;
}

/* 保存当前 active 提供商配置（保存按钮调用） */
function saveAIConfig(cfg) {
  aiStore.providers[aiStore.active] = { baseUrl: cfg.baseUrl, model: cfg.model, apiKey: cfg.apiKey };
  saveAIStore();
  syncActiveConfig();
}

let aiConfig = { ...aiStore.providers[aiStore.active], provider: aiStore.active };
apiKey = aiConfig.apiKey;

/* OpenAI 兼容端点：Base URL 去尾斜杠 + /chat/completions */
function aiEndpoint(cfg) {
  return (cfg.baseUrl || '').replace(/\/+$/, '') + '/chat/completions';
}

async function askAI(userContent, signal) {
  const cfg = aiConfig;
  if (!cfg.apiKey) throw new Error('NO_KEY');
  if (!cfg.baseUrl || !cfg.model) throw new Error('NO_CONFIG');
  const res = await fetch(aiEndpoint(cfg), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: AI_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.7,
      max_tokens: 1200,
      stream: false,
    }),
    signal,
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('KEY_INVALID');
    throw new Error('API_ERROR');
  }
  const data = await res.json();
  const content = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  if (!content) throw new Error('API_EMPTY');
  return content;
}

/* 从 AI 回复中提取 JSON（容错：可能夹带说明文字） */
function extractJSON(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function renderAIReport(data) {
  const cur = countRange(-6, 0);
  const patterns = (data.patterns || []).map((p) => `
    <div class="pattern-row"><span class="p-bullet"></span><span>${esc(p)}</span></div>`).join('');
  const trigBars = (data.triggers || []).map((t) => `
    <div class="bar-row">
      <span class="bar-label">${esc(t.name || '')}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, t.pct || 0)}%"></div></div>
      <span class="bar-val">${t.pct || 0}%</span>
    </div>`).join('');
  const suggs = (data.suggestions || []).map((s, i) => `
    <div class="pattern-row"><span class="suggest-num">0${i + 1}</span><span>${esc(s)}</span></div>`).join('');
  // 情绪观察卡（#16）：AI 有返回才显示
  const moodCard = data.moodInsight ? `
    <div class="report-card">
      <span class="report-tag">情绪观察</span>
      <div class="report-body" style="margin-top:10px"><p>${esc(data.moodInsight)}</p></div>
    </div>` : '';

  $('analysisResult').innerHTML = `
    <div class="report-card">
      <span class="report-tag">近 7 天概览</span>
      <p class="overview-num">${cur}<small> 次 · 日均 ${(cur / 7).toFixed(1)} 次</small></p>
      <div class="report-body" style="margin-top:10px"><p>${esc(data.overview || '')}</p></div>
    </div>

    <div class="report-card">
      <span class="report-tag">模式识别</span>
      ${patterns || '<p class="report-body" style="color:var(--ink-2)">AI 没有返回模式分析。</p>'}
    </div>

    ${moodCard}

    <div class="report-card">
      <span class="report-tag">诱因分布</span>
      ${trigBars || '<p class="report-body" style="color:var(--ink-2)">暂无诱因数据。</p>'}
    </div>

    <div class="report-card">
      <span class="report-tag">温和建议</span>
      ${suggs || '<p class="report-body" style="color:var(--ink-2)">AI 没有返回建议。</p>'}
    </div>

    <p class="disclaimer">以上内容由 AI 基于聚合统计生成（仅上传每周次数、时段分布、情绪分布等特征，不含单条记录），仅作习惯参考，不构成医疗诊断或建议。如有持续困扰，建议与专业医生或心理咨询师聊聊。</p>
    <button class="btn-primary" id="regenBtn" style="width:100%;margin-bottom:16px">重新生成分析</button>`;

  const regen = document.getElementById('regenBtn');
  // 直接绑定事件对象：#39 让生成期间禁用按钮、结束后恢复（防重复点击）
  if (regen) regen.addEventListener('click', generateAnalysis);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function aiErrorToast(err) {
  if (err && err.message === 'NO_KEY') toast('请先在「我的 → AI 设置」填入 DeepSeek 密钥');
  else if (err && err.message === 'KEY_INVALID') toast('密钥无效，请检查后重试');
  else if (err && err.name === 'AbortError') toast('AI 响应超时，请稍后重试');
  else toast('AI 服务暂时不可用，请检查网络后重试');
}

/* 自动模式失败后展示给用户的错误说明 */
function aiErrorMessage(err) {
  if (err && err.message === 'KEY_INVALID') return '密钥无效，请检查「我的 → AI 设置」中的配置';
  if (err && err.name === 'AbortError') return '响应超时，请检查网络后重试';
  if (err && err.message === 'API_ERROR') return 'AI 服务暂时不可用，请稍后重试';
  return '发生未知错误，请稍后重试';
}

/* ---------- AI 分析：自动生成 + 指纹 + 重试 ---------- */

const REPORT_FP_KEY = 'guanji_report_fingerprint';
const RETRY_DELAYS = [2000, 4000, 8000];   // 自动重试退避（3 次）

/* 数据指纹：日期 + 记录数 + 最新 id + 全量内容摘要——数据未变则不重复调用；
   #38：摘要覆盖情绪/诱因/时长/看片等影响聚合的字段（note 不影响聚合特征，不参与），
   编辑记录内容后指纹变化 → 报告自动过期刷新（保证时效性与可信度） */
function reportFingerprint() {
  const latest = [...records].sort((a, b) => (b.offset - a.offset) || b.time.localeCompare(a.time))[0];
  const digest = records.map((r) =>
    `${r.offset}|${r.time}|${(r.moods || []).join(',')}|${(r.triggers || []).join(',')}|${r.duration || ''}|${r.media ? '1' : ''}`
  ).join(';');
  return JSON.stringify({ date: fmtDateInput(new Date()), count: records.length, latestId: latest ? latest.id : '', digest });
}

/* ---------- #38：报告过期检测 + 自动重生成 ---------- */

let analysisBusy = false;          // 生成中防重入
let reportRefreshTimer = null;     // 防抖定时器

/* 报告是否过期：已生成过（指纹存在）且当前数据指纹 ≠ 生成时指纹 */
function reportStale() {
  const fp = localStorage.getItem(REPORT_FP_KEY);
  return fp !== null && fp !== reportFingerprint();
}

/* 数据变更 → 分析页可见时防抖自动重生成（连续操作合并一次 AI 调用；不在分析页则交给切回时） */
function scheduleReportRefresh() {
  if (analysisBusy) return;
  const onAnalysis = !document.getElementById('screen-analysis').classList.contains('hidden');
  if (!onAnalysis) return;   // 用户不在分析页：不烧 API，切回时 maybeAutoGenerate 处理
  clearTimeout(reportRefreshTimer);
  reportRefreshTimer = setTimeout(() => {
    reportRefreshTimer = null;
    if (analysisBusy || !reportStale()) return;
    refreshReport();
  }, 1500);
}

/* 刷新：不清空旧报告，顶部提示条；成功替换（提示条随 innerHTML 重绘消失），失败保留旧报告 */
function refreshReport() {
  if (analysisBusy) return;
  // 与 generateAnalysis 前置条件一致：无 key/无数据时不触发，避免刷新条残留
  if (!records.length || !apiKey || countRange(-6, 0) < 3) return;
  analysisBusy = true;
  const bar = document.createElement('div');
  bar.className = 'report-refresh-bar';
  bar.textContent = '数据已更新，正在刷新分析…';
  $('analysisResult').prepend(bar);
  generateAnalysis(null, { auto: true, refresh: true });
}

function hideRefreshBar() {
  const bar = document.querySelector('.report-refresh-bar');
  if (bar) bar.remove();
}

function generateAnalysis(ev, opts) {
  const auto = !!(opts && opts.auto);
  const refresh = !!(opts && opts.refresh);   // #38：报告已存在时的自动刷新
  if (!records.length) { if (!auto) toast('还没有记录，先去记录一次吧'); return; }
  if (!apiKey) { if (!auto) toast('请先在「我的 → AI 设置」填入 DeepSeek 密钥'); return; }
  if (auto && countRange(-6, 0) < 3) return;   // 自动模式要求近 7 天 ≥3 条

  const btn = (ev && ev.currentTarget) ? ev.currentTarget : null;
  if (btn) btn.disabled = true;
  if (!refresh) {
    $('analysisEmpty').innerHTML = `
      <div class="loading-box">
        <div class="spinner"></div>
        <span>AI 正在读你的记录…</span>
      </div>`;
  }

  let succeeded = false;
  let rawContent = '';
  let attemptNo = 0;

  const runAttempt = () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    askAI(
      `以下是用户过去两周手淫习惯的聚合统计（注意：只有聚合数据，没有单条记录）：\n` +
      JSON.stringify(buildAggregatePayload(), null, 2) + AI_JSON_INSTRUCTION,
      controller.signal
    ).then((content) => {
      rawContent = content;
      const data = extractJSON(content);
      if (!data) throw new Error('PARSE_FAIL');
      renderAIReport(data);
      succeeded = true;
      localStorage.setItem(REPORT_FP_KEY, reportFingerprint());   // 成功后更新指纹
    }).catch((err) => {
      // 可重试：网络/超时/解析失败（密钥无效属配置问题，重试无意义；刷新模式不重试，避免多次调用）
      const retriable = err && (err.name === 'AbortError' || err.message === 'API_ERROR' || err.message === 'PARSE_FAIL');
      if (auto && !refresh && retriable && attemptNo < 3) {
        attemptNo++;
        $('analysisEmpty').innerHTML = `
          <div class="loading-box">
            <div class="spinner"></div>
            <span>AI 正在读你的记录…（重试 ${attemptNo}/3）</span>
          </div>`;
        setTimeout(runAttempt, RETRY_DELAYS[attemptNo - 1]);
        return;
      }
      if (err && err.message === 'PARSE_FAIL') {
        $('analysisResult').innerHTML = `
          <div class="report-card">
            <span class="report-tag">AI 回复</span>
            <div class="report-body"><p>${esc(rawContent)}</p></div>
          </div>
          <p class="disclaimer">以上内容由 AI 生成，仅作习惯参考，不构成医疗诊断或建议。</p>`;
        succeeded = true;
        localStorage.setItem(REPORT_FP_KEY, reportFingerprint());
        return;
      }
      if (refresh) {
        // #38：保留旧报告 + 温和提示，不打扰（不更新指纹，下次变更/进页仍会尝试）
        hideRefreshBar();
        toast('报告刷新失败，仍显示上次结果');
      } else if (auto) {
        // 自动模式 3 次全失败：把报错展示给用户
        toast('AI 生成失败，已自动重试 3 次');
        $('analysisEmpty').classList.remove('hidden');
        $('analysisEmpty').innerHTML = `
          <p class="empty-text">AI 生成失败，请稍后重试。<br>${aiErrorMessage(err)}</p>
          <button class="btn-primary" id="genBtn2">重新生成分析</button>`;
        bindGenBtn();
      } else {
        aiErrorToast(err);
        $('analysisEmpty').classList.remove('hidden');
        $('analysisEmpty').innerHTML = emptyStateHTML();
        bindGenBtn();
      }
    }).finally(() => {
      clearTimeout(timer);
      if (btn) btn.disabled = false;   // #39：失败/成功后恢复按钮（成功时旧按钮已脱离 DOM，无害）
      if (refresh) analysisBusy = false;   // #38：刷新结束复位防重入
      if (succeeded) {
        $('analysisEmpty').classList.add('hidden');
        $('analysisResult').classList.remove('hidden');
        $('askSection').classList.remove('hidden');
      }
    });
  };

  runAttempt();
}

/* 自动生成：切换至分析页时触发（#38：报告已存在但数据过期 → 也自动刷新，保证时效性） */
function maybeAutoGenerate() {
  if (!records.length || !apiKey || countRange(-6, 0) < 3) return;    // 前置条件
  if (!$('analysisResult').classList.contains('hidden')) {
    // 已有报告：数据过期则自动刷新（修改/删除记录后保证报告时效性与可信度）
    if (reportStale()) refreshReport();
    return;
  }
  if (localStorage.getItem(REPORT_FP_KEY) === reportFingerprint()) return;  // 数据未变
  generateAnalysis(null, { auto: true });
}

function emptyStateHTML() {
  return `
    <p class="empty-text">让 AI 看看你这段时间的节奏，<br>找出藏在数据里的模式。</p>
    <button class="btn-primary" id="genBtn2">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5v13M1.5 8h13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      生成近 7 天分析
    </button>`;
}

/* ---------- 追问（真实对话） ---------- */

const ASK_PRESETS = {
  '我的频率算高吗？': '用户问：「我的频率算高吗？」请基于聚合数据温和回应：医学上没有标准频率，重点是是否影响生活与自我感受。',
  '怎么减少深夜看片？': '用户问：「怎么减少深夜看片？」请给出温和、可执行的建议，不评判。',
  '压力大时怎么办？': '用户问：「压力大时怎么办？」请结合数据中压力相关诱因，给出温和建议。',
};

/* #19：追问回复结构约束——1 句回应 + 编号建议列表 + 温和收尾 */
const ASK_FORMAT_INSTRUCTION =
  '\n\n请严格按以下结构回复：\n' +
  '1) 第一行：1 句直接回应（不超过 40 字）\n' +
  '2) 接着给 2-4 条建议，每条单独一行，用 "1. " "2. " 编号开头（每条不超过 60 字）\n' +
  '3) 最后 1 句温和收尾（不超过 30 字）\n' +
  '关键词语可以用 **文字** 加粗（全文不超过 3 处）。';

/* #19：轻量 markdown 子集渲染（加粗 / 有序无序列表 / 分段），不引第三方库 */
function renderMarkdown(text) {
  const lines = String(text ?? '').split('\n');
  let html = '';
  let listTag = null;
  const closeList = () => { if (listTag) { html += `</${listTag}>`; listTag = null; } };
  const inline = (s) => s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    const ol = line.match(/^(\d+)[.、]\s*(.*)$/);
    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ol) {
      if (listTag !== 'ol') { closeList(); html += '<ol class="ask-list">'; listTag = 'ol'; }
      html += `<li>${inline(esc(ol[2]))}</li>`;
    } else if (ul) {
      if (listTag !== 'ul') { closeList(); html += '<ul class="ask-list">'; listTag = 'ul'; }
      html += `<li>${inline(esc(ul[1]))}</li>`;
    } else {
      closeList();
      html += `<p>${inline(esc(line))}</p>`;
    }
  }
  closeList();
  return html;
}

function askQuestion(q) {
  const ans = $('askAnswer');
  ans.innerHTML = `<p class="ask-q">${esc(q)}</p><p class="card-sub">正在思考…</p>`;
  ans.classList.remove('hidden');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  askAI(
    `以下是用户两周习惯的聚合统计：\n` + JSON.stringify(buildAggregatePayload(), null, 2) +
    `\n\n${ASK_PRESETS[q] || `用户问：「${q}」请温和回应。`}` + ASK_FORMAT_INSTRUCTION,
    controller.signal
  ).then((content) => {
    ans.innerHTML = `<p class="ask-q">${esc(q)}</p>` + renderMarkdown(content);
  }).catch((err) => {
    ans.innerHTML = `<p class="ask-q">${esc(q)}</p><p style="color:var(--ink-2)">${err && err.message === 'NO_KEY' ? '请先在「我的 → AI 设置」填入密钥' : 'AI 暂时不可用，稍后再试'}</p>`;
  }).finally(() => clearTimeout(timer));
}

/* ---------- 问候语（时间问候 + AI 健康提醒组合） ---------- */

const GREETINGS = {
  '清晨': ['清晨好，今天感觉如何？', '清晨好，新的一天，慢慢来。'],
  '上午': ['上午好，今天感觉如何？'],
  '下午': ['下午好，今天感觉如何？'],
  '傍晚': ['傍晚好，今天感觉如何？', '傍晚好，今天辛苦啦。'],
  '深夜': ['夜深了，今天感觉如何？', '夜深了，照顾好自己。'],
};

function getGreeting() {
  const h = new Date().getHours();
  const key = BUCKETS.find((b) => b.test(h)).key;
  const cands = GREETINGS[key];
  return cands[new Date().getDate() % cands.length];
}

/* 组合模式前缀：「下午好，今天感觉如何？」→「下午好。」（v1.7 拆层后不再使用） */

/* 每日 AI 提醒句：当日缓存，条件不满足或失败时返回空串（静默降级） */
let tipPending = false;

function getDailyTip() {
  return new Promise((resolve) => {
    const today = fmtDateInput(new Date());
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem('guanji_daily_tip') || 'null'); } catch { cached = null; }
    if (cached && cached.date === today && cached.tip) { resolve(cached.tip); return; }
    if (tipPending) { resolve(''); return; }
    if (!apiKey || countRange(-6, 0) < 3) { resolve(''); return; }

    tipPending = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    askAI(
      `以下是用户近 7 天记录习惯的聚合统计（只有聚合数据，没有单条记录）：\n` +
      JSON.stringify(buildAggregatePayload(), null, 2) +
      `\n\n请基于以上数据生成 1 句（不超过 20 字）温和的健康提醒，直接输出提醒内容` +
      `（如「今晚试试提前 30 分钟放下手机」）。` +
      `不要包含问候语、不要任何前缀、不要引号、不要评判、不要命令式口吻。`,
      controller.signal
    ).then((content) => {
      let tip = content.trim().replace(/^["「『]|["」』]$/g, '').trim();
      if (tip.length > 30) tip = tip.slice(0, 16) + '…';   // 兜底截断（方案 A 第二道保险）
      if (tip) localStorage.setItem('guanji_daily_tip', JSON.stringify({ date: today, tip }));
      resolve(tip || '');
    }).catch(() => resolve('')).finally(() => {
      clearTimeout(timer);
      tipPending = false;
    });
  });
}

/* 渲染问候语（v1.7 拆层）：标题固定一行时段问候，AI 提醒句渲染到下方小字，
   标题永不截断（≤13 字一行），提醒完整可见不丢失 */
function renderGreeting() {
  $('greetingTitle').textContent = getGreeting();
  getDailyTip().then((tip) => {
    const tipEl = $('greetingTip');
    if (tip) {
      tipEl.textContent = tip;
      tipEl.classList.remove('hidden');
    } else {
      tipEl.classList.add('hidden');
    }
  });
}

/* ---------- 温和正向反馈（#17：连续记录里程碑肯定，非戒断语境） ---------- */

const POSITIVE_KEY = 'guanji_positive';   // 默认开启，'0' 为关闭

const POSITIVE_MILESTONES = {
  30: ['30 天持续记录，这本身就是一种对自己的关注。', '整整一个月，你一直在认真观察自己。'],
  7: ['连续观察 7 天，你对自己更了解了。', '7 天的持续记录，是很温柔的坚持。'],
};

function positiveEnabled() {
  return localStorage.getItem(POSITIVE_KEY) !== '0';
}

/* 按日期确定性选文案（当天内稳定不闪变） */
function milestoneText(streak) {
  if (streak < 7) return '';
  const arr = streak >= 30 ? POSITIVE_MILESTONES[30] : POSITIVE_MILESTONES[7];
  return arr[new Date().getDate() % arr.length];
}

/* ---------- 每日记录提醒（#13：仅本机通知，默认关闭） ---------- */

const REMINDER_KEY = 'guanji_reminder';   // JSON { enabled, time }
const REMINDER_TEXT = [
  '今天感觉如何？想记录就记一下，不想也没关系。',
  '睡前留一分钟：今天有什么想记下的吗？',
  '记或不记，都由你决定。',
];

function isNativeApp() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

function loadReminder() {
  try {
    return JSON.parse(localStorage.getItem(REMINDER_KEY) || '{"enabled":false,"time":"21:00"}');
  } catch { return { enabled: false, time: '21:00' }; }
}
function saveReminder(s) {
  localStorage.setItem(REMINDER_KEY, JSON.stringify(s));
}

/* 调度/取消本地通知（浏览器环境静默跳过，只保存设置） */
async function applyReminderSchedule(s) {
  const LN = isNativeApp() ? window.Capacitor.Plugins.LocalNotifications : null;
  if (!LN) return;
  try {
    if (s.enabled) {
      const [h, m] = s.time.split(':').map(Number);
      const body = REMINDER_TEXT[new Date().getDate() % REMINDER_TEXT.length];
      await LN.schedule({
        notifications: [{
          id: 1,
          title: '观己',
          body,
          schedule: { on: { hour: h, minute: m }, allowWhileIdle: true },
          sound: null,
        }],
      });
    } else {
      await LN.cancel({ notifications: [{ id: 1 }] });
    }
  } catch (err) {
    console.warn('reminder schedule failed', err);
  }
}

/* 设置页 UI 回显 */
function initReminderUI() {
  const s = loadReminder();
  $('reminderSwitch').classList.toggle('on', s.enabled);
  $('reminderTimeRow').classList.toggle('hidden', !s.enabled);
  $('reminderTime').value = s.time;
}

