# 观己 · 组件清单（DESIGN-LANGUAGE → 代码组件映射）

> P1 搬移式拆分产物（2026-08-09）。用途：拆分归属一览、复用防膨胀、多端迁移（RN/鸿蒙/网页）按此清单逐一实现、新会话快速上手。
> 加载顺序即依赖：CSS theme → base → components → tabbar → sheets → screens → responsive → glass；JS storage → records → stats → ai → ui-home → ui-timer → ui-sheet → ui-calendar → liquid-glass → app（**顶层执行的文件会引用后加载文件的函数，顺序不可乱**）。

## 一、CSS 文件（www/css/）

| 文件 | 内容 | 关键选择器/变量 |
|---|---|---|
| theme.css | :root 深浅色板全部变量 + 液态玻璃变量（--lg-*） | --lg-tint/-card/-strong、--lg-glow-a/b、--lg-edge-1/2/3、--lg-hi（#84） |
| base.css | reset + 手机画布 .phone + 屏幕容器 .screen + 文字体系 | .phone/.screen/.status/.notch、--font |
| components.css | 通用组件 | .focus-card、.stats-row、.card/.report-card/.ask-answer（基础）、.btn-primary/.btn-ghost/.btn-danger、.record-btn、.empty 空态 |
| tabbar.css | 底部导航 | .tabbar/.tab/.tab-pill/.tab-slide（基础浅蓝实底 + 0.55s 弹性过渡） |
| sheets.css | 浮层全家 | .sheet/.calendar-sheet/.dialog/.backdrop、.seg、.chip、toast |
| screens.css | 页面专属 | .area-chart、.ring、.logo、.report、.ask、.me-*、.cal-*、.recent-* |
| responsive.css | 媒体查询 | 真机窄视口铺满、桌面矮视口、prefers-reduced-motion、reduced-transparency |
| glass.css | 液态玻璃横切层（#72-#84 全部） | html.liquid-glass 前缀全部规则：受光层/边框环/滑块材质/液体滤镜/日历 3px/深色降白变量 |

**玻璃覆盖规则全在 glass.css**（横切关注点集中）：任何组件在玻璃态下的表现，改 glass.css。

## 二、JS 文件（www/js/）

| 文件 | 职责 | 关键函数/常量 |
|---|---|---|
| secure.js（#93） | 数据加密层：DEK/KEK 信封 + Keystore 存取 + 迁移 + 密文导出/导入 + 加密卡 UI | SECURE 常量、secureDeriveKey/aesGcmEncrypt/Decrypt、secureBuildEnvelope/OpenEnvelope、secureGetDEK/SetDEK（Keystore internal* API）、secureEnable/Disable/ChangePassphrase、secureExportPackage/ImportPackage、initSecureUI |
| storage.js | 数据层：本地存储 + 演示数据（#93 后读写走 secure.js 分支） | `$`（简写）、newRecordId、buildDemoRecords、records 初始化、TIMER_STORE_KEY |
| records.js | 记录模型：保存 + 小组件联动 | saveRecord、updateTimeDisplay、fmtTime/dayDiff/fmtDateInput、quickRecord、syncWidgetStats、afterRecordsChanged |
| stats.js | 聚合统计工具 | dateWithOffset、countRange、hourOf、countStreak |
| ai.js | AI 全链路 + 提醒 | buildAggregatePayload、loadAIStore/saveAIStore、aiEndpoint、generateAnalysis、maybeAutoGenerate、askQuestion、getGreeting/getDailyTip、milestoneText、loadReminder/saveReminder/initReminderUI |
| ui-home.js | 首页渲染（#88 热力图） | renderHome、renderChart（curve/heat 分发）、renderHeatmap、renderAreaChart、renderMonthSummary、moveSegSlide/initSegSlide、renderRingDist、renderRecentRecords、countUp |
| ui-timer.js | 计时流程（#51/#54/#62/#63） | loadRecordMode/saveRecordMode、startTimedRecord、finishTimedRecord、cancelTimer、showTimerScreen、showTimerSummary、resumeTimer、notifyStart/StopTimer |
| ui-sheet.js | 记录面板 + 弹层 + 两态 | openSheet/closeSheet/playSheetOpen、resetSheetStyle/animateSheetClose/initSheetDrag、transitionSheetHeight、goToDetails/goToTime、chips 体系（makeChip/makeAddChip/renderMoodChips/renderTriggerChips/自定义词/删除弹窗）、setupNowStep/showClassicStep1/initRecordModeUI、closeCalendar、bindGenBtn/readAIConfigFromInputs/switchProvider、exportBtn（#93 加密模式禁用） |
| ui-calendar.js | 日历弹层 | openCalendar、renderCalendar、renderCalDayDetail |
| liquid-glass.js | 主题 + 液态玻璃开关 | applyTheme/initTheme、initLiquidGlass、toast |
| app.js（入口） | 事件绑定 + 键盘 + 启动（#87 backButton） | tab 切换绑定、moveTabSlide/liquidTabPulse、handleBackButton（分层关闭+二次退出）、isKeyboardUp/syncKbLayout、启动 async IIFE |

## 三、组件 × 文件 × 玻璃态 快速查询

| 设计组件 | CSS 基础 | CSS 玻璃态 | JS 渲染 |
|---|---|---|---|
| 卡片 | components.css `.card` | glass.css（tint/受光/边框环） | ui-home.js 等 |
| 蓝色按钮 | components.css `.btn-primary` | glass.css（实色+高光） | 各 UI 文件 |
| 情绪/诱因标签 | sheets.css `.chip` | glass.css | ui-sheet.js |
| 分段控件（就现在/补记） | sheets.css `.seg` | glass.css | ui-sheet.js + ui-timer.js（loadRecordMode） |
| 记录面板 | sheets.css `.sheet` | glass.css | ui-sheet.js |
| 日历弹层 | screens.css `.cal-*` | glass.css（blur 3px #78） | ui-calendar.js |
| tab 栏 | tabbar.css | glass.css（滑块胶囊 #76/#81） | app.js（moveTabSlide/liquidTabPulse） |
| 弹窗 | sheets.css `.dialog` | glass.css | ui-sheet.js |
| 分析报告 | screens.css `.report` | glass.css | ai.js |
| 悬浮记录按钮 | components.css `.record-btn` | glass.css | app.js 绑定 |

## 四、版本纪律

- 所有子文件统一 `?v=N`；bump 时 index.html 内整体替换（勿漏子文件）
- 新增组件：基础样式 → components.css 或 screens.css（按通用/页面）；玻璃态表现 → glass.css 追加 `html.liquid-glass` 规则；JS → 按职责归文件
