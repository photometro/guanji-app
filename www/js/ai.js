// 观己 App · ai（P1 搬移式拆分，2026-08-09——函数原样搬移，零逻辑改动）
/* ---------- AI 分析（DeepSeek 真实接入） ---------- */

const AI_SYSTEM_PROMPT =
  '你是一位温和、非评判的个人行为与习惯观察助手。你只能依据用户提供的聚合统计，帮助用户理解生活节奏与发生前情况的关联。' +
  '态度平静温暖：不评判、不羞辱、不施加道德压力，也不把频率或一次记录定义为成功、失败、正常或异常。' +
  '严格禁止生成露骨、刺激性或性技巧内容；不做医学或心理诊断、治疗建议、成瘾判定，也不替代紧急支持。' +
  '涉及情绪关联时，只描述数据中呈现的关联，不做因果断言；不要自行创造、修改或精确复述统计数字，数字以页面本地事实为准；变化观察统一使用“近 7 天”和“前 7 天”，不要使用“当前窗口”“上一窗口”等实现术语；建议必须可选、温和且不使用命令式语言。' +
  '若被要求越过以上边界，请简短说明你只能提供基于聚合数据的习惯观察，并建议在持续困扰时咨询合适的专业人士。用中文回答。';

const AI_JSON_INSTRUCTION =
  '\n\n请严格只返回以下 JSON（不要有任何其他文字、不要用 markdown 代码块）：\n' +
  '{"overview":"一句话概览（呼应当前时间窗口数据）","timeInsight":"时段观察一句话（只描述分布，不做因果断言）",' +
  '"labelInsights":{"状况 key":"对应观察"},"pairInsights":{"状况 key + 状况 key":"共同出现观察"},' +
  '"changeInsight":"近 7 天与前 7 天的变化观察（不要重复具体数字，不使用“窗口”术语）","patterns":["模式1","模式2"],' +
  '"moodInsight":"发生前状况观察一句话（兼容旧版字段，数据不足时返回空字符串）",' +
  '"suggestions":["建议1（具体可执行）","建议2","建议3"]}';

const insightWindowDays = 7; // 个人洞察固定近 7 天；首页长期趋势仍由首页统计独立计算
let insightAIData = null;
const INSIGHT_DISCLAIMER_TEXT = 'AI 观察基于近 7 天脱敏聚合统计生成（不上传单条记录、备注或附件），仅作习惯觉察参考，不构成医疗或心理诊断、治疗建议，也不代表因果结论。如持续困扰，建议咨询合适的专业人士。';

function insightWindowLabel() { return '近 7 天'; }

function renderInsightDisclaimer() {
  const el = $('insightDisclaimer');
  if (!el) return;
  const visible = !!insightAIData && (insightAIStatus === 'ready' || insightAIStatus === 'ready-stale');
  el.textContent = visible ? INSIGHT_DISCLAIMER_TEXT : '';
  el.classList.toggle('hidden', !visible);
  el.setAttribute('aria-hidden', String(!visible));
}

function buildAggregatePayload(days = 7) {
  const snapshot = buildInsightSnapshot({ days });
  const defaultLabels = snapshot.labels.filter((item) => !item.custom);
  const observationCount = Object.fromEntries(defaultLabels.map((item) => [item.label, item.count]));
  const observationPct = Object.fromEntries(defaultLabels.map((item) => [item.label, Math.round(item.ratio * 100)]));
  const adult = defaultLabels.find((item) => item.key === 'adult_content_effect');

  return {
    '时间窗口': `近 ${snapshot.days} 天`,
    '记录数': snapshot.recordCount,
    '覆盖天数': snapshot.coverageDays,
    '数据清晰度': snapshot.clarity.label,
    '数据清晰度依据': snapshot.clarity.reasons,
    [`近 ${snapshot.days} 天时段分布`]: snapshot.timeBuckets,
    [`近 ${snapshot.days} 天发生前状况分布（出现于记录次数）`]: observationCount,
    [`近 ${snapshot.days} 天发生前状况比例（百分比）`]: observationPct,
    [`近 ${snapshot.days} 天共同出现（前 3）`]: snapshot.cooccurrence.slice(0, 3),
    '上一窗口记录数': snapshot.previous.recordCount,
    '记录数变化': snapshot.changes.recordDelta,
    '记录数变化百分比': snapshot.changes.recordDeltaPct,
    '连续记录天数': countStreak(),
    '成人内容影响记录占比': adult ? Math.round(adult.ratio * 100) : 0,
    '发生前状况统计口径': '每条记录中出现的标签各计一次；标签可以并存，比例之和可能超过 100%，只表示伴随出现，不代表因果关系。',
    '隐私边界': '只发送默认标签的聚合 key、计数、比例、时间桶和窗口变化；不发送单条记录、备注、附件或自定义标签原文。',
  };
}

let insightAIStatus = 'idle';       // idle | loading | ready | ready-stale | error；成功状态由 insightAIData + 指纹判断
let insightCardActionsBound = false;

function insightValueText(value, limit = 2) {
  if (Array.isArray(value)) return value.filter(Boolean).slice(0, limit);
  if (value && typeof value === 'object') return Object.values(value).filter(Boolean).slice(0, limit);
  return value ? [value] : [];
}

function insightAIItems(value, limit = 2) {
  return insightValueText(value, limit)
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
}

function insightAIText(value, limit = 2) {
  return insightAIItems(value, limit).map((item) => `<p class="insight-ai-copy">${esc(item)}</p>`).join('');
}

function insightLocalFacts(snapshot) {
  const topTime = snapshot.changes && snapshot.changes.currentTopTime;
  const topLabel = snapshot.labels && snapshot.labels[0];
  const change = snapshot.changes && snapshot.changes.recordDelta;
  const timeFact = topTime
    ? `近 7 天记录较多出现在${esc(topTime.key)}，共 ${topTime.count} 次。`
    : '记录后，这里会显示近 7 天的时段分布。';
  const labelFact = topLabel
    ? `近 7 天较常见的发生前状况是「${esc(topLabel.label)}」，出现于 ${topLabel.count} 条记录。`
    : '记录发生前状况后，这里会显示伴随出现的状态。';
  const pairFact = snapshot.cooccurrence && snapshot.cooccurrence.length
    ? `近 7 天记录到 ${snapshot.cooccurrence.length} 组共同出现的状况组合。`
    : '记录更多后，这里会显示常见的共同出现组合。';
  const changeFact = snapshot.previous.recordCount
    ? `${change === 0 ? '与前 7 天相同' : change > 0 ? `比前 7 天多 ${change} 次` : `比前 7 天少 ${Math.abs(change)} 次`}。`
    : '前 7 天还没有记录，暂时无法比较。';
  return {
    overview: snapshot.recordCount
      ? `近 7 天记录 ${snapshot.recordCount} 次，覆盖 ${snapshot.coverageDays} 天；数据清晰度为“${esc(snapshot.clarity.label)}”。`
      : '近 7 天还没有记录，想记录时按自己的方式记下即可。',
    time: timeFact,
    labels: labelFact,
    pairs: pairFact,
    change: changeFact,
  };
}

function insightActionHTML(snapshot, aiFresh) {
  // AI 是整页洞察的一次性动作，不在六张卡片上重复放置相同按钮。
  if (insightAIStatus === 'loading') {
    return '<div class="insight-action-loading"><span class="spinner"></span><span>正在生成 AI 增强观察…</span></div>';
  }
  if (snapshot.recordCount < 3) {
    return '<p class="insight-action-note">记录更多后开始观察</p>';
  }
  if (!apiKey) {
    return '<button class="btn-primary insight-action-cta" type="button" data-insight-action="configure"><span>配置 AI</span></button>';
  }
  return '<button class="btn-primary insight-action-cta" type="button" data-insight-action="generate"><span>重新生成分析</span></button>';
}

function bindInsightCardActions() {
  const root = $('insightActionBar');
  if (!root || insightCardActionsBound) return;
  insightCardActionsBound = true;
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-insight-action]');
    if (!button || button.disabled) return;
    if (button.dataset.insightAction === 'configure') {
      focusAISettings();
    } else if (button.dataset.insightAction === 'generate') {
      generateAnalysis(null, { auto: false });
    }
  });
}

function insightLabelName(key) {
  const meta = typeof insightLabelMeta === 'function' ? insightLabelMeta(key) : null;
  return esc((meta && meta.label) || (typeof observationLabelFromValue === 'function' ? observationLabelFromValue(key) : key));
}

function insightTimeStrip(snapshot) {
  const entries = Object.entries(snapshot.timeBuckets || {});
  const max = Math.max(0, ...entries.map(([, count]) => count));
  const top = entries.filter(([, count]) => count === max && max > 0).map(([key]) => key);
  return `<div class="insight-time-strip" role="img" aria-label="近 7 天时段分布">${entries.map(([key, count]) => {
    const height = count ? Math.round(12 + count / Math.max(max, 1) * 34) : 8;
    return `<div class="insight-time-cell ${top.includes(key) ? 'is-peak' : ''}">
      <div class="insight-time-rail"><span style="--insight-time-height:${height}px"></span></div>
      <strong>${count}</strong><small>${esc(key)}</small>
    </div>`;
  }).join('')}</div>`;
}

function insightLabelChips(snapshot) {
  const labels = (snapshot.labels || []).slice(0, 3);
  if (!labels.length) return '<p class="insight-card-empty">还没有足够的发生前状况可供比较。</p>';
  return `<div class="insight-label-chips">${labels.map((item, index) => `<div class="insight-label-chip ${index === 0 ? 'is-top' : ''}">
    <span class="insight-chip-dot"></span><span>${insightLabelName(item.key)}</span><strong>${item.count}</strong>
  </div>`).join('')}</div>`;
}

function insightPairRows(snapshot) {
  const pairs = (snapshot.cooccurrence || []).slice(0, 2);
  if (!pairs.length) return '<p class="insight-card-empty">记录中出现多个状况后，这里会显示它们的共同出现。</p>';
  const remaining = Math.max(0, (snapshot.cooccurrence || []).length - pairs.length);
  const rows = pairs.map((item) => {
    const parts = String(item.pair || '').split(/\s+\+\s+|\s+·\s+/).filter(Boolean);
    const labels = parts.map((part) => `<span class="insight-pair-label">${insightLabelName(part)}</span>`).join('<i class="insight-pair-separator" aria-hidden="true">·</i>');
    return `<div class="insight-pair-row"><div class="insight-pair-expression">${labels}</div><strong>${item.count} 次</strong></div>`;
  }).join('');
  const more = remaining ? `<p class="insight-pair-more">还有 ${remaining} 组组合</p>` : '';
  return `<div class="insight-pair-list">${rows}</div>${more}`;
}

function insightChangeVisual(snapshot) {
  const delta = Number(snapshot.changes && snapshot.changes.recordDelta) || 0;
  const previous = snapshot.previous.recordCount || 0;
  const current = snapshot.recordCount || 0;
  const max = Math.max(previous, current, 1);
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const comparable = previous > 0;
  const deltaText = !comparable ? '暂时无法比较' : delta > 0 ? `比前 7 天多 ${delta} 次` : delta < 0 ? `比前 7 天少 ${Math.abs(delta)} 次` : '与前 7 天相同';
  const caption = !comparable
    ? '前 7 天还没有记录，先积累一些数据再比较。'
    : '这里只比较记录数量，不代表好坏。';
  return `<div class="insight-change-compare" data-insight-compare>
    <div><span>近 7 天</span><i><b style="--insight-compare-width:${Math.round(current / max * 100)}%"></b></i><strong>${current} 次</strong></div>
    <div><span>前 7 天</span><i><b style="--insight-compare-width:${Math.round(previous / max * 100)}%"></b></i><strong>${previous} 次</strong></div>
  </div>
  <div class="insight-change-result ${direction}">
    <strong>${deltaText}</strong>
    <p>${caption}</p>
  </div>`;
}

function insightSuggestionsLocalItems(snapshot) {
  const topTime = snapshot.changes && snapshot.changes.currentTopTime;
  const topLabel = snapshot.labels && snapshot.labels[0];
  const suggestions = [];
  if (topTime) suggestions.push(`在${topTime.key}前，给自己留一小段缓冲时间。`);
  if (topLabel) suggestions.push(`下次记录时继续标记「${topLabel.label}」是否同时出现。`);
  suggestions.push('只选择一个最容易做到的小调整，观察几天再决定是否继续。');
  return suggestions;
}

function insightSuggestionKey(value) {
  return String(value || '').toLowerCase().replace(/[\s，。、“”‘’「」！？：:；;（）()、·]+/g, '');
}

function insightSuggestionsHTML(snapshot, aiValue, aiVisible) {
  const localItems = insightSuggestionsLocalItems(snapshot).map((text) => ({ text, source: 'local' }));
  const aiItems = aiVisible ? insightAIItems(aiValue, 3).map((text) => ({ text, source: 'ai' })) : [];
  const ordered = aiVisible ? [...aiItems, ...localItems] : localItems;
  const seen = new Set();
  const items = ordered.filter((item) => {
    const key = insightSuggestionKey(item.text);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 3);
  if (!items.length) return '<p class="insight-card-empty">记录更多后，这里会显示可以尝试的小调整。</p>';
  return `<ol class="insight-suggestion-list">${items.map((item, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span><p>${item.source === 'ai' ? '<small class="insight-suggestion-source">AI 建议</small>' : ''}${esc(item.text)}</p></li>`).join('')}</ol>`;
}

function insightAIBlock(aiValue) {
  const items = insightAIItems(aiValue, 2);
  if (!items.length) return '';
  return `<div class="insight-card-ai" data-insight-ai>
    <p class="insight-ai-lead"><span class="insight-ai-source">AI 观察</span><span class="insight-ai-copy">${esc(items[0])}</span></p>
    ${items.slice(1).map((item) => `<p class="insight-ai-copy">${esc(item)}</p>`).join('')}
  </div>`;
}

function insightNarrativeHTML(fact, aiValue, aiVisible) {
  const ai = aiVisible ? insightAIBlock(aiValue) : '';
  const evidence = fact ? `<p class="insight-card-fact">${fact}</p>` : '';
  return `<div class="insight-card-narrative ${ai ? 'has-ai' : ''}">${ai}${evidence}</div>`;
}

function insightCardBodyHTML(key, snapshot, fact, aiValue, aiVisible) {
  const body = {
    overview: `<div class="insight-overview-metrics"><div><strong>${snapshot.recordCount}</strong><span>次记录</span></div><div><strong>${snapshot.coverageDays}</strong><span>天有记录</span></div><em>${esc(snapshot.clarity.label)}</em></div>`,
    time: insightTimeStrip(snapshot),
    labels: insightLabelChips(snapshot),
    pairs: insightPairRows(snapshot),
    change: insightChangeVisual(snapshot),
    suggestions: insightSuggestionsHTML(snapshot, aiValue, aiVisible),
  }[key];
  const narrative = key === 'suggestions'
    ? ''
    : ['overview', 'change'].includes(key)
      ? (aiVisible ? insightNarrativeHTML('', aiValue, true) : '')
      : insightNarrativeHTML(fact, aiValue, aiVisible);
  return `<div class="insight-card-body insight-card-body--${key}">${narrative}${body}</div>`;
}

function renderInsightAction(snapshot, aiFresh) {
  const bar = $('insightActionBar');
  const content = $('insightActionContent');
  if (!bar || !content) return;
  bar.classList.remove('hidden');
  bar.classList.toggle('is-loading', insightAIStatus === 'loading');
  bar.dataset.insightState = insightAIStatus;
  bar.classList.toggle('is-stale', insightAIStatus === 'ready-stale');
  const title = bar.querySelector('.insight-action-title');
  if (title) {
    title.textContent = insightAIStatus === 'ready-stale'
      ? '数据有更新，上次 AI 观察已过期，可以重新生成。'
      : insightAIStatus === 'error'
        ? 'AI 观察暂时没有生成，可以稍后重试。'
        : '基于近 7 天聚合数据，在每张卡片中补充一段可选的温和观察。';
  }
  content.innerHTML = insightActionHTML(snapshot, aiFresh);
  renderInsightDisclaimer();
}

function renderInsightLocal() {
  const cardsEl = $('insightCards');
  if (!cardsEl || typeof buildInsightSnapshot !== 'function') return;
  bindInsightCardActions();
  const snapshot = buildInsightSnapshot({ days: 7 });
  const facts = insightLocalFacts(snapshot);
  const aiVisible = !!insightAIData && (insightAIStatus === 'ready' || insightAIStatus === 'ready-stale');
  const aiFresh = aiVisible && insightAIStatus === 'ready' && !reportStale();
  const aiValue = (key) => aiVisible ? insightAIData[key] : null;
  cardsEl.dataset.insightMode = aiVisible ? 'ai' : 'local';
  const cards = [
    ['overview', '整体观察', '整体概览', facts.overview, aiValue('overview')],
    ['time', '时段观察', '时段分布', facts.time, aiValue('timeInsight')],
    ['labels', '状况观察', '发生前状况', facts.labels, aiValue('labelInsights') || aiValue('moodInsight')],
    ['pairs', '关联观察', '共同出现', facts.pairs, aiValue('pairInsights') || aiValue('patterns')],
    ['change', '变化观察', '变化观察', facts.change, aiValue('changeInsight')],
    ['suggestions', '可选建议', '可以试试', '', aiValue('suggestions')],
  ];
  cardsEl.innerHTML = cards.map(([key, tag, title, fact, aiCopy]) => `
    <section class="report-card insight-report-card insight-card-${key}" data-insight-card="${key}">
      <span class="report-tag">${tag}</span>
      <h2 class="report-title">${title}</h2>
      ${insightCardBodyHTML(key, snapshot, fact, aiCopy, aiVisible)}
    </section>`).join('');
  renderInsightAction(snapshot, aiFresh);
  updateInsightActionState();
}

function setInsightWindowDays(days) {
  renderInsightLocal();
}

function setInsightButtonLabel(button, label) {
  if (!button) return;
  const textNodes = [...button.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE);
  if (textNodes.length) textNodes[textNodes.length - 1].textContent = `\n          ${label}\n        `;
  else button.textContent = label;
}

function updateInsightActionState() {
  const label = !apiKey
    ? '配置 AI 获得增强洞察'
    : (insightAIData && !reportStale() ? '重新生成 AI 增强洞察' : (reportStale() ? '更新 AI 增强洞察' : '生成 AI 增强洞察'));
  ['genBtn', 'genBtn2', 'regenBtn'].forEach((id) => setInsightButtonLabel($(id), label));
}

/* ---------- AI 提供商配置（#27/#43：默认 DeepSeek，密钥按提供商分别保存） ---------- */

const AI_CONFIG_KEY = 'guanji_ai_config_v2';        // #43：per-provider 结构
const AI_CONFIG_KEY_V1 = 'guanji_ai_config_v1';     // 旧版单份配置（迁移用）
const AI_PROVIDERS = {
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  custom: { label: '自定义', baseUrl: '', model: '' },
};

/* 每个提供商的完整配置（默认值 + 用户填写，互不干扰） */
const DEFAULT_PROVIDERS = {
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash', apiKey: '' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKey: '' },
  custom: { baseUrl: '', model: '', apiKey: '' },
};

/* per-provider 存储：{ providers: { deepseek: {...}, ... }, active: 'deepseek' } */
let aiStore = loadAIStore();

function loadAIStore() {
  try {
    const s = JSON.parse(localStorage.getItem(AI_CONFIG_KEY) || 'null');
    if (s && s.providers) {
      const providers = JSON.parse(JSON.stringify(DEFAULT_PROVIDERS));
      Object.keys(s.providers).forEach((key) => {
        providers[key] = { ...(providers[key] || {}), ...(s.providers[key] || {}) };
      });
      // 内置服务商缺失 Base URL 时恢复官方默认地址；自定义服务商继续保留空值。
      ['deepseek', 'openai'].forEach((key) => {
        if (!providers[key].baseUrl) providers[key].baseUrl = DEFAULT_PROVIDERS[key].baseUrl;
      });
      return { providers, active: s.active || 'deepseek' };
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

const AI_BOUNDARY_REPLY = '观己只能基于聚合数据提供温和的习惯观察，不提供露骨内容、医疗或心理诊断，也不会作羞耻化评价。';

function violatesAIOutputBoundary(content) {
  const text = String(content || '').replace(/\s+/g, ' ');
  return [
    /(?:露骨|色情).{0,24}(?:描述|细节|技巧|步骤)/i,
    /(?:怎样|怎么|如何).{0,24}(?:更刺激|更爽|性技巧|自慰技巧)/i,
    /(?:确诊|诊断为|患有).{0,30}(?:疾病|障碍|成瘾|心理)/i,
    /(?:羞耻|堕落|失败者|自制力差|肮脏|不正常)/i,
  ].some((rule) => rule.test(text));
}

function questionNeedsAIBoundary(question) {
  const text = String(question || '').replace(/\s+/g, ' ');
  return [
    /(?:露骨|色情).{0,24}(?:描述|细节|技巧|步骤)/i,
    /(?:怎样|怎么|如何).{0,24}(?:自慰|手淫|性行为).{0,24}(?:刺激|高潮|技巧|方法)/i,
    /(?:请|帮我|能否).{0,20}(?:诊断|确诊|治疗).{0,30}(?:疾病|障碍|成瘾|心理)/i,
  ].some((rule) => rule.test(text));
}

function renderAIReport(data) {
  insightAIData = {
    ...data,
    labelInsights: data.labelInsights || (data.moodInsight ? [data.moodInsight] : []),
    pairInsights: data.pairInsights || (Array.isArray(data.patterns) ? data.patterns : []),
    changeInsight: data.changeInsight || '',
  };
  insightAIStatus = 'ready';
  renderInsightLocal();
  const result = $('analysisResult');
  if (result) result.innerHTML = '';
  const ask = $('askSection');
  if (ask) ask.classList.remove('hidden');
  updateInsightActionState();
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
   #38：摘要覆盖情绪/诱因/时长/相关影响等聚合字段（note 不影响聚合特征，不参与），
   编辑记录内容后指纹变化 → 报告自动过期刷新（保证时效性与可信度） */
function reportFingerprint() {
  const latest = [...records].sort((a, b) => (b.offset - a.offset) || b.time.localeCompare(a.time))[0];
  const digest = records.map((r) =>
     `${r.offset}|${r.time}|${recordObservationValues(r).join(',')}|${(r.moods || []).join(',')}|${(r.triggers || []).join(',')}|${r.duration || ''}|${r.media ? '1' : ''}`
  ).join(';');
  return JSON.stringify({ date: fmtDateInput(new Date()), window: 7, layout: 'ai-card-v1', count: records.length, latestId: latest ? latest.id : '', digest });
}

/* ---------- #147：报告过期检测 + 旧版自动触发 ---------- */

let analysisBusy = false;          // 生成中防重入
let reportRefreshTimer = null;     // 页面可见时记录变更的 1.5 秒防抖

/* 报告是否过期：已生成过（指纹存在）且当前数据指纹 ≠ 生成时指纹 */
function reportStale() {
  const fp = localStorage.getItem(REPORT_FP_KEY);
  return fp !== null && fp !== reportFingerprint();
}

function insightReportInMemory() {
  return !!insightAIData && localStorage.getItem(REPORT_FP_KEY) !== null;
}

/* 数据变更：先刷新六张轻量卡片；洞察页可见时沿用旧版防抖自动刷新。 */
function scheduleReportRefresh() {
  if (typeof renderInsightLocal === 'function') renderInsightLocal();
  if (analysisBusy) return;
  const screen = $('screen-analysis');
  const onAnalysis = screen && !screen.classList.contains('hidden');
  if (!onAnalysis) return;   // 不在洞察页：下次进入时 maybeAutoGenerate 处理
  clearTimeout(reportRefreshTimer);
  reportRefreshTimer = setTimeout(() => {
    reportRefreshTimer = null;
    if (analysisBusy || !apiKey || countRange(-6, 0) < 3) return;
    const hasReport = insightReportInMemory();
    if (hasReport && !reportStale()) return;
    generateAnalysis(null, { auto: true, refresh: hasReport });
  }, 1500);
}

/* 兼容旧调用名：刷新沿用统一请求，不创建独立 AI 报告区。 */
function refreshReport() {
  if (analysisBusy) return;
  if (!records.length || !apiKey || countRange(-6, 0) < 3) return;
  generateAnalysis(null, { auto: true, refresh: true });
}

function hideRefreshBar() {
  const bar = document.querySelector('.report-refresh-bar');
  if (bar) bar.remove();
}

function generateAnalysis(ev, opts) {
  const auto = !!(opts && opts.auto);
  const refresh = !!(opts && opts.refresh);   // #38：报告已存在时的自动刷新
  if (analysisBusy) return;
  if (!records.length) { if (!auto) toast('还没有记录，先去记录一次吧'); return; }
  if (!apiKey) { if (!auto) focusAISettings(); return; }
  if (auto && countRange(-6, 0) < 3) return;   // 自动模式要求近 7 天 ≥3 条

  const btn = (ev && ev.currentTarget) ? ev.currentTarget : null;
  if (btn) btn.disabled = true;
  analysisBusy = true;
  insightAIStatus = 'loading';
  renderInsightLocal();

  let succeeded = false;
  let attemptNo = 0;
  let retryScheduled = false;

  const runAttempt = () => {
    retryScheduled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    askAI(
      `以下是用户${insightWindowLabel()}个人行为与习惯的聚合统计（注意：只有聚合数据，没有单条记录、备注、附件或自定义标签原文）：\n` +
      JSON.stringify(buildAggregatePayload(7), null, 2) + AI_JSON_INSTRUCTION,
      controller.signal
    ).then((content) => {
      const data = extractJSON(content);
      if (!data) throw new Error('PARSE_FAIL');
      if (violatesAIOutputBoundary(JSON.stringify(data))) throw new Error('UNSAFE_OUTPUT');
      localStorage.setItem(REPORT_FP_KEY, reportFingerprint());   // 成功后更新指纹
      renderAIReport(data);
      succeeded = true;
    }).catch((err) => {
      // 可重试：网络/超时/解析失败（密钥无效属配置问题，重试无意义；刷新模式不重试，避免多次调用）
      const retriable = err && (err.name === 'AbortError' || err.message === 'API_ERROR' || err.message === 'PARSE_FAIL');
      if (auto && !refresh && retriable && attemptNo < 3) {
        attemptNo++;
        retryScheduled = true;
        insightAIStatus = 'loading';
        renderInsightLocal();
        setTimeout(runAttempt, RETRY_DELAYS[attemptNo - 1]);
        return;
      }
      if (refresh) {
        // #38：保留旧报告；若有旧数据则以过期状态继续显示，并保留更新入口
        hideRefreshBar();
        insightAIStatus = insightAIData ? 'ready-stale' : 'error';
        renderInsightLocal();
        toast('报告刷新失败，仍显示上次结果');
      } else if (auto) {
        // 自动模式 3 次全失败：卡片内保留重试入口
        toast(err && err.message === 'UNSAFE_OUTPUT' ? 'AI 回复未通过内容边界校验，请稍后重试' : 'AI 生成失败，已自动重试 3 次');
        insightAIStatus = 'error';
        renderInsightLocal();
      } else {
        aiErrorToast(err);
        insightAIStatus = 'error';
        renderInsightLocal();
      }
    }).finally(() => {
      clearTimeout(timer);
      if (btn) btn.disabled = false;   // #39：失败/成功后恢复按钮（成功时旧按钮已脱离 DOM，无害）
      if (!retryScheduled) analysisBusy = false;
    });
  };

  runAttempt();
}

/* 切换至洞察页时自动检查：Key + 近 7 天至少 3 条 + 报告缺失/过期。 */
function maybeAutoGenerate() {
  renderInsightLocal();
  if (analysisBusy || !records.length || !apiKey || countRange(-6, 0) < 3) return;
  const hasReport = insightReportInMemory();
  if (hasReport && !reportStale()) return;
  generateAnalysis(null, { auto: true, refresh: hasReport });
}

function emptyStateHTML() {
  return `
    <p class="empty-text">基础洞察无需 AI 即可查看。<br>如果你愿意，可以生成一段 AI 增强观察。</p>
    <button class="btn-primary" id="genBtn2">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5v13M1.5 8h13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      生成 AI 增强洞察
    </button>`;
}

function focusAISettings() {
  const meTab = document.querySelector('.tab[data-screen="me"]');
  if (meTab) meTab.click();
  const input = $('apiKeyInput');
  if (input) {
    input.focus();
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  toast('AI 是可选增强功能，填入 API Key 后即可生成增强洞察');
}

/* ---------- 追问（真实对话） ---------- */

const ASK_PRESETS = {
  '我的频率算高吗？': '用户问：「我的频率算高吗？」请基于聚合数据温和回应：医学上没有标准频率，重点是是否影响生活与自我感受。',
  '深夜容易受成人内容影响，怎么办？': '用户问：「深夜容易受成人内容影响，怎么办？」请给出温和、可选、可执行的生活节奏建议，不评判。',
  '压力大时怎么办？': '用户问：「压力大时怎么办？」请结合数据中压力相关诱因，给出温和建议。',
};

/* #19：追问回复结构约束——1 句回应 + 编号建议列表 + 温和收尾 */
const ASK_FORMAT_INSTRUCTION =
  '\n\n请严格按以下结构回复：\n' +
  '1) 第一行：1 句直接回应（不超过 40 字）\n' +
  '2) 接着给 2-4 条建议，每条单独一行，用 "1. " "2. " 编号开头（每条不超过 60 字）\n' +
  '3) 最后 1 句温和收尾（不超过 30 字）\n' +
  '关键词语可以用 **文字** 加粗（全文不超过 3 处）。\n' +
  '不得包含露骨或刺激性内容、医学/心理诊断、羞耻化或道德评判；建议使用“可以尝试”等可选表达。';

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
  if (questionNeedsAIBoundary(q)) {
    ans.innerHTML = `<p class="ask-q">${esc(q)}</p><p style="color:var(--ink-2)">${AI_BOUNDARY_REPLY}</p>`;
    ans.classList.remove('hidden');
    return;
  }
  ans.innerHTML = `<p class="ask-q">${esc(q)}</p><p class="card-sub">正在思考…</p>`;
  ans.classList.remove('hidden');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  askAI(
    `以下是用户${insightWindowLabel()}个人行为与习惯的聚合统计（不含单条记录、备注、附件或自定义标签原文）：\n` + JSON.stringify(buildAggregatePayload(7), null, 2) +
    `\n\n${ASK_PRESETS[q] || `用户问：「${q}」请温和回应。`}` + ASK_FORMAT_INSTRUCTION,
    controller.signal
  ).then((content) => {
    if (violatesAIOutputBoundary(content)) throw new Error('UNSAFE_OUTPUT');
    ans.innerHTML = `<p class="ask-q">${esc(q)}</p>` + renderMarkdown(content);
  }).catch((err) => {
    const message = err && err.message === 'NO_KEY'
      ? '请先在「我的 → AI 设置」填入密钥'
      : err && err.message === 'UNSAFE_OUTPUT' ? AI_BOUNDARY_REPLY : 'AI 暂时不可用，稍后再试';
    ans.innerHTML = `<p class="ask-q">${esc(q)}</p><p style="color:var(--ink-2)">${message}</p>`;
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

/* 每日话语：基础版本地生成；AI 仅作为用户主动开启的增强。 */
const AI_DAILY_TIP_KEY = 'guanji_ai_daily_tip_enabled';
const DAILY_TIP_VISIBLE_KEY = 'guanji_daily_tip_visible_v1';
const AI_DAILY_TIP_MIGRATION_KEY = 'guanji_ai_daily_tip_migration_v1';
let tipPending = false;

/* #163：每日话语是首页体验开关；无 AI 时仍可使用本地话语。默认开启以保持旧用户体验。 */
function dailyTipEnabled() {
  return localStorage.getItem(DAILY_TIP_VISIBLE_KEY) !== '0';
}

function setDailyTipEnabled(enabled) {
  localStorage.setItem(DAILY_TIP_VISIBLE_KEY, enabled ? '1' : '0');
  if (typeof renderAIDailyTipSetting === 'function') renderAIDailyTipSetting();
}

/* 旧 key 继续表示 AI 增强偏好；新用户配置 AI 后默认获得增强，旧用户显式关闭则尊重原选择。 */
function aiDailyTipEnabled() {
  const legacyChoice = localStorage.getItem(AI_DAILY_TIP_KEY);
  return legacyChoice === null ? !!apiKey : legacyChoice === '1';
}

function setAIDailyTipEnabled(enabled) {
  localStorage.setItem(AI_DAILY_TIP_KEY, enabled ? '1' : '0');
  localStorage.setItem(AI_DAILY_TIP_MIGRATION_KEY, '1');
  renderAIDailyTipSetting();
}

function shouldShowAIDailyTipMigration() {
  if (localStorage.getItem(AI_DAILY_TIP_KEY) !== null || localStorage.getItem(AI_DAILY_TIP_MIGRATION_KEY) === '1') return false;
  let hasLegacyTip = false;
  try { hasLegacyTip = !!JSON.parse(localStorage.getItem('guanji_daily_tip') || 'null'); } catch { hasLegacyTip = false; }
  return !!(apiKey || hasLegacyTip);
}

function renderAIDailyTipSetting() {
  const sw = $('aiDailyTipSwitch');
  if (sw) sw.classList.toggle('on', dailyTipEnabled());
  const prompt = $('aiDailyTipMigration');
  if (prompt) prompt.classList.toggle('hidden', !shouldShowAIDailyTipMigration());
}

function getLocalDailyTip(snapshot) {
  const safe = snapshot || buildInsightSnapshot({ days: 7 });
  if (!safe.recordCount) return '按自己的节奏来，记录本身就是一种观察。';
  const topTime = safe.changes && safe.changes.currentTopTime;
  const topLabel = safe.labels && safe.labels[0];
  const templates = [
    topTime ? `最近记录多出现在${topTime.key}，可以留意这个时间段的安排。` : '今天可以留意一下自己的生活节奏。',
    topLabel ? `最近较常见的发生前状况是「${topLabel.label}」，先观察，不急着下结论。` : '每一次记录都在帮你更了解自己的节奏。',
    safe.coverageDays > 1 ? `近 7 天覆盖了 ${safe.coverageDays} 天，慢慢积累就能看见自己的模式。` : '今天先记下一次感受，给未来的自己留个线索。',
  ];
  return templates[new Date().getDate() % templates.length];
}

function getDailyTip() {
  return new Promise((resolve) => {
    if (!dailyTipEnabled()) { resolve(''); return; }
    const today = fmtDateInput(new Date());
    const localTip = getLocalDailyTip(buildInsightSnapshot({ days: 7 }));
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem('guanji_daily_tip') || 'null'); } catch { cached = null; }
    const explicitChoice = localStorage.getItem(AI_DAILY_TIP_KEY);
    if (cached && cached.date === today && cached.tip && explicitChoice === null) { resolve(cached.tip); return; }
    if (!aiDailyTipEnabled() || tipPending || !apiKey || countRange(-6, 0) < 3) { resolve(localTip); return; }

    tipPending = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    askAI(
      `以下是用户近 7 天个人行为与习惯的聚合统计（只有聚合数据，没有单条记录或备注）：\n` +
      JSON.stringify(buildAggregatePayload(7), null, 2) +
      `\n\n请基于以上数据生成 1 句（不超过 20 字）温和的健康提醒，直接输出提醒内容` +
      `（如「今晚试试提前 30 分钟放下手机」）。` +
      `不要包含问候语、不要任何前缀、不要引号、不要评判、不要命令式口吻。`,
      controller.signal
    ).then((content) => {
      let tip = content.trim().replace(/^["「『]|["」』]$/g, '').trim();
      if (violatesAIOutputBoundary(tip)) tip = '';
      if (tip.length > 30) tip = tip.slice(0, 16) + '…';   // 兜底截断（方案 A 第二道保险）
      if (tip) localStorage.setItem('guanji_daily_tip', JSON.stringify({ date: today, tip }));
      resolve(tip || localTip);
    }).catch(() => resolve(localTip)).finally(() => {
      clearTimeout(timer);
      tipPending = false;
    });
  });
}

/* 渲染问候语（v1.7 拆层）：标题固定一行时段问候，AI 提醒句渲染到下方小字，
   标题永不截断（≤13 字一行），提醒完整可见不丢失 */
function renderGreeting() {
  $('greetingTitle').textContent = getGreeting();
  const tipEl = $('greetingTip');
  if (!dailyTipEnabled()) {
    tipEl.textContent = '';
    tipEl.classList.add('hidden');
    return;
  }
  getDailyTip().then((tip) => {
    if (!dailyTipEnabled()) { tipEl.textContent = ''; tipEl.classList.add('hidden'); return; }
    tipEl.textContent = tip || getLocalDailyTip(buildInsightSnapshot({ days: 7 }));
    tipEl.classList.remove('hidden');
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

