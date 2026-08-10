// 观己 App · storage（P1 搬移式拆分，2026-08-09——函数原样搬移，零逻辑改动）
﻿/* ============================================================
   观己 · 正式版逻辑
   本地持久化（localStorage，WebView 私有存储）· DeepSeek AI
   ============================================================ */

const $ = (id) => document.getElementById(id);

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MOODS = ['平静', '放松', '愉悦', '无聊', '焦虑', '压力'];
const TRIGGERS = ['压力大', '睡不着', '睡前习惯', '无聊', '看了片', '无特别诱因'];
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
        trigger = t < 0.45 ? '睡不着' : t < 0.75 ? '睡前习惯' : t < 0.9 ? '看了片' : '压力大';
      } else if (hh >= 18 && hh < 22) {
        trigger = t < 0.5 ? '压力大' : t < 0.8 ? '无聊' : '看了片';
      } else {
        trigger = t < 0.5 ? '无聊' : '压力大';
      }

      const moodMap = {
        '压力大': '压力', '睡不着': '焦虑', '睡前习惯': '平静',
        '无聊': '无聊', '看了片': '愉悦', '无特别诱因': '放松',
      };

      const note = k === 0 ? DEMO_NOTES[Math.floor(seeded(idx + 11) * DEMO_NOTES.length)] : '';

      list.push({
        id: newRecordId('demo'),
        dateKey: fmtDateKey(dateWithOffset(off)),   // v3.6.1：演示数据也写绝对日期
        offset: off,
        time: String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'),
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

