// P1 拆分脚本：按行号区间把 app.js / styles.css 切割到 js/ css/ 目录（零逻辑改动）
// 用法: node debug/p1-split.cjs
const fs = require('fs');
const path = require('path');

const WWW = 'www';
const JS_OUT = path.join(WWW, 'js');
const CSS_OUT = path.join(WWW, 'css');

// ============ JS 映射（app.js 行号区间，1-based 包含） ============
const jsBlocks = [
  ['storage.js', [1, 111]],                 // 头部注释 + 本地存储 + 演示数据
  ['stats.js', [112, 141]],                 // 统计工具
  ['ui-home.js', [142, 394]],               // 数字滚动 + 首页 + 面积图 + 月度 + seg + 时段分布
  ['ui-calendar.js', [395, 408]],           // 日历头部（openCalendar + 状态）
  ['ui-sheet.js', [409, 497]],              // 弹层通用动画 + 拖拽 + closeCalendar（491 行函数头→497 闭合，完整收尾）
  ['ui-calendar.js', [498, 591]],           // 日历渲染 + 明细
  ['ui-home.js', [592, 634]],               // 最近记录
  ['ui-sheet.js', [635, 768]],              // 记录面板开关
  ['records.js', [769, 843]],               // 保存记录 + 时间工具
  ['ai.js', [844, 1461]],                   // AI 全部（分析/提供商/报告/追问/问候/反馈/提醒）
  ['liquid-glass.js', [1462, 1472]],        // Toast
  ['liquid-glass.js', [1473, 1525]],        // 深色模式 + 液态开关 + 滑块/脉冲定义
  ['app.js', [1526, 1624]],                 // 事件绑定（入口保留区，含 moveTabSlide/liquidTabPulse）
  ['ui-sheet.js', [1625, 2069]],            // 面板两步动画 + 面板内部全部
  ['ui-timer.js', [2070, 2252]],            // 计时流程
  ['ui-sheet.js', [2253, 2405]],            // 两态步骤 + 记录模式 UI
  ['records.js', [2406, 2460]],             // 小组件联动
  ['app.js', [2461, 2532]],                 // 键盘处理 + 启动（入口保留区）
];

// ============ CSS 映射（styles.css 行号区间，1-based 包含） ============
const cssBlocks = [
  ['theme.css', [1, 154]],                  // 变量（浅色 + 深色）
  ['base.css', [155, 247]],                 // 手机画布 + 屏幕容器 + 文字体系
  ['components.css', [248, 301]],           // 今日焦点 + 统计行 + 卡片与区块
  ['screens.css', [302, 394]],              // 面积图 + 时段分布 + Logo
  ['tabbar.css', [395, 464]],               // 底部 Tab
  ['components.css', [465, 577]],           // 按钮 + 记录主按钮 + 空态
  ['screens.css', [579, 724]],              // 报告 + 追问 + 我的页
  ['sheets.css', [725, 1252]],              // 底部弹层 + 弹窗 + Toast
  ['screens.css', [1253, 1468]],            // 日历 + 最近记录
  ['responsive.css', [1469, 1537]],         // 动效降级 + 真机适配
  ['glass.css', [1538, 1746]],              // 液态玻璃全部
];

// ============ 执行 ============
function split(file, blocks, outDir, header) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const total = lines.length;
  const grouped = new Map();
  for (const [name, [start, end]] of blocks) {
    if (!grouped.has(name)) grouped.set(name, []);
    grouped.get(name).push([start, end]);
  }
  let totalMoved = 0;
  for (const [name, ranges] of grouped) {
    const parts = [];
    for (const [s, e] of ranges) {
      if (s < 1 || e > total || s > e) throw new Error(name + ' 区间越界: ' + s + '-' + e + ' (total ' + total + ')');
      parts.push(lines.slice(s - 1, e).join('\n'));
      totalMoved += e - s + 1;
    }
    const content = header(name) + '\n' + parts.join('\n\n') + '\n';
    fs.writeFileSync(path.join(outDir, name), content, 'utf8');
    console.log('写入 ' + name + ' (' + ranges.map((r) => r[0] + '-' + r[1]).join(',') + ')');
  }
  console.log('共搬移 ' + totalMoved + ' 行 / ' + total + ' 行');
  return grouped;
}

fs.mkdirSync(JS_OUT, { recursive: true });
fs.mkdirSync(CSS_OUT, { recursive: true });

const jsHeader = (n) => '// 观己 App · ' + n.replace('.js', '') + '（P1 搬移式拆分，2026-08-09——函数原样搬移，零逻辑改动）';
const cssHeader = (n) => '/* 观己 App · ' + n.replace('.css', '') + '（P1 搬移式拆分，2026-08-09——规则原样搬移，零逻辑改动） */';

// 先备份原文件
fs.mkdirSync('debug/p1-backup', { recursive: true });
fs.copyFileSync('www/app.js', 'debug/p1-backup/app.js');
fs.copyFileSync('www/styles.css', 'debug/p1-backup/styles.css');
console.log('已备份原文件到 debug/p1-backup/');

console.log('===== JS 拆分 =====');
const jsUsed = split(path.join(WWW, 'app.js'), jsBlocks, JS_OUT, jsHeader);
console.log('===== CSS 拆分 =====');
split(path.join(WWW, 'styles.css'), cssBlocks, CSS_OUT, cssHeader);

// 校验覆盖：app.js 必须全部被映射（保留区在 app.js 内）
const appJsRanges = jsBlocks.filter((b) => b[0] === 'app.js').map((b) => b[1]);
console.log('app.js 保留区间:', JSON.stringify(appJsRanges));
