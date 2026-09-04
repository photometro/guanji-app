// 观己 App · storage（P1 搬移式拆分，2026-08-09——函数原样搬移，零逻辑改动）
﻿/* ============================================================
   观己 · 正式版逻辑
   本地持久化（localStorage，WebView 私有存储）· DeepSeek AI
   ============================================================ */

const $ = (id) => document.getElementById(id);

/* #185：所有新生成的观己文件使用同一套可读命名；旧文件只读不迁移。 */
function buildGuanjiFilename(type, extension = 'json', date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const safeType = String(type || 'secure').replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'secure';
  const ext = String(extension || 'json').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'json';
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  return `guanji-${safeType}-${stamp}.${ext}`;
}

/* 本机同秒导出不覆盖已有文件；浏览器降级路径用本地已生成名集合兜底。 */
async function uniqueGuanjiFilename(type, extension = 'json', date = new Date()) {
  const base = buildGuanjiFilename(type, extension, date);
  let names = [];
  try {
    if (window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.GuanjiSave) {
      const listed = await Capacitor.Plugins.GuanjiSave.listBackupFiles();
      names = Array.isArray(listed && listed.files) ? listed.files : [];
    }
  } catch { /* 列表失败不阻断导出 */ }
  if (!names.includes(base)) return base;
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  for (let i = 2; i <= 99; i += 1) {
    const candidate = `${stem}-${i}${ext}`;
    if (!names.includes(candidate)) return candidate;
  }
  return `${stem}-${Date.now().toString(36)}${ext}`;
}

// 供跨脚本模块（以及原生调试桥）显式复用，避免 WebView 全局词法环境差异。
window.buildGuanjiFilename = buildGuanjiFilename;
window.uniqueGuanjiFilename = uniqueGuanjiFilename;

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MOODS = ['平静', '放松', '愉悦', '无聊', '焦虑', '压力'];
/* #196：统计服务共享的时间基础。原始记录仍保存在 WebView；这些工具只负责
   严格识别日期、保存 IANA 时区和把可信时间戳格式化为统计日期。 */
const STATS_TIMEZONE_KEY = 'guanji_stats_timezone_v1';
const STATS_REVISION_KEY = 'guanji_stats_revision_v1';
const STATS_SCHEMA_VERSION = 2;
const STATS_RULE_VERSION = '3.60';
/* #198：同一统计时区复用格式化器，避免按记录/日期重复创建 Intl 实例。 */
const STATS_DATE_FORMATTER_CACHE = new Map();

function systemTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'; } catch { return 'local'; }
}

function isValidDateKey(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!m) return false;
  const y = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
  if (y < 1970 || y > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(y, month - 1, day);
  return d.getFullYear() === y && d.getMonth() === month - 1 && d.getDate() === day;
}

function dateKeyFromDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateKeyFromTimestamp(timestamp, zoneId = systemTimeZone()) {
  const ms = Number(timestamp);
  if (!Number.isFinite(ms) || ms < 0 || ms > 4102444800000) return '';
  try {
    const cacheKey = zoneId || 'local';
    let formatter = STATS_DATE_FORMATTER_CACHE.get(cacheKey);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: cacheKey === 'local' ? undefined : cacheKey,
        year: 'numeric', month: '2-digit', day: '2-digit',
      });
      STATS_DATE_FORMATTER_CACHE.set(cacheKey, formatter);
    }
    const parts = formatter.formatToParts(new Date(ms));
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const key = `${map.year}-${map.month}-${map.day}`;
    return isValidDateKey(key) ? key : '';
  } catch {
    return dateKeyFromDate(new Date(ms));
  }
}

function preferredStatsTimeZone() {
  let stored = '';
  try { stored = localStorage.getItem(STATS_TIMEZONE_KEY) || ''; } catch { stored = ''; }
  const current = systemTimeZone();
  if (!stored) {
    try { localStorage.setItem(STATS_TIMEZONE_KEY, current); } catch { /* 只读环境 */ }
    return current;
  }
  if (stored !== current) {
    /* 统计时区变化不改写原始记录；采用新的系统时区并给出一次非阻塞提示。 */
    try { localStorage.setItem(STATS_TIMEZONE_KEY, current); } catch { /* 只读环境 */ }
    if (!window.__guanjiTimezoneNoticeShown) {
      window.__guanjiTimezoneNoticeShown = true;
      setTimeout(() => { if (typeof toast === 'function') toast('检测到时区变化，统计已按当前时区更新'); }, 0);
    }
    return current;
  }
  return stored;
}

window.isValidDateKey = isValidDateKey;
window.dateKeyFromTimestamp = dateKeyFromTimestamp;
window.preferredStatsTimeZone = preferredStatsTimeZone;
// v3.18：新记录采用中性、明确的命名；旧记录和旧 CSV 保持原始值不改写。
const ADULT_CONTENT_TRIGGER = '成人内容影响';
const LEGACY_ADULT_CONTENT_TRIGGER = '看了片';
const TRIGGERS = ['压力大', '睡不着', '睡前习惯', '无聊', ADULT_CONTENT_TRIGGER, '无特别诱因'];

/* #132/#137/#133A：两套记录入口共用的单一觉察标签。
   新记录保存稳定 key；label 仅用于展示，旧 moods/triggers/显示文案通过 alias 兼容，不批量改写。 */
const OBSERVATION_OPTIONS = [
  { key: 'boredom', label: '无聊', section: 'primary', dimension: 'state', order: 1 },
  { key: 'stress', label: '压力', section: 'primary', dimension: 'state', order: 2 },
  { key: 'anxiety', label: '焦虑', section: 'primary', dimension: 'state', order: 3 },
  { key: 'solitude', label: '一个人', section: 'primary', dimension: 'context', order: 4 },
  { key: 'bedtime_habit', label: '睡前时段', section: 'primary', dimension: 'time', order: 5 },
  { key: 'adult_content_effect', label: ADULT_CONTENT_TRIGGER, section: 'primary', dimension: 'content', order: 6 },
  { key: 'loneliness', label: '缺少陪伴', section: 'more', dimension: 'state', order: 7 },
  { key: 'insomnia', label: '睡不着', section: 'more', dimension: 'sleep', order: 8 },
  { key: 'none', label: '没有明显情绪/诱因', section: 'more', dimension: 'state', marker: 'none', order: 9, exclusive: true },
  { key: 'unsure', label: '原因不确定', section: 'more', dimension: 'uncertainty', marker: 'uncertainty', order: 10 },
  // #144：补齐低落、烦躁、精力、自动性与放松动机维度；新标签只作为前置状况自报，不代表确定原因。
  { key: 'low_mood', label: '低落', section: 'more', dimension: 'state', order: 11 },
  { key: 'irritability', label: '烦躁', section: 'more', dimension: 'state', order: 12 },
  { key: 'fatigue', label: '疲惫', section: 'more', dimension: 'body', order: 13 },
  { key: 'automatic_habit', label: '顺手就做了', section: 'more', dimension: 'habit', order: 14 },
  { key: 'relief_motive', label: '想放松一下', section: 'more', dimension: 'motivation', order: 15 },
];
const OBSERVATION_BY_KEY = Object.fromEntries(OBSERVATION_OPTIONS.map((o) => [o.key, o.label]));
const OBSERVATION_KEY_BY_LABEL = {
  '无聊': 'boredom',
  '压力': 'stress',
  '压力大': 'stress',
  '焦虑': 'anxiety',
  '孤独': 'loneliness',
  '缺少陪伴': 'loneliness',
  '睡不着': 'insomnia',
  '独处': 'solitude',
  '一个人': 'solitude',
  '睡前习惯': 'bedtime_habit',
  '睡前时段': 'bedtime_habit',
  [ADULT_CONTENT_TRIGGER]: 'adult_content_effect',
  [LEGACY_ADULT_CONTENT_TRIGGER]: 'adult_content_effect',
  '无特别情况': 'none',
  '无特别诱因': 'none',
  '没有明显情绪/诱因': 'none',
  '正常': 'none',
  '说不清': 'unsure',
  '不确定': 'unsure',
  '原因不确定': 'unsure',
  // #144：允许研究/认知访谈中的同义显示文案回填为稳定 key。
  '情绪低落': 'low_mood',
  '低落': 'low_mood',
  '烦躁': 'irritability',
  '生气': 'irritability',
  '烦躁/生气': 'irritability',
  '疲惫': 'fatigue',
  '精力不足': 'fatigue',
  '疲惫/精力不足': 'fatigue',
  '顺手就做了': 'automatic_habit',
  '习惯性': 'automatic_habit',
  '习惯性/不自觉': 'automatic_habit',
  '想放松一下': 'relief_motive',
};

function observationKeyFromValue(value) {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (!text) return '';
  if (OBSERVATION_BY_KEY[text]) return text;
  if (OBSERVATION_KEY_BY_LABEL[text]) return OBSERVATION_KEY_BY_LABEL[text];
  if (text.indexOf('custom:') === 0 || text.indexOf('legacy:') === 0) return text;
  return `legacy:${text}`;
}

function observationLabelFromValue(value) {
  const key = observationKeyFromValue(value);
  if (!key) return '';
  if (OBSERVATION_BY_KEY[key]) return OBSERVATION_BY_KEY[key];
  if (key.indexOf('custom:') === 0 || key.indexOf('legacy:') === 0) return key.slice(key.indexOf(':') + 1);
  return String(value);
}

function isAdultContentObservation(value) {
  return observationKeyFromValue(value) === 'adult_content_effect';
}

function observationMetaFromKey(value) {
  const key = observationKeyFromValue(value);
  return OBSERVATION_OPTIONS.find((option) => option.key === key) || null;
}

/* #138/#186：稳定 key 兼容读取；普通标签多选，确定性标记按自身维度处理。 */
function normalizeObservationValues(values) {
  const list = Array.isArray(values) ? values : (values ? [values] : []);
  const out = [];
  list.forEach((value) => {
    const key = observationKeyFromValue(value);
    if (!key) return;
    const meta = observationMetaFromKey(key);
    if (key === 'none') {
      // “没有明显情绪/诱因”只与状态维度互斥；时间、环境和“不确定”仍可并存。
      for (let i = out.length - 1; i >= 0; i -= 1) {
        const existing = observationMetaFromKey(out[i]);
        if (existing && existing.dimension === 'state' && out[i] !== 'none') out.splice(i, 1);
      }
    } else if (meta && meta.dimension === 'state') {
      const noneIndex = out.indexOf('none');
      if (noneIndex >= 0) out.splice(noneIndex, 1);
    }
    if (!out.includes(key)) {
      out.push(key);
    }
  });
  return out;
}

/* 用于 UI 与统计的维度判断；未知旧/自定义标签保持普通多选。 */
function observationDimension(value) {
  const meta = observationMetaFromKey(value);
  return meta ? meta.dimension : 'custom';
}

/* 读取优先级：observations（v3.22）→ observation（v3.20 单值）→ 旧 moods/triggers。 */
function recordObservationValues(record) {
  if (!record) return [];
  let values;
  if (Array.isArray(record.observations)) values = normalizeObservationValues(record.observations);
  else if (record.observation) values = normalizeObservationValues(record.observation);
  else values = normalizeObservationValues([...(record.triggers || []), ...(record.moods || [])]);
  // 旧记录仅有 media=true 时，保留“成人内容影响”的历史语义；新数组也不覆盖这一明确标记。
  if (record.media && !values.some(isAdultContentObservation)) {
    // media=true 是旧版“成人内容影响”的明确语义；若旧标签为“无特别情况”，以该历史事实优先。
    values = values.includes('none') ? ['adult_content_effect'] : [...values, 'adult_content_effect'];
  }
  return normalizeObservationValues(values);
}

function recordObservationValue(record) {
  return recordObservationValues(record)[0] || '';
}

function recordObservationLabels(record) {
  return recordObservationValues(record).map(observationLabelFromValue).filter(Boolean);
}

function recordObservationLabel(record) {
  return recordObservationLabels(record)[0] || '';
}

function recordHasAdultContentObservation(record) {
  return recordObservationValues(record).some(isAdultContentObservation);
}

function isAdultContentTrigger(value) {
  return value === ADULT_CONTENT_TRIGGER || value === LEGACY_ADULT_CONTENT_TRIGGER;
}

// 仅用于展示和聚合：存储层仍保留旧记录的原始诱因，确保导入/导出可逆。
function displayTrigger(value) {
  return isAdultContentTrigger(value) ? ADULT_CONTENT_TRIGGER : value;
}

function displayRecordTags(record) {
  if (record && (Array.isArray(record.observations) || record.observation)) {
    return recordObservationLabels(record);
  }
  const triggers = (record.triggers || []).map(displayTrigger);
  const hasAdultContentTrigger = (record.triggers || []).some(isAdultContentTrigger);
  const tags = [...(record.moods || []), ...triggers];
  if (record.media && !hasAdultContentTrigger) tags.push(ADULT_CONTENT_TRIGGER);
  return tags;
}
const BUCKETS = [
  { key: '清晨', test: (h) => h >= 6 && h < 9 },
  { key: '上午', test: (h) => h >= 9 && h < 12 },
  { key: '下午', test: (h) => h >= 12 && h < 18 },
  { key: '傍晚', test: (h) => h >= 18 && h < 22 },
  { key: '深夜', test: (h) => h >= 22 || h < 6 },
];

/* ---------- 本地存储（数据只存在这台设备） ---------- */

const Storage = {
  KEY_RECORDS: 'guanji_records_v1',
  KEY_API: 'guanji_api_key_v1',

  /* #93：加载记录（加密模式走 secure.js 解密；明文模式原逻辑） */
  loadRecords() {
    return secureLoadRecords();
  },
  /* #93：保存记录（加密模式走 secure.js 加密——异步执行不阻塞调用点，失败记日志；内存 records 始终保真） */
  saveRecords(list) {
    secureSaveRecords(list).catch((e) => console.error('[secure] save failed', e));
  },
  loadApiKey() {
    return localStorage.getItem(this.KEY_API) || '';
  },
  saveApiKey(key) {
    localStorage.setItem(this.KEY_API, key);
  },
};

/* #211 N8：统一数据接口（仅收口调用契约，不迁移底层数据）。
   records/config 继续委托现有 Storage 与 AI 配置函数，保留旧 localStorage
   键、加密路径、JSON/CSV 导入导出；stats 只返回 StatsSnapshot，不直接接触存储。
   后续原生适配层只需实现同一组方法即可，不要求一次性改动所有调用方。 */
const GuanjiDataStore = Object.freeze({
  contractVersion: 1,
  records: Object.freeze({
    load: () => Storage.loadRecords(),
    save: (list) => Storage.saveRecords(list),
  }),
  stats: Object.freeze({
    snapshot: (options) => (typeof buildStatsSnapshot === 'function' ? buildStatsSnapshot(options) : null),
  }),
  config: Object.freeze({
    loadAI: () => (typeof loadAIStore === 'function' ? loadAIStore() : null),
    saveAI: (config) => (typeof saveAIConfig === 'function' ? saveAIConfig(config) : false),
    read: (key, fallback = null) => {
      try { const value = localStorage.getItem(String(key)); return value == null ? fallback : value; } catch { return fallback; }
    },
    write: (key, value) => {
      try { localStorage.setItem(String(key), String(value)); return true; } catch { return false; }
    },
  }),
});
window.GuanjiDataStore = GuanjiDataStore;

let records = [];
let apiKey = '';

function newRecordId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ---------- 演示数据（「恢复演示数据」用） ---------- */

/* 演示数据 v2（2026-08-10）：30 天窗口，覆盖全部功能测试点——
   - 热力图 4 档色阶全出现（0 / 1-2 / 3-5 / 6+：含 6 次深蓝日）
   - 最近 7 天连续有记录（连续里程碑 + 周统计对比）
   - 跨月（月末生成时本月 vs 上月都有数据，月度对比可测）
   - 全时段分布（深夜主导 + 傍晚/下午，SLOT_HOUR 轮换） */
const DEMO_DAILY = [
  1, 0, 2, 3, 1, 0, 4, 2, 1, 3,     // -29..-20
  0, 2, 5, 1, 3, 2, 0, 4, 1, 2,     // -19..-10
  3, 1, 0, 2, 6, 3, 2, 4, 2, 2,     // -9..0（-4 为 6 次深蓝日；-6..0 连续 7 天）
];

/* 确定性伪随机：同一索引每次结果一致 */
function seeded(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/* 预置记录的时段模式：保证深夜时段主导（18 条，含清晨——时段分布 5 段全可测） */
const TIME_PATTERN = [
  '深夜', '深夜', '傍晚', '深夜', '深夜', '傍晚', '深夜', '下午', '深夜',
  '深夜', '傍晚', '深夜', '下午', '深夜', '深夜', '傍晚', '深夜', '清晨',
];
const SLOT_HOUR = { '深夜': [22, 23, 0, 1], '傍晚': [19, 20, 21], '下午': [13, 14, 15, 16], '清晨': [7, 8] };

/* 演示备注样例（约 1/4 记录带备注，测试明细/导出/报告内容） */
const DEMO_NOTES = [
  '睡前刷手机，没控制住',
  '今天压力有点大',
  '和对象聊完天之后',
  '午休没睡着',
  '',
  '',
  '',
  '周末比较放松',
];

function buildDemoRecords() {
  const list = [];
  let seq = 0;
  DEMO_DAILY.forEach((n, dayIdx) => {
    const off = -(DEMO_DAILY.length - 1 - dayIdx);   // -29..0
    for (let k = 0; k < n; k++) {
      const idx = off * 10 + k;
      const slot = TIME_PATTERN[seq % TIME_PATTERN.length];
      const hours = SLOT_HOUR[slot];
      const h = hours[Math.floor(seeded(idx + 2) * hours.length)];
      const hh = h === 24 ? 0 : h;
      const mm = Math.floor(seeded(idx + 6) * 60);
      seq++;

      let trigger;
      const t = seeded(idx + 9);
      if (hh >= 22 || hh < 6) {
        trigger = t < 0.45 ? '睡不着' : t < 0.75 ? '睡前习惯' : t < 0.9 ? ADULT_CONTENT_TRIGGER : '压力大';
      } else if (hh >= 18 && hh < 22) {
        trigger = t < 0.5 ? '压力大' : t < 0.8 ? '无聊' : ADULT_CONTENT_TRIGGER;
      } else {
        trigger = t < 0.5 ? '无聊' : '压力大';
      }

      const moodMap = {
        '压力大': '压力', '睡不着': '焦虑', '睡前习惯': '平静',
        '无聊': '无聊', [ADULT_CONTENT_TRIGGER]: '愉悦', '无特别诱因': '放松',
      };

      const note = k === 0 ? DEMO_NOTES[Math.floor(seeded(idx + 11) * DEMO_NOTES.length)] : '';

      const demoDate = dateWithOffset(off);
      demoDate.setHours(hh, mm, 0, 0);
      list.push({
        id: newRecordId('demo'),
        dateKey: fmtDateKey(demoDate),   // v3.6.1：演示数据也写绝对日期
        offset: off,
        time: String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'),
        occurredAtMs: demoDate.getTime(),
        zoneId: systemTimeZone(),
        localDateKey: fmtDateKey(demoDate),
        timePrecision: 'minute',
        source: 'demo',
        createdAtMs: demoDate.getTime(),
        updatedAtMs: demoDate.getTime(),
        duration: Math.floor(seeded(idx + 7) * 25 + 5) * 5,
        moods: [moodMap[trigger]],
        triggers: [trigger],
        media: seeded(idx + 10) > 0.55,
        note,
      });
    }
  });
  return list;
}

