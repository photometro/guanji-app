// 观己功能海报系列生成器：输出 7 张竖版海报（1080×1920）到 C:\Users\43124\Desktop\观己海报\
// 外宣字体规范（2026-08-09）：宣传物料只允许免费商用字体——首选用本机已装的 Noto Sans SC（= 思源黑体 Google 版，OFL 开源）
// 严禁：Microsoft YaHei（微软雅黑，方正版权，商用有维权案例）/ PingFang SC（苹方，Apple 许可限制商用分发）
// 其他可替换的免费商用字体：思源黑体 / 阿里巴巴普惠体 3.0 / HarmonyOS Sans（需安装后替换 font-family 首位）
const fs = require('fs');
const path = require('path');
const OUT = 'C:\\Users\\43124\\Desktop\\观己海报';

/* ================= 通用 CSS（所有海报共用） ================= */
const baseCss = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  :root {
    --blue: #007AFF;
    --blue-deep: #0055C8;
    --ink: #3A3A3C;
    --ink-2: #8E8E93;
    --ink-3: #B9B9BE;
    --card: #FFFFFF;
    --sage: #34C759;
    --bg: #F2F3F7;
    --timer-grad: linear-gradient(180deg, #1288FF 0%, #0A63E8 58%, #074FB8 100%);
    --font: "Noto Sans SC", "Source Han Sans SC", "Alibaba PuHuiTi", "HarmonyOS Sans SC", sans-serif;
  }
  html, body { height: 100%; }
  body { font-family: var(--font); background: #DFE2EA; margin: 0; overflow: hidden; }
  .poster {
    position: absolute; top: 50%; left: 50%;
    width: 1080px; height: 1920px;
    transform: translate(-50%, -50%) scale(var(--s, 1));
    background:
      radial-gradient(900px 700px at 15% -5%, rgba(0, 122, 255, 0.10), transparent 60%),
      radial-gradient(800px 600px at 105% 18%, rgba(0, 122, 255, 0.08), transparent 55%),
      radial-gradient(700px 700px at 50% 115%, rgba(0, 122, 255, 0.07), transparent 60%),
      linear-gradient(180deg, #FBFBFD 0%, #F3F5FA 100%);
    overflow: hidden;
    color: var(--ink);
  }
  .deco-ring {
    position: absolute; right: -220px; top: 560px;
    width: 560px; height: 560px; border-radius: 50%;
    border: 2px dashed rgba(0, 122, 255, 0.10);
  }
  .deco-ring2 {
    position: absolute; left: -260px; top: 1290px;
    width: 620px; height: 620px; border-radius: 50%;
    border: 2px dashed rgba(0, 122, 255, 0.08);
  }
  /* 头部 */
  .header { display: flex; flex-direction: column; align-items: center; padding-top: 96px; }
  .logo {
    width: 104px; height: 104px; border-radius: 28px;
    background: linear-gradient(160deg, #1B8BFF, #0063E0);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 18px 44px rgba(0, 99, 224, 0.28);
  }
  .brand { margin-top: 26px; font-size: 46px; font-weight: 800; letter-spacing: 0.1em; color: var(--ink); }
  .brand b { color: var(--blue); }
  .feat-title {
    margin-top: 22px;
    font-size: 40px; font-weight: 800; letter-spacing: 0.02em;
    display: flex; align-items: center; gap: 16px;
  }
  .feat-title .tag {
    font-size: 20px; font-weight: 700; color: #fff;
    background: var(--blue); border-radius: 999px; padding: 8px 22px;
    letter-spacing: 0.06em;
  }
  .feat-sub {
    margin-top: 14px;
    font-size: 22px; font-weight: 500; color: var(--ink-2); letter-spacing: 0.08em;
    text-align: center;
  }
  /* 手机 */
  .showcase { position: relative; display: flex; justify-content: center; margin-top: 48px; }
  .phone {
    width: 330px; height: 640px; border-radius: 46px;
    background: #000; padding: 12px;
    box-shadow: 0 34px 80px rgba(28, 42, 68, 0.22), 0 8px 24px rgba(28, 42, 68, 0.10);
    position: relative;
  }
  .phone-inner {
    width: 100%; height: 100%; border-radius: 36px; overflow: hidden; position: relative;
  }
  .camera {
    position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
    width: 16px; height: 16px; border-radius: 50%; background: #111; z-index: 5;
  }
  /* 卖点 */
  .features {
    display: flex; flex-wrap: wrap; justify-content: center;
    gap: 16px 20px; margin-top: 56px; padding: 0 90px;
  }
  .feat {
    display: flex; align-items: center; gap: 12px;
    background: var(--card); border-radius: 999px;
    padding: 16px 26px;
    box-shadow: 0 8px 24px rgba(28,42,68,0.07);
    font-size: 21px; font-weight: 600; color: var(--ink);
  }
  .feat .dot { width: 11px; height: 11px; border-radius: 50%; flex: 0 0 11px; }
  .dot.blue { background: var(--blue); }
  .dot.sage { background: var(--sage); }
  .dot.gray { background: var(--ink-2); }
  .dot.deep { background: var(--blue-deep); }
  /* 承诺 */
  .promise { margin-top: 74px; display: flex; flex-direction: column; align-items: center; }
  .promise-line { font-size: 22px; font-weight: 700; color: var(--ink); }
  .promise-line b { color: var(--blue); }
  .promise-sub { margin-top: 14px; font-size: 16px; color: var(--ink-2); letter-spacing: 0.04em; text-align: center; line-height: 1.7; }
  .divider { margin-top: 44px; width: 640px; height: 1px; background: linear-gradient(90deg, transparent, #D9DCE6, transparent); }
  .footer {
    margin-top: 34px; display: flex; align-items: center; gap: 14px;
    font-size: 15px; color: var(--ink-3); letter-spacing: 0.06em;
  }
  .footer .f-logo {
    width: 30px; height: 30px; border-radius: 9px;
    background: linear-gradient(160deg, #1B8BFF, #0063E0);
    display: flex; align-items: center; justify-content: center;
  }
  .footer .f-logo svg { width: 17px; height: 17px; }
`;

/* ================= 各功能手机 mockup ================= */

/* 1. 全屏计时 */
const M_TIMER = `
      <div class="phone">
        <div class="camera"></div>
        <div class="phone-inner timer">
          <div class="t-status"><span>19:24</span><span>●</span></div>
          <div class="t-badge"><span class="pulse"></span>进行中</div>
          <div class="t-time">00:00</div>
          <div class="t-start">开始于 19:24</div>
          <div class="t-btn">结束记录</div>
          <div class="t-quit">取消计时</div>
        </div>
      </div>
      <div class="capsule">
        <span class="c-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M12 6v6l4 2" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="#fff" stroke-width="2"/></svg></span>
        <span class="c-title">观己 · 计时中</span>
        <span class="c-time">00:12</span>
      </div>`;

/* 2. 实况通知（锁屏胶囊 + 通知） */
const M_LIVE = `
      <div class="phone">
        <div class="camera"></div>
        <div class="phone-inner live">
          <div class="l-top">
            <div class="l-badge"><span class="pulse"></span>进行中</div>
            <div class="l-time">00:00</div>
            <div class="l-start">开始于 19:24</div>
          </div>
          <div class="l-capsule">
            <span class="c-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M12 6v6l4 2" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="9" stroke="#fff" stroke-width="2"/></svg></span>
            <span class="c-title">观己 · 计时中</span>
            <span class="c-time">00:12</span>
          </div>
          <div class="l-notif">
            <svg class="n-logo" viewBox="0 0 46 46" fill="none"><path d="M23 12c-6 0-10 4.2-10 9.8 0 6.5 7.5 11.8 9.4 13.1a1.2 1.2 0 0 0 1.2 0c1.9-1.3 9.4-6.6 9.4-13.1C33 16.2 29 12 23 12Zm0 13.3a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" fill="#007AFF"/></svg>
            <div class="n-body">
              <p class="n-title">观己 · 计时中</p>
              <p class="n-text">已计时 1 分钟 · 0:12 秒</p>
            </div>
            <svg class="n-chev" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 6l3 3 3-3" stroke="#8E8E93" stroke-width="1.6" stroke-linecap="round"/></svg>
          </div>
          <div class="l-note">AOD 息屏同样显示「已计时 X 分钟」</div>
        </div>
      </div>`;

/* 3. 首页看板 */
const M_HOME = `
      <div class="phone">
        <div class="camera"></div>
        <div class="phone-inner home">
          <div class="h-status"><span>19:24</span><span>●●</span></div>
          <div class="h-greet">晚上好，今天感觉如何？<small>记录本身就是觉察</small></div>
          <div class="h-num">9 <small>次</small></div>
          <div class="h-ring">
            <div class="ring-center"><b>9</b><span>今日记录</span></div>
          </div>
          <div class="h-stats">
            <div><b>16</b><span>本周次数</span></div>
            <div><b>+78%</b><span>较上周</span></div>
            <div><b>4</b><span>连续天数</span></div>
          </div>
          <div class="h-trend">
            <i></i><i></i><i class="hot"></i><i></i><i></i><i class="hot"></i><i></i>
          </div>
          <div class="h-recent">
            <p><span>8月8日 22:01</span><span>· 1 分钟</span></p>
            <p><span>8月8日 21:57</span><span>· 1 分钟</span></p>
          </div>
        </div>
      </div>`;

/* 4. AI 分析 */
const M_AI = `
      <div class="phone">
        <div class="camera"></div>
        <div class="phone-inner ai">
          <div class="h-status"><span>19:24</span><span>●●</span></div>
          <div class="ai-head">AI 洞察<small>本周模式 · 温和观察</small></div>
          <div class="ai-card">
            <p class="ai-title">这周的你</p>
            <p class="ai-para">这周共记录 <b>16 次</b>，比上周多了 <b>78%</b>。深夜时段出现得更多，也许最近有一些让思绪活跃的事情。</p>
            <p class="ai-para"><b>深夜时段占比最高</b>（44%）。如果在睡前留意一下看片和睡不着的关系，可能会有新发现。</p>
            <p class="ai-para">连续记录 4 天，坚持本身就是觉察。</p>
          </div>
          <div class="ai-ask">
            <input type="text" placeholder="想追问什么？">
            <button>问问</button>
          </div>
          <p class="ai-note">AI 只看聚合统计 · 不上传单条记录</p>
        </div>
      </div>`;

/* 5. 桌面小组件 */
const M_WIDGET = `
      <div class="widget-wall">
        <div class="w-grid">
          <div class="w-cell w-quick">
            <svg class="w-plus" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>
            <span>记录</span>
          </div>
          <div class="w-cell w-dash">
            <b>16</b><span>本周次数</span>
            <em>+78%</em>
          </div>
          <div class="w-cell w-week">
            <div class="w-bars"><i></i><i class="on"></i><i></i><i></i><i class="on"></i><i></i><i></i></div>
            <span>本周节奏</span>
          </div>
          <div class="w-cell w-streak">
            <b>4</b><span>连续天数</span>
            <div class="w-prog"><i></i></div>
          </div>
        </div>
        <p class="w-note">桌面即记录 · 数据实时同步</p>
      </div>`;

/* 6. 历史日历 */
const M_CAL = `
      <div class="phone">
        <div class="camera"></div>
        <div class="phone-inner cal">
          <div class="h-status"><span>19:24</span><span>●●</span></div>
          <div class="cal-head"><button>‹</button><b>2026年8月</b><button>›</button></div>
          <div class="cal-week"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>
          <div class="cal-grid">
            <span></span><span></span><span></span><span></span><span></span><span class="has">1</span><span class="has">2</span>
            <span class="has">3</span><span class="has">4</span><span class="has">5</span><span class="has">6</span><span class="has">7</span><span class="sel">8</span><span class="has">9</span>
            <span class="has">10</span><span class="has">11</span><span class="has">12</span><span>13</span><span>14</span><span>15</span><span>16</span>
            <span>17</span><span>18</span><span>19</span><span>20</span><span>21</span><span>22</span><span>23</span>
            <span>24</span><span>25</span><span>26</span><span>27</span><span>28</span><span>29</span><span>30</span>
            <span>31</span>
          </div>
          <div class="cal-detail">
            <p class="cd-date">8月8日 · 周六</p>
            <p class="cd-row"><span>深夜</span><b>2 次</b></p>
            <p class="cd-row"><span>傍晚</span><b>1 次</b></p>
            <p class="cd-note">想补记历史日期？日历直达</p>
          </div>
        </div>
      </div>`;

/* 7. 数据安全 */
const M_PRIV = `
      <div class="priv-wall">
        <div class="priv-shield">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none">
            <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" stroke="#007AFF" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M9 12l2.2 2.2L15.5 9.5" stroke="#007AFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="priv-card">
          <p class="pc-row"><span class="pc-dot"></span><div><b>数据只存本机</b><small>所有记录保存在设备本地，不上传云端，不注册账号</small></div></p>
          <p class="pc-row"><span class="pc-dot"></span><div><b>AI 只看聚合</b><small>只上传统计特征（次数/时段/占比），永远看不到单条记录</small></div></p>
          <p class="pc-row"><span class="pc-dot"></span><div><b>密钥也在本地</b><small>API 密钥按提供商保存在本机，调用从设备直连</small></div></p>
        </div>
      </div>`;

/* ================= 每张海报的文案配置 ================= */
const posters = [
  {
    file: '01-全屏计时.html',
    title: '全屏计时',
    tag: '01',
    headline: '像运动 App 一样计时记录',
    sub: '结束自动填入精准时长',
    mockup: M_TIMER,
    chips: [['dot blue', '开始记录即计时'], ['dot sage', '时长自动精准'], ['dot gray', '误触可反悔']]
  },
  {
    file: '02-实况通知.html',
    title: '实况通知',
    tag: '02',
    headline: '切出应用，计时仍在眼前',
    sub: '锁屏胶囊 · 通知栏 · 息屏 AOD',
    mockup: M_LIVE,
    chips: [['dot blue', '系统级走秒'], ['dot deep', '快捷按钮'], ['dot gray', '杀进程自动恢复']]
  },
  {
    file: '03-首页看板.html',
    title: '数据看板',
    tag: '03',
    headline: '一天的节奏，一眼看清',
    sub: '今日概览 · 时段分布 · 趋势',
    mockup: M_HOME,
    chips: [['dot blue', '时段分布环图'], ['dot sage', '14 / 30 天趋势'], ['dot gray', '最近记录']]
  },
  {
    file: '04-AI分析.html',
    title: 'AI 分析',
    tag: '04',
    headline: '温和地看清自己的模式',
    sub: '非评判 · 不诊断 · 可追问',
    mockup: M_AI,
    chips: [['dot blue', '只看聚合统计'], ['dot sage', '支持追问'], ['dot gray', '修改记录自动刷新']]
  },
  {
    file: '05-桌面小组件.html',
    title: '桌面小组件',
    tag: '05',
    headline: '桌面即记录，无需打开 App',
    sub: '一键记录 · 数据看板 · 连续进度',
    mockup: M_WIDGET,
    chips: [['dot blue', '5 个 2x2 组件'], ['dot sage', '一键快速记录'], ['dot gray', '实时同步']]
  },
  {
    file: '06-历史日历.html',
    title: '历史日历',
    tag: '06',
    headline: '每一天都有迹可循',
    sub: '月历角标 · 选天明细 · 补记直达',
    mockup: M_CAL,
    chips: [['dot blue', '月历角标'], ['dot sage', '选天明细'], ['dot gray', '补记历史日期']]
  },
  {
    file: '07-数据安全.html',
    title: '数据安全',
    tag: '07',
    headline: '你的记录，只属于你',
    sub: '数据仅存本地 · 不上传云端',
    mockup: M_PRIV,
    chips: [['dot blue', '数据仅存本地'], ['dot sage', 'AI 只看聚合'], ['dot deep', '密钥也在本地']]
  }
];

/* ================= mockup 专属样式 ================= */
const mockupCss = `
  /* ---- 计时页 ---- */
  .timer { background: var(--timer-grad); display: flex; flex-direction: column; align-items: center; }
  .t-status { width: 100%; padding: 20px 34px 0; display: flex; justify-content: space-between; color: rgba(255,255,255,0.85); font-size: 15px; font-weight: 600; }
  .t-badge { margin-top: 60px; display: flex; align-items: center; gap: 10px; color: rgba(255,255,255,0.9); font-size: 17px; font-weight: 600; letter-spacing: 0.1em; }
  .pulse { width: 12px; height: 12px; border-radius: 50%; background: #6EE7A0; box-shadow: 0 0 0 0 rgba(110,231,160,0.6); animation: pulse 2.2s infinite; }
  @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(110,231,160,0.55); } 70% { box-shadow: 0 0 0 14px rgba(110,231,160,0); } 100% { box-shadow: 0 0 0 0 rgba(110,231,160,0); } }
  .t-time { margin-top: 22px; font-size: 96px; font-weight: 800; font-variant-numeric: tabular-nums; color: #fff; letter-spacing: -0.02em; text-shadow: 0 8px 40px rgba(0,0,0,0.25); line-height: 1; }
  .t-start { margin-top: 16px; color: rgba(255,255,255,0.65); font-size: 15px; letter-spacing: 0.06em; }
  .t-btn { margin-top: 104px; width: 172px; height: 64px; border-radius: 40px; background: #fff; color: var(--blue); font-size: 19px; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 14px 34px rgba(0,0,0,0.20); }
  .t-quit { margin-top: 22px; color: rgba(255,255,255,0.55); font-size: 15px; letter-spacing: 0.06em; }
  .capsule {
    position: absolute; top: 250px; right: 62px;
    display: flex; align-items: center; gap: 14px;
    padding: 16px 26px; border-radius: 999px;
    background: var(--timer-grad);
    box-shadow: 0 16px 40px rgba(0, 99, 224, 0.35);
    animation: floaty 4.5s ease-in-out infinite; z-index: 6;
  }
  @keyframes floaty { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
  .c-icon { width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,0.22); display: flex; align-items: center; justify-content: center; }
  .c-icon svg { width: 18px; height: 18px; }
  .c-title { color: rgba(255,255,255,0.9); font-size: 14px; font-weight: 600; }
  .c-time { color: #fff; font-size: 20px; font-weight: 800; font-variant-numeric: tabular-nums; }

  /* ---- 实况通知 ---- */
  .live { background: var(--timer-grad); display: flex; flex-direction: column; align-items: center; padding: 0 22px; }
  .l-top { display: flex; flex-direction: column; align-items: center; margin-top: 46px; }
  .l-badge { display: flex; align-items: center; gap: 10px; color: rgba(255,255,255,0.9); font-size: 15px; font-weight: 600; letter-spacing: 0.1em; }
  .l-time { margin-top: 18px; font-size: 72px; font-weight: 800; font-variant-numeric: tabular-nums; color: #fff; text-shadow: 0 8px 40px rgba(0,0,0,0.25); line-height: 1; }
  .l-start { margin-top: 14px; color: rgba(255,255,255,0.65); font-size: 13px; letter-spacing: 0.06em; }
  .l-capsule {
    margin-top: 40px; width: 100%;
    display: flex; align-items: center; gap: 12px;
    padding: 14px 20px; border-radius: 999px;
    background: rgba(255,255,255,0.16);
    box-shadow: 0 12px 30px rgba(0,0,0,0.18);
  }
  .l-capsule .c-title { font-size: 13px; }
  .l-capsule .c-time { font-size: 18px; }
  .l-notif {
    margin-top: 18px; width: 100%;
    display: flex; align-items: center; gap: 12px;
    background: rgba(255,255,255,0.97); border-radius: 20px;
    padding: 16px 18px; box-shadow: 0 14px 34px rgba(0,0,0,0.22);
  }
  .n-logo { width: 40px; height: 40px; flex: 0 0 40px; border-radius: 10px; background: #fff; }
  .n-body { flex: 1; min-width: 0; }
  .n-title { font-size: 14px; font-weight: 700; color: var(--ink); }
  .n-text { font-size: 12px; color: var(--ink-2); margin-top: 4px; }
  .n-chev { flex: 0 0 14px; }
  .l-note { margin-top: 22px; color: rgba(255,255,255,0.7); font-size: 13px; letter-spacing: 0.04em; text-align: center; }

  /* ---- 首页 ---- */
  .home { background: var(--bg); display: flex; flex-direction: column; align-items: center; padding: 0 22px; }
  .h-status { width: 100%; padding: 20px 12px 0; display: flex; justify-content: space-between; color: var(--ink); font-size: 15px; font-weight: 600; }
  .h-greet { width: 100%; margin-top: 26px; font-size: 20px; font-weight: 700; color: var(--ink); }
  .h-greet small { display: block; margin-top: 8px; font-size: 13px; font-weight: 400; color: var(--ink-2); }
  .h-num { width: 100%; margin-top: 18px; font-size: 44px; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }
  .h-num small { font-size: 17px; font-weight: 600; color: var(--ink-2); }
  .h-ring { position: relative; width: 178px; height: 178px; margin-top: 20px; border-radius: 50%; background: conic-gradient(from -90deg, #0A84FF 0 44%, #64AFFF 44% 84%, #A8CFFF 84% 96%, #D5E6FF 96% 100%); display: flex; align-items: center; justify-content: center; }
  .h-ring::after { content: ""; position: absolute; inset: 26px; border-radius: 50%; background: var(--bg); }
  .ring-center { position: relative; z-index: 1; text-align: center; }
  .ring-center b { display: block; font-size: 28px; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }
  .ring-center span { font-size: 11px; color: var(--ink-2); letter-spacing: 0.08em; }
  .h-stats { width: 100%; margin-top: 18px; display: flex; justify-content: space-between; background: var(--card); border-radius: 16px; padding: 14px 18px; box-shadow: 0 6px 20px rgba(28,42,68,0.06); }
  .h-stats div b { display: block; font-size: 18px; font-weight: 800; color: var(--blue); font-variant-numeric: tabular-nums; }
  .h-stats div span { font-size: 11px; color: var(--ink-2); }
  .h-trend { width: 100%; margin-top: 12px; display: flex; align-items: flex-end; justify-content: space-between; gap: 7px; height: 60px; padding: 12px 8px 8px; background: var(--card); border-radius: 16px; box-shadow: 0 6px 20px rgba(28,42,68,0.06); }
  .h-trend i { flex: 1; border-radius: 6px 6px 3px 3px; background: #D5E6FF; }
  .h-trend i.hot { background: var(--blue); }
  .h-recent { width: 100%; margin-top: 12px; background: var(--card); border-radius: 16px; padding: 8px 18px; box-shadow: 0 6px 20px rgba(28,42,68,0.06); }
  .h-recent p { font-size: 12px; color: var(--ink); display: flex; justify-content: space-between; padding: 6px 0; }
  .h-recent p + p { border-top: 1px solid #F0F0F4; }
  .h-recent p span { color: var(--ink-2); font-size: 11px; }

  /* ---- AI 分析 ---- */
  .ai { background: var(--bg); display: flex; flex-direction: column; align-items: center; padding: 0 22px; }
  .ai-head { width: 100%; margin-top: 26px; font-size: 20px; font-weight: 800; color: var(--ink); }
  .ai-head small { display: block; margin-top: 6px; font-size: 12px; font-weight: 400; color: var(--ink-2); }
  .ai-card { width: 100%; margin-top: 18px; background: var(--card); border-radius: 18px; padding: 20px; box-shadow: 0 6px 20px rgba(28,42,68,0.06); }
  .ai-title { font-size: 15px; font-weight: 700; color: var(--blue); margin-bottom: 10px; }
  .ai-para { font-size: 12.5px; line-height: 1.75; color: var(--ink); margin-bottom: 10px; }
  .ai-para:last-child { margin-bottom: 0; }
  .ai-para b { color: var(--blue); font-weight: 700; }
  .ai-ask { width: 100%; margin-top: 16px; display: flex; gap: 10px; }
  .ai-ask input { flex: 1; border: none; background: var(--card); border-radius: 14px; padding: 14px 16px; font-size: 13px; font-family: var(--font); color: var(--ink); box-shadow: 0 6px 20px rgba(28,42,68,0.06); }
  .ai-ask button { border: none; background: var(--blue); color: #fff; border-radius: 14px; padding: 0 22px; font-size: 14px; font-weight: 700; font-family: var(--font); }
  .ai-note { margin-top: 16px; font-size: 12px; color: var(--ink-2); }

  /* ---- 小组件 ---- */
  .widget-wall { display: flex; flex-direction: column; align-items: center; }
  .w-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; padding: 20px 34px; }
  .w-cell { background: var(--card); border-radius: 24px; width: 240px; height: 240px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 14px 34px rgba(28,42,68,0.12); }
  .w-quick { background: var(--timer-grad); }
  .w-plus { width: 64px; height: 64px; }
  .w-quick span { color: #fff; font-size: 22px; font-weight: 700; }
  .w-dash b { font-size: 52px; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; }
  .w-dash span { font-size: 15px; color: var(--ink-2); }
  .w-dash em { font-size: 15px; font-weight: 700; color: var(--sage); font-style: normal; }
  .w-bars { display: flex; align-items: flex-end; gap: 6px; height: 52px; }
  .w-bars i { width: 14px; border-radius: 5px 5px 2px 2px; background: #D5E6FF; }
  .w-bars i.on { background: var(--blue); }
  .w-week span, .w-streak span { font-size: 15px; color: var(--ink-2); }
  .w-streak b { font-size: 48px; font-weight: 800; color: var(--blue); font-variant-numeric: tabular-nums; }
  .w-prog { width: 150px; height: 10px; border-radius: 999px; background: #EDEFF4; overflow: hidden; }
  .w-prog i { display: block; width: 57%; height: 100%; border-radius: 999px; background: var(--blue); }
  .w-note { margin-top: 26px; font-size: 18px; color: var(--ink-2); letter-spacing: 0.06em; }

  /* ---- 日历 ---- */
  .cal { background: var(--bg); display: flex; flex-direction: column; align-items: center; padding: 0 20px; }
  .cal-head { width: 100%; margin-top: 24px; display: flex; align-items: center; justify-content: space-between; }
  .cal-head button { border: none; background: none; font-size: 24px; color: var(--blue); width: 40px; height: 40px; }
  .cal-head b { font-size: 17px; font-weight: 800; color: var(--ink); }
  .cal-week { width: 100%; margin-top: 12px; display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; font-size: 11px; color: var(--ink-2); }
  .cal-grid { width: 100%; margin-top: 6px; display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; text-align: center; }
  .cal-grid span { height: 40px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 500; color: var(--ink); border-radius: 12px; position: relative; }
  .cal-grid span.has::after { content: ""; position: absolute; bottom: 4px; width: 5px; height: 5px; border-radius: 50%; background: var(--blue); }
  .cal-grid span.sel { background: var(--blue); color: #fff; font-weight: 700; }
  .cal-grid span.sel::after { background: #fff; }
  .cal-detail { width: 100%; margin-top: 16px; background: var(--card); border-radius: 18px; padding: 18px; box-shadow: 0 6px 20px rgba(28,42,68,0.06); }
  .cd-date { font-size: 13px; font-weight: 700; color: var(--ink); margin-bottom: 10px; }
  .cd-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--ink); padding: 6px 0; }
  .cd-row b { color: var(--blue); font-variant-numeric: tabular-nums; }
  .cd-note { margin-top: 8px; font-size: 12px; color: var(--ink-2); }

  /* ---- 隐私 ---- */
  .priv-wall { display: flex; flex-direction: column; align-items: center; }
  .priv-shield { width: 300px; height: 300px; border-radius: 50%; background: var(--card); display: flex; align-items: center; justify-content: center; box-shadow: 0 20px 50px rgba(28,42,68,0.12); }
  .priv-card { margin-top: 34px; display: flex; flex-direction: column; gap: 18px; }
  .pc-row { display: flex; gap: 16px; background: var(--card); border-radius: 20px; padding: 22px 24px; width: 520px; box-shadow: 0 10px 28px rgba(28,42,68,0.08); }
  .pc-row .pc-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--sage); margin-top: 8px; flex: 0 0 12px; }
  .pc-row b { display: block; font-size: 21px; font-weight: 700; color: var(--ink); }
  .pc-row small { display: block; margin-top: 6px; font-size: 15px; line-height: 1.6; color: var(--ink-2); }
`;

/* ================= 生成 ================= */
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

posters.forEach((p, i) => {
  const chipsHtml = p.chips
    .map(([cls, text]) => `<span class="feat"><span class="dot ${cls.split(' ')[1]}"></span>${text}</span>`)
    .join('\n    ');
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>观己 · ${p.title}海报</title>
<style>${baseCss}${mockupCss}</style>
</head>
<body>
<script>
  (function fit() {
    var s = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
    document.documentElement.style.setProperty('--s', s);
  })();
  window.addEventListener('resize', function () {
    var s = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
    document.documentElement.style.setProperty('--s', s);
  });
</script>
<div class="poster">
  <div class="deco-ring"></div>
  <div class="deco-ring2"></div>

  <header class="header">
    <div class="logo">
      <svg width="52" height="52" viewBox="0 0 46 46" fill="none"><path d="M23 12c-6 0-10 4.2-10 9.8 0 6.5 7.5 11.8 9.4 13.1a1.2 1.2 0 0 0 1.2 0c1.9-1.3 9.4-6.6 9.4-13.1C33 16.2 29 12 23 12Zm0 13.3a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" fill="#FFFFFF"/></svg>
    </div>
    <p class="brand">观<b>己</b></p>
    <p class="feat-title"><span class="tag">${p.tag}</span>${p.title}</p>
    <p class="feat-sub">${p.sub}</p>
  </header>

  <section class="showcase">${p.mockup}
  </section>

  <section class="features">
    ${chipsHtml}
  </section>

  <section class="promise">
    <p class="promise-line">所有记录只保存在<b>这台设备</b>上</p>
    <p class="promise-sub">AI 分析仅上传聚合后的统计特征，永远看不到你的单条记录<br>不评判 · 不焦虑 · 不打卡式逼迫</p>
    <div class="divider"></div>
    <p class="footer">
      <span class="f-logo"><svg viewBox="0 0 46 46" fill="none"><path d="M23 12c-6 0-10 4.2-10 9.8 0 6.5 7.5 11.8 9.4 13.1a1.2 1.2 0 0 0 1.2 0c1.9-1.3 9.4-6.6 9.4-13.1C33 16.2 29 12 23 12Zm0 13.3a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" fill="#FFFFFF"/></svg></span>
      观己 · 数据仅存本地 · AI 只看聚合，不看单条
    </p>
  </section>
</div>
</body>
</html>`;
  fs.writeFileSync(path.join(OUT, p.file), html, 'utf8');
  console.log('已生成', p.file);
});
console.log('完成：' + posters.length + ' 张海报 → ' + OUT);
