# 观己 · 改进意见清单（细化版）

> 记录日期：2026-08-06
> 状态：**已完成 v1.1**（2026-08-06 实施）
> 说明：每条含「需求 → 细化设计 → 实施清单 → 验收要点」；已实施的条目标注 ✅

---

## 1. 首页问候语动态化 ✅ 已实施（v1.1）

### 需求（用户澄清版）
问候语 = **时间问候 + AI 健康提醒，构成的一句话**（不是两块独立内容）。即问候语区域展示的是一句组合文案：先按时段问候，再衔接 AI 生成的健康提醒。

### 细化设计

#### 1.1 组合文案形态

**有 AI 提醒时**（合成一句话，示例）：
- 「下午好。本周深夜时段占比较高，今晚试试提前 30 分钟放下手机。」
- 「晚上好。这周压力是主要诱因，试试睡前留 10 分钟给自己。」

**无 AI 提醒时**（无 key / 无数据 / API 失败，降级为纯时段问候）：
- 「下午好，今天感觉如何？」
- 「夜深了，照顾好自己。」

#### 1.2 拼装方式（推荐：本地拼装）

- **时段问候固定**（本地生成，保证温和基调不失控），AI 只负责生成「提醒句」
- 组合规则：`时段问候句 + AI 提醒句`，两句话之间用句号衔接，构成完整问候语
- AI 提示词要求：生成 1 句（≤ 40 字）可直接接在问候后的提醒（如「本周深夜时段占比较高，今晚试试提前放下手机」），不要问候前缀、不要评判、不要命令式口吻
- 备选：AI 生成整句（含问候）——更自然但问候语不可控，暂不采用

#### 1.3 展示与加载

- **结构**：问候语区域仍是单一 `<h1>`，内容随状态变化：
  1. 首次进入：先显示时段问候（不等待 AI，页面不阻塞）
  2. AI 异步返回后：`h1` 文本替换为「问候 + 提醒」组合文案（淡入/文字过渡动画，可选）
  3. 失败/无 key/无数据：保持时段问候，**不打扰用户**（静默降级）
- 可选细节：组合文案带「AI 提醒」轻标识（小标签），与纯时段问候区分
- 点击问候语可手动重新生成提醒

#### 1.4 触发与缓存

- **触发条件**（全部满足才调用 API）：
  1. 已配置 API key
  2. 本周记录数 ≥ 3 条（数据太少时提醒无意义）
  3. 当日未生成过（缓存 `guanji_daily_tip`（含日期）→ 命中直接拼装展示，避免每次进首页都调 API）
- **数据流**：进入首页 → 渲染时段问候 → 异步检查缓存 → 未命中且条件满足 → 聚合特征（复用 `buildAggregatePayload()`）→ DeepSeek → 成功拼装替换 + 写缓存；失败静默
- **隐私**：只上传聚合特征 ✓；提醒文案存本地缓存
- **异常清单**：无 key（静默）/ 401（静默，保留手动重试）/ 超时（静默）/ 无数据（不触发）

#### 1.5 实施清单
1. `app.js`：新增 `getGreeting()`（时段问候）、`getDailyTip()`（AI 提醒句 + 缓存 + 降级）、`renderGreeting()`（拼装与替换）
2. `index.html`：问候语 `<h1>` 容器（加 id 便于替换，可选加 AI 标识元素）
3. `styles.css`：AI 提醒标识样式 + 文字替换过渡（可选）
4. `app.js` 启动流程：renderHome 后触发异步拼装

#### 1.6 验收要点
- 无 key / 无数据 / 断网：只显示时段问候，无报错无空白
- 有 key + 数据：首次进入先时段问候 → AI 返回后变组合文案；刷新不重复请求（缓存生效）
- 不同时段显示不同问候；组合文案读起来是一句自然的话，温和无评判
- 提醒句长度合理（整句不超长），h1 换行不破版

---

## 2. Tab 栏美化（参考记录模块的时间切换）✅ 已实施（v1.1，方案 A）

### 需求
底部 tab 栏参考记录模块「就现在 / 补记」分段控件的样式做美化。

### 细化设计

#### 2.1 参考样式（记录模块 seg）
- 容器：浅色底（`--bg-elev`）+ 圆角胶囊 + 内边距
- 选中项：白底（`--card`）+ 圆角 + 浅阴影（`--shadow-1`）+ 深色文字（`--accent-deep`）
- 未选中：透明底 + 次级灰文字
- 过渡：0.2s 平滑

#### 2.2 Tab 栏方案（两级可选）

**方案 A（基础，推荐先做）**：选中 pill 样式
- `.tab` 内部包一层 `.tab-pill`（图标 + 文字的容器，flex 垂直排列）
- `.tab.active .tab-pill`：`background: rgba(255,255,255,0.95)` + `border-radius: 16px` + 阴影 + 内边距（上下 6px 左右 14px）
- 毛玻璃 bar 上的白色 pill 对比清晰，与记录模块 seg.active 视觉语言一致
- 图标/文字选中态：`--accent-deep`（已有）

**方案 B（进阶）**：滑块跟随
- 在 tab 容器内绝对定位一个「活动 pill」层，用 `transform: translateX()` 在 tab 切换时滑动到对应位置（宽度按 tab 三等分）
- 需要 JS 监听 tab 切换更新 transform；动效 0.25s `--ease-spring`
- 优点：切换有滑动指向感；缺点：需维护位置计算（tab 数固定为 3，简单）

#### 2.3 实施清单
1. `index.html`：tab 内部包裹 `.tab-pill` 结构
2. `styles.css`：`.tab-pill` 样式 + `.tab.active .tab-pill` 选中态（方案 B 再加滑块层样式）
3. `app.js`（仅方案 B）：tab 切换时更新滑块位置
4. 保留毛玻璃、悬浮、按压反馈

#### 2.4 验收要点
- 选中 tab 有明显 pill 容器，视觉与记录模块分段控件一致
- 切换动画流畅；按压有反馈；毛玻璃保留
- 真机 + 桌面预览均正常

---

## 3. 【Bug】分析页：无 API key 点击生成后按钮消失 ✅ 已修复（v1.1）

### 现象与根因
见上文记录：`generateAnalysis` 的 `.finally()` 无条件隐藏空态区，失败路径中 `.catch()` 刚重建的按钮被随后隐藏。

### 细化修复设计
- **修改点**：`www/app.js` 的 `generateAnalysis()` 流程重构：

```
let succeeded = false;
askDeepSeek(...)
  .then(() => { succeeded = true; renderAIReport(data); })
  .catch(err => {
    if (err.message === 'PARSE_FAIL') { succeeded = true; 渲染原始文本; }
    else { aiErrorToast(err); 恢复空态(重建按钮); }
  })
  .finally(() => {
    clearTimeout(timer);
    if (succeeded) { $('analysisEmpty').classList.add('hidden'); }
    // 失败：空态已由 catch 恢复，保持可见，不隐藏
  });
```

- **关键规则**：`analysisEmpty` 的隐藏只发生在「报告已渲染」的前提下；失败路径必须保持空态 + 按钮可见可点
- **附带检查**：失败路径中 `askSection` 不应展开（追问区只在成功生成报告后显示——现状 finally 里 `classList.remove('hidden')` 无条件展开，需一并改为 succeeded 时展开）

### 验收要点（4 条路径各测一次）
| 路径 | 预期 |
|---|---|
| 无 key | toast 提示 + 空态按钮仍在、可再点 |
| 假 key（401） | toast「密钥无效」+ 按钮仍在 |
| 网络失败/超时 | toast 相应提示 + 按钮仍在 |
| 成功 | 报告渲染 + 空态隐藏 + 追问区展开 |

---

## 4. 【Bug】我的页：API key 输入框不回显已保存的密钥 ✅ 已修复（v1.1）

### 现象与根因
见上文记录：`$('apiKeyInput').value = apiKey` 在事件绑定区执行时，`apiKey` 尚未从 localStorage 加载（加载在文件底部启动区），输入框永远回填空值。

### 细化修复设计
- **修改点**：把 `$('apiKeyInput').value = apiKey;` 从「事件绑定」区删除，在「启动」区 `apiKey = Storage.loadApiKey()` 之后执行回填：

```
/* ---------- 启动 ---------- */
records = Storage.loadRecords();
apiKey = Storage.loadApiKey();
$('apiKeyInput').value = apiKey;   // 回填移到加载之后
renderHome();
```

- **注意事项**：
  - 输入框位于「我的」页（初始 display:none），DOM 已存在即可赋值，无需等页面可见
  - 保存按钮逻辑不变（`apiKey` 变量与 Storage 同步写入）
  - 若用户手动清空输入框并保存 → 应提示而非存空串（现状已有 `if (!key) toast('请输入密钥')` ✓）

### 验收要点
- 首次安装（无 key）：输入框为空
- 配置 key → 杀进程重启 App：输入框回显 key
- 覆盖安装更新：输入框回显 key（localStorage 保留）
- AI 功能正常（读取到 key）

---

## 记录

- 2026-08-06：用户提出改进意见 + 报告 2 个 bug，全部记录
- 2026-08-06：完成上述 4 条的细化设计（本版本），仍未修改任何代码
- 2026-08-06：**v1.1 实施完成**：问候语动态化（时段问候 + AI 提醒组合）、Tab 栏 tab-pill 美化（方案 A）、2 个 bug 修复；versionCode 2 / versionName 1.1
- 2026-08-06：新增第 5 条意见（时段分布改全天 100% 分段展示），仅记录
- 2026-08-06：第 5 条设计决策确认（配色 A 蓝系深浅渐变 / 中心显示最高时段+百分比）
- 2026-08-06：新增第 6 条意见（tab 栏改滑块跟踪样式，参考 D:\Download\index.html），仅记录
- 2026-08-06：**v1.2 实施完成**：时段分布 5 段分段环（蓝系深浅渐变 + 中心最高时段百分比 + 色点图例 + staggered 动画）、tab 栏滑块跟踪（弹性过渡 + 悬停阴影层 + 初始定位）；versionCode 3 / versionName 1.2
- 2026-08-06：新增第 7 条意见（适配安卓全面屏，参考 CSDN 屏幕适配文章），仅记录
- 2026-08-06：新增第 8 条意见（tab 滑块圆角与容器不匹配，修复方案已确认 A），仅记录
- 2026-08-06：**v1.3 实施完成**：全面屏适配（viewport-fit=cover + safe-area-inset 变量应用于 screen/tabbar + androidSystemBarStyle 沉浸配置）、tab 滑块圆角修复（26px 同心 + 跟随三等分格）；versionCode 4 / versionName 1.3
- 2026-08-06：新增第 9 条意见（首页两个记录入口重复），仅记录
- 2026-08-06：第 9 条方案确认 **B（日历升级为历史记录日历视图）**，A 方案删除
- 2026-08-06：新增第 10 条意见（分析页检测到数据自动生成），仅记录
- 2026-08-06：第 10 条决策确认——自动失败重试 3 次（递增退避 2s/4s/8s），全失败才报错给用户
- 2026-08-06：新增第 11 条意见（适配深色模式，参考 CSDN 深色模式适配文章），仅记录
- 2026-08-06：第 11 条决策确认——模式策略「跟随系统 + 手动覆盖」，深色主色 Material #121212
- 2026-08-06：**v1.4 实施完成**：日历视图（月历+角标+选天明细+补记预选）、分析页自动生成（指纹防重复+失败重试 3 次+报错展示）、深色模式（Material 深色变量集+设置页外观三选+防闪烁+图表色变量化+状态栏 colorDark）；versionCode 5 / versionName 1.4
- 2026-08-06：**v1.5 修复**：日历按钮被长问候语（AI 组合文案）挤压变形——`.icon-btn` 加 `flex-shrink: 0`、header 左侧 `flex: 1; min-width: 0`；versionCode 6 / versionName 1.5
- 2026-08-06：新增第 12 条意见（限制问候语长度，方案 A 三保险），仅记录
- 2026-08-06：用户采纳建议 1/3/4/5/7，新增第 13-17 条，仅记录
- 2026-08-06：第 14 条形态确认——小组件 **2x2**（放弃 2x1），仅记录
- 2026-08-06：**v1.6 实施完成**：问候语长度三保险（提示词≤20字+截断+line-clamp）、趋势图 14/30 天切换+月度汇总、情绪-频率关联分析（payload 情绪分布+组合+情绪观察卡）、温和正向反馈（7/30 天里程碑+设置开关）、每日记录提醒（local-notifications 默认关闭 21:00）、桌面小组件 2x2（AppWidgetProvider+点击直达记录面板）、修复 backfillBtn 重复绑定遗留 bug；versionCode 7 / versionName 1.6
- 2026-08-06：删除设置页隐私说明第 3 条「App 使用生物识别锁」误导性文案（功能从未实现，列为计划外修正；若未来实现生物识别锁需加回）
- 2026-08-06：**v1.7 实施完成**：问候语拆层方案（标题固定一行时段问候 ≤13 字永不截断，AI 提醒句移入标题下方小字完整显示，删除组合截断逻辑与 getGreetingPrefix）；删除生物识别锁文案；versionCode 8 / versionName 1.7
- 2026-08-06：新增第 18 条意见（时段分布环图配色升级），方案 **A 多彩时间色** 已确认（iOS 系统色板：黄/橙/绿/青/蓝 + 中心数字改 ink 解耦），仅记录
- 2026-08-06：**v1.8 实施完成**：时段分布环图多彩时间色（浅色 iOS 系统色黄/橙/绿/青/蓝，深色提亮版）、中心数字改 --ink 与环段解耦；versionCode 9 / versionName 1.8
- 2026-08-06：**v1.9 修复环图周长公式 bug**：`C = Math.PI * R` 应为 `2 * Math.PI * R`（少乘 2，v1.2 引入至今）——导致每段弧长减半、dasharray gap=半周长<真实周长产生周期重叠，**所有有数据时段渲染成断裂的两段短弧，环上出现大片空白弧位**（用户反馈「没数据的占了位置没颜色」的根因）；浏览器 canvas 像素级验证修复后环完整连续（深夜蓝 40°-260° 连续大弧）；versionCode 10 / versionName 1.9
- 2026-08-06：新增第 19 条意见（分析页追问回复排版乱：markdown 裸露 + 长段落一坨 + 与报告卡风格不统一），方案草案 A+B（轻量 markdown 子集渲染 + 提示词结构约束），仅记录
- 2026-08-06：用户一次提出 8 条意见，新增第 20-27 条：日历点空白退出、14/30 天切换滑块动效、记录面板分段滑块动效、记录面板两步高度跳动、情绪/诱因自定义添加、【Bug】按钮灰色边框残留、【Bug】补记 NaN、【需求】AI 多提供商可配置（Base URL + Key + 模型 + 连接测试），仅记录
- 2026-08-06：浏览器定位 #25/#26 根因（#25：UA 默认 :focus outline 灰色 ring，作者无 :focus 规则覆盖，WebView 触摸后 focus 残留；修复 CSS 已浏览器验证 ✅。#26：updateTimeDisplay 对空/非法日期时间无兜底，4 条路径实测全触发 NaN），修复方案已写入条目，仍待实施
- 2026-08-06：**v2.0 实施完成（9 条）**：#19 追问回复排版（renderMarkdown 加粗/列表/分段 + 提示词结构约束）；#20 日历点空白退出；#21+#22 首页 14/30 与记录面板分段滑块动效（通用 moveSegSlide/initSegSlide）；#23 记录面板两步统一 min-height 470px 消除 350px 高度跳动；#24 情绪/诱因自定义添加（+ 添加 chip → dialog 输入 → localStorage 持久化）；#25 全局 `*:focus{outline:none}` 修复灰色边框（保留 :focus-visible 键盘样式）；#26 updateTimeDisplay 空/非法回退当前时间 + saveRecord 校验拦截 + 清空自动恢复；#27 AI 多提供商（DeepSeek 默认/OpenAI/自定义，Base URL+模型+密钥配置，旧密钥自动迁移，连接测试分类报错）；versionCode 11 / versionName 2.0
- 2026-08-06：新增第 28 条意见（记录面板 min-height 500px 导致步骤 1 空旷），方案 **2 自适应 + 高度过渡动画** 已确认（去固定高度 + JS 测量过渡 0.35s 弹性），仅记录
- 2026-08-06：新增第 29 条意见（弹层小横杠拖拽关闭 + 出场/退场动画），方案草案（JS 退场过渡 + Pointer Events 拖拽阈值 90px 回弹 + backdrop 淡入淡出），仅记录
- 2026-08-06：新增第 30 条【Bug】（AI 设置卡「模型/API 密钥」label 紧贴上方输入框），浏览器定位根因（.field-label 无上边距 + 输入框无下边距 + 只给 Base URL 加了内联间距），修复方案（组合选择器统一 16px 上间距 + 删内联样式）已写入，仅记录
- 2026-08-06：新增第 31 条【Bug】（记录提醒时间清空后输入框显示为空——存储回退 21:00 但输入框未恢复显示，显示与存储不一致；对比 #26 漏了清空恢复步骤），修复方案（change 监听清空时同步恢复输入框）已写入，仅记录
- 2026-08-06：新增第 37 条意见（小组件点击行为统一：数据看板/连续记录/今日卡片/本周节奏 4 个统计 widget 点击只进 App 首页不弹记录面板；快速记录 widget「快速记录」与「打开面板」双按钮矛盾），方案确认 **A**（删「打开记录面板」按钮，整卡一键快速记录；openApp 扩展 OPEN_HOME 模式 requestCode=2，MainActivity 零改动），仅记录
- 2026-08-06：新增第 38 条意见（首页最近记录/日历列表只可删除不可修改），确认添加「编辑」功能；**AI 算法无需修改**（buildAggregatePayload 实时聚合，编辑即改输入，重新生成即反映）；方案（编辑按钮 + openSheet 'edit' 模式预填 + saveRecord 原地更新保持 id + toast「已更新 ✓」）已写入，仅记录
- 2026-08-06：第 38 条补充需求确认——**修改记录后自动重新生成报告**（保证时效性/可信度）；方案：指纹改造成「过期检测」（当前指纹≠REPORT_FP_KEY 即过期）+ afterRecordsChanged 触发 + 防抖 1.5s + analysisBusy 重入保护 + 刷新提示条不清空旧报告/失败保留旧报告 + maybeAutoGenerate 支持报告可见时过期刷新，仅记录
- 2026-08-06：新增第 39 条【Bug】（分析页「重新生成分析」按钮灰色/禁用），定位两层根因：① regenBtn 用 btn-ghost 灰底灰字，与空状态 btn-primary 风格不一致（视觉误导）；② generateAnalysis finally 不恢复 btn.disabled，失败路径按钮永久禁用 + analysisResult 未隐藏，重进分析页仍禁用。方案（regenBtn 改 btn-primary 统一样式 + finally 恢复 disabled）已写入，仅记录
- 2026-08-06：新增第 40 条【Bug】（我的页 AI 设置「保存」按钮默认灰色像禁用），定位根因：纯视觉——apiKeySave 用 btn-ghost 灰底灰字（浅色 #E5E5EA/#8E8E93，深色 #2C2C2E/#B0B0B4），无 disabled 逻辑实际可点，同区域「测试连接」btn-primary 蓝底对比强烈；与 #39 视觉层同源，同模式存在于所有 ghost 按钮。方案（局部 apiKeySave 改 btn-primary + 全局 btn-ghost 视觉改进加边框深字）已写入，仅记录
- 2026-08-06：第 40 条方案决策确认——**选择全局**：改进 .btn-ghost 视觉（文字 --ink-2→--ink + 1px 边框，深浅色同步适配），所有 ghost 按钮同时受益；放弃局部 apiKeySave 改 btn-primary（双主按钮同屏过重），仅记录
- 2026-08-06：**v2.3 实施完成**：#37 小组件点击统一（OpenMode 三模式 OPEN_HOME/OPEN_RECORD/QUICK_RECORD，requestCode 0/1/2；4 个统计 widget 整卡点击只进首页；快速记录 widget 删「打开记录面板」按钮，整卡+大按钮一键记录）；#38 记录编辑（recent-actions 编辑按钮×2 处、openSheet 'edit' 模式预填多选 chips/时长/看片/备注/时间、saveRecord editingId 原地更新保持 id、toast「已更新 ✓」）+ 修改后自动重生成报告（reportStale 指纹过期检测、scheduleReportRefresh 防抖 1.5s、analysisBusy 防重入、刷新提示条不清空旧报告、失败保留旧报告温和 toast、maybeAutoGenerate 支持报告可见时过期刷新、刷新模式不重试）；#39 regenBtn 改 btn-primary + generateAnalysis finally 恢复 btn.disabled；#40 btn-ghost 全局样式（--ink 主文字 + 1px --line 边框 + 深浅色 hover）；versionCode 14 / versionName 2.3，资源版本 ?v=16
- 2026-08-06：v2.3 浏览器回归中发现并追加修复 6 处：① durSlider max=60 clamp 丢时长（预填 clamp + 保存从 durLabel 解析，编辑 135 分钟记录不再变 60）；② reportFingerprint 升级为内容摘要（digest 覆盖 offset/time/情绪/诱因/时长/看片，note 不参与）——原指纹只看 count/latestId/date，编辑内容不触发刷新，时效性需求不满足；③ regenBtn 绑定传事件对象（否则 btn=null 点击不禁用，防重复失效）；④ scheduleReportRefresh 用「是否在分析页」判断（原用 analysisResult.hidden 不准，首页编辑会后台烧 API）；⑤ refreshReport 前置检查（无 key/无数据不触发，避免刷新条残留 + analysisBusy 卡死）；⑥ editingId 保存后重置。全部浏览器验证通过（编辑保存/预填/时长保真/offset 重算/无重复/自动刷新 1.5s 防抖/失败保留旧报告/无 key 静默/regenBtn disabled 恢复）
- 2026-08-06：新增第 41 条【Bug】（换新手机后系统字体放大，趋势胶囊「30 天」与 API 保存按钮上下排布），浏览器定位根因（textZoom 只放大文本不放大容器：card-head 胶囊被压缩导致「30 天」空格断行；picker-row input min-width:auto 撑大挤压保存按钮），方案（.seg white-space:nowrap + card-head 标题截断胶囊不压缩 + picker-row input min-width:0/按钮 flex-shrink:0）已写入，仅记录
- 2026-08-06：**v2.4 实施完成**：#41 textZoom UI 修复（.seg nowrap、card-head > div:first-child 截断 + #chartSeg flex-shrink:0、.picker-row input min-width:0 + .btn-ghost flex-shrink:0）；浏览器 font-size ×2.0 模拟验证（胶囊单行完整、API 行并排）；新手机（3B163A002UT00000）真机验证 6 项 PASS + 编辑功能回归 11 项 PASS；versionCode 15 / versionName 2.4，资源版本 ?v=17
- 2026-08-06：新增第 42 条【Bug】（配置 AI 时软键盘把底部 tab 栏顶起来），定位根因（真机 .phone height:100vh + .tabbar absolute bottom，Capacitor adjustResize 压缩 WebView 高度 → tabbar 贴到键盘上方），方案草案（visualViewport resize 监听 → 键盘显示时 tabbar 加隐藏态）已写入，待确认，仅记录
- 2026-08-06：新增第 43 条【Bug】（AI 提供商切换时 API 密钥不清空——自定义 key 残留到 DeepSeek，保存后 401），定位根因（applyProviderPreset 只更新 baseUrl/model 不处理 apiKeyInput + 单份配置存储不按提供商区分），方案草案 A（切换清空密钥 + 提示，推荐）/ B（按提供商分别存储含迁移）已写入，待确认，仅记录
- 2026-08-06：第 43 条方案决策确认——**选择方案 B（按提供商分别保存密钥）**：aiConfig 扩展 per-provider 结构 + active 记忆 + v1 旧配置迁移（旧 key 归入原 provider），切换自动回显；A 方案弃用，仅记录
- 2026-08-06：第 42 条方案决策确认——**键盘弹出时隐藏 tab 栏**（visualViewport 检测 + .keyboard-up 移出屏外），仅记录
- 2026-08-06：**v2.5 实施完成**：#42 键盘弹出隐藏 tabbar（isKeyboardUp 视觉视口差 >150px + visualViewport/window resize 监听 + .tabbar.keyboard-up translateY(180%)/opacity 0 过渡）；#43 per-provider 密钥（guanji_ai_config_v2 {providers, active} + v1 迁移旧 key 归入原 provider + 旧独立 apiKey 归入 deepseek + switchProvider 切换回显完整配置 + saveAIConfig 按 active 保存 + syncActiveConfig 扁平视图）；浏览器验证（迁移/回显/切换/持久化全过；CDP 确认 keyboard-up 规则生效，headless 不推进过渡属环境限制）；真机验证（#43 全过；#42 class/CSS/过渡全过；旧手机 Flyme 键盘为 overlay 模式视口不变属机型差异，adjustResize 机型真实键盘待新手机插回验证）；versionCode 16 / versionName 2.5，资源版本 ?v=18
- 2026-08-07：新增第 44 条【Bug】（记录页/日历页点空白退出时卡片模糊感，疑似退场动画），定位根因（.sheet backdrop-filter blur(30px) 毛玻璃 + 退场下滑 opacity 0.6 → 玻璃条扫过内容），方案草案（退场时临时关 backdrop-filter / 切不透明背景 / 缩短动画）已写入，仅记录
- 2026-08-07：新增第 45 条【Bug】（深色模式首页日历图标不可读），定位根因（backfillBtn SVG 硬编码 stroke="#000000"，深色背景 #121212 上不可见），方案草案（stroke 改 currentColor + .icon-btn color:var(--ink)，检查全站硬编码图标色）已写入，仅记录
- 2026-08-07：新增第 46 条意见（编辑记录跳入开始页而非详情页——openEditRecord 复用 openSheet 默认第一步），方案草案（编辑直达第二步详情，保留时间 seg 可调）已写入，仅记录
- 2026-08-07：新增第 47 条意见（自定义添加项对话框：键盘弹出无确认提示、Enter 直接添加、无删除选项），定位现状（openAddDialog focus 弹键盘 + keydown Enter 直接 confirmAddCustom + 自定义项无删除 UI），方案草案（对话框按钮键盘可见 + 字数提示 + 自定义 chip 删除入口待确认交互）已写入，仅记录
- 2026-08-07：第 47 条方案决策确认——删除交互选**长按弹出删除确认**（600ms 长按自定义 chip → 确认弹层），仅记录
- 2026-08-07：**v2.6 实施完成**：#44 退场动画关闭毛玻璃（animateSheetClose 动画期间 backdropFilter:none + resetSheetStyle 恢复，消除玻璃条扫过内容的模糊感）；#45 图标颜色变量化（index.html 硬编码 #000000/#C7C7CC/#007AFF → currentColor ×7 处，.icon-btn 加 color:var(--ink)，深色模式日历图标/行箭头/模拟状态栏全部自适应）；#46 编辑直达详情（openEditRecord 单页编辑：stepTime 保留可见时间 seg 可调 + stepDetails 直接展开 + saveBtn 显示、next/prev 隐藏）；#47 添加对话框字数提示（n/6 实时）+ 长按删除自定义项（data-custom 标记 + 600ms 长按确认弹层 + 删除后重渲染，内置预设不可删、历史记录不受影响）；versionCode 17 / versionName 2.6，资源版本 ?v=19
- 2026-08-07：**#44/#47 用户复测未通过**——#44 仍有「段落感」（v2.6 只关 blur，opacity 0.6 半透明下滑仍有叠影，升级方案：退场时背景转不透明 var(--card)）；#47 三处新问题（① 长按触发系统复制菜单——系统长按 500ms 早于 600ms，修复 user-select:none + touch-callout:none + pointerdown/contextmenu preventDefault；② 删除确认卡片被记录卡片遮住——.backdrop z-index 20 < .sheet 30，修复 dialog 弹层 z-index 提至 40；③ 添加流程不透明——Enter 直接提交造成「退出键盘即添加」错觉，修复移除 Enter 提交 + 键盘弹出对话框上移 + 「将添加：xxx」预览），条目标记回待修复/待实施，仅记录
- 2026-08-07：**v2.7 实施完成**：#44 退场背景转不透明（animateSheetClose 动画期间 background:var(--card) + backdropFilter:none，resetSheetStyle 恢复——下滑为实心卡片，彻底消除半透明叠影段落感）；#47 三处（① chips user-select:none + -webkit-touch-callout:none + pointerdown preventDefault + contextmenu 拦截，长按不再触发系统复制菜单；② addBackdrop/delBackdrop 加 .dialog-layer z-index:40（高于 sheet 30），删除确认不再被面板遮住；③ 移除 Enter 直接提交（只能点「添加」）、输入时「将添加：xxx」预览、键盘弹出时对话框 translateY(-24%) 上移按钮不被遮挡）；versionCode 18 / versionName 2.7，资源版本 ?v=20
- 2026-08-07：**#47 v2.7 复测反馈**——添加窗口键盘弹出时整体偏上：根因（adjustResize 下视口压缩 + backdrop flex 居中已自动把对话框放在键盘上方，-24% 手动上移双重复合导致偏上），方案（移除 kb 手动上移规则与联动，依赖系统压缩居中），仅记录
- 2026-08-07：**#47 v2.7 复测反馈 2**——① 删除首次长按无效二次才成功：根因推断（Android WebView 系统长按文本选择菜单原生层抢跑，DOM contextmenu 拦不住），方案 A（自定义 chip 右上角 × 删除按钮，推荐）/ B（长按缩短 400ms）待确认；② 添加框「将添加」预览残留上次输入：根因实锤（openAddDialog 漏清 addPreview），修复方案（补清空）已写入，仅记录
- 2026-08-07：**#47 删除交互方案决策确认——方案 A（chip 右上角 × 按钮）**：仅自定义项显示 ×，点击弹删除确认，绕开系统长按冲突；长按删除逻辑（initChipLongPress/longPressFired/pointerdown preventDefault/contextmenu 拦截）随补丁移除；方案 B 弃用，仅记录
- 2026-08-07：**#44 v2.7 复测反馈 2**——退场「先降透明度卡一下，然后才退出完成」：根因已定位（animateSheetClose 同时过渡 transform+opacity，transform 弹簧曲线起始段斜率极慢而 opacity ease 均匀下降 → 感知先透明卡顿再滑动），方案（退场去掉 opacity 过渡只保留下滑，backdrop 淡出保留），仅记录
- 2026-08-07：**v2.8 补丁实施完成**：#44 退场去掉 opacity 过渡（只下滑，backdrop 淡出保留——无「先透明卡顿」）；#47 移除 kb 手动上移（-24% 规则与联动删除，adjustResize 压缩视口自动居中，对话框不再偏上）；#47 openAddDialog 补清 addPreview（预览残留修复）；#47 删除交互改方案 A（chip × 按钮：attachChipDelete 附加 ×、.chip-x 样式、click stopPropagation + 删除确认；长按逻辑 initChipLongPress/longPressFired/pointerdown preventDefault/contextmenu 全部移除）；versionCode 19 / versionName 2.8，资源版本 ?v=21
- 2026-08-07：**#44/#47 v2.8 复测反馈**——退出生硬（日历卡片 + 添加卡片）：根因 1（sheet 退场弹簧曲线起始段 ~0.1s 不动再加速 → 顿感，改快启慢停曲线）；根因 2（dialog 关闭直接 display:none 无退场动画，需加 animateDialogClose 淡出+位移），方案已写入，仅记录
- 2026-08-07：**v2.9 实施完成**：#44 sheet 退场曲线改快启慢停（transform 0.22s cubic-bezier(0.55,0,0.55,0.2)——开始即滑无顿感，替代弹簧曲线）；#47 新增 animateDialogClose（淡出 + translateY(10px) 0.2s 后隐藏，fadeUp 动画层先关闭防覆盖），closeAddDialog/closeDeleteDialog 走退场动画——添加/删除卡片不再瞬间消失；versionCode 20 / versionName 2.9，资源版本 ?v=22
- 2026-08-07：新增第 48 条【Bug】（编辑面板拖拽小横条退出后首页编辑按钮残留选中状态；点空白退出无此问题），初步定位（焦点残留：拖拽路径 pointer capture 无 click 语义不 blur 按钮，点空白路径 pointerdown 在 backdrop 移走焦点），方案草案（openEditRecord 主动 blur 触发按钮），待真机确认，仅记录
- 2026-08-07：#48 真机定位确认——触摸点击编辑按钮焦点落于按钮（activeElement=recent-edit）；拖拽退出（adb swipe 真实模拟）后焦点仍残留（focusOnBtn:true），点空白退出无残留；方案定案（openSheet 统一 blur 当前焦点，编辑/新增/补记全受益；:focus-visible 键盘环保留），仅记录
- 2026-08-07：新增第 49 条意见（退场动画平滑化：日历/记录卡片点空白退出做平滑效果），定位现状（v2.9 遮罩 ease 均匀淡出与卡片快启慢停下滑曲线不同步、缺乏一体感），方案草案（统一 easeOutCubic 曲线 + 0.3s 时长 + 卡片同步淡出与微缩放 scale(0.98) + dialog 统一），待确认微缩放是否采用，仅记录
- 2026-08-07：**v3.0 实施完成**：#48 openSheet 统一 blur 当前焦点（面板打开即清除触发按钮焦点，拖拽退出不再残留高亮；:focus-visible 键盘环保留）；#49 退场平滑化（sheet 与 backdrop 统一 easeOutCubic cubic-bezier(0.33,1,0.68,1) 0.3s——下滑 translateY(100%) + 微缩 scale(0.98) + 同步淡出（两属性同曲线同速，无「先透明」），遮罩与卡片一体退场；animateDialogClose 同曲线 0.25s 统一）；versionCode 21 / versionName 3.0，资源版本 ?v=23
- 2026-08-07：新增第 50 条【Bug】（触摸设备按钮取消选中后残留 hover 黑字——点击变蓝、再点取消边框恢复但字仍黑、第三次才完全恢复；全 App 共性问题），浏览器真实鼠标复现根因（指针停留 :hover 粘滞，.chip:hover color:var(--ink) 覆盖基础灰字；styles.css 共 16 条 :hover 规则受影响），方案（全部 :hover 规则包裹 @media (hover: hover)，触摸设备无粘滞）；**用户指定版本号不变（保持 v3.0，实施时跳过版本升级）**，仅记录
- 2026-08-07：**#50 实施完成（版本号保持 v3.0，versionCode 21 不变）**：16 条 :hover 规则全部包裹 @media (hover: hover)（icon-btn/tab/btn-primary/btn-ghost×2/btn-danger/record-btn/row-btn/seg/chip/chip-add/cal-nav/cal-cell×2/recent-del/recent-edit）；资源版本 ?v=23→24（?v 是缓存标识非版本号）；真机验证 4 项 PASS——真实触摸点击变蓝 rgb(0,98,204) → 取消选中**直接恢复灰字 rgb(142,142,147)**（修复前为黑 rgb(0,0,0)）；桌面鼠标 hover 效果保留（浏览器真实 hover 黑字仍在）
- 2026-08-07：新增第 51 条意见（「就现在」改造成运动记录式计时：点下一步开始计时、结束跳转记录页选情绪诱因、时长精准），判断契合觉察定位 + 与 widget 快速记录分工 + 技术可行（durLabel 数据源支持任意时长）；方案草案（计时器态步骤一 + 开始/结束 + 自动进详情预填 + 中途退出取消不保存）与 3 个待确认问题已写入，仅记录
- 2026-08-07：#51 补充——用户提出计时中切出应用用安卓实况通知（Live Updates）显示计时（官方文档链接）；确认可行（targetSdk 36 ≥ 35、WidgetStatsPlugin 插件先例、计时器为官方适用场景），且 WebView 切后台 JS 定时器挂起 → 通知 chronometer 系统级计时是后台精准计时的解法；写入「扩展：计时通知」小节（提升条件/降级链/POST_NOTIFICATIONS 权限/setDeleteIntent/Flyme OEM 验证），仅记录
- 2026-08-07：#51 待确认问题全部拍板（方案 A×3）——计时中关闭面板取消不保存 + 温和提示；时长按分钟取整（不足 1 分钟按 1）；计时态隐藏「现在/补记」seg；实况通知降级链默认方案无异议（15+ 提升 / 12-14 常驻 / 权限拒绝纯 App 内计时），仅记录
- 2026-08-07：#51 细化为 **v4.0 核心更新**（用户指定）——完成代码核对（openSheet/saveRecord/closeSheet/插件调用/registerPlugin 全部对接点确认）+ 资料佐证（实况通知 = Android 16/API 36 特性，compileSdk 36 + target 36 项目已满足；setRequestPromotedOngoing 由 androidx.core 1.17.0-alpha01 加入，项目 1.17.0 恰好包含；MDN 佐证 hidden 页面 rAF 停止/定时器限流 → 时间戳差值渲染 + 系统级 chronometer 双保险；官方提升条件清单全部满足）；新增设计：杀进程恢复机制（ongoing 通知不随进程消亡，localStorage 持久化 startTime + 启动检测恢复）、deleteIntent 广播标记（划掉不强行拉起 App）、权限降级链、边界清单、验证计划；实施清单扩至 11 项，仅记录
- 2026-08-07：#51 补充 5b——用户提出①保留经典模式（有人喜欢原来的「就现在」：下一步→手动时长）加按钮选择；②像测试 AI 一样加实况通知测试（验证手机是否支持）。判断：经典模式需保留但避免每次二选一负担（计时主推 + 步骤一「不想计时？直接填写」小字入口 + 设置页「记录方式」偏好）；通知测试价值大于 AI 测试（OEM 是否真支持提升，直接成为真机验证工具，getLiveUpdateStatus 分级提示 + 15s 示例通知）。方案写入 5b，3 个待确认问题（默认记录方式/测试按钮位置/入口文案）已列，仅记录
- 2026-08-07：#51 5b 深化定稿（3 项全部按推荐确认）——「记录方式」默认计时（localStorage guanji_record_mode，openSheet('now') 读取分流计时器态/经典流程）；经典入口「不想计时？直接填写」（不改变偏好）+ quick 模式对称入口「想要精准计时？开始计时」；测试按钮落位设置页「关于」卡独立小卡（内联 3 行状态区：系统/通知权限/实况通知，比 toast 持久），分级处理（16+ 可提升发测试通知 / 12-15 普通通知 / 权限拒绝引导），测试通知 15s 自动取消；quick 模式天然无计时冲突（幂等入口），仅记录
- 2026-08-07：**#51 实施完成（v3.1，versionCode 22，用户指定版本号 3.1）**：计时状态机（startTimedRecord/finishTimedRecord/cancelTimer/renderTimerTick，纯时间戳差值零累积误差；分钟取整不足 1 按 1）；计时器态 UI（timerBox 大数字 tabular-nums + seg/pickerRow 隐藏 + nextBtn「开始记录/结束记录」）；「不想计时？直接填写」直达详情 + quick 模式对称入口（会话级切换不改偏好）；记录方式设置卡（timer/quick 默认 timer）；设置页「实况通知」测试卡（getLiveUpdateStatus 内联 3 行分级 + testLiveUpdate 15s 自消）；杀进程恢复（guanji_timer_v1 启动检测 → 恢复面板 + toast）；closeSheet 计时中取消不保存 + 温和提示；visibilitychange 切回校正；TimerLiveUpdatePlugin.kt（渠道 IMPORTANCE_LOW/ongoing/chronometer/when/progress/API36 setRequestPromotedOngoing/deleteIntent 广播/POST_NOTIFICATIONS 权限回调/getLiveUpdateStatus/testLiveUpdate）+ TimerDeleteReceiver.kt（划掉标记不拉起 App）+ ic_stat_timer.xml + Manifest 双权限 + MainActivity registerPlugin + 划掉标记 JS 提示；nextBtn 分流按当前面板计时器态而非偏好（修掉 quick 偏好 + 恢复计时的组合 bug，浏览器回归抓出）；版本 v3.1/22/资源 ?v=25；浏览器回归 11 项 PASS + 真机 8 项 PASS（魅族 Android 16：canPostPromoted=false 实况通知提升不可用 → 降级链生效，普通常驻通知 posted 验证（id 4101/ONGOING_EVENT/title「观己 · 计时中」/contentIntent/deleteIntent）、结束计时通知消失、杀进程恢复 00:23 精确）；截图存档 2 张（通知栏 + 计时面板）
- 2026-08-07：新增第 52 条意见（魅族实况通知适配——用户提供 GitHub Demo Ruyue-Kinsenka/Flyme-Live-Notification-Demo），已通读源码分析：魅族私有胶囊机制 = 标准通知 addExtras 注入私有 key（is_live/notification.live.operation/type/capsule{status/type/content/icon/bgColor/contentColor/remote.view}）+ 自定义 contentView + IMPORTANCE_HIGH + VISIBILITY_PUBLIC；判断可行（魅族走胶囊/非魅族标准提升双轨，未知 extras 无副作用）但必须 Build.MANUFACTURER 判断仅在魅族附加（contentView 会破坏标准提升条件）；胶囊 RemoteViews 可用 Chronometer 组件系统级走秒；方案/实施清单/2 个待确认问题（是否实施、渠道重要性）已写入，仅记录
- 2026-08-07：**#52 实施完成（v3.2，versionCode 23）**：isFlyme() 检测（Build.MANUFACTURER==Meizu）；Flyme 分支——startTimer/testLiveUpdate 在标准通知（ongoing/chronometer/Progress）基础上 addExtras 魅族私有胶囊（is_live=true/operation=0/type=2/capsule{status=1/type=5/content「观己 · 计时中」/icon 时钟/bgColor #007AFF/contentColor 白/capsule.content.remote.view=flyme_live_capsule 布局}）+ notification.contentView 换 flyme_live_content 布局（标题 + Chronometer）；胶囊/主内容 RemoteViews 均用 Chronometer 组件（SystemClock.elapsedRealtime 换算 base，系统级走秒后台精准）；仅魅族附加（非魅族标准提升条件不被破坏）；新布局 flyme_live_capsule.xml/flyme_live_content.xml；渠道保持 IMPORTANCE_LOW（胶囊生效与渠道关系待观察）；真机验证：dumpsys 确认 extras 全部注入（is_live=true/operation=0/type=2/capsule Bundle 2436B）+ contentView 附加（0x7f0b0020），通知栏截图确认自定义布局生效（「观己 · 计时中 已计时 00:12」系统级秒数跳动），**用户确认魅族实况通知调用成功**；版本 v3.2/23/about-ver v3.2；截图存档 v32_flyme_capsule.png
- 2026-08-07：新增第 53 条意见（排版设计规范——统计全项目标题字体/字号/间距并文档化应用），已全量核对 styles.css 完成统计（字号阶梯 9-52px 共 19 档、权重体系 400/500/600/700/800、字距三档 -0.02~0.14em、行高四档 1.0~1.9、间距规范 5 组）；应用结论：体系已高度自洽（report-title=card-title、弹层标题统一 800、13px 次级强调统一、无同语义漂移），仅标注 2 处有意差异（about-name 0.06em 品牌感、timer-display +0.02em tabular 对齐）；规范写入 #53，仅记录
- 2026-08-07：新增第 54 条意见（「就现在」计时升级全屏沉浸式计时页——用户描述「开始记录后还是在小卡片里，想要像运动 App 一样一整页都是时间」，代理补充细化：运动 App 进行中页形态（脉冲徽标/超大 96-120px 等宽时间/开始时刻小字/底部大按钮）+ 交互流（面板收起→全屏淡入→结束回面板详情预填→保存；下滑/退出=取消；杀进程恢复直进全屏）+ 技术方案（#timerScreen 覆盖层 z-index 60、渐变背景变量化、timerState/通知/持久化全复用）；4 个待确认问题（暂停功能/退出方式/背景风格/返回键），仅记录
- 2026-08-07：#54 待确认问题全部按推荐拍板——不加暂停（两态保持）；下滑/退出=直接取消不弹确认；主题蓝渐变背景；返回键拦截=取消计时+温和提示，仅记录
- 2026-08-07：**#54/#55/#56 实施完成（v3.3，versionCode 24）**：①#54 全屏沉浸式计时页——timerScreen 覆盖层（z-index 60，主题蓝渐变 --timer-bg-1/2、脉冲「进行中」徽标、96px tabular-nums 大时间、开始时刻小字、白色大圆「结束记录」按钮 + 「取消计时」）；startTimedRecord→showTimerScreen（面板保留在层下）、finishTimedRecord→hideTimerScreen+回详情预填、cancelFromTimerScreen（取消+关面板+提示）、history.pushState+popstate 拦截返回键取消；restoreTimer 恢复直进全屏；renderTimerTick 同步更新双显示；②#55 补记入口回归——setupNowStep timer 模式未计时时恢复 timeSegRow 显示（就现在=计时器态/补记=经典流程），nowSeg/customSeg 点击联动（timerBox 隐藏/显示、nextBtn 文案、modeLink、pickerRow），计时中 running 分支保持隐藏 seg；③#56 编辑移除「就现在」——openSheet edit 分支额外隐藏 timeSegRow（pickerRow 保留=纯补记语义，杜绝历史记录被覆盖为当前时刻）；版本 v3.3/24/?v=26/25/about-ver；浏览器回归全过（seg 回归/补记切换/全屏走秒/结束回详情/取消/返回键/恢复直进全屏 01:40/quick 回归/编辑无 seg）+ 真机 7 项 PASS（verify-v53.js）；截图存档 v33_timer_fullscreen.png
- 2026-08-07：新增第 57 条意见（实况通知能力细化——双轨已验证后扩展交互闭环）：盘点现状（计时通知/标准 Live Updates/魅族胶囊/恢复/降级链/测试按钮/划掉提示/点击打开）；方案按价值排序 A 通知栏快捷操作（结束并记录/取消，标准 Action + 魅族 contentView 按钮 + JS 桥）、B 点击通知直达全屏计时页（contentIntent extra）、C 锁屏 VISIBILITY_PUBLIC、D 温和时长提醒（30/60 分钟可选）；明确不做（目标化进度条/暂停/提醒类实况）；3 个待确认问题（结束直达详情/温和提醒纳入/点击直达全屏），仅记录
- 2026-08-07：#57 决策确认——用户指定「实现 A」（通知栏快捷操作：结束并记录/取消），A 直达详情子决策并入方案确认；B（点击直达全屏）/C（锁屏可见）/D（温和时长提醒）暂缓未拍板；计划写入，仅记录
- 2026-08-07：**#57-A 实施完成（v3.4，versionCode 25）**：①原型先行（prototype/live-notification.html 五场景，用户定稿：300px 手机框、信息分层——标题/26px 秒数/进度条/按钮各行独立、删除副文本行）；②TimerLiveUpdatePlugin——startTimer 加 2 个 Action（「结束并记录」requestCode=4 + EXTRA_GUANJI_TIMER_FINISH /「取消」requestCode=5 + EXTRA_GUANJI_TIMER_CANCEL，timerActionPendingIntent），魅族 contentView（flyme_live_content.xml）加两个文字按钮（结束并记录蓝/取消灰，setOnClickPendingIntent 同 PendingIntent）；③MainActivity——两个常量 + handleTimerIntent（onCreate/onNewIntent）→ runWhenReady JS 桥；④app.js——window.__guanjiTimerFinish（running→finishTimedRecord 直达详情）/__guanjiTimerCancel（running→cancelFromTimerScreen 取消+提示）；冷启动衔接：进程被杀点按钮 → JS restoreTimer 先恢复 → JS 就绪后触发 finish/cancel；版本 v3.4/25/app.js?v=26；真机验证（魅族，按用户要求只验魅族路径）：dumpsys actions=2 + contentView 0x7f0b0020、热启动真实 intent finish（details=true/dur 预填/key 清）、冷启动 force-stop+finish intent（恢复→结束→详情 1 分钟）、cancel 真实 intent（running=false/无详情/key 清）；截图存档 v34_notif_actions.png；B/C/D 暂缓
- 2026-08-07：#52 样式强化补丁（用户反馈「胶囊展开态所有样式都没生效」）——真机实测定位：魅族渲染 contentView 只尊重代码显式 set 的属性（XML 样式声明被系统卡片模板覆盖，浅色卡片黑字）；修复：flyme_live_content.xml 重写（content_root 加 flyme_live_bg 渐变 drawable 背景 + 白字）+ buildFlymeContentRv 全部显式 set（setBackgroundResource/setTextColor/setTextViewTextSize：标题 14sp 白 bold、秒数 30sp 白 bold、按钮 13sp 白/白 75%）；真机验证样式生效（蓝色渐变卡片 + 白色标题/大秒数/按钮，与系统浅色通知区分明显，层次协调）；版本号不变（v3.4 内补丁）；截图存档 v34_styled_expand.png
- 2026-08-07：新增第 55 条【Bug】（计时模式下「补记」入口消失——用户反馈「更新后点击记录只剩直接记录和不想计时了，补录功能怎么没有了」），根因已定位：#51「计时态隐藏 seg」决策副作用——默认 timer 模式步骤一不再有「就现在/补记」切换，补记入口从主面板消失（只剩日历入口）；quick 模式不受影响；修复方案（未计时时恢复 seg 显示：就现在=计时器态/补记=经典流程，计时开始后 seg 隐藏保留），仅记录
- 2026-08-10：新增第 106 条（加密后卡片对称优化）：加密态「关闭加密」改为顶部大按钮（btn-danger 全宽，与「开启加密」btn-primary 对称）——secureStatus 带锁标识；secureActions 只留修改口令；1 个待确认（关闭按钮颜色 btn-danger vs btn-primary）；仅记录
- 2026-08-10：新增第 105 条（数据卡间距 + 加密后优化）：真机测量——row-btn 节距 52px 均匀，状态说明与操作组 56px 偏松；加密操作与数据操作连列表无分组感；加密后卡片缺「已加密」视觉反馈；方案（状态行高收紧+组间距 10px；加密状态加锁标识+蓝色高亮；分组小标题）；2 个待确认（分组样式/标识形式）；仅记录
- 2026-08-10：**#103/#104 实施完成**：#103 toast 超长——文案缩短（明文「已保存到 下载/文件名」/加密「已保存加密备份：下载/文件名——受口令保护」）+ toast CSS 改多行（white-space normal + max-width 86% + 居中）；#104 导入定位下载目录——原生桥扩展 listBackupFiles()（MediaStore 查 guanji-backup-%/export-% 倒序）+ readDownloadedFile()（按名读内容），导入弹窗自动列出下载目录备份（点选即读取）+「浏览其他位置」兜底；真机完整链路（加密导出→下载 json→导入列表显示）✓；资源 v=88
- 2026-08-10：新增第 103/104 条（导出导入体验优化）：#103 导出 toast 路径超长（ui-sheet.js:640/611 完整路径 60-80 字符超屏——方案：缩短「下载/文件名」+ toast 多行检查）；#104 导入定位导出目录（导出固定公共 Download——方案：原生桥 listBackupFiles() 列出下载目录备份文件点选 + 保留浏览其他位置）；仅记录
- 2026-08-10：**#102 导出保存入口优化（用户「导出面板根本没有文件管理」）**：定位——Flyme 分享面板「文件管理」点击后进扫码快传界面（非标准保存）；实施 SaveToDownloadsPlugin 原生桥（MediaStore.Downloads，Android 10+ 免权限）+ manifest WRITE_EXTERNAL_STORAGE maxSdk 28；导出流程改为保存到公共 Downloads + toast 完整路径，失败降级 Share/剪贴板（明文 CSV + 加密 JSON 均走）；真机验证（toast 路径 + adb 确认文件真实存在 120B）✓；资源 v=87
- 2026-08-10：**「share canceled」报错修复（用户「退出面板时提醒 share canceled」）**：根因——Capacitor Share 插件对 RESULT_CANCELED（用户取消面板）reject「Share canceled」，我们 catch 原样 toast 报错；修复：导出 catch 识别 cancel → **静默**（取消分享是正常操作，不打扰），非取消错误才 toast；同时实测分享面板选项（微信/QQ/**文件管理**/邮件全列——「文件管理」即保存入口）→ toast 引导文案改「选『文件管理』即可保存」；真机验证：取消面板后无任何 toast ✓；资源 v=86
- 2026-08-10：**#99/#100 实施完成（#101 暂缓）**：#99 导入「选择备份文件」label 加 for 关联隐藏 file input（点击可弹系统文件选择器）；#100 口令机制说明——加密导出 toast「受你的加密口令保护，分享面板选『保存到文件』即可存到你的目录」+ 明文导出 toast 文件名引导 + 导入弹窗文案「输入创建该备份时设置的口令（即开启加密时的口令）」/标题改「导入备份」/placeholder 同步；真机验证（label 关联/文案/标题）全过；资源 v=85
- 2026-08-10：新增第 99/100/101 条（导出导入体验）：#99【Bug】导入「选择备份文件」点击无反应（根因：label 缺 for 关联隐藏 file input）；#100 口令机制困惑（导出时口令已随信封打包无需再输——导出 toast 需说明「受加密口令保护」、导入说明「创建者口令」）；#101 导出后打开存储管理（方案 A toast 引导+B 路径提示 组合，C 原生跳转成本高暂缓）；仅记录
- 2026-08-10：**#97 分割线修复（用户「4 按钮 6 条线」）+ 分享面板修复（v82-v84）**：#97 删除 2 条 card-section-divider——row-btn 自带 border-bottom 列表线自然分隔（iOS 设置页列表风），卡片内连续列表；真机验证 dividers 0/7 按钮/列表线在 ✓；分享面板不弹出根因（logcat SecurityException：cache 目录 FileProvider grant 在魅族失败）→ 导出目录 CACHE 改 EXTERNAL（明文 CSV/加密 JSON 两处）+ writeFile 补 encoding:'UTF8'（Capacitor 8 字符串必须 UTF8）；EXTERNAL+Share 面板弹出验证（微信/QQ/文件管理全列）✓；资源 v=84；截图 v84_data_card
- 2026-08-10：新增第 97/98 条（数据卡细节）：#97 分割线过多（用户数出「4 按钮 6 条线」属实——4 条 row-btn 自带 border-bottom + 2 条 card-section-divider；方案：删 divider，row-btn 列表线自然承担）；#98 导出地址提醒（Share 面板由用户选位置，App 无法获知路径——方案：toast 引导「在分享面板选保存到文件」+ 文件名提示）；仅记录
- 2026-08-10：**数据卡布局优化（用户「导出数据下面两条分割线 + 明文也要文件导出」）**：①「导入备份」从加密操作组移到备份区块（明文/加密均可用）——备份区块 = 导出数据 + 导入备份一组，两条分隔线对称（加密区下一条/危险区上一条），不再夹单按钮；②明文导出改文件（CSV + Filesystem.writeFile + Share.share，文件名 guanji-export-日期.csv；浏览器降级剪贴板）；真机验证（export→import 相邻 gap 0、两 divider 位置正确、明文导出走文件分支）✓；资源 v=81；截图 v81_data_card
- 2026-08-10：**数据卡合并（用户「把数据加密和数据管理两个板块合为一个」）**：两卡合一为「数据」卡三区块（.card-section-divider 分隔）——①加密区块（状态/开启/修改口令/导入备份/关闭加密）②备份区块（导出数据——模式自适应）③危险操作（清除/恢复演示数据）；删除冗余「导出加密备份」按钮（#96 exportBtn 已承担，secure.js 同步删绑定防 null 崩溃）；说明文案保留卡底；真机验证（单卡/7 按钮/2 分隔线/加密流程正常）；资源 v=80；截图 v80_data_card_merged
- 2026-08-10：**#94/#95/#96 实施完成（加密体验闭环）**：#94 弹窗输入框样式（.dialog 选择器扩展 text/password/textarea 统一 + focus 态）；#95 加密备份导出改文件（Filesystem.writeFile + Share.share，文件名 guanji-backup-日期.json 不含敏感信息，浏览器降级剪贴板）+ 导入改文件选择（input[type=file] + 文件名显示 + 口令）；#96 数据管理模式自适应（exportBtn：明文=CSV / 加密=加密备份文件，一个按钮两行为；清除/恢复补加密提示文案）；真机验证（password 样式生效/文件导出分支调用/导入文件元素）；资源 v=79；截图 v79_secure_ui
- 2026-08-10：新增第 94/95/96 条（数据弹窗与加密体验）：#94【Bug】数据加密/导入弹窗输入框无样式（根因：.dialog input 选择器只覆盖 type=text，password/textarea 落空）；#95 加密备份导出改文件形式（现状剪贴板 JSON，方案：Filesystem+Share 导出 .json 文件、导入支持选文件）；#96【Bug】数据管理与加密模式冲突（加密后 CSV 导出禁用→数据管理卡失效；方案：exportBtn 按模式自适应——明文 CSV/加密密文备份文件，清除/恢复补温和提示）；仅记录
- 2026-08-10：**演示数据 v2（用户「更新演示数据，更好测试功能」）**：30 天窗口（-29..0，62 条）——热力图 4 档色阶全出现（1-2 档 15 天/3-5 档 9 天/6+ 档 1 天深蓝）；最近 7 天连续有记录（连续里程碑/周对比可测）；时段分布 4 段覆盖（深夜 38/傍晚 14/下午 7/清晨 3，TIME_PATTERN 补清晨）；5 种触发词/情绪全覆盖；备注 16 条（26%）+ 看片 28 条（测试明细/导出/报告）；月度对比可测（本月 25 次 -32% 测 down 色）；确定性可复现（seeded）；资源 v=78；截图 demo_v2_device
- 2026-08-10：**趋势卡 footer 冲突根因定位与修复（用户「底部文字按钮冲突还是没有解决」）**：真机实测定位——month-summary 内容 211px 溢出 172px 容器 39px（「本月 10 次 · 日均 1.0」126px + 「较上月 +67%」77px），nowrap 强制一行 → 溢出文字冲进 seg 间隙（此前只验 gap 数值没查 overflow）；修复：①文案精简——主项去「日均」（热力图/面积图已覆盖该信息）、delta 去「较上月」前缀（颜色+符号表方向）②布局硬化——ms flex:1 + min-width:0 + 主项 ellipsis 兜底；真机验证：溢出 false、间距 20、极端数据（本月 40 次 -33%）无溢出、空数据正常；资源 v=76；截图 footer_fixed_v76
- 2026-08-10：**热力图六轮优化（用户「格子不要微光，平涂色块就好」）**：.heat-cell 移除 inset 上亮下暗 box-shadow（不再有玻璃光泽感），纯平涂色块；圆角 8px 保留；浏览器+真机验证（shadow none/radius 8px/14 天 2 行）全过；资源 v=75；截图 heatmap_v6_flat_device
- 2026-08-10：**热力图五轮优化（用户「14 天两行能搞定为何三行」）**：改为**固定行数网格**——rows = ceil(days/7)（14 天恒 2 行、30 天恒 5 行），连续天数行主序排列、无空占位；移除星期表头（列不再对应自然周，表头语义失效）；格子仍 1fr 填满列宽；浏览器+真机验证（14 天 2 行 14 格/30 天 5 行 30 格/无表头）全过；资源 v=74；截图 heatmap_v5_2rows / heatmap_v5_device
- 2026-08-10：**footer 间距加固（用户复反馈「较上月与 seg 贴一起」）**：承认盲区——前几轮只验证演示数据短文案；本轮真机实测 v71 已 20px 不贴，仍加固：#chartSeg flex-shrink 0（长文案统计下 seg 永不挤压）+ month-summary min-width 0 + 内部 gap 8；长文案压力测试（本月 14 次 · 日均 1.4 较上月 -22% + 窄 footer 304px）间距稳定 20px、单行 ✓；真机 v72 实测 gapBetween 20/segShrink 0 ✓；资源 v=72；截图 footer_v72_device
- 2026-08-10：**主线同步日期漂移修复（v3.6.1 hotfix 同源方案）**：拆分版代码实施——records.js 加 fmtDateKey/normalizeOffsets/checkDayRollover + saveRecord 写 dateKey（编辑/新增）；storage.js 演示数据 dateKey；app.js 启动归一化 + 跨天基准初始化；ui-home.js renderHome 跨天检测；资源 v=73；浏览器验证（旧数据迁移昨晚→8/9 offset-1、今早→8/10；新记录 dateKey；跨天当天不触发）全过；真机保持 v3.6.1 不覆盖（v3.7 发布时真机验证）
- 2026-08-10：**v3.6.1 hotfix 发布（日期漂移 P0 修复，用户拍板基于旧版出补丁）**：从 v3.6（bef5826）拉 hotfix/date-fix 分支独立修复——saveRecord 存 dateKey（yyyy-mm-dd）+ normalizeOffsets 启动/变更/跨天归一化 + 旧记录 id 时间戳精确恢复（真机验证昨晚→8/9、今早→8/10）；versionCode 28/versionName 3.6.1/资源 v=61；发布 commit b0d4274 + tag v3.6.1 + Release（含 APK 附件 + 道歉发行说明）+ Issue #2 提醒更新；踩坑记录：PowerShell Set-Content 破坏 index.html UTF-8 编码（textarea 未闭合吞 script 标签）、fs.writeFileSync 缺内容参数写坏文件、hotfix 目录缺 node_modules/cap sync 产物
- 2026-08-10：**趋势卡四轮优化（用户「较上月与 seg 贴一起 + 热力图 2/3 空白」）**：①热力图改**日历式 7 列星期布局**——顶部星期表头（一二三四五六日横排）+ 行=周（14 天 2 行/30 天 5 行），格子 1fr 填充列宽（实测 **100% 占满**、39px 圆角 8px），首尾行空占位对齐（.heat-empty）；②footer gap 14→**20px**（统计与 seg 彻底分开）；浏览器+真机验证（7 列表头/100% 填充/39px/间距 20/30 天 30 格+12 占位）全过；资源 v=71；截图 heatmap_v4_14d / heatmap_v4_device
- 2026-08-10：**趋势卡三轮优化（用户「今日高亮不需要 + 格子太大 + footer 间距」）**：①移除今日高亮（.today 描边删除）②格子固定 16×16px 居中（grid-auto-columns 16px + justify-content center——不再随列数拉伸，14 天 2 列/30 天 5 列同尺寸）③footer gap 10→14px（统计与天数 seg 拉开）；浏览器+真机验证（16px/无今日/单行/间距 14px）全过；资源 v=70；截图 heatmap_v3_browser/device
- 2026-08-10：**趋势卡二轮优化（用户「本月统计要一行显示 + 热力图太丑」）**：①month-summary 强制单行（flex-wrap nowrap + ms-item white-space nowrap + flex-shrink 0——实测 16px 单行不再换行）②热力图精致化：左侧星期行标签（一二三四五六日 9px）、今日格子 accent 描边高亮（outline 1.5px）、格子 5px 圆角 + 微光 inset（上亮下暗，与液态玻璃语言一致）、结构拆 .heat-labels + .heat-grid；浏览器+真机验证（单行/标签/今日高亮/30 天 30 格）全过；资源 v=69；截图 heatmap_v2_browser/device
- 2026-08-10：**次数趋势卡重设计（#88 后布局优化）**：头部去掉竖排双 seg（head-actions 删除）——视图 seg（曲线/热力图）横排留标题行右侧；14/30 天 seg 下移与月度统计合并为底部 footer 行（chart-footer：统计左、天数右，分隔线由 footer 承担）；热力图图例保持图表右下；浏览器+真机验证（布局/双视图切换/14 格）全过；资源 v=68；截图 trend_redesign_curve/heat/device
- 2026-08-10：**P0 修复：secureEnable 迁移 await**（用户代码审查发现）：`secure.js` secureEnable 内 `const list = secureLoadRecords()` 未 await——async 函数返回 Promise，被 `JSON.stringify` 序列化为 `{}`，迁移校验「假通过」（两个 `{}` 相等）→ 开启加密会**写空数据**；真机已受影响（明文键变 `{}` 对象，原记录无法恢复——无备份）；修复 `await secureLoadRecords()` + 删残留变量；验证：浏览器/真机 2-3 条记录迁移保真 + 密文确认 + 关闭恢复全过；真机损坏数据已清理；另核验 SECURE 常量区运行时键值全部有效（用户报告的「注释吞代码」在当前文件不存在，可能基于旧版本）；资源 v=67
- 2026-08-10：**#105/#106 决策全部拍板（用户确认，仅记录）**：①间距只调整「开启加密」按钮与下方组件的间距（不做分组小标题/不动状态行高）②「关闭加密」大按钮用蓝色 btn-primary，与「开启加密」同位置同色完全对称（不用红色危险色）③状态区不用锁标识，改为**小圆点 + 是否加密**——未加密灰点、已加密绿点（绿色高亮状态文字「已加密 · 数据从写入即是密文」）；#105/#106 均标记 ✅ 已确认待实施，未修改任何代码
- 2026-08-10：**#105/#106 实施完成（v3.7）**：#106 加密态顶部「关闭加密」升级为 btn-primary 蓝色全宽大按钮（与「开启加密」同位置同色对称，事件监听从旧 row-btn 迁移）；状态区去锁标识改 **sec-dot 小圆点**（灰=未加密 var(--ink-3) / 绿=已加密 var(--sage)）+ 已加密文字绿色高亮（#secureStatus.on）；secureActions 只留「修改口令」；#105 大按钮与下方操作列表间距 14px（#secureEnableBtn/#secureDisableBtn margin-bottom，两态对称）；versionCode 28 / versionName 3.7 / 资源 v=89；浏览器回归（明文/加密两态结构、圆点颜色、对称按钮）+ 真机验证
- 2026-08-10：新增第 107-109 条意见（用户三项反馈，仅记录）：#107【Bug】加密态「修改口令」下方缺分割线（根因已定位：.row-btn:last-child 移除 border-bottom，#106 后 secureActions 只剩修改口令一个按钮命中）；#108 「液态玻璃」改名「玻璃效果」（只改用户可见文案，内部标识符保留）；#109 玻璃模式记录卡片透明度同步日历/tab（知识库确认：三浮层 tint 同用 --lg-tint，差异在 blur——tab/日历 3px、记录面板 0px，方案 sheet 对齐 blur(3px)）；仅记录
- 2026-08-10：#109 决策确认（用户：「记录面板统一blur(3px)」）——记录面板 .sheet 对齐 #78/#82 同款 blur(3px) saturate；✅ 已确认，未修改任何代码
- 2026-08-10：**#107/#108/#109 实施完成（v3.8）**：#107 加密态「修改口令」分割线修复（screens.css 新增 #secureActions .row-btn 显式 border-bottom，规避 last-child 移除）；#108 「液态玻璃」→「玻璃效果」（index.html 设置页标题/开关/说明 + 注释同步，内部标识符 guanji_liquid_glass 键与 html.liquid-glass class 保持不变）；#109 记录面板 .sheet 对齐 #78/#82 同款 blur(3px) saturate（glass.css，与日历/tab 透明度观感统一）；versionCode 29 / versionName 3.8 / 资源 v=90；浏览器回归 + 真机验证
- 2026-08-10：**「本周」口径文案修正（v3.8 内补丁）**（用户拍板：「不用改统计口径，更改文字近七天不就好了」）：index.html「本周次数」→「近 7 天」「较上周」→「较上 7 天」「生成本周分析」→「生成近 7 天分析」；ai.js 10 处（本周记录数/时段分布/诱因分布/情绪分布/含看片占比/概览/提示词「本周手淫习惯」→「近 7 天记录习惯」等）；统计口径不变（countRange(-6,0) 近 7 天）；资源 v=91；**顺带清理 P1 拆分残留死文件** www/app.js（101KB 旧版）+ www/styles.css（55.8KB 旧版，git 历史可恢复）——不再打进 APK
- 2026-08-10：新增第 110 条意见（备份管理——列表/删除/清理下载目录备份文件，用户「把备份管理列入计划」），仅记录
- 2026-08-09：**#88 配色拍板（按 App 整体风格蓝色系）+ #85 确认已解决 + #90 搁置**：#88 热力图色阶用 --blue 主色系（0 灰→浅→中→深蓝，深色模式跟随）；#85 用户确认已修改（实测曾未复现，关闭）；#90 实况回顾先搁置（语义待定）
- 2026-08-09：**#88/#87/#93 实施完成（v3.5 内补丁）**：#88 次数趋势热力图（曲线/热力图视图 seg + GitHub 风格网格行=星期列=周 + 蓝系色阶 --heat-0..3 深浅两套 + 图例，数据 countRange 复用）；#87 返回兜底（装 @capacitor/app 8.1.1 + backButton 分层关闭：自定义词弹窗→删除确认→数据管理弹窗→日历→全屏计时→记录面板→首页二次确认「再按一次退出」）；#93 全链路加密核心链路（secure.js：DEK/KEK 信封 + PBKDF2-SHA-256 600k + AES-256-GCM + 12B nonce + 原子迁移 + 密文导出包 + 导入合并 + 改口令/关闭加密 UI + 加密模式禁用 CSV 明文导出；DEK 存 Keystore（@aparajita/capacitor-secure-storage 8.0.0，internal* API）+ 浏览器降级；启动异步化）；资源 ?v=66；浏览器全链路 + 真机验证（热力图 14 格/插件注册/加密开启→密文→信封→关闭→明文恢复）全过；截图 p2_heatmap_device / p2_secure_card
- 2026-08-09：**#19/#30/#31 已解决（用户确认已修改完成）**
- 2026-08-09：**状态审计完成**：修正 16 条过时标记（#20-#29/#32-#36/#53 实际已完成但标题未同步——补 ✅ 与版本/对应条目）；删除 #42 重复条目（保留 v2.5 已修复版）；#19/#30/#31 无实施证据保留待核实；总条目 93 条
- 2026-08-07：新增第 56 条【Bug】（编辑模式「就现在」选项冲突——用户反馈「编辑进入的是补记但还有就现在选项，既然补记可以选时间，就现在就没意义了」），根因已定位：#46 编辑直达详情保留 seg 可切换——编辑=修改已存在记录，无「现在新建」语义，且切到就现在会把历史记录时间覆盖为当前时刻（误操作风险）；修复方案（编辑模式隐藏 timeSegRow，保留 pickerRow 时间可调=纯补记语义），仅记录
- 2026-08-09：**#93 决策点全部拍板（方案闭环）**：①口令引导设置+可跳过（明文模式可选）②导出/备份无口令确认（本机免解锁一致；WebDAV 凭据由用户自填）③DEK 存 App 内部存储（卸载=放弃数据；误删有备份可导入恢复——重装+口令解信封，链路成立）；信封加密 DEK/KEK 双层方案定稿；待实施
- 2026-08-09：**#89 拍板否决分享 + 新增 #93 全链路本地加密**（用户合规判断 + 加密方案升级）：分享功能不做（性健康记录分享可能构成传播淫秽物品，法律风险）；#93 本地 at-rest 加密（写入即密文）→ 导出/WebDAV 均为密文 → 仅 App+口令可解码——「防泄露」升级为「防定性」（即使数据被动离开也是不可解码密文，法律上不构成传播）；落点 storage.js（P1 已拆好）；4 个决策点待确认（密钥来源/解锁频率/找回/WebDAV 依赖）；仅记录
- 2026-08-09：新增第 87-92 条（群友反馈汇总——用户转述「真好看，功能多，反馈一些小 bug 和建议」）：#87【Bug】浮层打开时侧滑/返回直接退出（根因已定位：无 backButton 监听，Capacitor 默认退出；方案：分层关闭+首页二次确认）；#88 次数趋势加热力图视图（GitHub 绿格风格，按次数深浅）；#89 日志分享群友+隐私边界（黑匣子梗——显式分享/脱敏/本地不变）；#90 实况回顾（语义待确认）；#91 心率捕捉（BLE 广播/Health Connect，高成本远期）；#92 API key 泄露风险已答复（本地存储+直连=最小泄露面，残余风险在自己保管）；仅记录/待实施
- 2026-08-09：**P1 架构拆分实施完成（搬移式：app.js 2532 行 + styles.css 1746 行 → 10 JS + 8 CSS 文件）**：函数/规则原样搬移零逻辑改动；js/（storage/records/stats/ai/ui-home/ui-timer/ui-sheet/ui-calendar/liquid-glass/app）+ css/（theme/base/components/tabbar/sheets/screens/responsive/glass）；组件清单 docs/component-inventory.md（用户拍板列入）；版本统一 v=62；浏览器+真机（10JS+8CSS 加载、两态 345/346、玻璃态滤镜/磨砂/深色降白全过）验证通过；踩坑：区间切函数头（closeCalendar 491 行）+ 顶层执行引用后加载文件（加载顺序 ui-timer→ui-sheet→ui-calendar）；方案文档 docs/architecture-upgrade.md P1 已标 ✅
- 2026-08-09：**#84 实施完成（v3.5 内补丁，用户「实施，#83先搁置」）**：玻璃受光层变量化——深浅变量区新增 --lg-glow-a/b（光带 浅 0.40/0.16、深 0.12/0.05）、--lg-edge-1/2/3（边框环 浅 0.95/0.55/0.28、深 0.35/0.15/0.08）、--lg-hi（卡片高光 浅 0.90、深 0.20）；::before 光带/::after 边框环/卡片 inset 高光替换硬编码白；全部玻璃元素一处生效；浏览器+真机深浅双态验证（浅色零回归、深色降白）；资源 ?v=61/61；截图 v84_dark_card / v84_device_dark
- 2026-08-09：新增第 85 条【Bug】（记录页两态切换高低差「又出现了」——用户「记录页的两态切换高低差的问题又出现了，解决方法可以搜索知识库」）：已实测（v3.6 真机+浏览器 CDP）——就现在/补记两态玻璃态 346.7/347.2 diff 0.5、非玻璃态 345.3/345.7 diff 0.4（#75 成果保持，**当前代码未复现**）；步骤 1→2 差 24px 为设计内容差；已检索知识库 #75 系列解法（区块测量→对称调间距→真机为准调平，目标 diff≤1）；3 个可能场景待用户确认（旧版本/步骤切换/其他），仅记录
- 2026-08-09：新增第 84 条【Bug】（液态玻璃+深色模式卡片左上角大片白色晕染——用户「暗色模式卡片的可读性有很大问题，左上角有大片白色晕染，先定位问题」）：根因已定位（代码实锤）——玻璃受光层全部硬编码白 rgba 未按深浅变量化：`::before` 光带 `radial-gradient(130% 70% at 15% 0%, 白0.4→透明50%)` 中心在左上角（主源）+ `::after` 渐变边框环白 0.95→0.28 + inset 上缘高光白 0.9；tint 背景有深浅两套（--lg-tint-card 浅 0.60/深 0.08）但受光层无变量，深色底上白 0.4 对比度极高成大块白晕；方案草案（A 推荐：新增 --lg-glow/--lg-edge/--lg-hi 深浅两套变量，深色光带 0.10-0.14；B 深色选择器覆盖）；2 个待确认（降白幅度/修复范围卡片 or 全部玻璃元素），仅记录
- 2026-08-09：新增第 83 条意见（液态玻璃蓝色按钮阴影太实——用户「阴影有点太实的感觉，发散一点更好看」）：根因已定位（.btn-primary/.record-btn 玻璃态外投影仅单层 0 3px 14px rgba(0,122,255,0.3)——偏移小 blur 小单层，紧贴按钮显「描边感」；对照玻璃卡双层发散阴影栈先散后收）；方案草案（A 纯蓝光晕双层：远层 0 14px 34px 0.22 + 近层 0 4px 14px 0.25 / B 蓝光晕+中性柔影 iOS 风格）；3 个待确认（A/B/发散档位/发丝线是否微降），仅记录
- 2026-08-09：**#82 实施完成（v3.5 内补丁，用户「tab栏增加日历页同款的背景模糊」）**：玻璃态 tabbar 加轻磨砂 blur(3px) saturate(var(--lg-saturate))——与 #78 日历同款配方（内容密集提升可读性）；其他浮层 sheet/dialog/card 保持 blur(0px) 不变；浏览器+真机验证（tabbar 3px ✓ sheet/calendar 不变 ✓ 非玻璃态旧毛玻璃不变 ✓）；资源 ?v=59/59；截图 v82_tabbar_blur3.png
- 2026-08-09：**#81 实施完成（v3.5 内补丁，用户拍板「C，20，背景折射不要」）**：玻璃态滑块回归单一元素（材质=#76 渐变玻璃胶囊迁移，::before 底座删除）+ `filter: url(#lg-distort)`（feTurbulence 0.012/0.018 + feDisplacementMap）+ 切换时 liquidTabPulse 脉冲 scale 0→20→0（sin 650ms + seed 随机，仅玻璃态）；非玻璃态完全不变（浅蓝实底/26px/0.55s 弹性）；浏览器+真机（魅族 21/Android 16）验证全过（峰值 20 归零、材质/滤镜 computed、非玻璃态回归）；资源 ?v=58/58；截图 v81_device_pulse20/tab_clean
- 2026-08-09：**#81 方案 C 原型已出（用户「尝试一下可选项C」）**：`prototype/liquid-tab-c.html` 三模式对照（现状/A 滑动/C 液体变形）+ SVG feTurbulence+feDisplacementMap 胶囊变形脉冲（650ms sin + seed 随机）+ shuding 原版背景折射（backdrop-filter url()）；浏览器验证：滤镜真实渲染（ui_diff_check 证实 scale200 波纹扭曲）+ 脉冲采样平滑；真机 CDP 实测 Android 16 WebView 支持 backdrop-filter url()（-webkit- 前缀不支持）——方案 C 可落地；截图 v81_proto_main/pulse18/bg_refract_scale200/off；待用户看原型定夺
- 2026-08-09：新增第 81 条意见（液态玻璃 tab 切换动效丢失——用户「切换动效没了，显得特别生硬」，参考 shuding/liquid-glass + 火山引擎文章）：根因已定位（#76 玻璃态隐藏 .tab-slide 滑块 → 选中指示改由 .tab.active::before 承担，::before 随类瞬时有无无过渡 → 生硬；旧版滑块 transition left/width 0.55s 弹性滑动 + moveTabSlide 仍存活）；方案草案（A 推荐：玻璃胶囊材质迁回单一滑块 + 恢复 moveTabSlide 滑动弹性合体；B 渐隐保底；C SVG 变形实验）；3 个待确认（动效形态/时长/是否做 SVG 变形），仅记录
- 2026-08-09：**#76/#77/#79/#80 实施完成（v3.5 内补丁）**：#76 定稿全宽渐变玻璃胶囊（tab-slide 隐藏 + ::before 放大 top/bottom 5px + left/right 4px + 圆角 22px 与旧版滑块同域 + 径向渐变/高光/单层投影）；#77 移除 P1 滚动收缩（删 syncTabbarScroll/监听/常量/孤儿注释 + .scrolled 规则与 --lg-tint-scroll，tab 栏恒 58px）；#79 日历明细提权（recent-tags --ink/500 + 分钟 .dur accent-deep/700）；#80 未来日期双保险（cell 灰显 disabled + saveRecord offset>0 温和拦截「未来的日期还没到哦」）；浏览器回归四项全过 + 构建安装真机；资源 ?v=57/57
- 2026-08-08：新增第 58 条意见（Android 16 状态条状标签 chip 优化——用户反馈「未展开状态有点丑，一个大横条，有用信息少」），根因已定位（对照官方规范：chip 最大 96dp、<7 字符全显示——标题「观己 · 计时中」6 字符被系统整段塞进 chip 成 96dp 横条，秒数又放不进）；方案（setShortCriticalText("计时中") 3 字符缩短横条 + 标题保持展开态使用 + 真机验证）；1 个待确认（chip 文本：计时中/只图标/其他），仅记录
- 2026-08-08：新增第 80 条【Bug】（日历可补记未发生的未来日期——用户「为什么可以补记没发生的日期」）：根因已定位（renderCalendar 未来 cell 可选 + calAddBtn 无限制 + saveRecord 补记分支只校验非空无 offset>0 拦截，未来记录可直接保存）；方案草案双保险（日历未来 cell 灰显禁用 + saveRecord offset>0 温和拦截「未来的日期还没到哦」）；仅记录
- 2026-08-08：新增第 79 条【Bug】（日历页每日细项「分钟」灰色看不清——用户「分钟因为字体的灰色的所有显示不清楚」）：根因已定位（.recent-tags 12px 浅灰 #8E8E93，液态玻璃透明底上对比不足；时长与情绪/诱因同级无区分）；方案草案（#calDayDetail .recent-tags 颜色提权 + 分钟 accent-deep 加粗强调）；仅记录
- 2026-08-08：**#78 实施完成（v3.5 内补丁，用户原型选 3px）**：日历弹层玻璃态单独加 blur(3px) saturate(2)（内容密集可读性提升，通透保留）；tab 栏/记录面板/对话框/卡片保持无磨砂；原型先行四档对比（calendar-glass.html：细节纹理+四段对比条）；浏览器五组件对照 + 真机验证通过；资源 ?v=56/56；截图 v78_calendar_blur3.png / v78_cal_compare_v2.png
- 2026-08-08：新增第 78 条（日历页液态玻璃可读性差——用户「在玻璃材质加上一点点的模糊，但通透感还要保留」）：现状（calendar-sheet 与其他浮层同配方 blur 0 无磨砂，日历内容密集可读性差；对照 iOS Material 分层密集内容应用更厚材质）；方案草案（仅日历弹层加轻磨砂 blur 2-3px + saturate 2，其余浮层不变；tint/边缘结构保留；可选网格线微调）；2 个待确认（blur 强度 2/3px、是否配合网格线微调），仅记录
- 2026-08-08：**#77 决策确认（用户「不保留，记录在案」）**：移除 P1 滚动收缩——tab 栏恒 58px（同时消除切换残留）；移除范围已列（app.js syncTabbarScroll+监听 / styles.css .scrolled 规则+--lg-tint-scroll）；备注：未来流动感可用「仅背景变实不收缩」形式；待实施
- 2026-08-08：新增第 77 条【Bug】（切换 tab 时 tab 栏高度变低——用户「tab栏移动高度会变低是什么问题」）：根因已定位（代码 + 浏览器/真机对照）——`syncTabbarScroll` 的 max 统计包含隐藏 screen，浏览器 display:none 重置 scrollTop 未复现但真机 WebView 保留 → 切换后收缩态残留（58→50）；方案草案（只统计可见 screen 一行修复 + 待确认滚动收缩 P1 保留 or 移除）；1 个待确认，仅记录
- 2026-08-08：**#76 方案 C 复测反馈已确认（用户「先记录选择」）**：质感保留「渐变玻璃胶囊」✅——全宽选中胶囊（top/bottom 5px + left/right 4px + 圆角 22px 与旧版滑块同域）+ 玻璃渐变/高光/单层投影；待实施
- 2026-08-08：**#76 方案 C 复测反馈（用户「图标玻璃底座一小块覆盖不了选中区域，覆盖范围可不可以和旧版一样大」）**：36px 底座太小——调整方向为全宽选中胶囊（top/bottom 5px + left/right 4px + 圆角 22px 与旧版滑块同域，玻璃质感保留：渐变+高光+单层投影）；1 个待确认（质感保留 vs 回归滑块浅蓝实底），仅记录
- 2026-08-08：**#76 实施完成（v3.5 内补丁，方案 C）**：玻璃态隐藏 .tab-slide（选中指示由图标底座承担，消除两层阴影叠加）+ 底座强化为 36px/圆角 12px/渐变 0.65→0.18/高光 0.75/单层外阴影 0.25；双态验证（玻璃：滑块 none+底座单层；旧版：滑块恢复+底座不渲染）；浏览器 computed 全过 + 构建安装真机；资源 ?v=55/55；截图 v76_tab_base_selected.png
- 2026-08-08：新增第 76 条【Bug】（液态玻璃 tab 栏选中状态「阴影两层」观感——用户「选中状态的阴影好像有两层的样子」）：根因已定位（代码实锤）——`.tab-slide` 选中滑块（浅蓝 0.12 胶囊）与 #72-P2 `.tab.active::before` 图标玻璃底座（含蓝色外阴影 0 1px 5px 0.22 + 白高光）在选中项同区叠加，三重蓝色层次显脏；方案草案（A 推荐：玻璃态移除底座（tabbar 本身即玻璃，底座重复）/ B 底座去外阴影 / C 底座替代滑块）；1 个待确认，仅记录
- 2026-08-08：**#75 抖动消除（v3.5 内补丁，用户「两态切换还有高度抖动」）**：CDP 区块测量定位（真机差 ~4px = 字体行高渲染差，补记 timeDisplay/pickerRow vs 就现在 timerBox/modeLink）；timeDisplay mt 11→8 以真机为准调平——真机 347/347/347 diff 0 零抖动；浏览器 333/330（跨环境渲染差，真机权威）；截图 v75_no_jitter_now/backfill.png；资源 ?v=54/54
- 2026-08-08：**#75 高度回调（v3.5 内补丁，用户「再提高一点，核心原则不要忘记」）**：两态对称回调（公共 +19/计时 +12/补记 +13：padding 10/24、grab 10、title 18、label 12/9、actions 20、timer-display 34、timerBox 10、timeDisplay 11、pickerRow 6、input 9）；核心原则保持——浏览器两态 333/333 diff 0、真机 345/349 容差 ±4；截图 v75_sheet_adjusted_now/backfill.png；资源 ?v=52/53
- 2026-08-08：**#75 实施完成（v3.5 内补丁，用户「两态严格一致 + 就现在不要日期时间」）**：卡片紧凑化（公共：padding/grab/title/field-label/actions/input；计时态：timeDisplay 隐藏 + timer-display 52→28 + 间距收敛；补记态：timeDisplay mt 3 + pickerRow mt 2 均衡）；JS 五处同步 timeDisplay 显隐（setupNowStep/showClassicStep1/nowSeg/customSeg/modeLink）；迭代测量：浏览器 304/305 → 真机 317/317 diff 0 严格一致；截图 v75_sheet_compact_now/backfill.png；资源 ?v=51/52
- 2026-08-08：新增第 75 条（记录卡片整体太大需紧凑缩小——用户「卡面最好可以和补记卡片大小一致」）：实测就现在 452px vs 补记 357px（差 95px，主要来自 timerBox 84px 大数字与计时态间距）；方案草案（面板内 timer-display 字号压缩 + 间距压缩：timerBox margin/seg 下/title 下/modeLink/actions/grab/padding）；2 个待确认（严格一致 vs ±10px/面板内数字字号），仅记录
- 2026-08-08：**#74 实施完成（v3.5 内补丁，用户「日历不悬浮」）**：记录面板悬浮化——.sheet left/right/bottom 12px + 全圆角 22px + 增强悬浮阴影（0 22px 55px）；玻璃态 sheet 悬浮投影/日历保持贴底投影（规则拆开）；真机 media query bottom +safe-bottom（实测 38px = 12+26 手势条，与 tabbar 同体系）；sheetUp/拖拽/键盘/高度过渡兼容；浏览器+真机全过；资源 ?v=47/47；截图 v74_floating_sheet.png
- 2026-08-08：新增第 74 条（记录卡片改悬浮形式——用户反馈「记录卡片底部连着一起的，想做成悬浮形式」）：现状（.sheet/.calendar-sheet 贴底 left/right/bottom:0 + 仅顶部圆角，与悬浮 tab 栏风格不统一）；方案草案（left/right 12px + bottom 12px（真机 +safe-bottom）+ 全圆角 22px + 增强悬浮阴影；sheetUp/拖拽/键盘/高度过渡兼容；液态玻璃边缘自动适配）；3 个待确认（边距 12px/日历弹层是否一并/圆角），仅记录
- 2026-08-08：**#73 实施完成（v3.5 内补丁，用户「按草案，液态玻璃独立成卡」）**：我的页重排——外观（主题）→ 液态玻璃独立卡（实验性标注）→ 记录方式 → 记录提醒 → 正向反馈 → 实况通知 → AI 设置下移 → 数据管理 → 关于；液态玻璃开关从外观卡独立；app.js 按 id 绑定无副作用；浏览器+真机全过（cardOrder 正确/开关切换/清除弹窗回归）；资源 ?v=46/46；截图 v73_me_page_reordered.png
- 2026-08-08：新增第 73 条（我的页设置项顺序调整——用户反馈「设置顺序有点杂乱了」）：现状盘点 7 张卡（外观/AI 设置/记录提醒/正向反馈/记录方式/实况通知/数据管理+关于），杂乱点（四类混合无分组、AI 长卡居中挡高频项、液态玻璃实验开关混在主题下）；方案草案按使用频率+分组重排（外观→液态玻璃独立成卡→记录方式→记录提醒→正向反馈→实况通知→AI 设置下移→数据管理→关于）+ 2 个待确认（排序方案/视觉分组），仅记录
- 2026-08-08：**#72 液态玻璃 P1+P2 优化（v3.5 内补丁，基于三篇液态玻璃文章分析）**：P1 流动性——tab 栏滚动收缩（>60px → 58→50px + 玻璃变实 --lg-tint-scroll 0.4/0.1 + 阴影加深，0.25s 过渡，双态）；P2 材质——Vibrancy 近似（tint-card 0.60/0.08）+ 选中 tab 图标玻璃底座（32px 径向渐变+高光+光晕）+ 色散近似实验（大数字 RGB 双色 text-shadow 0.18）；DESIGN-LANGUAGE.md 新增第 9 章 Material 分层（L0-L4 五级）；浏览器+真机全过（滚动收缩 h=50 变实 0.4/底座/色散）；资源 ?v=44/45；截图 v72_liquid_glass_p12.png
- 2026-08-08：**#72 液态玻璃双态化 + 按钮实色玻璃（v3.5 内补丁，用户「按钮太浅保留原色 + 我的页加模式切换」）**：按钮改实色+玻璃边缘（accent 实底/亮边/高光/光晕，弃半透明 tint）；CSS 玻璃规则全部挂 html.liquid-glass 前缀覆盖层（默认旧版：毛玻璃/白底/实色/纯色背景）；我的页外观卡加「液态玻璃（实验性）」开关（guanji_liquid_glass 默认 on + 防闪烁应用 + initLiquidGlass 同步）；浏览器双态全过 + 真机默认玻璃态+开关切换生效；资源 ?v=43/43；截图 v72_liquid_glass_switch.png
- 2026-08-08：**#72 按钮着色玻璃（v3.5 内补丁，用户「按钮也可以做成带颜色的玻璃」）**：tinted glass 配方（半透明色底 0.55 + saturate(2) + 亮边 + inset 高光 + 色相光晕）；--lg-tint-blue/gray/red（+hi hover）浅深双套；改造 btn-primary（蓝）/btn-ghost（灰）/btn-danger（红）/record-btn（蓝 CTA）/chip（灰）+chip.active（蓝玻璃白字）；浏览器全过 + 构建安装真机；资源 ?v=42/42；截图 v72_liquid_glass_buttons.png
- 2026-08-08：**#72 液态玻璃全 App 铺开（v3.5 内补丁，用户「直接全 App 铺开」）**：背景增强（.phone 双层蓝晕 radial，浅 0.06/0.05 深 0.09/0.06——玻璃有内容可透）+ 内容卡玻璃化（.card/.report-card/.ask-answer：--lg-tint-card 浅 0.55/深 0.06 + relative + 玻璃阴影栈 + 共享边框环/光带扩展七组件）+ 交互控件保持实底（可读性/可点击暗示）；reduced-transparency 扩展；浏览器全过（含深色）+ 真机配方生效+面板落位 381；资源 ?v=41/41；截图 v72_liquid_glass_full_app.png
- 2026-08-08：**#72 液态玻璃全 App 扩展（v3.5 内补丁，用户「应用到整个app看看」）**：.calendar-sheet（日历弹层）+ .dialog（添加/删除对话框）液态玻璃化——共享边框环/光带选择器扩展四组件；dialog 用 --lg-tint-strong（浅/深 0.85）保遮罩上可读性；.card 内容卡保持白底（纯色背景无可透内容，玻璃化无收益）；reduced-transparency 查询扩展；浏览器全过（含深色）+ 真机配方生效+面板落位 381；资源 ?v=40/40；截图 v72_liquid_glass_app_full.png
- 2026-08-08：**#72 液态玻璃定稿应用（v3.5 内补丁，用户「其他可以，定稿实施」，微摆移除）**：.tabbar/.sheet 应用定稿配方（无磨砂 blur(0px) saturate(2) + 阴影栈 + ::after 渐变边框环环形 mask + ::before 光带 + tabbar 按压增强；深色 tint 0.05 适配；reduced-transparency/#44 退场逻辑兼容）；浏览器浅色/深色全过 + 真机 CDP 配方生效 + 面板弹簧落位 381 无残留；原型同步清理微摆；资源 ?v=39/39；截图 v72_liquid_glass_app.png
- 2026-08-08：**#72 液态玻璃 v8 修复（用户反馈「边框改动影响主体、通透感没了」，待定稿）**：v7 双层背景 bug（透明 padding-box 遮不住 border-box 白渐变 → 白纱盖满主体）→ 主体恢复纯透明背景 + 渐变边框改 ::after 环形 mask（content-box xor/exclude）独立绘制，液体微摆改为环带加宽 6px+扰动；验证主体 rgba(255,255,255,0) + mask exclude 生效 + 阴影层/光带全在；截图 v72_liquid_glass_v8.png；待用户定稿
- 2026-08-08：**#72 液态玻璃 v7（用户反馈「边框轮廓不够玻璃」，待定稿）**：边缘重构——渐变边框（上亮 0.95→下暗 0.28，background-clip 双层不破坏圆角）替代均匀白描边 + 外侧发丝暗线 0.5px 分离背景 + 内侧白亮环 + 上缘 1px 实线高光 + 内缘 12px 柔光 + 顶部转角亮斑增强；验证全生效（渐变边框/发丝线/亮环/高光/柔光/转角光 + 圆角保留 + 无磨砂保持）；截图 v72_liquid_glass_v7_edge.png；待用户定稿
- 2026-08-08：**#72 液态玻璃 v6（用户要求「彻底无磨砂」，待定稿）**：blur 8px→0、tint 0.12→0（完全透明）——backdrop-filter 仅 saturate(200%)，通透感完全来自饱和度+边缘高光/折射光带/边缘层；按压反馈去 blur 项（保留 saturate 220%/高光/亮边）；性能红利：无 blur 重绘，#44 渲染成本基本解除；验证 blur(0px) saturate(2)+透明底+高光/光带/边缘层全生效；截图 v72_liquid_glass_v6_noblur.png；待用户定稿
- 2026-08-08：**#72 液态玻璃 v5（参照 AndroidLiquidGlass 原生量级，待定稿）**：读取 kyant0/backdrop 库源码后按推荐推进——blur 20px→8px（原生示例 blur(8dp) 轻磨砂量级）；边缘层修正（v4 透明边框空元素挂滤镜无可位移内容实际不可见 → 半透明环带 0.16 + 小位移，产生液体微摆）；新增按压反馈（:active 时 saturate 220%/高光 1.0/blur 12px/亮边 0.9 + 微缩放，参照原生按压驱动模型）；原生算法（SDF 圆角矩形+circleMap 边缘衰减+法线折射+色差）确认边缘折射模型并留作鸿蒙 ArkUI shader 算法底稿（AGSL/GLSL 兼容）；验证 blur(8px) saturate(2) 生效 + 边缘层有内容 + 主体无滤镜；截图 v72_liquid_glass_v5_default/edge_on.png；待用户定稿
- 2026-08-08：**#72 液态玻璃 v4 修复（用户实测「整个画面都扭曲变形」）**：v3 整面 SVG 滤镜挂玻璃主体 + 0×0 SVG + scale 22 → 位移映射捕获整屏全局扭曲（验证只查 computed 未查视觉，方法失误）；v4：主体移除整面滤镜、扰动重做为 6px 边缘折射层 ::after（#lg-edge-distort）、SVG 给真实尺寸+显式滤镜区域、参数 scale 22→8/freq 0.12→0.02、扰动独立开关默认关闭；验证默认态无滤镜+v2 配方完整、扰动开启仅边缘层生效；截图 v72_liquid_glass_v4_default/on.png；待用户定稿
- 2026-08-08：**#72 液态玻璃 v3 增强（待定稿）**：按推荐借鉴 cult-ui distorted-glass——SVG feTurbulence+feDisplacementMap 折射扰动（scale 22）挂到 .glass 三组件（filter:url(#lg-distort)），玻璃表面获得折射扭曲细节；cult-ui 深度阅读结论（157 registry 项=78 动效组件+79 demo，MIT；真折射需 Three.js shader 移动端成本高，SVG 扰动是可行近似；edge-blur/morph-surface 配方与现有原型同思路）；验证滤镜生效+弹簧落位正常；截图 v72_liquid_glass_v3.png；性能提示升级（扰动滤镜作可选项，低端机降级无扰动）；待用户定稿
- 2026-08-08：**#72 液态玻璃原型交付（待定稿）**：prototype/liquid-glass.html 桌面交互原型——三组件（tab 栏/记录面板/数据卡）液态玻璃 vs 原毛玻璃一键切换对比 + 面板弹簧打开（复用 anime vendor）+ 配方说明；配方 blur(26px) saturate(180%) + 亮边 + inset 上缘高光 + ::before 折射光带；验证全过（配方生效/切换/弹簧落位/position）；修复 2 个原型 bug（.glass 规则 position:relative 覆盖 absolute 致 sheet 掉流；CSS 初始 transform 与 anime 清理冲突致面板收回）；截图 v72_liquid_glass_on/off.png；应用需真机性能验证（#44 前科）+ reduced-motion 降级，待用户定稿
- 2026-08-08：**#72 anime 试点实施完成（v3.5 内补丁）**：vendor 引入 animejs v3.2.2（v4 无 UMD 单文件改 v3）；面板弹出改回弹动画——playSheetOpen（animation:'none' 防 CSS 双动画 + anime translateY easeOutBack(1.4) 550ms + changeComplete 清 transform、animation 保持 none 防 sheetUp 重播 + animateSheetClose 先 pause + vendor 缺失/reduced-motion 回退 CSS 零风险）；spring easing 弃用（v3 固定 1s 不可调，实测 1003ms 太拖沓）；环图已有 CSS 交错入场不替换；浏览器验证回弹 -6.48% overshoot + 清理/落位/退场全过（CDP evaluate 期间 rAF 节流为测试干扰）；真机逐帧验证 y 851→381→overshoot 319→衰减振荡→381 稳定，~550ms 无停顿；资源 ?v=38/38
- 2026-08-08：新增第 72 条（动效与视觉增强候选——用户调研三个 GitHub 库：liquid-glass-react 液态玻璃组件 / cult-ui React 组件库 / anime.js 轻量动画库），调研结论：两个 React 库直接不可用（观己零构建 vanilla 架构，反证无需为动效库改 React——动效库均框架无关）；liquid-glass 视觉配方可纯 CSS 模拟（注意 WebView 性能降级，#44 前科）；anime.js 唯一可落地（v4 单文件无构建，补 CSS 短板：真实弹簧/stagger/时间线/SVG/数字滚动）；落地候选 anime 试点两处（面板弹簧弹出 + 环图分段入场）+ 液态玻璃 CSS 原型；2 个待拍板，仅记录
- 2026-08-08：新增第 71 条（观己宣传海报系列 HTML 交付物——参考「桌面/原型」7 张手机界面截图，无生图模型改为 HTML 输出）：交付 7 张竖版海报（1080×1920 设计稿 + JS 等比缩放）到 `C:\Users\43124\Desktop\观己海报\`（01 全屏计时/02 实况通知/03 首页看板/04 AI分析/05 桌面小组件/06 历史日历/07 数据安全），统一 Apple 风格设计系统 + 按功能还原手机 mockup（计时蓝渐变/锁屏胶囊+通知/AI 报告卡/小组件网格/月历/盾牌隐私卡）+ 卖点 chips + 隐私 footer；生成脚本 debug/poster-gen.cjs 可复用；Playwright 抽查 01/05/07 布局全过
- 2026-08-08：**#70 实施完成（v3.5 内补丁）**：网页原型矮视口状态栏显示不完全——根因 `.phone` 固定 844px + body flex 居中，桌面窗口 <890px 时顶部被裁（实测 800 高视口状态栏 y=-21）；修复 `@media (max-height:920px) and (pointer:fine)` 手机高度 calc(100vh-28px) 跟随视口（.screen flex:1 吸收高度差，状态栏 46px 恒完整），min-height 640 兜底；fine/coarse 与真机规则互斥零影响；验证状态栏 y=-21→y=15 完整可见；资源 ?v=37；已构建安装
- 2026-08-08：**#69 实施完成（v3.5 内补丁，版本号不变）**：关于卡去分割线与「隐私说明」标题——`.about-privacy` 简化为直接挂 about-card 的 `ul.privacy-list`（品牌区后直跟 2 条隐私条目，苹果页脚风格），CSS 去 border-top/padding-top、margin-top 18px 衔接；版本号不变（26/3.5），资源 ?v=36/36；真机验证（魅族）borderTop=0px none + 无 card-title + brandY 2077→privY 2141 + 2 条文案左对齐 + v3.5；浏览器回归一致；截图 v35_about_clean.png
- 2026-08-08：**#68 实施完成（v3.5 内补丁，版本号不变）**：独立隐私说明卡并入 about-card——品牌区（logo/观己/版本）下方新增 `.about-privacy` 分区（隐私说明标题 + 原 2 条文案），`--line` 分隔线 + 左对齐；卡片数 9→8；版本号不变（26/3.5，about-ver 保持），资源 ?v=35/35；真机验证（魅族）cardCount=8 + 分隔线 0.73px --line + 左对齐 + 2 条文案完整 + 数据管理仍在其上 + 清除弹窗回归正常；浏览器回归一致；截图 v35_about_merged.png
- 2026-08-08：**#67 实施完成（v3.5，用户指定版本号）**：隐私说明卡从我的页顶部移至「数据管理」卡之后（新顺序 外观→AI 设置→记录提醒→正向反馈→记录方式→实况通知→数据管理→隐私说明→关于）；版本升级 versionCode 26 / versionName 3.5 / about-ver v3.5 / 资源 ?v=34；真机验证（魅族）dumpsys 26/3.5 + CDP DOM 顺序 dataBeforePrivacy=true + 清除确认弹窗回归正常；浏览器回归一致；截图 v35_me_page.png
- 2026-08-08：**#66 实施完成（v3.4 补丁，方案 A）**：transitionSheetHeight 修复——签名改 `(from)`（调用方切步骤前测切换前高度），`to` 改测步骤切换后 sheet 自然全高（含 chrome），清理改 transitionend（防子元素冒泡校验 target/propertyName）+ 600ms 兜底，时长 0.35s→0.22s easeOutCubic 与退场语言一致；goToDetails/goToTime 同步传 from；真机逐帧验证四路径（补记下一步/小字直达单调展开、上一步单调收缩、编辑 inlineSeen=0 无回归）+ 浏览器回归 4 项 PASS 零 console 错误；资源 ?v=33/33；版本号不变；截图 v66_step_transition_fixed.png
- 2026-08-08：新增第 66 条【Bug】（步骤切换动画「弹出一部分→卡一下→显示完整」——用户澄清：问题在「点下一步到记录页」与「点小字直接填写到记录页」，补记同，编辑无；弹出动画本身平滑）；根因已定位（魅族真机 rAF 逐帧采样 + CDP Profiler + 函数插桩三重实锤）：`goToDetails()` 的 `transitionSheetHeight('stepDetails')` 目标高度算错——sheet = grab+标题+按钮区+padding 等 chrome ≈188px，实测 `from=681.1`（sheet 全高）`to=493.3`（仅 stepDetails 自身）→ 高度过渡**反向收缩** 681→493（~350ms）→ 400ms 清理定时器在动画尾段触发 → inline 清空 → **瞬间弹回 681**（帧数据：停在 493 约 216ms 后跳回）——「卡一下显示完整」实锤；上一步同 bug；编辑直达详情不调用该函数故平滑；方案草案（A 修复目标高度 + transitionend 清理，推荐 / B 移除过渡瞬间切换 / C transform 替代），1 个待确认，仅记录
- 2026-08-08：**#65 第三轮修复（v3.4 补丁，用户反馈「键盘和窗口重合了」）**：第二轮冻结让 dialog 居中于冻结画布 851px → bottom 541 > 可见区 528 → 底部被键盘盖住；修复 3 处——①冻结条件收窄为「对话框打开 + 键盘弹出」（设置页/备注输入保持原 adjustResize，实测 WebView 自动滚动 .screen 使输入框可见无回归）②`--kb-h` CSS 变量每帧更新 + `body.keyboard-up .backdrop.dialog-layer { bottom:auto; height:var(--kb-h) }`——对话框层只覆盖可见区域，dialog 居中于键盘上方完整露出 ③`.toast { position: fixed }`（真机媒体查询内）跟随可见区底部；真机验证（魅族，两套风格真实点按）：键盘弹出后 dialog `y=149/bottom=379 < 528` 完整露出不重合、输入后 y=148/h=232 不变、sheet 稳定 y=170、汇总页同过、设置页输入框 y=241-287 可见；截图 v65_kb_visible_panel.png / v65_kb_visible_summary.png；资源 ?v=32/32
- 2026-08-08：**#65 根治实施（v3.4 补丁）**：第一轮只合并预览行（重叠消除）但顶起/拉扯仍在（验证方法缺陷：JS focus 已召起键盘，前后两组数据同为键盘态，误判无问题；用户复测确认）；二次定位实锤真根因——真机媒体查询 `.phone { height:100vh }` 随 adjustResize 键盘压缩（851→528）导致整棵布局树重排（sheet 顶起/dialog 重新居中/vh 间距全变）；修复 4 处：①app.js 键盘弹出冻结 html/body 为弹出前高度（kbBase 历史最大值自愈，防重载捕获压缩态）②`.phone` 改 height:100% + `.stage` height:100%（补确定参照防百分比回退撑高 1620px 回归）③`#addPreview` min-height:1.8em 预留预览行（dialog 高度恒定零跳动）④汇总页 3 处 clamp(vh) 间距固定化 28/32/32px；真机验证（魅族，键盘前后分离采样）：面板风格 sheet 键盘前后 y=170/bottom=851 完全一致（修复前顶到 top:200）、输入 5 字 dialog y=310/h=232 不变、单行预览无重叠、键盘收起解冻恢复；汇总页风格真实点按路径同样 PASS；截图 v65_keyboard_frozen.png / v65_summary_frozen.png；资源 ?v=31/31；调试工具沉淀 cdp-eval.cjs / parse-ui.cjs
- 2026-08-08：新增第 59 条意见（AOD 息屏优化——用户澄清：观己在 AOD 有内容显示但简陋，非不可见），根因已定位：AOD 息屏卡片内容 = 通知 contentText（Maps 示例的「2 km · 转向指令」即 contentText），之前删除 contentText 后 AOD 只剩标题+图标；方案定稿（用户确认）：恢复 contentText 为动态核心信息「已计时 X 分钟」每 60s 更新（AOD/折叠态信息量提升；展开态秒数下方多一行小字已确认接受）；实施清单（Handler 定时更新 + 停止/取消清除定时器）已写入，仅记录
- 2026-08-08：**#58/#59 实施完成（v3.4 补丁）**：①#58 chip 短文本——setShortCriticalText 用 extras 注入（NotificationCompat 无 setter、framework 无此 API/常量，实测 extras key=android.shortCriticalText；构建后 `n.extras.putCharSequence` 最稳），dumpsys 确认 shortCriticalText=「计时中」+ requestPromotedOngoing=true + PROMOTED_ONGOING 全保留；②#59 AOD 动态 contentText——startTimer 重构出 buildTimerNotification（startTimer/定时更新共用，保留 actions/胶囊/chronometer/shortCriticalText），progressText「已计时 X 分钟」（不足 1 分钟按 1），Handler(Looper.getMainLooper()) 60s 循环重新 notify，stopTimer 清除；真机验证（Android 16 PLZ110）：AOD 息屏显示「观己 · 计时中 / 已计时 2 分钟」（1→2 自动更新），锁屏后 App 后台 Handler 短时仍工作（OEM 长冻结会滞后但恢复后纠正，可接受）；截图存档 aod_check2.png
- 2026-08-08：新增第 60 条【Bug】（AOD 息屏计时不动态刷新 + 显示滞后——用户测试：AOD 不更新、解除息屏再息屏才更新、App 7 分钟 vs AOD 4 分钟），根因已定位：#59 动态 contentText 依赖 App 进程 Handler，OEM（OPPO）息屏冻结 → 停更；7 vs 4 = contentText 停更值 vs App 实时值（非时间戳错）；AOD 卡片系统 chronometer 不独立显示秒数（实测）→ AOD 信息只能靠 contentText；方案草案（前台服务保活 TimerService + SPECIAL_USE 权限，运动 App 标准做法）+ 1 个待确认（前台服务 vs 接受滞后），仅记录
- 2026-08-08：**#60 实施完成（v3.4 补丁，引导文案已添加）**：TimerService（前台服务 + Handler + AlarmManager 兜底）+ TimerAlarmReceiver + Manifest + 插件重构 + 设置页引导文案（息屏实时刷新需允许后台运行）；实测定论：OPPO 息屏冻结 Handler 消息队列 + 拦截高频闹钟 → 亮屏即纠正；引导设置是生态标准解法
- 2026-08-08：新增第 61 条意见（体验优化：通知按钮回 App「先计时页再详情页」割裂——用户实测反馈，开始优化魅族/安卓 Live Updates 使用体验的第一项），根因已定位（代码时序：restoreTimer IIFE 在 JS 加载时立即恢复并 showTimerScreen 全屏，runWhenReady 轮询命中后 finish/cancel 才执行 → 全屏必然先闪现；热启动回前台同理）；方案草案（restoreTimer 延迟 showTimerScreen 400ms + running 守卫，意图在途时全屏从未显示直接进详情；纯恢复正常）；1 个待确认（延迟 400ms 过渡可接受性），仅记录
- 2026-08-08：**#61 实施完成（v3.4 补丁，app.js?v=27）**：restoreTimer 的 showTimerScreen 延迟 400ms + running 守卫（意图在途→全屏从未显示直接进详情/关闭；纯恢复→400ms 后全屏正常）；浏览器验证两场景 PASS（意图在途：screenHidden+详情可见+dur 预填；纯恢复：全屏 01:09 正常）；真机冷启动验证 PASS（force-stop → am start --ez guanji_timer_finish → UI 树直接是详情页 stepDetails + dur「1 分钟」，无 timerScreen 元素）；cancel 路径同逻辑受益
- 2026-08-08：新增第 62 条意见（体验优化：通知「结束并记录」直接保存跳过详情页——用户追问「流程一定要计时页→详情页吗，有没有彻底解决」），方案三选（A 推荐：通知结束直接保存，时长自动落库、情绪留空可事后编辑，与 widget 快记同哲学；B 保留详情页只优化动画；C 静默保存）；App 内结束仍进详情（快捷路径 vs 完整路径分工）；2 个待确认（方案选择 + 空情绪可接受性），仅记录
- 2026-08-08：**#62 实施完成（v3.4 补丁，D1 全屏汇总页，用户确认）**：timerScreen 拆计时视图（timerRunView）+ 汇总视图（timerSummaryView：时长大字 40px/情绪诱因 chips 可多选/看片开关/存为记录/放弃）；结束计时 → showTimerSummary 同容器切换（替代 hideTimerScreen+goToDetails，零页面跳变）；renderMoodChips/renderTriggerChips 参数化（面板与汇总双容器）+ openDeleteDialog id 兼容 + summaryMediaSwitch 绑定；saveTimedSummary（时长自动落库 + 情绪可补选 + toast + 回首页）/abandonSummary（不保存关闭）；通知结束/冷启动意图在途 → 直接汇总（#61 延迟逻辑天然兼容）；浏览器全流程 PASS（同容器切换/保存/放弃/通知结束/冷启动意图）+ 构建安装 Android 16；资源 ?v=27/28
- 2026-08-08：新增第 63 条意见（汇总页「继续计时」——用户反馈效果挺好但考虑误触结束想继续的情况，当前汇总页只有保存/放弃，误结束想继续只能重开丢时长）；方案草案（汇总页加「继续计时」入口 + finishTimedRecord 暂存 summaryStartTime + resumeTimer 恢复 running/localStorage/通知/计时视图，chronometer 从原 startTime 起时长连续）；2 个待确认（入口形式/继续后自动隐藏），仅记录
- 2026-08-08：**#63 实施完成（v3.4 补丁）**：原型 13 轮迭代（v10-v23）定稿——浅色背景 + 三级层次（#007AFF>#3A3A3C>#8E8E93）+ 间距 40/24/40 + chips 无边框阴影 + 主按钮蓝底白字蓝光晕 + 数字蓝光晕投影；删「本次计时」眉题与开始时刻注脚；情绪/诱因居中；看片开关删除（media 由「看了片」诱因推导）；「继续计时」按钮 + resumeTimer（summaryStartTime 恢复 running/localStorage/通知/计时视图，时长连续）；设计语言沉淀 DESIGN-LANGUAGE.md v2 + 知识库「观己设计语言v2」（53c9a107）；验证：浏览器全过（恢复连续/时长累计/media 推导）+ 真机魅族（汇总页 v23 完整、继续计时后通知恢复 ONGOING_EVENT+FOREGROUND_SERVICE）；资源 ?v=28/29；**后续用户要求回退 v5 视觉**（蓝渐变白色体系 + 文字次级操作 + 间距 vh 自适应 + 顶部三段 13/44/13px + chips gap 12 + 添加对话框 z-index 70 修复，真机验证）
- 2026-08-08：新增第 64 条意见（记录模块两套风格并存——计时新风格 vs 面板旧风格），方案三选（A 推荐：场景分区——计时沉浸/日常轻量是模式差异 + 组件一致性补强（chips/按钮色彩逻辑统一、面板→全屏衔接动画、面板对齐 v2 设计语言）；B 全记录全屏化；C 统一浅色——用户已否决），2 个待确认，仅记录
- 2026-08-08：**#64 实施完成（v3.4 补丁，方案 A 确认）**：timerScreen 入场动画（fadeIn 0→1 + scale 0.98→1，0.3s easeOutCubic 统一退场语言，prefers-reduced-motion 降级）——面板→全屏不再瞬切；组件一致性检查确认（chips/按钮双背景色彩逻辑一致：选中蓝系、三级层级）；面板 v2 对齐标记为渐进工程（DESIGN-LANGUAGE v2 锚点，逐屏推进）；真机验证计时正常（通知+前台服务）；资源 ?v 不变（仅 CSS 无引用变化）
- 2026-08-08：新增第 65 条【Bug】（添加对话框键盘弹出顶高预览框 + 页面拉扯——面板与汇总两套风格共有），真机复现定位（WebView 压缩至 1452px）：①预览框顶高/重叠——输入时 addCount（n/6）与 addPreview（将添加）同时出现、CSS 间距不足（重叠约 3px）+ dialog 高度突变 flex 居中跳动；②页面拉扯——adjustResize 压缩视口、底部记录面板被顶起（top 200），#42 仅处理 tabbar 面板本身跟随视口；方案草案（预览区间距/合并、对话框稳定定位、拉扯处理评估），2 个待确认，仅记录
- 2026-08-06：**v2.1 实施完成（4 条）**：#28 记录面板自适应 + 切换高度过渡动画（去 min-height，JS 测量过渡 0.35s 弹性，动画后清理内联）；#29 弹层小横杠拖拽关闭（Pointer Events 阈值 90px 回弹，sheet-grab 热区）+ 出场/退场动画（sheetUp 保持 + 退场下滑淡出 0.25s + backdrop 淡入淡出，关闭/拖拽/点空白统一走退场）；#30 AI 设置卡 label 统一 16px 上间距（组合选择器 + 删内联）；#31 提醒时间清空自动恢复 21:00（显示与存储一致）；versionCode 12 / versionName 2.1
- 2026-08-06：新增第 32 条意见（小组件一键快速记录 + 信息增强：widget 点击只弹面板非快捷记录；方案草案——quick_record 意图由 WebView 自动存默认记录零数据风险 + 今日次数/连续天数同步展示 + 双按钮布局），仅记录
- 2026-08-06：新增第 33 条意见（再增加一个独立 2x2 数据看板小组件：今日/本周/连续/环比展示，独立 provider 与快速记录 widget 并存，复用 stats 同步机制，点击打开首页），仅记录
- 2026-08-06：用户从小组件创意清单选取 4/3/7 三项，新增第 34-36 条（**统一 2x2 大小**）：本周节奏柱状图、连续记录进度（7/30 里程碑温和正向）、今日卡片（已记录状态 + 温和文案），仅记录
- 2026-08-06：**v2.2 实施完成（5 个小组件）**：#32 一键快速记录（widget ＋ 按钮 → quick_record 意图 → WebView 自动存默认记录 + 今日状态展示 + 双按钮布局）；#33 数据看板（本周大数字 + 环比 + 今日 + 连续）；#34 本周节奏（7 根柱 LinearLayout 权重 + 今日高亮）；#35 连续进度（大数字 + ProgressBar 到 7/30 里程碑 + 温和文案）；#36 今日卡片（已记录/未记录状态 + 温和文案）；新增 WidgetStatsPlugin（WebView→SharedPreferences 统计同步 + APPWIDGET_UPDATE 广播刷新，记录保存/删除/清除/恢复/快速记录/启动时同步）；MainActivity quick_record 意图 + runWhenReady 通用化；versionCode 13 / versionName 2.2

---

## 5. 时段分布改为「一天 100%，每个时段各占百分比」 ✅ 已实施（v1.2）

### 需求
首页「时段分布」模块：改为以**一天为整体 100%**，展示**每个时段**各占多少百分比。

### 现状
- 半环形图只显示「占比最高的时段」（如深夜 57%）
- 明细列表显示各时段「n 次 · X%」（X 为该时段记录数 / 总记录数）

### 理解与设计（草案）

**目标形态**：环形图改为**全分段展示**——5 个时段各占一段弧，全部加起来 = 100%（即各时段记录占比的全貌），中心显示最高时段或总数。

- **环图**：5 段同心环（按时段顺序首尾相接），每段弧长 = 该时段记录占比
  - 颜色方案：**✅ 已确认 A. 蓝色系深浅渐变**——按时间顺序（清晨最浅 → 深夜最深），有时间递进逻辑
  - 分段间留 2-3px 间隔（白色 gap），干净利落
  - 中心显示：**✅ 已确认——最高时段名 + 百分比**（如「深夜 57%」）
- **明细列表**：保留「时段 · n 次 · X%」，最高时段高亮；百分比口径不变（记录占比，总和 = 100%）
- **空态**（无记录）：整环灰色，中心「暂无记录」
- **动画**：分段弧各自生长（stagger，每段 0.6s，共约 1s）
- **技术**：仍用 SVG circle stroke-dasharray 分段；每段 dasharray = [segLen, gap, rest]（或每段独立 circle + rotate 偏移）；复用现有 `renderRingDist()` 改造

### 实施清单
1. `app.js`：`renderRingDist()` 改为 5 段分段渲染（颜色方案 A 或 B，需确认）
2. `styles.css`：分段环样式（如需色板变量）
3. 空态 / 动画处理

### 待确认问题
- ~~颜色方案选 A（蓝系深浅）还是 B（柔和多色）？~~ ✅ 已确认 A
- ~~中心显示：最高时段 + 百分比 / 总次数 / 其他？~~ ✅ 已确认：最高时段名 + 百分比

### 验收要点
- 5 段弧长与列表百分比一致，总和 100%
- 无记录时全灰环 + 「暂无记录」
- 动画流畅，真机 + 桌面正常

---

## 6. Tab 栏改为「滑块跟踪」样式 ✅ 已实施（v1.2）

### 需求
底部 tab 栏改为参考示例的滑块跟踪导航样式（用户提供参考文件：`D:\Download\index.html`）。

### 参考样式解析（来自示例）
- 圆角胶囊容器（浅灰底，border-radius 10em，内边距）
- `.slide` 滑块层：绝对定位，点击项时通过 `left` + `width` 过渡滑动到目标（`transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1.05)`——带轻微过冲的弹性感）
- `.slide-shadow` 阴影层：鼠标悬停时跟随显示（`scale(0.9)` 挤压效果）
- 定位算法：`target.getBoundingClientRect()` 相对 nav 容器的 left/width

### 落地设计（草案，结合观己 Apple 风格）
- **结构**：悬浮毛玻璃胶囊容器内，加入绝对定位的滑块层（z-index 低于内容）
- **滑块**：宽高跟随当前 tab（tab-pill 内容宽度），背景用 Apple 蓝浅色（如 `rgba(0,122,255,0.14)` 或 `--accent-soft`），圆角与容器一致
- **动效**：`left/width` 过渡 0.5-0.6s，曲线用示例的 `cubic-bezier(0.23, 1, 0.32, 1.05)`（轻微过冲弹性）或现有 `--ease-spring`
- **初始化**：页面加载后滑块定位到当前选中 tab（首页）
- **切换逻辑**：现有 tab 点击事件中追加 `moveSlide()`（计算相对 nav 的 left/width）
- **悬停阴影层**：桌面预览生效（hover 提示 + 缩放），移动端（真机）无 hover 自动忽略——可选实现
- **选中态**：滑块到达后文字/图标变蓝（`--accent-deep`，现有逻辑保留）
- **与 v1.1 的关系**：替换/升级现有「tab-pill 白底胶囊」选中态为滑块样式（或两者结合：滑块 + pill 内容）

### 实施清单
1. `index.html`：tabbar 内新增 `.tab-slide` 滑块层
2. `styles.css`：滑块层样式（绝对定位、圆角、过渡）
3. `app.js`：tab 切换时 `moveSlide()` 更新滑块位置；初始化定位
4. 真机适配：滑块在 `pointer: coarse` 媒体查询下表现正常（bottom/尺寸已适配）

### 验收要点
- 点击 tab 滑块平滑滑到目标，弹性过渡自然
- 初始加载滑块在「首页」正确位置
- 桌面预览有 hover 阴影提示；真机触摸切换正常
- 滑块宽度与 tab 内容一致，无错位

---

## 7. 适配安卓全面屏（edge-to-edge + 安全区域） ✅ 已实施（v1.3）

### 需求
让观己适配安卓全面屏。用户提供参考文章：Android 分辨率/屏幕适配总结（https://blog.csdn.net/qq_27061049/article/details/115373211）——文章主题是屏幕分辨率适配（dp 局限、百分比布局、虚拟按键遮挡、多分辨率资源目录），核心思路（弹性布局、避让系统栏）可迁移到本项目。

### 现状
- 已做：`pointer: coarse` 媒体查询（≤420px 触摸屏画布全屏铺满、隐藏模拟状态栏）
- 未做：
  - WebView 内容未延伸到系统状态栏/导航栏区域（edge-to-edge）——当前 WebView 从真实状态栏下方开始
  - 刘海屏/挖孔屏安全区域未处理（meta 无 `viewport-fit=cover`，CSS 未用 `env(safe-area-inset-*)`）
  - 底部手势条区域靠固定 18px 上移避让（应改为安全区域值，不同设备手势条高度不同）
  - 不同屏幕长宽比（19.5:9 / 21:9 等）下布局未系统验证
  - 状态栏背景与 App 背景（--bg #F2F2F7）未协调

### 理解与设计（草案）

1. **edge-to-edge（内容延伸到系统栏）**：
   - Android 15（API 35）+ targetSdk 36 强制 edge-to-edge；Capacitor 需在 MainActivity/配置中处理 `SystemBarStyle`（Capacitor 8 支持通过 `androidSystemBarStyle` 配置，或在原生代码设置）
   - 内容延伸后，顶部需避开状态栏（safe-area-inset-top 给 header 加 padding），底部避开手势条（safe-area-inset-bottom 给 tab 栏）
2. **安全区域（刘海/挖孔适配）**：
   - `index.html` viewport meta 加 `viewport-fit=cover`
   - `styles.css` 定义 `--safe-top / --safe-bottom`（`env(safe-area-inset-top/bottom)`，非安全区设备回退 0/标准值）
   - 应用位置：`.home-header`/`.screen-header` 顶部 padding、`.screen` 底部 padding、`.tabbar` bottom、`.sheet` 底部
3. **状态栏协调**：状态栏背景透明或与 `--bg` 一致；状态栏文字用深色（浅色背景下）
4. **屏幕尺寸适配（迁移文章思路到 Web）**：
   - 弹性优先：flex / % / clamp() 替代固定值（画布已全屏铺满，检查内部模块在超长屏/超宽屏的表现）
   - 大屏（平板/折叠屏 >420dp）：桌面壳模式回退——验证 390px 画布居中是否合理，或加宽上限
5. **虚拟按键/手势条**：`--safe-bottom` 替代固定 18px

### 实施清单
1. `index.html`：viewport meta 加 `viewport-fit=cover`
2. `styles.css`：`--safe-top/--safe-bottom` 变量 + 应用到 header/screen/tabbar/sheet
3. `android/`：Capacitor `androidSystemBarStyle` 配置（或 MainActivity 原生处理）
4. 真机验证：全面屏设备（刘海/挖孔 + 手势条）上检查顶部/底部/横竖屏

### 待确认问题
- 状态栏方案：**沉浸透明**（内容延伸到状态栏后，状态栏区域显示 App 背景）还是保持不透明背景条？
- 是否要支持横屏？（当前设计为竖屏）

### 验收要点
- 刘海/挖孔屏设备上内容不被摄像头区域遮挡（safe-area 生效）
- 底部手势条不遮挡悬浮 tab 栏（safe-area-bottom）
- 状态栏区域与 App 背景协调，无突兀色块
- 19.5:9 / 21:9 等长宽比下首页布局正常、无元素错位

---

## 8. Tab 滑块与容器圆角不匹配修复 ✅ 已实施（v1.3，方案 A）

### 需求
tab 栏滑块跟踪方案的滑块层圆角与 tab 栏容器对不上，视觉割裂，需要修复。

### 根因（3 点叠加）
1. **圆角不匹配**：滑块 `border-radius: 21px` vs 容器 `26px`——内外弧线不同心，滑块像「独立胶囊」而非容器内嵌层
2. **形状比例失衡**：滑块宽度跟随内容（tab-pill 图标+文字，约 80px），高度却铺满容器内高（48px）→ 细长胶囊嵌宽扁胶囊，比例冲突
3. **定位跟随对象**：滑块跟 `.tab-pill`（内容）而非 `.tab`（三等分格），与 tab 栏均匀布局不对齐

### 修复方案 A（✅ 已确认，推荐）
- **宽度**：改为跟随 `.tab` 按钮（三等分格），不再跟随 pill 内容宽度
- **高度**：保持容器内缩（top/bottom 5px，48px）
- **圆角**：改为与容器一致 **26px**（或 24px 略小 2px 制造同心层次），视觉上滑块 = 「容器内嵌的一层」
- 滑动时整层平移，圆角始终与容器对齐，割裂感消除
- 悬停阴影层（`.tab-slide-shadow`）同步同样规则

### 备选方案 B（不采用）
- 滑块只包内容（小胶囊浮动式，圆角 17px）——仍存在「小胶囊 vs 大容器」两层关系，改善有限

### 实施清单
1. `styles.css`：`.tab-slide` / `.tab-slide-shadow` 圆角改 26px（或 24px）、宽度规则改由 JS 计算 tab 格
2. `app.js`：`moveTabSlide()` 的跟随目标从 `.tab-pill` 改为 `.tab` 按钮
3. 初始定位与切换逻辑同步更新

### 验收要点
- 滑块圆角与容器弧线对齐（视觉同心）
- 滑块宽度 = tab 三等分格宽，滑动位置与 tab 对齐
- 滑块移动动画流畅，桌面 hover 阴影一致
- 真机触摸切换正常

---

## 9. 日历按钮升级为「历史记录日历视图」 ✅ 已实施（v1.4）

### 需求
首页顶部日历图标与「+ 记录」大按钮功能重复（都打开记录面板）。经对比，采用**方案 B：日历图标升级为历史记录日历视图**，同时补上「历史查看」缺口。

### 现状
- 顶部日历图标（`#backfillBtn`）→ 打开记录面板（补记模式）
- 「+ 记录」大按钮（`#recordBtn`）→ 打开记录面板（就现在模式）
- 当前没有历史查看功能（最近记录只显示 7 条）
- 记录面板第一步有「就现在 / 补记」分段（补记能力面板内已具备）

### 方案设计（✅ 已确认 B）

**功能**：点日历图标 → 日历月视图 → 点某天查看记录明细（可删除）→「补记这一天」复用现有面板。

**交互流程**：
1. 点日历图标 → 日历视图弹出（底部大面板，约 85% 高，复用 sheet 弹层机制）
2. 月视图：当月网格，有记录的日期显示蓝色圆点 + 次数角标；今天蓝色描边
3. 顶部：月份标题「2026年8月」+ 上月/下月箭头 + 「回今天」
4. 点某天 → 下方记录区：
   - 有记录：记录列表（时间/情绪/诱因/时长/看片）+ 每条可删除（复用最近记录行样式与删除逻辑）
   - 无记录：「这一天没有记录」
5. 「补记这一天」按钮 → 复用 `openSheet('backfill')`，日期输入预选为该天

**UI 草图**：
```
┌────────────────────────────┐
│  ‹  2026年8月  ›  回今天    │
│  一 二 三 四 五 六 日       │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐      │
│  │  │ │  │ │ 1│ │ 2│      │
│  └──┘ └──┘ └──┘ └──┘      │
│  ...（有记录日：●3 蓝色角标）│
│  ──────────────────────    │
│  8月3日 · 2 条记录          │
│  23:30 平静·睡前习惯·15分 × │
│  22:10 压力·看了片·10分  ×  │
│  [ + 补记这一天 ]           │
└────────────────────────────┘
```

### 实施清单
1. `index.html`：新增日历面板容器（sheet 弹层）+ 网格 + 记录区结构
2. `app.js`：`renderCalendar()`（状态：`monthOffset` 当前月、`selectedOffset` 选中日；复用 `countRange()` 算每天次数、`fmtDateShort()`）；月份切换、选天、删除、补记（预选日期）逻辑
3. `styles.css`：日历网格样式（7 列、40px 格、今天蓝描边、有记录日蓝点角标）、面板样式
4. 顶部日历按钮保留（`#backfillBtn` 改为打开日历视图，不再直接开面板）

### 待确认问题
- 无（方案已定 B）

### 验收要点
- 点日历图标打开日历视图，当月渲染正确（有记录日角标、今天描边）
- 月份切换 / 回今天正常；选天显示对应记录明细，可删除
- 「补记这一天」打开面板且日期预选正确
- 无 console 错误；真机 + 桌面正常

---

## 10. 分析页「检测到数据自动生成」 ✅ 已实施（v1.4）

### 需求
分析页目前需手动点击「生成本周分析」，希望改为**检测到数据就自动生成**。

### 现状
- 分析页空态显示「生成本周分析」按钮 → 手动点击 → AI 调用 → 渲染报告
- 切换 tab 不会自动触发

### 理解与设计（草案）

**核心：数据指纹自动触发（智能 + 省钱）**

1. **自动触发时机**：切换到分析页 tab 时自动检测
2. **检测条件**（全部满足才调 API）：
   - 已配置 API key
   - 本周记录数 ≥ 3（数据太少无分析意义）
   - **数据指纹变化**：localStorage 记录上次生成的指纹 `guanji_report_fingerprint` = `{ date, count, latestId }`（记录总数 + 最新记录 id + 日期）；指纹相同（数据未变）不重复调用；指纹变化才自动重新生成
3. **降级**：无 key / 无数据 / API 失败 → 保持空态（显示对应提示），不打扰
4. **手动按钮保留**：作为「重新生成」兜底（文案可改为「重新生成分析」）

**数据流**：
```
切到分析页 tab
  → 有报告已渲染？→ 跳过（不重复）
  → 检测条件（key / 数据量 / 指纹）
      → 满足 → 自动生成（复用 generateAnalysis 流程，loading → 渲染 → 更新指纹）
      → 不满足 → 保持空态（提示原因）
```

### 实施清单
1. `app.js`：新增指纹读写（`guanji_report_fingerprint`）；tab 切换分析页时触发 `maybeAutoGenerate()`；`generateAnalysis` 成功路径更新指纹
2. 自动重试：失败自动重试最多 3 次（递增退避 2s/4s/8s），仅对「调用失败」（网络/401/超时/解析失败）重试；无 key / 无数据属前置条件不满足，不重试
3. 3 次全失败：报错信息展示给用户（toast + 空态错误原因），手动「重新生成」按钮兜底
4. 空态提示：无 key / 无数据时显示对应引导文案（按钮保留）
5. 手动按钮文案「生成本周分析」→「重新生成分析」（有报告后）

### 待确认问题
- 每日自动生成次数限制：指纹方案下同数据只生成一次，无需额外限制（数据变化多次才会多次调用）——默认不限制
- ~~自动生成失败自动重试？~~ ✅ 已确认：**自动重试 3 次（递增退避 2s/4s/8s），3 次全失败才把报错信息展示给用户**（toast + 空态错误原因），手动「重新生成」按钮兜底

### 验收要点
- 首次进入分析页（有 key + 有数据）自动生成，无需点击
- 数据未变再次进入：不重复调用（指纹命中，报告保留）
- 新增记录后进入：自动重新生成（指纹变化）
- 无 key / 无数据：保持空态 + 引导提示，无报错（前置条件不满足，不触发重试）
- **失败重试路径**：模拟 AI 调用失败 → 自动重试（间隔递增）→ 3 次全失败 → 用户看到明确报错（toast + 空态错误信息），手动「重新生成」可用

---

## 11. 适配深色模式 ✅ 已实施（v1.4）

### 需求
适配深色模式。用户提供参考文章：Android 深色模式适配总结（https://blog.csdn.net/hai_qing_xu_kong/article/details/156260493）——核心：DayNight 主题 + 资源匹配、不硬编码颜色、WebView forceDark、对比度 ≥4.5:1。

### 现状
- 全部颜色已在 CSS 变量中（浅色一套）
- **JS 中有硬编码颜色**：`RING_COLORS` 环色、面积图渐变/数值文字（#8E8E93）、日期标签（#C7C7CC）、白描边 chart-val——深色下会刺眼
- 原生层：capacitor.config.json `androidSystemBarStyle` 为浅色（light + #F2F2F7）
- 无任何深色变量集

### 理解与设计（草案）

**架构认知**：Capacitor WebView App，深色适配主要在 **CSS 变量层**（WebView 内容）+ **原生状态栏**，不需要 DayNight 主题。

1. **CSS 深色变量集**（核心）：
   - 深色变量覆盖（**✅ 已确认：Material 标准 #121212** 深色规范系）：
     - `--bg: #121212`、`--card: #1E1E1E`、`--bg-elev: #2C2C2E`
     - `--ink: #FFFFFF`、`--ink-2: #B0B0B4`、`--ink-3: #6E6E73`
     - 强调色提亮：`--accent: #0A84FF`（iOS 深色系统蓝）
     - 分割线 `--line: #3A3A3C`
     - 阴影深色下淡化/去阴影（靠明度分层）
   - 毛玻璃：tab 栏/sheet 深色半透明黑底（`rgba(28,28,30,0.8)` + blur 保留）
   - 环图/图表：`RING_COLORS` 提亮系（深色下可见度），面积图渐变与数值/日期标签色随主题
2. **模式策略**：**✅ 已确认：跟随系统 + 手动覆盖**——默认 `prefers-color-scheme` 自动切换；设置页加「外观：跟随系统 / 浅色 / 深色」开关，`data-theme` 属性 + localStorage 持久化
3. **JS 硬编码色提取**：RING_COLORS、图表文字色等改为读取 CSS 变量（`getComputedStyle`）或随 `data-theme` 切换的映射表
4. **原生层**：capacitor.config.json `androidSystemBarStyle` 增加 `colorDark: #121212` + style dark（Capacitor 支持 colorDark 自动跟随系统深色切换状态栏）
5. **对比度检查**：正文/标题对比度 ≥ 4.5:1 / 3:1（深色下文字反白）

### 实施清单
1. `styles.css`：深色变量集（`@media (prefers-color-scheme: dark)` + `[data-theme="dark"]` 两套触发）；毛玻璃/阴影深色调整
2. `app.js`：图表硬编码色变量化（RING_COLORS 等随主题）；设置页「外观」选项 + localStorage 持久化（若选手动覆盖方案）
3. `index.html`：`data-theme` 初始化脚本（防闪烁，head 内联读 localStorage）
4. `capacitor.config.json`：SystemBarStyle 增加 colorDark
5. 真机验证：系统切深色 → App 跟随；设置页手动切换

### 待确认问题
- ~~模式策略：跟随系统 + 手动覆盖（推荐，设置页三选）还是仅跟随系统？~~ ✅ 已确认：跟随系统 + 手动覆盖
- ~~深色主色：#121212（Material）还是更暖的深色（配合产品基调）？~~ ✅ 已确认：Material 标准 #121212

### 验收要点
- 系统深色模式下 App 全界面深色（背景/卡片/文字/图表/毛玻璃/状态栏），无刺眼白块
- 浅色模式无回归；手动切换即时生效并持久化
- 图表（分段环/面积图）深色下可见、色点与列表一致
- 对比度达标；真机 + 桌面正常

---

## 12. 限制问候语长度（方案 A 三保险 → v1.7 拆层演进） ✅ 已实施（v1.6 / v1.7）

### 需求
AI 组合问候语太长影响页面美观（实测 31 字换 3 行），需限制长度。方案对比后确认 **A（限制长度）**，放弃 B（滚动显示——标题滚动观感差、marquee 已废弃、不符合 Apple 风格）。

### 方案设计（✅ 已确认 A：三保险）

1. **提示词收紧**：AI 提醒句生成要求从「≤40 字」改为「**≤20 字**」（getDailyTip 的提示词），组合后约 25-28 字，最多 2 行
2. **代码兜底截断**：renderGreeting 拼装时，组合文案总长 > 30 字 → 截断为「问候语前缀 + 提醒句前 16 字 + …」
3. **CSS 最终兜底**：`.screen-title` 加 `-webkit-line-clamp: 2`（最多 2 行，超出省略号）——任何情况压得住，页面永不破版

### 实施清单
1. `app.js`：getDailyTip 提示词「不超过 40 字」→「不超过 20 字」；renderGreeting 加组合文案长度兜底截断
2. `styles.css`：`.screen-title` 加两行省略（display: -webkit-box + line-clamp: 2）

### 验收要点
- 组合问候语最长 2 行，无 3 行换行
- 超长提醒句被截断且以「…」结尾，无硬切断
- 按钮不再有被挤压风险（v1.5 已加 flex-shrink 双保险）
- 真机 + 桌面正常

---

## 18. 时段分布环图配色升级（多彩时间色） ✅ 已实施（v1.8）

### 需求
时段分布环形图的蓝色系渐变配色不好看（用户反馈「有点丑」），需要配色方案升级。

### 现状（问题诊断）
当前浅色模式 5 段纯蓝明度渐变：`#C6E2FF → #9CCBFF → #6FB2FF → #3F96FF → #007AFF`：
1. **深浅失衡**：前两段（清晨 #C6E2FF / 上午 #9CCBFF）与白色卡片对比度仅 ~1.15:1 / 1.35:1，几乎隐形；深夜段 #007AFF 最重——整环「头轻脚重」
2. **同色相边界弱**：5 段同一色相只改明度，相邻段色差小，像「一个蓝环切了几刀」而非精心色板
3. **中心撞色**：中心数字用 --accent-deep 深蓝，与深夜段 #007AFF 几乎同色，环与中心糊在一起

### 方案设计（✅ 已确认 A：多彩时间色）
按「一天的光线变化」选色：清晨柔黄 → 上午橙 → 下午绿 → 傍晚青 → 深夜蓝。暖到冷的时间递进直觉性强；每段独立色相、边界清晰；全部取自 iOS 系统色（App 已同体系）。

**浅色模式**：
| 时段 | 色值 | 语义 |
|------|------|------|
| 清晨 | #FFCC00 | 晨光黄 |
| 上午 | #FF9500 | 日间橙 |
| 下午 | #34C759 | 正午绿 |
| 傍晚 | #32ADE6 | 暮色青 |
| 深夜 | #007AFF | 夜色蓝 |

**深色模式**（iOS 深色系统色提亮版）：
| 时段 | 色值 |
|------|------|
| 清晨 | #FFD60A |
| 上午 | #FF9F0A |
| 下午 | #30D158 |
| 傍晚 | #64D2FF |
| 深夜 | #0A84FF |

**附带修正**：中心数字颜色由 --accent-deep 改为 --ink（跟随主题黑/白），与环段解耦不再撞色；列表色点与环自动一致（同一变量）。

### 实施清单
1. `styles.css`：浅色 + 深色 `--ring-1..5` 换成上表色值
2. `styles.css`：`.ring-num` 颜色改 `--ink`
3. 验证：浅/深色模式下 5 段可辨、列表色点一致、中心数字不撞色

### 验收要点
- 浅色模式：5 段独立色相清晰可辨，深夜段不再显得过重
- 深色模式：提亮版色板在 #121212/#1E1E1E 上可辨
- 中心数字（最高时段 %）为黑/白色，与任何环段不撞
- 列表色点与环段一一对应；真机 + 桌面正常

---

## 19. 分析页「在聊聊」追问回复排版优化 ✅ 已解决（用户 2026-08-09 确认已修改）

### 需求
分析页点追问 chip 后，AI 回复排版混乱：markdown 语法（`**`、`1. 2. 3.`）原样显示、长段落无换行、无标题/列表/层次感，与报告页的卡片式结构风格不统一。

### 现状（问题诊断）
- `askQuestion()`（app.js）把 AI 回复纯文本直接塞进 `#askAnswer` 的单个 `<p>`：`ans.innerHTML = <p class="ask-q">…</p><p>${esc(content)}</p>`
- 换行被 HTML 折叠成空格，`**加粗**` 和数字列表原样露出，长段落（实测 5 段建议 400+ 字）挤成一坨
- 报告页（renderAIReport）是结构化卡片（本周概览/模式识别/情绪观察/诱因分布/温和建议），追问区却无结构——同一页面两套视觉语言
- 真实案例：AI 输出「感谢+数据总结（长段）+ 1-5 条建议（markdown 列表 + **加粗**）+ 结尾」，前端全原样显示

### 方案设计（草案）
**A + B 组合**：

1. **轻量 markdown 子集渲染**（前端，不引第三方库，本地离线原则）：
   - `**文字**` → `<b>`（现有 report-body 的 `b { color: var(--accent-deep) }` 已有样式）
   - `1. 2. 3.` / `- ` 行 → 有序/无序列表（`.pattern-row` 风格或新 `.ask-list`）
   - 空行分段 → `<p>` 段落
   - 实现：`renderMarkdown(text)` 小函数（先 esc 再分段/列表/加粗替换），放 `askQuestion` 前
2. **提示词约束输出结构**（`askQuestion` 的 user prompt 追加）：
   - 要求：先 1 句直接回应（≤40 字），再给 2-4 条建议（每条一行，`1. ` 开头，每条 ≤60 字），结尾 1 句温和收尾
   - 控制长度避免超长段落（用户反馈的乱感主要来自 400+ 字一坨）
3. **样式**：`#askAnswer` 内复用现有视觉语言（report-body 的 `b` 强调色、段落间距、列表圆点/序号），保持 Apple 卡片感

### 实施清单
1. `app.js`：新增 `renderMarkdown()`（esc → 分段 → 列表 → 加粗），`askQuestion` 的 then 分支改用
2. `app.js`：追问 user prompt 加结构约束（回应 ≤40 字 + 2-4 条建议每条一行 + 温和收尾）
3. `styles.css`：`.ask-list` 样式（序号/圆点、间距，跟随主题变量）
4. 验证：真实 AI 回复渲染（浏览器 mock 或真机）+ 无 console 错误

### 待确认问题
- 是否同时限制追问回复总长度（如 ≤300 字）？——倾向加（提示词约束即可，不硬截断）
- 追问回复是否需要「卡片包裹」（像报告卡）还是保持对话流式气泡？——倾向轻量：气泡卡片 + 内部列表结构

### 验收要点
- 追问回复中 `**加粗**`、`1. 2.` 列表渲染为样式化内容，无 markdown 符号裸露
- 长回复分段显示，无 400 字一坨
- 视觉与报告页同体系（强调色、间距、列表）
- 深色模式正常；真机 + 桌面无 console 错误

---

## 13. 每日温和记录提醒 ✅ 已实施（v1.6）

### 需求
增加**每日温和提醒**：设定时间提醒用户记录（可选，默认关闭或默认开启待定），文案非评判、不催促。

### 现状
- 记录完全靠主动想起，无任何提醒机制
- 已有每日 AI 问候语（打开 App 时），但没有定时推送

### 理解与设计（草案）

**架构**：Capacitor 本地通知（`@capacitor/local-notifications`）——纯本地调度，无需服务器、不收集任何数据，符合「数据仅本地」原则。

1. **设置页新增「记录提醒」区块**：
   - 开关（默认关，避免打扰；开启时请求通知权限）
   - 时间选择器（默认 21:00，可自定义）
2. **提醒文案**（非评判示例）：
   - 「今天感觉如何？想记录就记一下，不想也没关系。」
   - 「睡前留一分钟：今天有什么想记下的吗？」
   - 文案库 2-3 条随机轮换（或周一/周末语气微调）
3. **交互**：点击通知 → 打开 App（Capacitor 通知默认行为）；不强制进入记录面板（温和原则）
4. **边界**：通知权限被拒 → 设置页显示引导说明；卸载/关开关自动清理调度

### 实施清单
1. `npm i @capacitor/local-notifications` → 注册插件
2. 设置页 UI：开关 + 时间选择
3. 通知调度/取消逻辑（开→schedule，关→cancel，时间变更→重排）
4. 权限请求与拒绝引导
5. 文案库 + 随机选择

### 待确认问题
- ~~默认开启还是默认关闭？~~ ✅ 已确认：**默认关闭**（温和不打扰，用户主动开启；开启时请求通知权限）
- ~~默认提醒时间~~ ✅ 已确认：**21:00**（可自定义）

### 实施备注（v1.6）
- 浏览器（非原生）环境只保存设置，调度在真机生效
- 通知文案库 3 条按日期轮换；重启 App 时幂等重排调度

### 验收要点
- 开启后到设定时间收到通知，文案温和非评判
- 点击通知打开 App；关闭后不再收到
- 修改时间后按新时间提醒；权限拒绝有引导
- 卸载重装不残留调度

---

## 14. 桌面快捷小组件（Widget） ✅ 已实施（v1.6，2x2）

### 需求
安卓桌面添加**「一键记录」小组件**：不打开 App 完整流程，点一下直接记录（或点一下打开 App 并弹出记录面板）。

### 现状
- 记录必须：打开 App → 点「+ 记录」→ 面板填写（3 步内）
- 桌面无任何入口

### 理解与设计（草案）

**架构**：原生 `AppWidgetProvider` + 点击广播 → `MainActivity` 接收 intent（`onNewIntent`）→ WebView JS 层触发记录面板。

1. **Widget 形态**（**✅ 已确认：2x2**，Apple 风格圆角深色/浅色；原 2x1 方案放弃）：
   - 「观己」logo + 大「＋」按钮 + 副文案（如「记录一下」）
   - 2x2 空间更充裕，可顺带展示今日状态：如「今天已记录 1 次」/「今天还没记录」（点亮/置灰 + 小字）——**本轮未做**（WebView 记录数据原生无法直接读取，需后续加 WebView→原生数据桥，标记为增强项）
   - 点按钮 → 打开 App 并自动弹出记录面板（就现在模式）
2. **数据流**：
   ```
   桌面点 Widget
     → AppWidgetProvider onReceive（ACTION_APPWIDGET_UPDATE + 自定 action）
     → PendingIntent 带 extra（如 guanji://record 或 action 常量）
     → MainActivity onNewIntent 检测 → bridge 到 WebView（capacitor bridge 或 JS eval）
     → app.js 收到 → openSheet('now')
   ```
3. **样式**：widget 布局 XML + 图标资源；深浅色自适应（`android:theme` 或跟随系统）
4. **边界**：App 被系统杀掉后点 Widget 冷启动 → 仍能打开记录面板（onCreate 路径同样处理 intent）

### 实施清单
1. `android/app/src/main/`：`GuanjiWidget.kt`（AppWidgetProvider）+ `res/layout/widget.xml` + `res/xml/widget_info.xml`
2. `MainActivity.kt`：`onNewIntent`/`onCreate` 处理 widget intent → 通知 WebView 打开记录面板
3. `app.js`：监听原生事件（`window` 自定义事件或 Capacitor 监听）→ `openSheet('now')`
4. 图标/文案资源；深浅色适配
5. `npx cap sync` 后构建验证

### 验收要点
- 桌面添加 widget 成功，样式与 App 风格一致（圆角、深浅色跟随）
- 冷/热启动点击 widget 都打开 App 并自动弹出记录面板（就现在模式）
- 记录流程完整可用（时间正确）
- 卸载 App widget 同步消失

---

## 15. 30 天 / 月度趋势 ✅ 已实施（v1.6）

### 需求
图表支持**更长周期的观察**：近 30 天趋势 + 月度汇总对比（本月 vs 上月）。

### 现状
- 面积图固定近 14 天；时段分布固定 7 天口径
- 无月度维度数据视图

### 理解与设计（草案）

**方案**（轻量，不新增页面——首页图表卡内扩展）：

1. **面积图范围切换**：图表卡顶部加小分段「近 14 天 / 近 30 天」；数据量从 14 → 30 点，纵轴自适应
2. **月度汇总卡**（首页新增小节或并入面积图卡）：
   - 本月次数 vs 上月次数（环比，如「+3 次 / -12%」）
   - 本月日均 vs 上月日均
   - 月度口径：自然月（每月 1 日起）
3. **复用**：现有 `countRange()` / `renderAreaChart()` 参数化；`totalCount` 已有

### 实施清单
1. `app.js`：`renderAreaChart(days)` 参数化（14/30）；月度汇总计算函数（本月/上月次数、日均、环比）
2. `index.html`：图表卡顶部范围分段 + 月度汇总区块
3. `styles.css`：分段小控件样式（复用设置页 chips 风格）

### 待确认问题
- ~~月度汇总放首页（推荐）还是分析页？~~ ✅ 已确认：**首页面积图卡内**（趋势卡底部小行）
- ~~环比口径：仅次数还是也要时长/时段？~~ ✅ 已确认：**仅次数**（附日均辅助，时长口径后续再议）

### 验收要点
- 切换 30 天面积图正确渲染（30 点、坐标自适应、无重叠）
- 月度汇总数字正确（与记录数据核对）；无记录月份显示空态
- 真机 + 桌面正常

---

## 16. 情绪-频率关联分析 ✅ 已实施（v1.6）

### 需求
AI 分析报告加入**情绪维度**：观察「情绪 × 频率 × 时段」的关联，帮用户理解自己的模式（非评判）。

### 现状
- 记录已有情绪字段（5 档：平静/放松/压力/焦虑/无聊等）
- 但聚合 payload（发给 DeepSeek 的特征）**未包含情绪数据**，AI 报告完全没有情绪维度

### 理解与设计（草案）

1. **payload 扩展**（`buildAggregatePayload`）：
   - 本周情绪分布：各情绪占比（如「压力 40% · 无聊 25% …」）
   - 情绪 × 诱因交叉：如「压力 + 看片」组合次数 Top3
   - 情绪 × 时段：各时段主要情绪
   - 只发聚合特征，**不发原始记录**（隐私原则不变）
2. **提示词更新**：让 AI 在报告中加入「情绪观察」小节——如「你压力较大的日子频率略高，这只是个观察，不代表任何对错」
3. **报告结构**：新增「情绪观察」卡（或在现有「模式识别」内扩展），其余结构不变
4. **边界**：数据不足（本周 < 3 条）跳过情绪小节，不硬编

### 实施清单
1. `app.js`：聚合函数新增情绪统计（分布/交叉）；payload 结构扩展
2. 提示词增加情绪小节要求（保持 ≤40 字风格约束与非评判基调）
3. 报告渲染：情绪观察卡（新增或并入现有卡）
4. 回归：无情绪数据时不影响现有报告

### 验收要点
- 生成的分析报告中出现情绪观察内容（数据充足时）
- 数字与本地记录统计一致（可对照时段分布卡核对）
- 无情绪/数据不足时不出现该小节，无报错
- 隐私不变：请求 payload 仍只有聚合特征

---

## 17. 温和正向反馈（里程碑肯定） ✅ 已实施（v1.6）

### 需求
连续观察达到里程碑时给**温和肯定**（非「戒断天数」压力语境，而是「你更了解自己了」）。

### 现状
- 首页仅有「连续记录 n 天」数字，无任何情感反馈
- 产品基调已是非评判，但缺少正向强化

### 理解与设计（草案）

1. **里程碑阈值**：连续记录 ≥ 7 天 → 出现温和肯定；≥ 30 天 → 升级文案
2. **文案库**（非评判、不涉及戒断/次数对错）：
   - 7 天：「连续观察 7 天，你对自己更了解了。👀」
   - 30 天：「30 天持续记录，这本身就是一种对自己的关注。」
   - 文案 2-3 条轮换；显示位置：今日卡副文案区（问候语下方小字）
3. **展示规则**：
   - 未达 7 天不显示（不制造压力）
   - 已显示后当天不再变化（稳定）
   - 深色/浅色下同样式（ink-3 小字即可，不抢视觉）
4. **技术**：`countStreak()`（已有）复用；阈值判断 + 文案选择

### 实施清单
1. `app.js`：里程碑判断（streak ≥ 7 / ≥ 30）+ 文案选择 + 渲染到今日卡副文案
2. `styles.css`：副文案样式（若需）

### 待确认问题
- ~~是否需要在设置页加「关闭正向反馈」开关？~~ ✅ 已确认：**加开关**（设置页「正向反馈」卡，默认开启）
- ~~文案基调确认~~ ✅ 已确认：温和观察式，非戒断语境（「连续观察 7 天，你对自己更了解了」等）

### 验收要点
- 连续 7 天出现肯定文案，未达不显示
- 30 天文案升级；当天内文案稳定不闪变
- 开关可关闭（若做）；深色模式正常
- 真机 + 桌面正常

---

## 20. 日历视图支持点空白退出 ✅ 已实施（点空白关闭面板，日历优先）

### 需求
首页点日历按钮打开日历视图后，点击空白区域（backdrop）无法退出，只能点「完成」按钮——期望点空白也能关闭（与记录面板行为一致）。

### 现状
- 记录面板：`$('sheetBackdrop').addEventListener('click', closeSheet)` 已有点空白关闭
- 日历视图：`openCalendar()` 显示 `#calendarSheet` + `#sheetBackdrop`，但 backdrop 点击未绑定关闭（只有 `#calClose` 按钮）

### 方案设计
1. backdrop 点击 → `closeCalendar()`（复用同一个 `#sheetBackdrop`，注意与记录面板的监听并存——两个 sheet 共用 backdrop，需区分当前打开的是哪个）
2. 确认 sheet 层级：calendarSheet 与 recordSheet 都是 z-index 30，backdrop z-index 20，点击 backdrop 触发关闭逻辑需判断当前显示的是哪个面板

### 实施清单
1. `app.js`：backdrop 点击监听扩展——当前若 calendarSheet 可见则 closeCalendar，否则 closeSheet
2. 验证：日历打开 → 点空白关闭；记录面板打开 → 点空白关闭；两者互不干扰

### 验收要点
- 日历视图点空白关闭，动画正常
- 记录面板点空白行为不回归
- 真机 + 桌面正常

---

## 21. 首页 14/30 天切换增加滑块动效 ✅ 已实施（通用 seg 滑块动效）

### 需求
首页「次数趋势」卡内 14 天/30 天分段切换目前是颜色高亮跳变，希望像底部 tab 栏一样有滑块滑动效果。

### 现状
- 底部 tabbar 已有 `.tab-slide` 滑块层（left/width 过渡 + 弹性曲线）
- `#chartSeg` 的 seg 切换只是 `classList.toggle('active')`（背景色变化，无滑动）

### 方案设计
- 复用 tabbar 滑块模式：`#chartSeg` 内加绝对定位滑块层（`.seg-slide`），点击 seg 时计算相对容器 left/width 过渡过去
- 尺寸：mini seg（高度 30px），滑块圆角与 seg 一致（999px 胶囊）
- 曲线：`cubic-bezier(0.23, 1, 0.32, 1.05)`（与 tabbar 同款弹性）
- 初始化定位到当前选中 seg

### 实施清单
1. `index.html`：`#chartSeg` 内加滑块层
2. `styles.css`：`.seg-slide` 样式（绝对定位、胶囊、过渡）
3. `app.js`：点击 seg 时 `moveSegSlide()`；初始化定位

### 验收要点
- 切换 14/30 天滑块平滑滑到目标，弹性自然
- 初始加载滑块在「14 天」
- 深色模式正常；真机 + 桌面正常

---

## 22. 记录面板「就现在/补记」分段加滑块动效 ✅ 已实施（通用 seg 滑块动效）

### 需求
记录面板第一步的时间分段「就现在 / 补记」切换目前是颜色跳变，希望加滑块动效（与 #21 同款）。

### 现状
- `.seg-row`（就现在/补记）是 `.seg.active` 背景色切换，无滑动层
- 与底部 tabbar 滑块视觉语言不一致

### 方案设计
- 同 #21：`.seg-row` 加滑块层，点击 seg 平滑滑动
- 注意：记录面板内 `#chartSeg` 与 `#recordSheet` 的 seg-row 是两处独立的滑块，需各自初始化定位（`initSegSlide(container)` 通用函数）

### 实施清单
1. `index.html`：记录面板 seg-row 加滑块层
2. `app.js`：通用 `initSegSlide()`/`moveSegSlide()`（#21/#22 共用）；记录面板初始化时定位
3. 验证：就现在/补记切换滑块动画；与其他 seg（themeChips？themeChips 是 chips 不是 seg-row，不动）

### 验收要点
- 切换滑块平滑；初始滑块在「就现在」
- 记录流程无回归；真机 + 桌面正常

---

## 23. 记录面板两步切换高度跳动修复 ✅ 已实施（v3.4 补丁，见 #66）

### 需求
记录面板第一步（时间）与第二步（详情）内容高度不同，切换时面板整体高度突变、内容上下跳动，观感差。

### 现状
- `#stepTime`（时间选择，内容少）与 `#stepDetails`（时长/情绪/诱因/备注，内容多）在 sheet 内切换
- sheet 高度跟随内容自适应（max-height 86%），两步切换瞬间高度跳变，无过渡

### 方案设计
1. **固定两步的最小一致高度**：sheet 内容区给一个稳定高度（如取两步中较高者的近似值，`min-height`），或
2. **高度过渡动画**：切换时用 CSS transition 平滑高度（max-height 过渡或 grid-template-rows 技巧）
3. 推荐：给 sheet 内步骤容器设 `min-height`（如 420px）+ 内容淡入上移（现有 fadeUp 语言），高度不再跳动

### 实施清单
1. `styles.css`：sheet 步骤容器 min-height + 过渡
2. 验证：两步来回切换高度稳定无跳动

### 验收要点
- 两步切换面板高度稳定，无上下跳动
- 深色模式正常；真机 + 桌面正常

---

## 24. 情绪/诱因支持自定义添加 ✅ 已实施（v2.9，见 #47）

### 需求
记录面板的情绪和诱因只能选预设 6 项，希望可以自主添加自定义选项（如「平静」外的「烦躁」、诱因「健身日」等）。

### 现状
- `MOODS = ['平静','放松','愉悦','无聊','焦虑','压力']`、`TRIGGERS = [...]` 为常量，chips 由 JS 生成
- 无添加入口，无法扩展

### 方案设计
1. chips 行尾加「+ 添加」chip（虚线/浅色样式）
2. 点击 → 小输入弹层（复用 dialog 机制或 prompt 式内联输入）→ 输入文字 → 加入该组 chips 并选中
3. 持久化：localStorage 存自定义列表（如 `guanji_custom_moods` / `guanji_custom_triggers`），启动时合并渲染
4. 边界：去重、长度限制（≤6 字）、空输入忽略；删除自定义项（长按或编辑模式——首版可不做删除，做「再次点击添加弹层可删除已有自定义项」可选）

### 实施清单
1. `app.js`：自定义列表存储 + 合并渲染 + 添加交互
2. `index.html`/`styles.css`：添加 chip + 输入弹层
3. 验证：添加后立即可选、重启后仍在、可保存记录

### 待确认问题
- 自定义项是否需要删除/管理入口？（倾向：首版支持添加即可，管理后续）
- 添加弹层形式：居中 dialog（现有样式）还是 sheet 内联输入？（倾向 dialog）

### 验收要点
- 添加自定义情绪/诱因后 chips 出现并可选中，记录保存正常
- 重启 App 自定义项仍在（持久化）
- 去重/长度限制生效；深色模式正常

---

## 25. 【Bug】按钮点击后灰色边框残留 ✅ 已修复（关闭 UA focus outline）

### 需求
App 内按钮点击后，取消点击（松开）后仍有一个灰色边框残留，要再次点击才消失——按钮没有回到未点击状态。

### 现状（✅ 已定位根因，浏览器实测）
- **根因**：Chromium UA 默认样式表对 `:focus` 元素提供 `outline: auto`（实测无样式按钮 focus 后 computed outline = `rgb(16,16,16) auto`，即**深灰色 focus ring**）
- 项目所有按钮只写了 `:focus-visible { outline: 2px solid var(--accent-deep) }`（键盘可达性），**没有任何 `:focus` 规则显式关闭 outline**
- **Android WebView 触摸点击后元素保持 focus 状态**（触摸交互下焦点不自动移除）→ UA 默认灰色 outline 一直显示；再次点击使焦点转移/变化后才消失——即用户看到的「灰色边框」
- 桌面浏览器鼠标点击后 `:focus-visible` 不匹配（规范行为），所以桌面看不出问题，真机才复现

### 修复方案（✅ 浏览器已验证）
```css
/* 全局关闭 UA 默认 focus outline（灰色残留来源） */
*:focus { outline: none; }
```
- 保留各按钮 `:focus-visible { outline: 2px solid var(--accent-deep) }`——specificity (0,2,0) 高于 `*:focus` (0,1,0)，**键盘 Tab 导航蓝色 outline 不受影响**（实测：注入后 probe 按钮 outline=none、recordBtn 键盘焦点 outline=蓝色 2px solid ✓）
- **双保险（可选）**：`document.addEventListener('touchend', ...)` 对非输入类交互元素 `blur()`——首版 CSS 方案已足够，JS 失焦作为真机回归不彻底时的备选

### 实施清单
1. `styles.css`：全局 `*:focus { outline: none }`（放基础样式区，`*` 选择器附近）
2. 验证：真机点击任意按钮松开后无灰色边框；键盘 Tab 导航蓝色 outline 保留
3. 全按钮回归（tab/记录/设置/dialog/日历/chips）

### 验收要点
- 点击任意按钮松开后无灰色边框残留（真机）
- 键盘/无障碍 focus 指示不丢失（蓝色 outline）
- 真机 + 桌面正常

---

## 26. 【Bug】补记模式日期时间显示 NaN ✅ 已修复（空/非法日期拦截保存）

### 需求
补记模式下「月日时间」显示 NaN——日期/时间选择异常时时间显示崩坏。

### 现状（✅ 已定位根因，浏览器实测复现）
- **根因**：`updateTimeDisplay()` 中 `new Date($('pickDate').value + 'T' + $('pickTime').value)`——`pickDate`/`pickTime` 为**空字符串或非法格式**时 `new Date()` 产生 Invalid Date，`getMonth()+1` = NaN → 显示「NaN月NaN日 NaN:NaN」
- **原生 date/time input 允许用户清空**（WebView 日期选择器有清除操作）→ change 触发 → NaN
- 浏览器实测复现 4 条路径全部触发：
  - 清空日期 → `NaN月NaN日 NaN:NaN` ✓
  - 清空时间 → 同上 ✓
  - 非法时间 `99:99` → 同上 ✓
  - 非法日期 `2026-13-99` → 同上 ✓
- **连带隐患**：`saveRecord()` 补记分支对空值不校验（`+parts[0]` 空串 → 0），可能保存坏数据

### 修复方案（草案，待实施验证）
```js
function updateTimeDisplay() {
  let d;
  if (sheetMode === 'backfill') {
    const dv = $('pickDate').value, tv = $('pickTime').value;
    d = (dv && tv) ? new Date(dv + 'T' + tv) : null;
  } else {
    d = new Date();
  }
  if (!d || isNaN(d.getTime())) d = new Date();   // 空/非法 → 回退当前时间
  $('timeDisplay').textContent = `${d.getMonth() + 1}月${d.getDate()}日 ${fmtTime(d)}`;
}
```
1. `updateTimeDisplay()`：空/非法值回退当前时间，永不 NaN
2. `saveRecord()`：补记模式 `pickDate`/`pickTime` 为空 → toast「请选择日期和时间」+ 阻止保存（不产生坏数据）
3. 输入 change 被清空时自动恢复默认（今天/当前时刻）——交互更友好
4. 验证：清空/非法输入后显示正常、保存被拦截或正确

### 实施清单
1. `app.js`：`updateTimeDisplay()` 兜底 + `saveRecord()` 校验 + 清空自动恢复
2. 浏览器回归：4 条 NaN 路径全部不再触发
3. 真机验证补记全流程

### 验收要点
- 补记任意清空/非法操作后时间显示无 NaN（回退当前时间）
- 空日期/时间保存被拦截（toast）或回退，不产生坏数据
- 真机 + 桌面正常

---

## 27. AI 提供商可配置（多提供商 + 连接测试） ✅ 已实施（v2.5，见 #43）

### 需求
AI 分析不局限于 DeepSeek：默认 DeepSeek，但允许用户自定义 **Base URL + API Key + 模型名**，选择其他 OpenAI 兼容提供商（如 OpenAI、硅基流动、本地 Ollama 等），并提供**连接测试**功能。

### 现状
- `askDeepSeek()` 硬编码 `https://api.deepseek.com/chat/completions` + `model: 'deepseek-chat'`
- 设置页只有 API Key 输入（`#apiKeyInput`），无 Base URL/模型/提供商配置
- 无连接测试能力

### 方案设计
1. **设置页 AI 设置区扩展**：
   - 提供商预设选择（chips 或下拉）：DeepSeek（默认）/ OpenAI / 自定义
   - Base URL 输入（默认按提供商自动填：DeepSeek `https://api.deepseek.com`、OpenAI `https://api.openai.com/v1`）
   - API Key 输入（已有）
   - 模型名输入（默认 `deepseek-chat` / `gpt-4o-mini` / 自定义）
2. **存储扩展**：`guanji_ai_config_v1` = { provider, baseUrl, model, apiKey }（apiKey 可并入或保留旧 key 兼容迁移）
3. **askDeepSeek 改造**：`askDeepSeek` → `askAI()`，endpoint = `${baseUrl}/chat/completions`（baseUrl 已含 /v1 时避免重复），model 可配；保持 OpenAI 兼容格式
4. **连接测试**：设置页「测试连接」按钮 → 发送最小请求（1 token 或 system 单条消息）→ 成功 toast「连接成功 · 模型 xxx」/ 失败展示错误类型（401 密钥无效 / 404 路径错 / 超时 / 网络）
5. **隐私说明更新**：文案改为「AI 提供商与聚合特征」，仍只传聚合数据
6. 兼容：已有 `guanji_api_key_v1` 读取迁移到新配置；API key 输入回显

### 实施清单
1. `index.html`：设置页 AI 设置区扩展（提供商 chips + Base URL + 模型 + 测试按钮）
2. `app.js`：配置存储/读取/迁移；`askAI()` 改造（所有调用处：报告/自动生成/每日提醒/追问）；`testAIConnection()`
3. `styles.css`：新输入区样式（复用 picker-row）
4. 验证：DeepSeek 默认路径回归；自定义 Base URL + 测试连接成功/失败各分支

### 待确认问题
- 提供商预设哪几个？（建议：DeepSeek / OpenAI / 自定义 三个，覆盖大多数）
- 测试连接的最小请求格式？（发一条 `{"messages":[{"role":"user","content":"ping"}]}` 或带 max_tokens=1）

### 验收要点
- 默认 DeepSeek 全流程无回归（报告/提醒/追问）
- 切换提供商 + 填 Base URL/Key/模型后可生成分析
- 连接测试对错误（401/404/超时/网络）给出明确提示
- 配置持久化、重启生效；隐私说明同步更新
- 真机 + 桌面正常

---

## 28. 记录面板空旷问题修复（自适应 + 高度过渡动画） ✅ 已实施（v3.4 补丁，见 #66）

### 需求
v2.0 #23 为消除两步切换高度跳动，给 `#stepTime`/`#stepDetails` 统一 `min-height: 500px`——但步骤 1（时间选择）实际内容仅约 120px，被撑出大片空白，面板显得空旷。用户反馈后方案对比确认 **方案 2：自适应高度 + 切换动画**。

### 现状
- `styles.css`：`#stepTime, #stepDetails { min-height: 500px; }`（步骤 1 空 380px）
- 步骤 1 内容 ~120px（label + seg + 时间显示 + 日期时间输入），步骤 2 内容 ~493px（真机实测）
- 去除 min-height 后步骤 1 恢复紧凑，但切换瞬间高度跳变 370px（#23 原始问题回归）

### 方案设计（✅ 已确认 2：自适应 + 高度过渡动画）
1. **去掉固定 min-height**：两步恢复各自自然高度（步骤 1 紧凑 ~120px，步骤 2 ~493px）
2. **切换高度动画**：`nextBtn`/`prevBtn` 切换时用 JS 测量目标步骤高度，sheet 高度从当前值平滑过渡到目标值（0.35s `--ease-spring`），过渡完成后清除内联 height 样式（恢复 auto）
   - sheet 是 bottom:0 定位 → 高度变化向上延伸，视觉自然
   - 步骤内容淡入（现有 fadeUp 语言）配合
3. 注意：初始打开 sheet 时无过渡（直接显示）；连续快速切换时以最后一次为准（动画防抖：清除上一个过渡）

### 实施清单
1. `styles.css`：删除 `#stepTime, #stepDetails { min-height: 500px }`
2. `app.js`：`transitionSheetHeight(targetEl)` 函数——测量目标高度 → 设当前高度 → rAF 过渡到目标 → transitionend/超时清理；`nextBtn`/`prevBtn` 点击时调用（目标 = stepDetails/stepTime）
3. 验证：两步来回切换高度平滑过渡，无跳动感、无空旷；快速连续点击无残留内联样式

### 验收要点
- 步骤 1 紧凑无大片空白（恢复自然高度）
- 两步切换 sheet 高度动画平滑（~0.35s 弹性），无瞬间跳变
- 动画结束后内联 height 清理（不残留固定值，内容变化仍自适应）
- 真机 + 桌面正常；深色模式正常

---

## 29. 弹层小横杠拖拽关闭 + 出场/退场动画 ✅ 已实施（通用弹层动画+拖拽）

### 需求
记录面板和日历视图顶部都有小横杠（`.sheet-handle`），用户希望：① 支持**拖动小横杠关闭弹层**（或类似交互）；② 两个弹层卡片增加**出场（打开）和退场（关闭）动画**。

### 现状
- 打开动画：`.sheet` / `.calendar-sheet` 有 `sheetUp`（translateY 100%→0，0.32s 弹性）出场动画 ✓
- **无退场动画**：关闭瞬间直接加 `.hidden` 消失（生硬）
- **无拖拽交互**：小横杠无任何功能，只是装饰
- backdrop 无淡入淡出

### 方案设计（草案）
1. **退场动画**（JS 过渡，避免与 sheetUp 动画冲突）：
   - 关闭时：sheet `transform: translateY(100%)` + `opacity` 过渡（0.25s），backdrop `opacity → 0` 淡出，~260ms 后加 `.hidden` 并清理内联样式
   - 打开时：显式恢复 `sheet.style.animation = ''`（清拖拽残留的 animation:none）使 sheetUp 重播
2. **拖拽关闭**（Pointer Events 统一鼠标/触摸）：
   - 小横杠区域作为拖拽热区（`touch-action: none` 防滚动冲突；热区可扩大：handle 外包 `.sheet-grab` 透明条，高约 20px，`cursor: grab`）
   - pointerdown：记录起点，`sheet.style.animation = 'none'` 让位 inline transform
   - pointermove：`translateY(dy)` 跟随 + backdrop 透明度同步（1 - dy/500）
   - pointerup：dy > 90px → 走退场动画关闭；否则回弹归位（0.3s 弹性）
   - setPointerCapture 保证手势连续
3. **通用函数**：`animateSheetClose(sheetEl, backdropEl, closeFn)` + `initSheetDrag(handleId, sheetId, backdropId, closeFn)`，记录面板与日历共用
4. 打开动画保持现有 sheetUp；backdrop 加淡入（`backdropIn` 0.25s）

### 实施清单
1. `styles.css`：退场过渡、`.sheet-grab` 拖拽热区样式、backdrop 淡入淡出、`.sheet-handle` touch-action
2. `index.html`：两个弹层 handle 外包 `.sheet-grab`
3. `app.js`：`animateSheetClose()` + `initSheetDrag()`；`closeSheet`/`closeCalendar` 改走退场；`openSheet`/`openCalendar` 恢复 animation 重播
4. 验证：打开/关闭动画流畅、拖拽跟随/回弹/阈值关闭、与点空白关闭共存（都走退场动画）

### 验收要点
- 打开有上滑动画，关闭有下滑退场动画（含 backdrop 淡出），不生硬
- 按住小横杠拖动：弹层跟随手指，超过阈值松手关闭，未达阈值回弹
- 点空白/完成按钮关闭同样有退场动画
- 快速连续开关无动画残留、无 console 错误；真机 + 桌面正常；深色模式正常

---

## 30. 【Bug】AI 设置卡「模型/API 密钥」label 紧贴上方输入框 ✅ 已解决（用户 2026-08-09 确认已修改）

### 需求
AI 设置卡中「模型」「API 密钥」两个小字（`.field-label`）紧贴上方输入框，间距为 0，视觉拥挤。

### 现状（✅ 已定位，浏览器实测）
- 实测间距：`Base URL 输入框 →「模型」= 0.0px`、`模型输入框 →「API 密钥」= 0.0px`（完全紧贴）
- 根因：
  1. 写 AI 设置卡时只给「Base URL」label 加了内联 `style="margin-top:16px"`（从提供商 chips 隔开），「模型」「API 密钥」没加
  2. `.field-label` 基础样式 `margin: 0 0 8px`（**只有下边距，无上边距**）
  3. `.card > input[type="text"]` 输入框 `margin-bottom: 0` → 输入框下边缘与下一个 label 之间 0 间距

### 修复方案（草案）
**统一 CSS 规则，删除内联样式**（styles.css）：
```css
/* 输入框/选择控件之后紧跟的 label 自动留出 16px 上间距 */
.card > input + .field-label,
.card > .picker-row + .field-label,
.card > .chips + .field-label { margin-top: 16px; }
```
- 覆盖「模型」「API 密钥」（输入框后）与「Base URL」（chips 后）——**第一个「提供商」label 不受影响**（卡片标题下无需额外间距）
- 删除 index.html 里「Base URL」label 的内联 `margin-top:16px`（统一走 CSS）

### 实施清单
1. `styles.css`：上述组合选择器规则
2. `index.html`：删掉 Base URL label 的内联 margin-top
3. 验证：四个字段间距一致（8px label 下边距 + 16px 上边距），无紧贴

### 验收要点
- 「模型」「API 密钥」label 与上方输入框间距 ≥16px，无紧贴
- 四个字段（提供商/Base URL/模型/密钥）垂直节奏一致
- 深色模式正常；真机 + 桌面正常

---

## 31. 【Bug】记录提醒时间清空后输入框显示为空 ✅ 已解决（用户 2026-08-09 确认已修改）

### 需求
设置页「记录提醒」卡：进入时间选择（`#reminderTime`）后清空时间，输入框显示为空——应自动恢复默认值（与 #26 补记日期时间的「清空自动恢复」行为一致）。

### 现状（代码定位）
`app.js` 提醒时间 change 监听：
```js
$('reminderTime').addEventListener('change', () => {
  const s = loadReminder();
  s.time = $('reminderTime').value || '21:00';   // 存储回退 21:00
  saveReminder(s);
  applyReminderSchedule(s);
  toast('提醒时间已更新');
});
```
- 清空时**存储**回退 `'21:00'`，但**输入框本身**没有恢复显示（`$('reminderTime').value` 仍是空）→ **界面显示空、存储是 21:00，显示与存储不一致**
- 对比 #26 修复：pickDate/pickTime 清空后 change 监听会**恢复输入框显示**——`#reminderTime` 漏了这步

### 修复方案（草案）
change 监听中，清空时同步恢复输入框显示（默认 21:00，或恢复上次有效值）：
```js
if (!$('reminderTime').value) $('reminderTime').value = '21:00';
```
再读取保存——保证界面与存储一致，不会显示为空。

### 实施清单
1. `app.js`：`reminderTime` change 监听开头加清空恢复（恢复默认 21:00 或上次有效值）
2. 验证：清空时间 → 自动恢复显示 21:00、toast 时间更新、调度正常

### 验收要点
- 清空提醒时间后输入框自动恢复显示（21:00 或上次有效值），不显示为空
- 存储与显示一致；开关/调度行为无回归
- 真机 + 桌面正常

---

## 32. 小组件「一键快速记录」+ 信息增强 ✅ 已实施（v2.1-2.2）

### 需求
桌面小组件（#14，2x2）点击后只是「打开 App + 弹出记录面板」，仍要手动选情绪/诱因/时长/保存——**没有真正快捷记录**。需要：① 一键快速记录；② 小组件信息增强。

### 现状（#14 已实施）
- widget 点击 → intent extra `guanji_record` → MainActivity → WebView `window.__guanjiOpenRecord()` → `openSheet('now')` 弹面板
- widget 无任何数据展示（今日次数/连续天数/最近记录均无）
- 数据在 WebView localStorage，原生无法直接读写 → **widget 无法直接写记录**（只能通过 WebView 执行）

### 方案设计（草案）
**核心思路：数据一致性零风险——原生只传「意图」，记录始终由 WebView 写入。**

1. **一键快速记录**（解决痛点）：
   - widget 主按钮「＋ 快速记录」→ intent extra `guanji_quick_record`（与现有 `guanji_record` 区分）
   - MainActivity 检测 → WebView `window.__guanjiQuickRecord()` → **自动保存一条「就现在」默认记录**（当前时间、无情绪/诱因/时长/备注）→ toast「已快速记录 ✓」→ 停留在首页（不弹面板）
   - 一键完成记录：点 widget → 打开 App → 记录已保存。全程零操作
2. **widget 信息增强**（展示层）：
   - 今日已记录次数 + 连续天数：WebView 在记录变化（保存/删除）时通过自定义 Capacitor 插件（或 Android Bridge 方法）把 `{todayCount, streak}` 同步到 SharedPreferences → widget onUpdate 读取显示
   - widget 布局：2x2 = 顶部「观己」+ 今日状态（如「今天已记录 1 次 · 连续 3 天」）+ 主按钮「＋ 快速记录」+ 底部小字「打开记录面板」（点击走原弹面板意图）
   - 深色模式适配（现有 values-night）
3. **可配置性（后续增强，首版可不做）**：快速记录是否含「最近一次的情绪/诱因」预填？——首版纯默认，保持极简

### 实施清单
1. `android`：MainActivity 处理 `guanji_quick_record` extra → WebView 调用 `__guanjiQuickRecord`；自定义插件或 Bridge 暴露 `syncWidgetStats(todayCount, streak)` 写 SharedPreferences
2. `www/app.js`：`window.__guanjiQuickRecord = () => saveQuickRecord()`（复用 saveRecord 逻辑的默认值版本 + toast）；记录变化时调 `syncWidgetStats`
3. `android`：GuanjiWidget 布局改（今日状态 + 快速记录按钮 + 打开按钮两个 PendingIntent 区分）；onUpdate 读 SharedPreferences 显示
4. 验证：widget 快速记录一键完成（真机桌面操作）；今日次数/连续天数显示正确；App 内记录后 widget 数据更新（onUpdate 刷新时机）

### 待确认问题
- 快速记录是否需要「撤销」（toast 附撤销按钮）？——倾向首版不做，toast 仅确认
- 今日状态同步时机：App 启动 + 记录变化时同步即可？（widget 无法实时推送，onUpdate 在 App 同步后下次刷新显示）

### 验收要点
- 点 widget「＋」→ App 打开并自动保存一条就现在记录，toast 确认，无面板交互
- 点 widget「打开」→ 弹记录面板（原行为保留）
- widget 显示今日次数/连续天数，与 App 内数据一致（同步后）
- 数据仍只存 WebView（原生零数据写入）；真机 + 深色模式正常

---

## 33. 新增 2x2 数据看板小组件 ✅ 已实施（v2.1-2.2）

### 需求
在快速记录小组件（#14/#32）之外，**再增加一个独立的 2x2 数据看板小组件**：无需打开 App 即可查看关键统计。

### 现状
- 现有 widget：2x2 快速记录型（点击记录/打开面板），无数据展示
- 数据展示全部在 App 内（首页统计行：本周次数/较上周/连续天数）

### 方案设计（草案）
1. **独立 provider**：新增 `GuanjiStatsWidget`（AppWidgetProvider）+ `widget_stats_info.xml`（2x2），与快速记录 widget 并存（桌面可同时添加两个）
2. **看板内容**（2x2 四宫格或大数字布局，数据复用 #32 的 WebView→SharedPreferences 同步机制）：
   - 今日次数（大数字，主视觉）
   - 本周次数
   - 连续天数
   - 较上周（环比 %，↑绿/↓灰或按观己语义）
   - 布局示例：
     ```
     ┌─────────────┐
     │ 今日 1 次     │  ← 大数字
     │ 本周 7 · 连续 3│
     │ 较上周 −22%   │
     └─────────────┘
     ```
3. **点击行为**：打开 App 首页（普通启动意图，不弹记录面板）
4. 深色模式：复用 values-night 配色资源；无数据时显示「—」占位
5. 同步时机：同 #32（App 启动 + 记录变化时写入 SharedPreferences，widget onUpdate 读取）

### 实施清单
1. `android`：`GuanjiStatsWidget.kt` + `res/layout/widget_stats.xml` + `res/xml/widget_stats_info.xml` + Manifest receiver 注册
2. `android`：与 #32 共用 stats 同步字段（todayCount/weekCount/streak/weekDelta）
3. 验证：桌面添加看板 widget，数据与 App 一致；深浅色正常；点击打开首页

### 待确认问题
- 看板格子内容组合（今日/本周/连续/环比 四格 vs 今日大数字 + 其余小字）？——倾向后者（大数字主视觉）
- 是否需要「点击看板进入分析页」？——倾向首页（普通打开）

### 验收要点
- 桌面可同时添加「快速记录」与「数据看板」两个 widget
- 看板数据（今日/本周/连续/环比）与 App 内一致
- 点击看板打开 App 首页；深色模式正常
- 无数据时占位「—」不报错

---

## 34. 本周节奏小组件（2x2） ✅ 已实施（v2.1-2.2）

### 需求
新增 2x2「本周节奏」小组件：7 天柱状小图，一眼看本周每天记录次数。

### 方案设计（草案）
- 布局（2x2）：周一~周日 7 根柱状图 + 底部星期标签，柱高按当天次数比例
- 技术：RemoteViews 不支持 SVG——用 7 个纵向 LinearLayout（每根柱一个 View，高度按权重/固定比例设置），或用 `setViewPadding`/`setInt(R.id.bar, 'layout_height', ...)` 动态设高
- 数据：近 7 天每天 counts（复用 #32/#33 的 WebView→SharedPreferences 同步机制，同步近 7 天数组）
- 点击 → 打开 App 首页；深色模式适配；无数据显示空柱 + 占位
- 今日柱高亮（accent 色），其余灰蓝色

### 实施清单
1. `android`：`GuanjiWeekWidget.kt` + `widget_week.xml` + `widget_week_info.xml`（2x2）+ Manifest 注册
2. `android`：同步字段扩展（近 7 天 counts 数组）
3. 验证：柱状图比例正确、今日高亮、深浅色、点击打开首页

### 验收要点
- 7 根柱高度与数据成比例，今日柱高亮
- 与 App 近 7 天数据一致；深色模式正常
- 无数据不报错；真机正常

---

## 35. 连续记录进度小组件（2x2） ✅ 已实施（v2.1-2.2）

### 需求
新增 2x2「连续记录进度」小组件：连续记录天数 + 里程碑进度条（7/30 天），温和正向反馈桌面化（非戒断）。

### 方案设计（草案）
- 布局（2x2）：「连续记录 n 天」大数字 + 进度条（到最近里程碑 7 或 30 天）+ 温和文案（「距离 7 天还有 x 天」/ 已达成显示肯定语）
- 技术：进度条用 `ProgressBar`（水平）+ `setProgress`，或两层 View 宽度比例
- 数据：streak（复用同步机制）；里程碑阈值 7/30
- 点击 → 打开 App 首页；深色模式适配；streak=0 显示「今天开始也不迟」

### 实施清单
1. `android`：`GuanjiStreakWidget.kt` + `widget_streak.xml` + `widget_streak_info.xml`（2x2）+ Manifest 注册
2. `android`：同步字段扩展（streak）
3. 验证：进度条到里程碑正确、文案温和非评判、深浅色

### 验收要点
- 连续天数显示正确，进度条到 7/30 天阈值
- 文案温和（非戒断语境）；streak=0 有鼓励文案
- 深色模式正常；真机正常

---

## 36. 今日卡片小组件（2x2） ✅ 已实施（v2.1-2.2）

### 需求
新增 2x2「今日卡片」小组件：今日是否已记录 + 温和文案（非评判版打卡）。

### 方案设计（草案）
- 布局（2x2）：「今天」标题 + 状态（已记录：✓ 大图标 + 「今天已记录 n 次」/ 未记录：「今天还没记录，想记就记」）+ 温和小字
- 数据：todayCount（复用同步机制）
- 点击 → 打开 App 首页（不弹面板，保持简单）
- 深色模式适配；状态文案随已记录/未记录切换

### 实施清单
1. `android`：`GuanjiTodayWidget.kt` + `widget_today.xml` + `widget_today_info.xml`（2x2）+ Manifest 注册
2. `android`：同步字段（todayCount）
3. 验证：记录前后 widget 状态更新、文案温和、深浅色

### 验收要点
- 未记录时显示鼓励文案，记录后显示「今天已记录 n 次」
- 状态与 App 一致（同步后）；深色模式正常
- 点击打开 App 首页；真机正常

---

## 37. 小组件点击行为统一：统计类只进首页，快速记录整卡一键 ✅ 已实施（v2.3）

### 需求
1. 数据看板 / 连续记录 / 今日卡片 / 本周节奏 4 个统计类小组件：点击 → 只打开 App 首页（不弹记录面板，纯看数据不打扰）
2. 快速记录小组件：「＋快速记录」与「打开记录面板」两个动作矛盾（一个立刻记、一个弹表单，定位打架，用户点起来犹豫）——用户确认 **方案 A：删掉「打开记录面板」按钮，整卡点击 = 一键快速记录**

### 现状（问题定位）
- 当前 4 个统计 widget 整卡点击全部绑定 `openApp(quickRecord=false)` → 弹记录面板（与「只进首页」预期不符）
- 快速记录 widget 双按钮：`＋快速记录`（requestCode=1）→ 自动存默认记录；`打开记录面板`（requestCode=0）→ 弹表单——同一 widget 两个相反语义

### 细化设计
- `WidgetStatsHelper.openApp` 扩展为三模式（PendingIntent requestCode 区分，避免 FLAG_UPDATE_CURRENT 互相覆盖）：
  - `OPEN_HOME`：不带任何 extra，requestCode=2 → MainActivity 冷/热启动正常进首页，不弹面板、不自动记录（MainActivity **零改动**：无 extra 即默认行为）
  - `OPEN_RECORD`：EXTRA_GUANJI_RECORD，requestCode=0 → 保留实现（本次无使用方，预留）
  - `QUICK_RECORD`：EXTRA_GUANJI_QUICK_RECORD，requestCode=1 → 保留（快速记录 widget 用）
- 4 个统计 widget（GuanjiStatsWidget / GuanjiStreakWidget / GuanjiTodayWidget / GuanjiWeekWidget）整卡点击（stats_root / streak_root / today_root / week_root）改绑 OPEN_HOME
- 快速记录 widget：`widget_guanji.xml` 删除「打开记录面板」按钮 → 布局改为顶部今日状态 + 整卡点击 = QUICK_RECORD（桌面主区域即按钮，误触风险低、语义单一）

### 实施清单
1. `android`：`WidgetStatsHelper.openApp` 加 OPEN_HOME 模式（不带 extra，requestCode=2）
2. `android`：Stats/Streak/Today/Week 4 个 widget 的整卡点击改绑 OPEN_HOME
3. `android`：`GuanjiWidget` + `widget_guanji.xml`：删「打开记录面板」按钮，整卡可点 = 快速记录
4. 验证：4 个统计 widget 点击进首页不弹面板；快速记录 widget 整卡点击 +1（热/冷启动）；5 个 widget 点击互不串扰

### 验收要点
- 点统计 widget：进 App 首页，无记录面板弹出
- 点快速记录 widget：立即 +1 并 toast「已快速记录 ✓」
- 5 个 widget 点击行为互不串扰（requestCode 0/1/2 区分）；快速记录 widget 布局无空按钮残留

---

## 38. 最近记录 / 日历列表支持「编辑」记录 + 修改后自动重生成报告 ✅ 已实施（v2.3）

### 需求
首页「最近记录」目前只可删除不可修改（记错时间/漏记情绪无法修正，误删只能靠补记重建）。添加「编辑」：点击后打开记录面板并预填原数据，保存时原地更新。

### 关键结论：AI 算法不需要修改
`buildAggregatePayload()`（app.js:747）每次生成分析时对 records **实时重新聚合**（频率/时段分布/情绪/诱因/组合/连续天数/看片占比），编辑记录 = 改聚合输入，重新点「生成分析」自然反映。只需编辑保存后触发 `afterRecordsChanged()`（widget 同步 hook 已存在）。

**补充需求（用户 2026-08-06 确认）：修改记录后自动重新生成报告**——保证报告的时效性和可信度，不用手动再点一次。

现状问题定位：`maybeAutoGenerate()`（app.js:1030）仅在报告**不存在**时自动生成（`analysisResult` 可见即 return）；`reportFingerprint()`（记录总数+最新 id+日期）防重复。→ 修改记录后报告已存在则**永不自动刷新**，指纹机制反而成为刷新阻碍。

自动重生成设计（复用指纹，把「防重复」改造成「检测过期」）：
- **过期判定**：当前指纹 ≠ `REPORT_FP_KEY` 存储值（且已生成过 / 有 key / 本周≥3 条）
- **触发**：`afterRecordsChanged()`（已挂钩编辑/删除/新增/快速/清除/恢复）→ 报告**可见**（用户在分析页）→ 防抖 1.5s 自动重生成（连续操作合并一次调用）；报告**不可见** → 不立即调 API，由 `maybeAutoGenerate()` 改造兜底：进分析页时报告可见且过期 → 也自动刷新
- **重入保护**：`analysisBusy` 标志，生成中不重复触发
- **刷新态 UI（不打断阅读）**：不清空旧报告——顶部插入轻提示条「数据已更新，正在刷新分析…」；成功 → 替换新报告 + 清空旧追问上下文（旧报告已失效）+ 更新指纹；失败 → 移除提示条、**保留旧报告** + 温和 toast「报告刷新失败，仍显示上次结果」
- **失败不更新指纹** → 下次变更/进页仍会尝试（每次只触发一次，不循环爆炸）
- **成本**：每次修改消耗一次 AI 调用（只发聚合特征，隐私约束不变；防抖合并连续操作）

### 细化设计
- 入口两处（保持一致）：首页「最近记录」每条 + 日历当天明细列表，删除按钮旁加「✎ 编辑」按钮（data-id）
- `openSheet` 增加第三模式 `'edit'`：预填日期时间（补记 seg 激活）/ 情绪诱因 chips / 时长滑块 / 看片开关 / 备注；「现在/补记」seg 可切换（切「现在」→ 时间重置当前，切「补记」→ 保留原时间可改）
- `saveRecord` 编辑分支：按 `editingId` 原地更新（**id 不变**，时间变更才重算 offset），不再 push；toast「已更新 ✓」
- 保存后：`renderHome()` + 日历 `renderCalendar()` + `afterRecordsChanged()`
- 边界：快速记录（`quick_` 前缀，空字段）也可编辑补全；改时间后排序/日历角标/时段分布自动重绘；分析页不自动重生成

### 实施清单
1. `app.js`：`renderRecentRecords` + `renderCalDayDetail` 加编辑按钮（data-id）
2. `app.js`：`openSheet` 支持 `'edit'` 模式（预填 + editingId）
3. `app.js`：`saveRecord` 编辑分支（原地更新，保持 id，重算 offset/time，toast「已更新 ✓」）
4. `app.js`：两处事件委托处理 `recent-edit` 点击
5. `styles.css`：`.recent-edit` 样式（复用 `.recent-del` 按钮样式族）
6. `app.js`：自动重生成报告（指纹过期判定 + `afterRecordsChanged` 触发 + 防抖 1.5s + `analysisBusy` 重入保护 + 刷新提示条/失败保留旧报告 + `maybeAutoGenerate` 支持报告可见时过期刷新）

### 验收要点
- 点编辑 → 面板预填原数据，可改时间/情绪/诱因/时长/看片/备注
- 保存后原地更新，不产生重复记录、id 不变
- 日历当天列表同样可编辑；改时间后角标/排序/时段分布正确
- **编辑保存后：分析页报告自动刷新（在分析页 → 防抖 1.5s 自动重生成 + 顶部提示条；不在分析页 → 切回分析页时自动刷新）；刷新成功替换报告 + 清空旧追问；失败保留旧报告 + 温和 toast；连续操作只调用一次 AI**
- 5 个小组件统计同步刷新

---

## 39. 【Bug】分析页「重新生成分析」按钮灰色/禁用 ✅ 已修复（v2.3）

### 现象
「重新生成分析」按钮默认呈灰色，看起来像禁用状态；且点过一次生成失败后，按钮变成**真正禁用**（更灰 + 禁止光标），重进分析页也不恢复。

### 根因（浏览器 + 代码定位，两层）
1. **视觉层**：`regenBtn` 用 `.btn-ghost`（styles.css:430，`background: var(--bg-elev)` 灰底 + `color: var(--ink-2)` 灰字）——天生灰色系；而空状态「生成本周分析」按钮用 `.btn-primary`（app.js:1040，accent 彩色）。同一功能两个按钮样式不一致，报告存在后反而更灰，视觉上像禁用。
2. **逻辑层（真 bug）**：`generateAnalysis`（app.js:952）点击后 `btn.disabled = true`，但 `finally`（app.js:1016）只处理 succeeded 分支，**从不恢复 `btn.disabled = false`**。成功路径被 `renderAIReport` 重建 innerHTML 掩盖；失败路径按钮留在 `analysisResult` 中永久 disabled 且 `analysisResult` 未隐藏 → 切走再切回分析页（`maybeAutoGenerate` 因报告可见直接 return）看到真禁用按钮。

### 方案
1. `styles.css`/`app.js`：`regenBtn` 改 `.btn-primary`（与「生成本周分析」样式统一，醒目可点）
2. `app.js`：`generateAnalysis` 的 `finally` 统一恢复 `btn.disabled = false`（成功时旧按钮已脱离 DOM 无害；失败时恢复可点）

### 验收要点
- 报告存在时「重新生成分析」按钮为彩色主按钮样式，非灰色
- 生成失败后再进分析页，按钮可正常点击（不残留禁用）
- 点击后加载期间仍为禁用态（防重复点击），结束后恢复

---

## 40. 【Bug】我的页「保存」按钮默认灰色（视觉像禁用） ✅ 已修复（v2.3）

### 现象
「我的 → AI 设置」的「保存」按钮默认呈灰色，像不可点击；旁边「测试连接」却是蓝色主按钮，对比强烈。

### 根因
纯视觉问题（无 disabled 逻辑，click 正常绑定，按钮实际可点）：
- `apiKeySave` 用 `.btn-ghost`（index.html:189），样式 = 灰底灰字（styles.css:431-432：浅色 `#E5E5EA` 底 + `#8E8E93` 字；深色 `#2C2C2E` 底 + `#B0B0B4` 字）——次级按钮被做成「禁用观感」
- 同区域「测试连接」用 `.btn-primary`（`#007AFF` 蓝底白字）——对比强烈
- 与 #39 视觉层同源；同一模式还存在于所有 ghost 按钮：日历「完成」、弹窗「取消」、记录面板「上一步」、添加弹层「取消」等

### 方案（✅ 已确认：全局，2026-08-06）
- **全局（采用）**：改进 `.btn-ghost` 视觉——文字从 `--ink-2`（`#8E8E93` 中灰）加深为 `--ink`（`#000000`/`#FFFFFF`），并加 1px 边框（半透明边框色，深色模式同步适配），使「次级按钮」明确可点、不像禁用；所有 ghost 按钮（保存/完成/取消/上一步等）同时受益，避免同类疑问反复出现；hover/active 状态随文字加深同步调整
- ~~局部：apiKeySave 改 .btn-primary~~（放弃——与「测试连接」双主按钮同屏视觉过重，且其他 ghost 按钮问题仍在）

### 验收要点
- 「保存」按钮不再是灰色禁用观感（全局 ghost 样式改进后，文字清晰、有边框、明确可点）
- 其他 ghost 按钮（完成/取消/上一步）在浅色/深色模式下均无明显禁用观感
- 按钮点击行为不变；hover/active 反馈正常

---

## 41. 【Bug】系统字体放大（textZoom）时胶囊/按钮换行上下排布 ✅ 已修复（v2.4）

### 现象
换新手机后（系统字体较大/不同渲染），首页「次数趋势」切换胶囊的「30 天」变成上下排布（文字在空格处断行），「我的」页 API 密钥的「保存」按钮同样异常。

### 根因（浏览器定位）
Android WebView 的系统字体缩放（textZoom）只放大文本、不放大容器：`.card-head`（标题 + 胶囊 flex 行）中标题与胶囊 min-content 同时变宽 → 胶囊被压缩 → 「30 天」在空格处断行成两行；`.picker-row`（input flex:1 + 保存按钮）中 input 的 min-width:auto 被 placeholder 撑大 → 按钮被挤压。浏览器用「全元素 font-size ×1.4/×2.0」模拟复现（容器宽度不变）确认。

### 方案
1. `.seg` 全局加 `white-space: nowrap`（趋势胶囊 + 记录面板 seg 均受益，永不断行）
2. `.card-head > div:first-child { flex: 1; min-width: 0 }` + 内部 p 截断省略；`#chartSeg { flex-shrink: 0 }`（字体大时标题让位截断，胶囊完整）
3. `.picker-row input { min-width: 0 }`（允许收缩让位）+ `.picker-row .btn-ghost { flex-shrink: 0 }`（保存按钮永不压缩）

### 验收要点
- 字体放大 2 倍模拟下：胶囊文字单行、胶囊完整；保存按钮与输入框并排完整
- 真机（新手机）验证通过；滑块定位/编辑功能回归无异常

---

## 43. 【Bug】AI 提供商切换时 API 密钥不清空/不区分 ✅ 已修复（v2.5）

### 现象
配置自定义 AI 并填入 API 密钥后，切换回 DeepSeek：Base URL/模型会恢复预设，但 API 密钥输入框仍保留自定义的密钥；保存后自定义 key 被当作 DeepSeek 的 key 使用（请求 api.deepseek.com 必 401）。

### 根因（代码定位）
- `applyProviderPreset()`（app.js:1524）切换提供商时只更新 `aiBaseUrlInput`/`aiModelInput`，**不处理 `apiKeyInput`**
- 配置为单份存储（`aiConfig = { provider, baseUrl, model, apiKey }`，localStorage `guanji_ai_config_v1`），密钥不按提供商区分

### 方案（✅ 已确认：B——按提供商分别保存，2026-08-06）
- **B（采用）**：按提供商分别保存密钥——`aiConfig` 扩展为 per-provider 存储 `{ deepseek: {baseUrl, model, apiKey}, openai: {…}, custom: {…} }`（localStorage `guanji_ai_config_v2`），切换提供商时自动回显对应密钥；含旧版单份配置（`guanji_ai_config_v1` + 独立 apiKey 存储）自动迁移：旧 key 归入当前 provider
- 存储结构：`{ providers: { deepseek: {…}, openai: {…}, custom: {…} }, active: 'deepseek' }`（active 记忆当前提供商）
- 切换提供商：回显该提供商的 baseUrl/model/apiKey（custom 保留上次自定义值）；连接测试/保存/askAI 全部基于 active 提供商配置
- ~~A（放弃）：切换清空密钥~~——体验差，已弃用

### 实施清单
1. `app.js`：`loadAIConfig/saveAIConfig` 改为 per-provider 结构 + v1 迁移（旧配置 key 归入原 provider）
2. `app.js`：`applyProviderPreset` 切换时回显对应提供商完整配置（含 apiKey）并记忆 active
3. `app.js`：`readAIConfigFromInputs`/保存/连接测试/`askAI` 均基于 active provider 配置
4. 验证：切自定义填 key → 切 DeepSeek 回显 DeepSeek 的 key（无则空）→ 切回自定义仍保留原 key；旧版配置升级后数据不丢

### 验收要点
- 切回 DeepSeek 后密钥输入框为空（A）/ 回显 DeepSeek 已保存的密钥（B）
- 保存后 AI 调用使用当前提供商对应的 key；连接测试用当前输入框内容

---

## 44. 【Bug】记录页/日历页点空白退出时卡片出现模糊感/段落感 ✅ 已修复（v2.9）

### 需求（用户原话）
记录页和日历页，如果点击空白处退出，卡片会出现模糊感，怀疑是退出动画的问题。

### 根因（已定位）
- `.sheet`（styles.css:681）带 `backdrop-filter: blur(30px)` 毛玻璃 + 半透明背景（`--glass`）
- 退场动画 `animateSheetClose`（app.js:420）：`translateY(100%)` 下滑 + `opacity: 0.6`，backdrop 同步淡出
- 退场过程中毛玻璃 sheet 半透明地滑过下方卡片内容 → 30px 模糊条扫过内容 = 用户看到的「模糊感」

### ✅ v2.6 已修（2026-08-07）：退场期间临时 backdropFilter:none + 动画结束恢复——但用户复测仍有「段落感」

### 🆕 复测反馈与新根因（2026-08-07）
- 用户：**「点击空白处退出，卡片还是会有段落感」**——v2.6 只关了 blur，但退场仍是 **opacity 0.6 半透明下滑**：半透明 sheet 滑过内容、且 backdrop 淡出后 sheet 直接叠在页面上滑动 → 两层内容视觉交叠 = 「段落感/断层感」

### ✅ v2.7 已修（2026-08-07）：退场背景转不透明 var(--card)——段落感消除

### 🆕 v2.7 复测反馈 2（2026-08-07）：退场「先降透明度卡一下，然后才退出完成」
- 根因（已定位）：`animateSheetClose` 同时过渡 transform 与 opacity，但 **transform 用弹簧曲线 `--ease-spring`（cubic-bezier(0.23,1,0.32,1.05)）起始段斜率极慢**（前 ~0.1s 几乎不动），opacity 用 ease 均匀下降 → 感知为「透明度先降 → 卡片卡住不动 → 才下滑」
- 方案：**退场去掉 opacity 过渡**（opacity 保持 1，只做 transform 下滑，backdrop 遮罩淡出保留）——无透明闪烁、下滑即退；或统一两属性用同曲线（推荐前者，最简单干净）

### 🆕 v2.8 复测反馈（2026-08-07）：退场「很生硬」（日历卡片 + 添加卡片）
- 用户：**「现在点击空白处退出又很生硬，日历卡片和添加卡片」**
- 根因 1（sheet）：v2.8 去掉 opacity 后，下滑动画仍用弹簧曲线 `--ease-spring`（cubic-bezier 0.23,1,0.32,1.05）——**起始段 ~0.1s 几乎不动再突然加速** →「顿一下再走」= 生硬
- 根因 2（dialog）：添加/删除对话框 `.backdrop` 关闭是 `classList.add('hidden')` **直接瞬间消失，无退场动画**

### 升级方案（v2.9）
- sheet 退场曲线改**快启慢停**（如 `cubic-bezier(0.55, 0, 0.55, 0.2)` ease-in 风格，或 `transform 0.22s ease-in`）——开始立即滑动，结束自然减速
- dialog 退场加动画：复用 animateSheetClose 思路做 animateDialogClose（opacity→0 + translateY(10px) 或 scale(0.95)，0.2s 后 hidden），closeAddDialog/closeDeleteDialog 走动画

### 验收要点
- 记录面板/日历弹层点空白退出：**开始即滑动无停顿、退出干净**；背景遮罩淡出
- 添加/删除对话框关闭：平滑淡出+位移，无瞬间消失
- 打开动画（sheetUp / dialog fadeUp）质感不变；正常使用不受影响

---

## 48. 【Bug】编辑面板拖拽退出后首页编辑按钮残留选中状态 ✅ 已修复（v3.0）

### 需求（用户原话）
首页的最近记录，点击修改后，拉动卡片小横条退出到首页，编辑按钮还是选中状态；但点击空白处退出就没有这个问题。

### 现状与初步定位（✅ 真机已确认 2026-08-07）
- 真机触摸点击编辑按钮 → `document.activeElement` 停留在 `.recent-edit`（触摸聚焦按钮）
- **拖拽小横条退出**（adb swipe 模拟真实拖拽）：`sheetHidden: true` 后 `activeElement` 仍为 `recent-edit`、按钮 `:focus` 匹配——**焦点残留**（拖拽走 pointer capture 手势，无 click 语义、不转移焦点）
- **点空白退出**：pointerdown 落在 backdrop（不可聚焦元素）→ 浏览器把焦点移走（blur）→ 无残留
- 视觉呈现：按钮 :focus 在魅族 WebView 上带默认高亮 → 用户看到的「选中状态」

### 方案（✅ 已确认可行）
1. `openSheet` 打开面板时统一清除焦点：`if (document.activeElement && document.activeElement.blur) document.activeElement.blur()`（编辑/新增/补记全部受益）
2. 键盘 Tab 导航的 `:focus-visible` 焦点环保留不受影响

### 验收要点
- 编辑 → 拖拽小横条退出：按钮无选中/高亮残留
- 编辑 → 点空白退出：同前（无残留）
- 键盘 Tab 导航仍可见 :focus-visible 焦点环

---

## 49. 退场动画平滑化：遮罩与卡片同步联动 ✅ 已实施（v3.0）

### 需求（用户原话）
看看还有没有办法继续优化，日历和记录卡片点击空白处退出动画，可不可以做出一个平滑效果。

### 现状（v2.9）
- sheet：`transform 0.22s cubic-bezier(0.55,0,0.55,0.2)`（快启慢停）下滑 + 不透明背景
- backdrop：`opacity 0.22s ease` 淡出
- **问题**：两条曲线/语义不同步——遮罩按 ease 均匀消失，卡片按快启慢停下滑，视觉上「各走各的」，退出缺乏一体感

### 方案（草案）
- **统一曲线**：sheet 与 backdrop 都用 `cubic-bezier(0.33, 1, 0.68, 1)`（easeOutCubic——立即响应、末端柔缓停住），时长统一 **0.3s**（比 0.22s 从容）
- **卡片同步淡出 + 微缩放**：opacity 1→0 与下滑**同曲线同速**（消除「透明先降」的关键是曲线同步，而非去掉透明度）；`scale(0.98)` 微缩（iOS 弹层退场质感：下滑+微缩+同步淡出）
- backdrop 同 0.3s 同曲线 → 遮罩与卡片一起退场，一体感
- dialog 退场（animateDialogClose）顺带统一同曲线 0.25s

### 待确认问题
- 微缩放 scale(0.98) 是否采用（推荐加，iOS 质感；不加则纯下滑+淡出同步）

### 验收要点
- 点空白退出：遮罩与卡片**同步**平滑退场（无先透明、无顿感、无生硬）
- 打开动画（sheetUp）质感不变；拖拽退出同样平滑
- 对话框关闭统一顺滑

---

## 50. 【Bug】触摸设备按钮取消选中后残留 hover 黑字（全 App 共性问题） ✅ 已修复（v3.0，版本号不变）

### 需求（用户原话）
点击记录页的选项第一次点击，按钮整体变蓝色，再次点击取消，按钮边框变成正常未点击的灰色，但是按钮里面的字体还是黑色，不是未点击状态的灰色；再次点击的时候才变成未点击状态的完全体。可能是整个 app 的共性问题。

### 根因（✅ 浏览器已复现 2026-08-07）
- Playwright 真实鼠标复现：指针停留在 chip 上（hover 粘滞）→ 取消选中（移除 active）后 `:hover` 仍匹配 → `.chip:hover { color: var(--ink) }` 黑色覆盖基础灰（--ink-2）；指针移出才恢复灰字 rgb(142,142,147)
- 触摸设备上指针位置保持 → `:hover` 粘滞（sticky hover）→ **全 App 共性问题**：所有 :hover 样式（styles.css 共 16 条：chip/chip-add/btn-primary/btn-ghost/btn-danger/record-btn/row-btn/seg/tab/icon-btn/cal-nav/cal-cell/recent-del/recent-edit）在取消选中后都会残留 hover 态

### 方案
- 将所有 `:hover` 规则包裹进 `@media (hover: hover)`——hover 效果仅对支持悬停的设备（桌面鼠标）生效，触摸设备无粘滞 hover
- 共 16 条规则（含深色变体）逐条包裹，保持原有样式不变

### 实施清单
1. `styles.css`：`:hover` 规则 ×16 包裹 `@media (hover: hover) { ... }`（icon-btn/tab/btn-primary/btn-ghost×2/btn-danger/record-btn/row-btn/seg/chip/chip-add/cal-nav/cal-cell×2/recent-del/recent-edit）
2. 验证：触摸模拟（hover:none）下选中→取消→文字直接灰；桌面鼠标 hover 效果不变

### 验收要点
- 记录页选项：第一次点蓝、再点取消直接恢复灰字（无需第三次点击）
- 全 App 按钮/选项/图标同规则；桌面浏览器 hover 效果保留
- 版本号不 bump（用户指定保持 v3.0）

---

## 56. 【Bug】编辑模式「就现在」选项冲突（历史记录不该有「现在」语义） ✅ 已修复（v3.3）

### 现象（用户 2026-08-07 反馈）
最近记录点「编辑」进入的是补记，但还有「就现在」的选项——既然补记可以选时间，「就现在」就没有意义了，有点冲突。

### 根因（已定位）
- #46 编辑直达详情时「保留时间 seg 可调」——seg（就现在/补记）在编辑页可见
- 编辑的语义是修改**已存在的记录**，不存在「现在新建」概念；且切到「就现在」后 updateTimeDisplay 走 now 分支（显示当前时刻 + pickerRow 隐藏），保存会把**历史记录时间覆盖成当前时刻**——误操作风险
- 默认激活补记态，但 seg 可切换造成语义冲突

### 修复方案（草案）
- **编辑模式隐藏 timeSegRow**（无「就现在/补记」概念），保留 pickerRow（时间可调 = 补记语义）
- openSheet('edit') 分支：showClassicStep1 基础上额外隐藏 timeSegRow（或 edit 专用布局：pickerRow 显示 + seg 隐藏 + modeLink 隐藏）
- 保存逻辑不变（edit 分支读 pickDate/pickTime）

### 实施清单
1. `app.js` openSheet：mode==='edit' 时 timeSegRow 隐藏、pickerRow 显示（改时间的入口保留）
2. 验证：编辑记录 → 无 seg、日期时间可调、保存时间正确；「就现在」模式 seg 行为不受影响（#55 修复后）

### 验收要点
- 编辑页不再出现「就现在」选项，只有补记时间选择
- 编辑保存时间正确（不会意外覆盖为当前时刻）
- 新增记录（就现在/补记）的 seg 行为正常

---

## 57. 实况通知能力细化（双轨已验证，扩展交互闭环） ✅ 已实施（v3.4，A 部分）

### 需求（用户 2026-08-07）
已证明 App 使用安卓原生 Live Updates 与魅族实况通知均成功，基于现有基础细化功能，看还能实现什么。

### 现状盘点（v3.1-v3.3 已验证）
- 计时通知（ongoing + 系统级 chronometer 后台走秒）✓ 标准 Live Updates（Android 16+）✓ 魅族锁屏胶囊 ✓ 杀进程恢复 ✓ 权限降级链 ✓ 通知测试按钮 ✓ 划掉标记提示 ✓ 点击通知打开 App ✓

### 细化方案（按价值排序，草案）

**A. 通知栏快捷操作「结束并记录」/「取消」**（最高价值，运动 App 标准能力）
- 通知 Action「结束并记录」→ 结束计时 + 移除通知 → 打开 App 直达详情页（时长已预填，可微调）→ 选情绪/诱因 → 保存
- 通知 Action「取消」→ 取消计时 + 移除通知（温和提示在打开时补）
- 技术：标准通知用 NotificationCompat.Action + PendingIntent（requestCode 4=结束/5=取消，extra 区分）；魅族胶囊展开 contentView 加按钮（RemoteViews.setOnClickPendingIntent，因胶囊折叠态无按钮、展开态有）；MainActivity runWhenReady 调 JS（window.__guanjiTimerFinish / __guanjiTimerCancel）
- 权限/降级链不变；非原生忽略

**B. 点击通知直达全屏计时页**
- 计时中点击通知：打开 App 直接显示全屏计时页（而非首页）
- 技术：contentIntent 加 extra（guanji_timer_open）→ MainActivity → runWhenReady(window.__guanjiOpenTimerScreen) → running 时 showTimerScreen()

**C. 锁屏直接显示计时秒数**
- baseBuilder 加 setVisibility(Notification.VISIBILITY_PUBLIC)（计时内容不敏感，锁屏可见）

**D. 温和时长提醒（可选）**
- 计时到 30/60 分钟：通知文本更新「已经 X 分钟了，想结束随时可以」（温和非评判；由系统 chronometer 驱动，App 侧无需计时器）

### 明确不做（理由）
- 进度条目标化（引入目标/督促，违背温和非评判定位）
- 暂停/继续（#54 已拍板不加）
- 提醒类实况通知（官方文档明确仅适配「进行中」场景）
- 双计时/计时历史复用（语义不清，暂缓）

### 实施清单（✅ A 已确认实施，2026-08-07 计划定稿；B/C/D 暂缓）

**A. 通知栏快捷操作「结束并记录」/「取消」——实施计划**

1. `android/app/src/main/java/com/guanji/app/TimerLiveUpdatePlugin.kt`：
   - startTimer 通知加 2 个 Action（NotificationCompat.Builder.addAction，图标复用 ic_stat_timer）：
     - 「结束并记录」→ PendingIntent.getActivity(requestCode=4, extra EXTRA_GUANJI_TIMER_FINISH=true, FLAG_UPDATE_CURRENT|FLAG_IMMUTABLE)
     - 「取消」→ PendingIntent.getActivity(requestCode=5, extra EXTRA_GUANJI_TIMER_CANCEL=true, 同 flag)
   - 魅族 contentView（flyme_live_content.xml）加两个按钮「结束并记录」「取消」，buildFlymeContentRv 里 RemoteViews.setOnClickPendingIntent 绑定同一对 PendingIntent（胶囊折叠态无按钮，展开态有；标准 Action 双端通用）
2. `android/.../MainActivity.java`：
   - 新增常量 EXTRA_GUANJI_TIMER_FINISH / EXTRA_GUANJI_TIMER_CANCEL
   - onCreate/onNewIntent 统一处理（并入 handleWidgetIntent 或新增 handleTimerIntent）：
     - finish → runWhenReady("window.__guanjiTimerFinish ? (window.__guanjiTimerFinish(), 'ok') : 'pending'")
     - cancel → runWhenReady("window.__guanjiTimerCancel ? (window.__guanjiTimerCancel(), 'ok') : 'pending'")
   - **冷启动衔接**：进程被杀后点通知按钮 → 冷启动 → JS 层 restoreTimer 先恢复计时（running + 全屏页）→ runWhenReady 等到 JS 就绪后触发 finish/cancel，与恢复流程自然衔接
3. `www/app.js`：
   - window.__guanjiTimerFinish = () => { if (timerState.running) finishTimedRecord(); return 'ok'; }（结束 → 全屏隐藏 → 详情预填 → 面板详情打开，用户可调时长后保存）
   - window.__guanjiTimerCancel = () => { if (timerState.running) cancelFromTimerScreen(); return 'ok'; }（取消 + 关面板 + toast「已取消本次计时」）
4. 版本：versionCode 25 / versionName 3.4 / about-ver v3.4（资源 ?v 如 Web 层改动则 +1）
5. 验证：
   - 浏览器：直接调用 __guanjiTimerFinish/__guanjiTimerCancel 验证（结束预填/取消清理/无记录）
   - 真机（魅族）：开始计时 → 通知栏按钮「结束并记录」→ 打开 App 直达详情（时长预填）→ 保存正常；「取消」→ 计时终止 + 通知移除 + 温和提示；魅族胶囊展开态按钮；冷启动点按钮衔接恢复；权限拒绝/低版本无按钮（降级链不变）
   - 回归：全屏计时页/补记/编辑/quick 模式不受影响

### 待确认问题（✅ 2026-08-07 确认 A 实施）
- **A「结束并记录」直达详情** ✅ 已确认实施（2026-08-07 用户指定「实现A」）：结束计时 → 移除通知 → 打开 App 直达详情页（时长已预填可微调）→ 选情绪/诱因 → 保存
- B 点击通知直达全屏 vs 保持进首页（推荐：直达）——暂缓（未拍板）
- D 温和时长提醒是否纳入（30/60 分钟两个节点）——暂缓（未拍板）
- C 锁屏 VISIBILITY_PUBLIC——暂缓（未拍板）

### 验收要点
- 通知栏可直接结束/取消计时，结束直达详情可保存
- 计时中点击通知直达全屏计时页
- 锁屏显示计时秒数；魅族胶囊展开态按钮可用
- 非计时场景无通知；权限拒绝/低版本降级链不变

---

## 59. 息屏（AOD）状态优化：动态 contentText 增加信息量 ✅ 已实施（v3.4 补丁）

### 需求（用户 2026-08-08）
优化息屏显示（AOD，Always-On Display）阶段观己实况通知的形态——**AOD 有内容显示但简陋**（系统示例：Google Maps 导航在 AOD 显示「2 km · 转向指令」卡片）。

### 根因（已定位）
- AOD 息屏卡片的内容 = 通知的 **contentText**（Maps 示例的「2 km · 转向指令」就是它的 contentText）
- 之前按用户要求删除了 contentText（展开态副文本「回到 App 记录结束时刻即可」）→ **AOD 卡片只剩标题「观己 · 计时中」+ 图标 → 简陋**
- 展开态不需要提示语，但 AOD/折叠态需要信息文本——同一 contentText 两处显示，用「核心信息」而非「提示语」解决

### 方案（✅ 已定稿，用户确认）
1. **恢复 contentText 为动态核心信息**：「已计时 X 分钟」——每 **60 秒** 定时更新（重新 notify 同 id）
2. AOD 息屏卡片：`[icon] 观己 · 计时中 / 已计时 12 分钟`（接近 Maps 信息量）
3. 通知栏折叠态同受益；**展开态 chronometer 大秒数下方多一行小字**「已计时 12 分钟」（用户已确认接受——核心信息非噪音）
4. 系统 chronometer 秒数照常走（AOD 卡片右侧时间戳）

### 实施清单
1. `TimerLiveUpdatePlugin`：
   - startTimer 后启动定时更新（Handler postDelayed 60s 循环）：contentText = `已计时 ${分钟} 分钟`，重新 notify(NOTIF_ID)
   - stopTimer / 取消 / 结束路径清除定时器（含 JS 侧 finish/cancel 触发 stopTimer）
   - testLiveUpdate 不启用定时（15s 自消）
2. 构建 → 装 Android 16 新手机 → **AOD 息屏截图验证**（显示「已计时 X 分钟」）
3. 魅族路径：contentText 同时生效（魅族 contentView 布局是否显示 contentText 取决于 Flyme 渲染——主通知文本区，验证）

### 待确认问题（✅ 已确认）
- ~~展开态多一行小字「已计时 12 分钟」~~ ✅ 接受（核心信息非噪音）
- ~~更新频率~~ ✅ 每 60 秒（分钟级）

### 验收要点
- AOD 息屏：观己卡片显示「观己 · 计时中 + 已计时 X 分钟」（信息量达标）
- 每 60s 分钟数自动更新；停止/取消计时后不再更新
- 展开态/通知栏/状态栏 chip/魅族胶囊无回归

---

## 65. 【Bug】添加对话框：键盘弹出顶高预览框 + 页面拉扯（两套风格共有） ✅ 已实施（v3.4 补丁，2026-08-08）

### 需求（用户 2026-08-08）
情绪/诱因点「添加」时键盘弹出，把预览框顶高、页面被拉扯——**面板与汇总两套风格都触发**（共性）。

### 根因（✅ 真机复现定位，魅族 461QYFDN226NF）
UI 树实测（键盘弹出后 WebView 压缩至 1452px）：
1. **预览框顶高/重叠**：输入时 addCount（n/6）与 addPreview（「将添加：xxx」）同时出现，CSS 间距不足（.dialog-hint margin-top 6px、.dialog-text 无独立上距）→ 两者重叠约 3px；出现瞬间 dialog 高度突变 → flex 居中重算 → dialog 在键盘上方跳动 =「顶高」感
2. **页面拉扯**：adjustResize 压缩视口 → 底部记录面板被顶起（实测 top 200）、全页重排——键盘动画期间连续变化（#42 仅处理 tabbar，面板本身跟随视口）

### 方案（草案）
1. **预览区布局**：addCount 与 addPreview 间距/或合并为一行（「5/6 · 将添加：xxx」）——消除重叠与跳动
2. **对话框稳定**：键盘弹出时 dialog 固定定位（max-height + overflow 或 transform 定位，不随内容高度变化重居中）
3. **页面拉扯**：键盘弹出时对 backdrop 内容层做视觉稳定（或接受系统机制，先做 1+2 评估）

### 实施清单
1. `styles.css`：.dialog-hint/.dialog-text 间距处理（或合并显示）
2. `app.js`/`styles.css`：对话框键盘态稳定定位
3. 真机复现对比验证（面板 + 汇总两处添加）

### 待确认问题
- 预览与字数合并一行 vs 分行加间距

### ✅ 第一轮实施（2026-08-08，用户确认「按推荐，实施」）——只修了重叠，顶起/拉扯仍在（用户复测反馈「根本没有修复」）
- 合并一行：`addInput` input handler 单行预览——`addCount` 恒为空，`addPreview` 输出 `n/6 · 将添加：xxx`；`.dialog-text` 加 `margin-top: 6px`
- **该轮验证有方法缺陷**：`openAddDialog` 的 JS focus 已召起键盘，「键盘前/后」两组数据都采自键盘弹起态（innerHeight 恒 528），对比失效 → 误判「无顶起无拉扯」、跳过方案 2/3
- 用户复测确认问题仍在，重新定位

### ✅ 根治实施（2026-08-08，二次定位）
**真正的根因（真机 CDP 实锤）**：真机命中媒体查询 `@media (max-width: 420px) and (pointer: coarse)`（魅族 dpr 2.75 → CSS 宽 393px），其中 `.phone { height: 100vh }`——100vh 是布局视口高度，随 adjustResize 键盘压缩（851→528）→ `.phone` 从 844 缩到 528 → **整棵布局树全部重排**：sheet（absolute bottom:0）被顶起、backdrop 变矮 dialog 重新居中、汇总页 `clamp(vh)` 间距全变 =「预览框顶高 + 页面拉扯」的真实机制
- **修复 1（app.js #42 区块改造）**：键盘弹出时把 `html/body` 冻结为弹出前高度（inline px），收起恢复——`.phone` 改 `height: 100%` 后继承冻结值，布局树不再随键盘变化。基线 `kbBase` 取历史最大值并随每次键盘收起自愈（实测 WebView 崩溃重载时基准被捕获成压缩态 792 < 851 的案例，动态校准后修复）
- **修复 2（styles.css）**：媒体查询 `.phone { height: 100vh }` → `height: 100%` + `.stage { height: 100% }`（提供确定参照，否则百分比回退 auto 撑高内容——实测回归 1620px 后补上）
- **修复 3（styles.css）**：`#addPreview { min-height: 1.8em }` 预留预览行——dialog 高度恒定，预览出现时不再 flex 居中跳动（±0px）
- **修复 4（styles.css）**：汇总页 3 处 `clamp(4vh/4.5vh)` 间距固定化（28px/32px/32px）——vh 在键盘压缩时变化导致跳动，固定值在常见屏高安全
- **真机验证（魅族 461QYFDN226NF，键盘前后分离采样）**：
  - 面板风格：键盘前 sheet `y=170/h=681/bottom=851` → 键盘弹出后（innerHeight 528、html/body 冻结 851px）sheet **完全一致 y=170/bottom=851** ✓（修复前顶到 top:200）；输入 5 字 dialog `y=310/h=232` 与输入前一致（预留高度零跳动）；单行预览「5/6 · 将添加：abcde」无重叠；键盘收起解冻恢复 851 ✓
  - 汇总页风格（真实点按路径）：键盘弹出冻结 851 ✓、dialog y=310 与面板风格一致 ✓、单行预览 ✓、summary-title margin-top=28px（vh 固定生效）✓
  - 对话框两套风格共享 #addBackdrop，一处修复两处生效；z-index 70 与 timerScreen 无冲突（#63）
- 截图存档 `debug/v65_keyboard_frozen.png`（面板）/`debug/v65_summary_frozen.png`（汇总）；资源版本 styles.css?v=31 / app.js?v=31；版本号不变（v3.4 内补丁）
- 新增调试工具：`debug/cdp-eval.cjs`（WebView CDP 求值）、`debug/parse-ui.cjs`（UI 树解析）、`debug/v65-*.js`（几何采样脚本）

### ✅ 第三轮修复（2026-08-08，用户反馈「键盘和窗口重合了」）
**问题**：第二轮冻结让对话框居中于冻结画布（851px）→ dialog bottom 541 > 可见区 528 → 底部 13px 被键盘盖住（实测数据：dialog y=310/bottom=541 vs 可见区 0-528）
**修复 3 处**：
- app.js：冻结条件收窄为「对话框打开 + 键盘弹出」（addBackdrop/delBackdrop 可见性判断）——设置页/备注等输入保持原 adjustResize 行为；每帧更新 CSS 变量 `--kb-h = innerHeight`；`body.keyboard-up` 类供对话框层选择器使用
- styles.css：`body.keyboard-up .backdrop.dialog-layer { bottom:auto; height: var(--kb-h) }`——对话框层只覆盖可见区域，dialog 居中于键盘上方（y≈149，完整露出）；`.toast { position: fixed }`（真机媒体查询内）——toast 跟随可见区底部不被键盘遮
- **真机验证（魅族，两套风格真实点按）**：
  - 面板风格：键盘弹出（innerHeight 528、冻结 851）dialog `y=149/h=231/bottom=379 < 528` **完整露出不重合**；输入 5 字 dialog `y=148/h=232` 不变、单行预览「5/6 · 将添加：abcde」、sheet 稳定 y=170
  - 汇总页风格：同样全过（dialog bottom 379 < 528）
  - 设置页 API 密钥输入（无对话框场景）：无冻结（html inline 空）、WebView 自动滚动内层 .screen（scrollTop 555）→ 输入框 y=241-287 键盘上方可见，无回归
  - 键盘收起解冻恢复 851；kbBase 自愈保持
- 截图存档 `debug/v65_kb_visible_panel.png` / `debug/v65_kb_visible_summary.png`；资源版本 styles.css?v=32 / app.js?v=32；版本号不变（v3.4 内补丁）

### 验收要点
- 键盘弹出 + 输入时：预览/字数不重叠、对话框不跳动
- 面板与汇总两处添加行为一致；无回归

---

## 64. 记录模块两套风格并存——场景分区 + 组件一致性 ✅ 已实施（v3.4 补丁，方案 A）

### 需求（用户 2026-08-08）
更新「就现在」计时后，记录模块出现两套风格：新（全屏计时/汇总——蓝渐变白色体系 v5）vs 旧（记录面板/补记/编辑——浅色 Apple 面板），寻求解决方法。

### 方案对比（三选）
**方案 A（推荐）：场景分区 + 组件一致**
- 承认差异为「模式差异」：计时 = 沉浸仪式（蓝渐变），日常记录/补记/编辑 = 轻量面板（浅色）——运动 App 同款（训练深色沉浸/设置浅色轻量）
- 补强一致性：①chips/按钮两种背景下的色彩逻辑统一（选中蓝系、三级层级逻辑相同）；②面板→全屏计时衔接动画（降低瞬切跳变）；③面板逐步向 v2 设计语言对齐（三级层次/间距体系/悬浮），保留浅色背景
**方案 B**：全记录流程统一全屏沉浸（补记/编辑全屏化）——统一但改动大、轻量操作过重
**方案 C**：统一回浅色（计时也浅色）——用户此前已否决（v2/v4/v6/v7）

### 待确认问题（✅ 已确认方案 A）
- 方案 A / B / C → **A**（场景分区：计时沉浸蓝渐变 / 日常浅色面板，模式差异非风格混乱）
- 三项补强 → ①衔接动画（本轮实施：timerScreen 入场 fadeIn+微 scale 0.3s easeOutCubic + reduced-motion 降级）②组件一致性（检查确认：chips/按钮双背景色彩逻辑已一致——选中蓝系、主/次/弱三级）③面板对齐 v2（**渐进工程**：DESIGN-LANGUAGE v2 为锚点，后续随各屏改造逐步对齐）

### 验收要点
- 计时路径沉浸感保留；日常记录路径轻量不变
- 面板→全屏入场有统一过渡（0.3s 淡入+微缩放），不再瞬切
- 补记/编辑/快速记录无回归

---

## 63. 汇总页支持「继续计时」（误触结束可反悔） ✅ 已实施（v3.4 补丁）

### 需求（用户 2026-08-08）
全屏汇总页效果挺好，但考虑用户误点击「结束记录」后想继续的情况——目前汇总页只有「存为记录」/「放弃」，误结束后想继续只能重开，**已计时长丢失**。

### 方案（草案）
1. 汇总页加**「继续计时」**入口（主按钮「存为记录」下方小字按钮，或「← 继续计时」链接）——温和文案「还想继续？」
2. **恢复逻辑**（关键）：finishTimedRecord 清理状态前把 startTime 暂存到 summaryStartTime；「继续计时」用原 startTime 恢复：
   - timerState.startTime = summaryStartTime / running = true / intervalId 重启
   - localStorage 重新写入（杀进程恢复链不断）
   - notifyStartTimer(summaryStartTime) → 通知恢复（chronometer 从原 startTime 起，**时长连续**）
   - 视图切回计时视图（timerRunView 显示、timerSummaryView 隐藏）
3. 时长连续性：继续计时期间 AOD/通知/全屏全部回到计时态，最终结束时长 = 完整时长

### 实施清单（✅ 已完成，含 v23 设计定稿）
1. ✅ index.html：汇总视图重写 v23（浅色背景 summary-view、数字/情绪/诱因/存为记录/继续计时/放弃；删看片开关）
2. ✅ styles.css：v23 样式（三级层次 #007AFF>#3A3A3C>#8E8E93、间距 40/24/40、chips 无边框+阴影、蓝底白字主按钮+蓝光晕、数字蓝光晕投影）
3. ✅ app.js：finishTimedRecord 暂存 summaryStartTime；resumeTimer()（原 startTime 恢复 running/localStorage/通知/计时视图，时长连续）；saveTimedSummary media = triggers.includes('看了片')（删开关后推导）；清理 summaryMediaSwitch
4. ✅ 验证：浏览器（继续计时恢复 00:02 连续/再结束时长累计/media 推导 true/开关已删）+ 真机魅族（汇总页 v23 完整显示、点继续计时后通知恢复 ONGOING_EVENT+FOREGROUND_SERVICE）
5. ✅ 设计语言沉淀：DESIGN-LANGUAGE.md（v2）+ 知识库「观己设计语言v2」

### 验收要点
- 汇总页可「继续计时」→ 回计时视图，秒数/通知连续（不丢已计时长）；最终结束时长 = 完整时长
- 保存时 media 由「看了片」诱因推导；放弃清理；面板流程无回归

---

## 62. 体验优化：通知「结束并记录」→ 全屏汇总页（同容器无缝切换） ✅ 已实施（v3.4 补丁）

### 需求（用户 2026-08-08）
从通知操作结束计时，流程一定要「计时页 → 详情页」吗？寻求彻底解决（#61 已解决全屏闪现，但结束后强制停详情页、需再点保存仍显冗长）。**用户澄清：通知结束仍进详情页（补情绪），在此前提下彻底优化割裂感。**

### 方案（✅ 已确认 D1：全屏汇总页，运动 App 标准）
- 计时视图与汇总视图**同一全屏容器（timerScreen）内切换**——结束计时瞬间视图切换，零页面跳转
- 汇总视图：本次计时（时长大字 40px）+ 情绪/诱因 chips（可多选，复用渲染逻辑）+ 看片开关 + 「存为记录」/「放弃本次计时」
- 从通知结束（__guanjiTimerFinish）同样直接进汇总；冷启动意图在途 → 直接汇总（#61 延迟逻辑天然兼容）
- 保存 → 记录落库（时长自动、情绪可补选）+ toast + 回首页；放弃 → 不保存关闭

### 实施清单
1. ✅ index.html：timerScreen 拆计时视图（timerRunView）+ 汇总视图（timerSummaryView：summaryDuration/summaryMoodChips/summaryTriggerChips/summaryMediaSwitch/summarySaveBtn/summaryAbandonBtn）
2. ✅ styles.css：汇总视图样式（summary-card 半透明白卡片区 + 40px 时长大字）
3. ✅ app.js：renderMoodChips/renderTriggerChips 参数化（容器可传）；openDeleteDialog group 判断兼容双容器（id includes Mood/Trigger）；finishTimedRecord → showTimerSummary；新增 showTimerSummary/saveTimedSummary/abandonSummary + summaryDuration；summaryMediaSwitch 绑定；showTimerScreen 先 hideTimerSummary
4. ✅ 验证：浏览器全流程（计时→汇总同容器/保存落库/放弃无记录/通知结束→汇总/冷启动意图→直接汇总）；构建安装 Android 16

### 验收要点
- 结束计时：全屏内直接从计时视图切到汇总视图（无页面跳变、无底部面板）
- 汇总可选情绪/诱因/看片后保存 → 记录落库 + 回首页；放弃不保存
- 通知「结束并记录」→ 直接汇总；冷启动意图在途无计时视图闪现
- 面板新增/补记/编辑流程无回归（chips 参数化默认值）

---

## 61. 体验优化：通知按钮回 App「先计时页再详情页」割裂 ✅ 已实施（v3.4 补丁）

### 需求（用户 2026-08-08）
从展开态卡片点击「结束并记录」/「取消」回到 App，步骤都是**先到计时页（全屏）再到登记页（详情）**——整体割裂。

### 根因（已定位，代码时序）
- 通知按钮 → MainActivity `runWhenReady` 轮询 JS 就绪（500ms 首轮 + 300ms 重试）
- 但 **JS 加载时 restoreTimer（IIFE）立即恢复**：`openSheet('now')` + `showTimerScreen()`（全屏计时页显示）
- 轮询命中后 `__guanjiTimerFinish` 才执行 → finishTimedRecord（hideTimerScreen + goToDetails）
- **时序竞争**：全屏页必然先显示（冷启动恢复场景），用户先看到计时页再跳详情；热启动场景回前台先见全屏页再跳转（轮询第一轮命中，闪现较短）
- cancel 路径同样受影响（cancelFromTimerScreen 依赖 hideTimerScreen + closeSheet）

### 方案（草案）
1. **restoreTimer 延迟 showTimerScreen**：`setTimeout(() => { if (timerState.running) showTimerScreen(); }, 400)`——期间 finish/cancel 意图到达（计时结束）→ 全屏从未显示 → 直接进详情/关闭，无闪现；纯恢复场景 400ms 后正常显示全屏
2. 热启动：runWhenReady 首轮命中已最快（保持）
3. 验证：冷启动点「结束并记录」→ 直接详情（无全屏闪现）；点「取消」→ 直接关闭；无意图恢复 → 400ms 后全屏正常

### 实施清单
1. `app.js` restoreTimer：showTimerScreen 延迟 + running 守卫
2. 浏览器模拟（localStorage key + reload + 立即调 __guanjiTimerFinish → 不应见全屏）
3. 真机：冷启动点通知按钮（finish/cancel 各一次）截图/观察无全屏闪现；纯恢复正常

### 待确认问题
- 延迟 400ms 是否合适（正常恢复时面板→全屏有 400ms 过渡，可接受？）vs 其他值

### 验收要点
- 冷启动点「结束并记录」：直接到详情页（时长预填），无全屏计时页闪现
- 点「取消」：直接关闭面板，无全屏闪现
- 纯杀进程恢复（无按钮意图）：全屏计时页正常显示

---

## 60. AOD 息屏计时不动态刷新（OEM 冻结 Handler）+ 显示滞后 🆕 实测结论已定（2026-08-08）

### 需求（用户 2026-08-08 测试反馈）
AOD 息屏卡片内容的计时**不会动态刷新**；解除息屏再息屏才会更新；且 App 内显示 7 分钟时 AOD 显示 4 分钟。

### 根因（已定位 + 真机实测）
- **#59 的动态 contentText 依赖 App 进程**——OEM（OPPO ColorOS）息屏冻结进程消息队列 → Handler 停摆 → contentText 停更
- 「7 vs 4」= contentText 停更值 vs App 实时值（非时间戳错误）

### 实测结论（2026-08-08，OPPO PLZ110 Android 16）
| 方案 | 结果 |
|---|---|
| Handler 60s 更新（进程内） | ❌ 息屏冻结（进程消息队列停摆） |
| **前台服务** TimerService 保活 | ⚠️ 进程/服务不被杀，但 **Handler 消息队列仍被冻结** |
| **AlarmManager** setExactAndAllowWhileIdle 60s | ❌ 被 ColorOS 拦截（高频精确闹钟保护） |
| 亮屏 | ✅ 立即纠正（积压 Runnable 恢复执行，分钟数正确） |

**结论**：OPPO ColorOS 息屏持续刷新被系统硬限制，App 侧无法绕过（不 root）；生态标准解法 = **引导用户设置「允许后台运行」**（设置 → 应用 → 观己 → 耗电管理 → 允许后台运行），设置后息屏持续刷新。当前行为：亮屏即纠正（可用）。

### 方案（定稿）
1. 保留 **Handler + AlarmManager 双保险**（前台场景/部分设备可用；OPPO 亮屏纠正兜底）
2. 新增**设置页引导**：「实况通知」卡加提示——息屏实时刷新需在系统设置允许观己后台运行（附操作路径）
3. 前台服务保留（进程保活收益：服务不被杀、亮屏立即恢复、通知常驻）

### 实施清单
1. ✅ TimerService（前台服务 + Handler 60s + AlarmManager 兜底 + 停止清理）——已实施
2. ✅ TimerAlarmReceiver + Manifest（service/receiver/权限）——已实施
3. ⏳ 设置页引导文案（#61 或并入本条目，待用户确认）

### 验收要点
- 前台/亮屏：分钟数实时刷新；息屏：OPPO 上受系统限制（引导设置后解决），其他厂商视冻结策略而定
- 亮屏即纠正（分钟数正确）；停止/取消计时服务停止、通知消失
- 魅族/快捷操作/杀进程恢复无回归

---

## 58. Android 16 状态条状标签（chip）优化：大横条 + 信息少 ✅ 已实施（v3.4 补丁）

### 需求（用户 2026-08-08 反馈）
Android 16 实况通知的**未展开状态（状态条状标签 chip）**有点丑——一个大横条，但显示的有用信息很少。

### 根因（已定位，对照官方规范）
- 状态条状标签规范：**最大宽度 96dp**；图标必有、文本可选；**文本 <7 字符显示全部，显示不足一半时只显示图标**
- 我们的通知标题「观己 · 计时中」= 6 字符（<7）→ 系统把整个标题塞进 chip → **96dp 大横条**
- chip 空间有限，秒数/进度放不进去 → 「有用信息少」

### 方案（草案）
1. **用 `setShortCriticalText("计时中")`**（官方推荐的状态传达 API）→ chip 显示 3 字符 → 横条缩短约一半
   - 备选 A1：chip 文本留空（只图标）——最窄但无状态文字
   - 备选 A2：尝试动态秒数（如「00:12」4 字符）——需定期 notify 更新，与系统 chronometer 重复，不推荐
2. 标题保持「观己 · 计时中」（展开态/锁屏胶囊使用）
3. 真机验证 chip 实际显示（用户新手机 Android 16：PLZ110）

### 实施清单
1. `TimerLiveUpdatePlugin.baseBuilder`：setShortCriticalText("计时中")（startTimer 与 testLiveUpdate 共用）
2. 构建 → 装 Android 16 新手机 → 截图对比 chip 宽度
3. 魅族路径不受影响（魅族胶囊不读 setShortCriticalText）

### 待确认问题
- chip 文本：「计时中」（推荐，3 字符）vs 只图标（最窄）vs 其他文案

### 验收要点
- 状态栏 chip 明显变窄（不再是 96dp 大横条），显示「计时中」或图标
- 展开态/锁屏胶囊不受影响；魅族路径无回归

---

## 55. 【Bug】计时模式下「补记」入口消失（seg 隐藏副作用） ✅ 已修复（v3.3）

### 现象（用户 2026-08-07 反馈）
更新后点击「记录」，面板只剩「开始记录」和「不想计时？直接填写」，原来的「补记」功能不见了。

### 根因（已定位）
- #51 实施时按「计时态隐藏『就现在/补记』seg」决策（为简化计时器态 UI）——但副作用：默认「计时记录」模式下，记录面板步骤一不再有 seg 切换，**补记入口从主面板消失**（只剩日历「补记这一天」）
- quick 模式不受影响（该模式 seg 仍显示）——用户默认 timer 模式，所以看不到

### 修复方案（草案）
- **未计时时恢复显示 seg**（与 v2.x 行为一致）：
  - 「就现在」选中 = 计时器态（timerBox + 开始记录 + 「不想计时？直接填写」）
  - 切「补记」= 经典补记流程（seg + pickerRow 日期时间 + 下一步）
  - 切回「就现在」= 恢复计时器态
- **计时开始后隐藏 seg**（计时中不可切换模式，只能结束/取消）——现有 setupNowStep running 分支已隐藏，保留
- 与 quick 模式的 seg 逻辑统一（quick 模式 seg 行为不变）

### 实施清单
1. `app.js` setupNowStep：timer 模式未计时时不再隐藏 timeSegRow（显示 seg，nowSeg 选中）
2. seg 切换逻辑：customSeg 点击 → timerBox 隐藏 + pickerRow 显示 + nextBtn「下一步」+ modeLink 隐藏；nowSeg 点击 → 恢复计时器态（timerBox + 开始记录 + modeLink）
3. 计时运行中 setupNowStep running 分支保持隐藏 seg（不变）
4. 验证：timer 模式打开面板可见 seg；切补记可正常选日期时间；切回就现在计时器态；计时开始后 seg 隐藏；quick 模式无回归

### 验收要点
- 默认计时模式打开记录面板：seg（就现在/补记）可见，补记流程完整可用
- 计时开始后 seg 隐藏；计时中无法切换模式
- quick 模式行为不变；编辑/日历补记入口不受影响

---

## 54. 「就现在」计时升级为全屏沉浸式计时页（运动 App 风格） ✅ 已实施（v3.3）

### 需求（用户原话，2026-08-07 已补充细化）
点击开始记录后还是在小卡片（记录面板）里面，希望像运动 App 一样：点「开始记录」后变成**一整页都是时间**的沉浸式计时页。

### 补充后的完整需求（代理补充细化）
**现状**：v3.1 点「开始记录」后，计时数字显示在记录面板（底部小卡片）内，切后台靠实况通知。

**目标形态**（运动 App 进行中页，如 Keep/悦跑圈）：
```
┌─────────────────────────┐
│      ● 进行中            │ ← 状态徽标（脉冲圆点动画）
│                          │
│      00:12:34            │ ← 超大等宽时间（约 96-120px tabular-nums）
│                          │
│    开始于 21:47           │ ← 小字（ink-2/白 次级）
│                          │
│                          │
│      [ 结束记录 ]         │ ← 底部大圆按钮（主题色/红色系）
└─────────────────────────┘
```

**交互流**：
1. 面板步骤一点「开始记录」→ 面板收起 + **全屏计时页淡入**（0.3s easeOutCubic，沿用退场语言）
2. 全屏页大时间走秒（纯时间戳差值）；切后台通知栏 chronometer 照常，切回 visibilitychange 校正
3. 点「结束记录」→ 全屏页退出 → **回面板详情页**（时长已预填）→ 选情绪/诱因 → 保存（现有流程不变）
4. 全屏页下滑/点退出 = 取消计时不保存 + 温和提示（与「计时中关闭面板」行为一致）
5. 杀进程恢复：重启**直接进全屏计时页**（timerState 持久化机制不变）

**技术方案（草案）**：
- 新增全屏覆盖层 `#timerScreen`（fixed 全屏，z-index 高于 sheet 30 与 dialog 40，约 60）
- 背景：主题蓝渐变（`--accent` 系渐变，深浅色变量化）+ 状态徽标脉冲动画（呼吸圆点）
- 大时间复用 `renderTimerTick()`（fmtElapsed），样式 96-120px tabular-nums
- `startTimedRecord` 改为：启动 timerState（不变）→ `showTimerScreen()`（隐藏面板层）
- `finishTimedRecord`：`hideTimerScreen()` → 显示面板 stepDetails（时长预填，现有逻辑）
- `cancelTimer`：全屏页退出按钮/下滑 → 取消 + 回首页（toast）
- 返回键处理：全屏页下 Android 返回 = 取消计时 + 温和提示（或退出 App 由杀进程恢复兜底，待确认）
- 通知/权限/持久化/deleteIntent 全部复用（#51/#52 不动）
- 面板步骤一未计时时保留现有计时器态 UI（开始按钮 + 提示），开始后才切全屏

### 待确认问题（✅ 2026-08-07 全部确认按推荐）
- ~~是否需要「暂停 / 继续」~~ ✅ 已确认：**首版不加**，保持开始→结束两态（避免暂停期通知栏语义复杂度）
- ~~全屏页退出方式~~ ✅ 已确认：下滑/退出按钮 = **直接取消**（不弹确认，与「计时中关闭面板」行为一致）
- ~~背景风格~~ ✅ 已确认：**主题蓝渐变**（运动感，深浅色变量化）
- ~~返回键处理~~ ✅ 已确认：**拦截为「取消计时 + 温和提示」**（与全屏退出按钮行为一致，避免按返回直接退出 App 且无提示）

### 实施清单
1. `index.html`：新增 `#timerScreen` 覆盖层（徽标/大时间/开始时间小字/结束按钮/退出按钮）
2. `styles.css`：全屏层样式（渐变背景变量化、96-120px tabular-nums、脉冲动画、深浅色）
3. `app.js`：showTimerScreen/hideTimerScreen；startTimedRecord/finishTimedRecord/cancelTimer 衔接全屏层；恢复机制改直接进全屏页；返回键处理（如确认）
4. 验证：开始→全屏→走秒→结束回详情预填→保存；全屏取消无记录；杀进程恢复直进全屏；通知联动不变；深色模式

### 验收要点
- 点「开始记录」面板收起、全屏计时页淡入（不再是小卡片内计时）
- 全屏页大时间后台走秒（通知栏同步）、切回校正
- 结束记录 → 回面板详情时长正确预填 → 保存正常
- 全屏页退出取消不产生记录 + 温和提示；杀进程恢复直进全屏
- 深色模式正常；补记/quick 模式不受影响

---

## 51. 「就现在」改造成运动记录式计时（时长精准化） ✅ 已实施（v3.1）

### 需求（用户原话）
现在记录有两个模式「就现在」和「补记」。「就现在」现状：打开后读取当前时间 → 点下一步 → 选时长/情绪/诱因。想法：把「就现在」改成像运动软件一样的运动记录——点下一步后**开始计时**，结束后结束计时，然后跳转到记录页选情绪和诱因，时长记录更精准。

### 定位判断（已与用户确认倾向）
- 契合「温和觉察」产品定位：开始/结束计时 = 正念仪式；与 widget 一键快速记录形成分工（快速记=无时长，就现在=计时精准）
- 技术可行：保存时长从 durLabel 解析（#38），任意分钟数（含 >60）可保存；滑块位置按比例换算

### 方案（草案）
1. 「就现在」步骤一：时间 seg 区域变为**计时器态**——大数字计时显示（时:分:秒递增）+ 文案「开始记录时计时」；「下一步」按钮改「开始记录」
2. 点击「开始记录」→ 记录 startTime（Date.now）→ 计时器递增显示（每秒更新）
3. 步骤一按钮变「结束记录」→ 点击 → 计算 duration = 实际分钟（向下取整，不足 1 分钟按 1）→ **自动进入 stepDetails**，durLabel 预填实际分钟、durSlider 按比例定位
4. 情绪/诱因/看片/备注流程不变；保存走原逻辑
5. **兜底**：计时中关闭面板（拖拽/点空白/切 tab）→ **取消计时不保存** + toast 温和提示「已取消本次计时」；补记模式不变

### 待确认问题（✅ 2026-08-07 全部确认方案 A）
- ~~计时中关闭面板：取消不保存 vs 提示确认~~ ✅ 已确认：**取消不保存** + toast 温和提示「已取消本次计时」
- ~~计时精度：按分钟取整 vs 精确到秒~~ ✅ 已确认：**按分钟取整**（不足 1 分钟按 1 分钟，数据模型不变）
- ~~步骤一在计时模式下是否仍显示「现在/补记」seg~~ ✅ 已确认：**隐藏 seg**（计时只属于「就现在」，补记不需要计时）

### 扩展：计时通知（安卓实况通知，用户 2026-08-07 提出）
开始计时后切出应用，用安卓原生实况通知（Live Updates）显示计时状态（参考 https://developer.android.google.cn/develop/ui/views/notifications/live-update）。

**可行性（已确认）**：targetSdk 36 ≥ 35 满足实况通知要求；已有 WidgetStatsPlugin 自定义 Kotlin 插件先例；计时器是官方文档点名的适用场景（进行中/用户发起/时间敏感）。

**为什么必要**：WebView 切后台 JS 定时器被系统挂起，App 内计时会停摆；实况通知计时（setUsesChronometer）由系统驱动，后台依然精准跳动，切回时用 Date.now() - startTime 校准。

**方案（草案）**：
1. 新插件 LiveUpdatePlugin（路径照 WidgetStatsPlugin）：开始 → ongoing 通知 + setUsesChronometer（ProgressStyle）；结束/取消 → cancel
2. Android 15+（API 35）请求 EXTRA_REQUEST_PROMOTED_ONGOING 提升为实况通知
3. 降级链：Android 12-14 → 普通常驻通知（无锁屏胶囊）；Android 13+ 首次计时请求 POST_NOTIFICATIONS 运行时权限；拒绝 → 纯 App 内计时照常（通知只是增强，不阻塞主功能）
4. 用户从通知划掉 → setDeleteIntent 检测 → App 内温和提示「计时已从通知移除，仍在计时中」
5. 魅族 Flyme OEM 可附加条件，真机需验证提升效果

### 细化设计 v4.0（2026-08-07 深化：代码核对 + 资料佐证）

#### 0. 资料佐证与可行性结论（✅ 全部通过）
| 关键点 | 佐证结论 | 项目状态 |
|---|---|---|
| 实况通知起始版本 | **Android 16（API 36）** 特性，需 compileSdk 36 + target Android 16（官方 Live Updates 文档 + Android 16 QPR1 报道） | compileSdk 36 / targetSdk 36 ✅ |
| 请求提升 API | `NotificationCompat.Builder#setRequestPromotedOngoing(true)`，**androidx.core 1.17.0-alpha01（2025-06-18）加入**（官方 release notes 原文 "NotificationCompat.Builder.setRequestPromotedOngoing() aggiunti"） | androidxCoreVersion = 1.17.0 ✅ |
| 提升硬性条件 | 样式须为 标准/BigText/Call/Progress/Metric 之一；manifest 声明 `POST_PROMOTED_NOTIFICATIONS`（非运行时权限）；ongoing；contentTitle；禁 RemoteViews/group summary/colorized；渠道非 IMPORTANCE_MIN（官方文档） | 设计全部满足 ✅ |
| 状态检查 API | `FLAG_PROMOTED_ONGOING` / `hasPromotableCharacteristics()` / `canPostPromotedNotifications()` / `Settings.ACTION_MANAGE_APP_PROMOTED_NOTIFICATIONS` | 用于权限引导 ✅ |
| 后台 JS 定时器 | hidden 页面 rAF 完全停止、定时器预算制限流（MDN Page Visibility：Chrome 后台 10s 后限流）→ 显示层后台不可靠 | 时间戳差值渲染方案 ✅ |
| 系统级计时 | `setUsesChronometer(true)` + `setWhen(startTime)`：通知时间由系统时钟驱动，后台不依赖 JS | 通知显示精准 ✅ |
| 时长数据模型 | duration 保存从 durLabel 正则解析（app.js:754），任意分钟数（含 >60）可存 | 无需改模型 ✅ |

#### 1. 代码对接点（已核对 app.js 现状）
- `openSheet('now')`（app.js:667）：stepTime 含 timeSegRow（就现在/补记 seg）+ timeDisplay + pickerRow；nextBtn（app.js:1558 点击→隐藏 stepTime 显示 stepDetails + transitionSheetHeight）
- `saveRecord()`（app.js:750）：`/^(\d+)/` 从 durLabel 解析 duration（`duration || null`）——计时结束预填 label 即保存正确
- `closeSheet()`（app.js:711）→ animateSheetClose：计时兜底挂在此处
- 插件调用模式：`window.Capacitor.Plugins.WidgetStats.syncStats({stats})`（app.js:1982，try/catch 非原生静默）——LiveUpdate 插件照此
- 原生注册：MainActivity.load() 中 registerPlugin（super.load() 之前，MainActivity.java:24）

#### 2. Web 层设计
- **计时器 UI**：stepTime 新增 `#timerBox`（初始 hidden）：大数字 `#timerDisplay`（48px tabular-nums，时:分:秒）+ 状态小字「切到后台也没关系，通知栏会继续计时」；「就现在」模式打开时隐藏 timeSegRow + pickerRow、显示 timerBox；timeDisplay 保留为小字当前时间
- **状态机** `timerState = { startTime: number|null, running: boolean, intervalId }`：
  - `startTimedRecord()`：startTime = Date.now()；1s interval 渲染；原生 startTimer；持久化 `guanji_timer_v1 = {startTime}`（localStorage）；nextBtn 文案「开始记录」→「结束记录」
  - `renderTimerTick()`：elapsed = Date.now() - startTime（**纯差值，无累积误差**）
  - `finishTimedRecord()`：停 interval；`duration = Math.max(1, Math.floor(elapsed/60000))`（✅ 分钟取整，不足 1 分钟按 1）；预填 durLabel=`${duration} 分钟`、durSlider=Math.min(duration,60)；自动进 stepDetails（复用 nextBtn 逻辑）；原生 stopTimer；清 guanji_timer_v1
  - `cancelTimer()`：停 interval；原生 stopTimer；清存储；reset UI
  - `visibilitychange`：切回前台立即 renderTimerTick()（校正后台挂起期间的显示；数值由时间戳保证）
- **兜底（✅ 已确认）**：closeSheet 时 running → cancelTimer + toast「已取消本次计时」；补记/编辑模式零影响
- **崩溃/杀进程恢复（v4.0 新增设计）**：开始计时即持久化 startTime；App 启动检测 guanji_timer_v1 存在 → 恢复计时并自动打开面板计时态（因为 ongoing 通知不随进程消亡，通知栏 chronometer 仍在走，必须给收尾路径）——用户在面板点「结束记录」正常收尾，或关闭面板取消
- **权限流程**：首次点「开始记录」→ 原生检查/请求 POST_NOTIFICATIONS（Android 13+）→ 拒绝则降级纯计时 + toast 温和说明「计时仍会继续，只是没有通知提醒」

#### 3. 原生层设计（TimerLiveUpdatePlugin.kt，照 WidgetStatsPlugin 模式）
- `@CapacitorPlugin(name = "TimerLiveUpdate")`，方法：
  - `startTimer({startTimeMs})`：渠道「计时进行中」（IMPORTANCE_LOW，非 MIN ✅）；`NotificationCompat.Builder`：setOngoing(true) / setContentTitle("观己 · 计时中") / setSmallIcon(新 drawable 时钟图标) / setWhen(startTimeMs) / setUsesChronometer(true)（系统级计时，后台精准）/ setProgress(0,0,true)（ProgressStyle 之一）/ setContentIntent(打开 App，requestCode=3) / setDeleteIntent(广播：通知被划掉 → SharedPreferences 写标记，App 前台时读取温和提示，**不强行拉起 App**)；`Build.VERSION.SDK_INT >= 36` 时 setRequestPromotedOngoing(true)（androidx 1.17.0 提供，低版本 no-op 安全）→ notify
  - `stopTimer()`：cancel 通知
  - `checkPermission()` / `requestPermission()`：POST_NOTIFICATIONS（Android 13+）
  - `canPostPromoted()`：canPostPromotedNotifications()（API 36，返回用户是否允许提升）
- `MainActivity.java`：load() 中 registerPlugin(TimerLiveUpdatePlugin.class)
- `AndroidManifest.xml`：`POST_NOTIFICATIONS`（运行时，13+）+ `POST_PROMOTED_NOTIFICATIONS`（API 36，低版本系统自动忽略，安全）
- 通知小图标：新增 drawable（时钟/沙漏白色轮廓，Android 通知小图标需纯 alpha 单色）

#### 4. 降级链（✅ 已确认默认方案）
| 设备 | 行为 |
|---|---|
| Android 16+（API 36） | 实况通知：锁屏胶囊 + AOD + 抽屉置顶，默认展开不可折叠 |
| Android 12-15 | 普通常驻 ongoing 通知（chronometer 照常工作，行为一致仅位置不同） |
| 通知权限被拒 | 纯 App 内计时（计时/结束/取消全流程照常，无通知） |
| 用户划掉通知 | 计时不中断，App 内温和提示一次 |

#### 5. 边界情况清单
- 计时中杀 App → 通知残留 + 重启恢复计时（启动检测）
- 计时中划掉通知 → 计时继续，App 提示一次
- 计时中切后台 30 分钟 → JS 显示停但数值准（时间戳），回前台立即校正
- 计时中打开补记/编辑面板 → 冲突处理：计时面板保持打开（记录面板互斥设计，计时态下不响应其他入口）或直接禁止——设计为：计时运行中再次点「+ 记录」打开的是计时面板本身（幂等）
- 时长 > 60 分钟 → durLabel 直显（数据源方案已支持），滑块顶格
- widget 快速记录/补记/编辑 → 不受影响（计时仅属「就现在」面板态）

#### 5b. 扩展：经典模式保留 + 实况通知测试（用户 2026-08-07 提出）
**背景**：用户提出①有人喜欢原来的「就现在」模式（直接下一步→手动时长），是否加按钮给用户选择；②像测试 AI 连接一样，加一个实况通知测试，验证手机是否支持此功能。

**判断（已确认合理）**：
- 现有「补记」+ widget 快记不能完全替代「就现在」经典流程（记当前时刻 + 手动时长），需保留路径；但避免每次二选一的负担——计时主推 + 一条直达经典
- 通知测试比 AI 测试价值更大：验证 OEM（魅族 Flyme 是官方文档「OEM 可附加条件」设备）是否真显示提升效果，直接成为真机验证工具

**方案（✅ 2026-08-07 细化定稿）**：

1. **经典模式保留**：
   - 计时器态步骤一主按钮「开始记录」下方加小字入口「不想计时？直接填写」→ 直接进 stepDetails（经典流程：时长滑块照旧），**不改变偏好**
   - 设置页「记录」卡新增「记录方式」分段：**计时记录（默认）/ 快速记录**，存储 `guanji_record_mode`（localStorage），默认 'timer'
   - openSheet('now') 读取偏好：'timer' → 计时器态；'quick' → 经典流程（步骤一 = 时间显示 + nextBtn「下一步」→ stepDetails）
   - 可选对称入口（quick 模式步骤一加小字「想要精准计时？开始计时」→ 切计时器态）——实现成本低，视觉对称，默认纳入
   - 计时运行中不显示「直接填写」入口（计时中只能结束/取消）
2. **实况通知测试**（设置页「关于」卡内，独立小卡「实况通知」）：
   - 卡内结构：标题 + 描述小字（「测试你的手机是否支持实况通知（Android 16+）」）+「测试」按钮 + **内联状态区**（3 行小字：`系统：Android 16` / `通知权限：已开启` / `实况通知：支持 · 已提升`）——内联比 toast 持久，适合测试工具定位
   - 交互流：点「测试」→ `getLiveUpdateStatus()` → 渲染内联状态 + 分级处理：
     - Android 16+ 且权限开且可提升 → 状态行「支持 · 已提升」+ toast「已发送测试通知，请查看锁屏/通知栏」+ `testLiveUpdate(15)`
     - Android 12-15 → 状态行「不支持提升（系统低于 Android 16）」+ toast「将以普通常驻通知显示」+ 仍发测试通知
     - 通知权限未授权（13+）→ 先请求权限；拒绝 → 状态行「权限未开启」+ 引导提示「计时仍可用，只是没有通知」
   - 测试通知：标题「观己 · 实况通知测试」+ chronometer（from now）+ ProgressStyle，15s 后自动取消（JS setTimeout → stopTimer）
   - 该按钮同时服务开发者验证（真机验证环节直接用）
3. **偏好与计时互斥**：quick 模式不进入计时态，天然无冲突；timer 模式计时运行中「+ 记录」入口幂等打开计时面板本身

#### 6. 验证计划
- 浏览器：计时全流程（开始→tick→结束→时长预填→保存→记录正确）；中途关闭取消；CDP 模拟 visibilitychange hidden→visible 校正
- 真机 Android 16：实况通知提升（锁屏胶囊/抽屉置顶）、后台 chronometer 跳动、杀进程恢复、划掉通知提示、权限拒绝降级
- 真机 Android ≤15（魅族）：普通常驻通知 + 无提升降级路径
- 回归：补记/编辑/widget 快速记录/分析页全流程

#### 7. 版本与发布
- versionCode 22 / versionName 4.0（用户明确此为 4.0 核心更新）；资源 ?v=24→25
- CHANGELOG v4.0 条目 + GitHub Release v4.0 + APK

### 实施清单
1. `app.js`：timerState（startTime/intervalId/timerEl 更新）；startTimedRecord/finishTimedRecord/cancelTimer/renderTimerTick；visibilitychange 校正
2. `app.js`：openSheet 'now' 模式步骤一显示计时器（隐藏 seg+pickerRow）；nextBtn 文案「开始记录/结束记录」动态切换；结束后自动进 stepDetails 预填时长（durLabel + durSlider 比例定位）；「不想计时？直接填写」小字入口
3. `app.js`/`index.html`/`styles.css`：计时器 UI（大数字 tabular-nums、状态小字）；深色模式适配；设置页「记录方式」偏好（计时/快速）+「测试实况通知」按钮区
4. 兜底：closeSheet 时若计时中 → cancelTimer + toast「已取消本次计时」
5. 持久化恢复：guanji_timer_v1 启动检测 → 恢复计时态并打开面板；结束/取消清除
6. `TimerLiveUpdatePlugin.kt`：startTimer（渠道/ongoing/chronometer/when/progress/提升请求 API36+）/stopTimer/checkPermission/requestPermission/canPostPromoted/getLiveUpdateStatus/testLiveUpdate；deleteIntent 广播标记
7. `MainActivity.java`：registerPlugin；通知 contentIntent 打开 App（requestCode=3）；启动时读划掉标记 → JS 提示
8. `AndroidManifest.xml`：POST_NOTIFICATIONS + POST_PROMOTED_NOTIFICATIONS；通知小图标 drawable
9. 权限流程：首次计时请求 POST_NOTIFICATIONS，拒绝降级纯计时
10. 版本：versionCode 22 / versionName 4.0；资源 ?v=25；CHANGELOG + Release
11. 验证：浏览器全流程 + 真机（Android 16 提升/后台跳动/杀进程恢复/划掉提示/权限拒绝；Android ≤15 降级）+ 回归（补记/编辑/widget 快记）+ 通知测试按钮各分级

### 待确认问题（✅ 2026-08-07 全部确认，5b 3 项按推荐定案）
- ~~「记录方式」默认值~~ ✅ 已确认：**计时**（v4.0 主推），设置页可改「快速」
- ~~「测试实况通知」按钮位置~~ ✅ 已确认：**设置页「关于」卡内**独立小卡
- ~~经典模式入口文案~~ ✅ 已确认：「不想计时？直接填写」（quick 模式对称入口「想要精准计时？开始计时」）

### 验收要点
- 「就现在」：开始记录 → 计时递增 → 结束 → 自动进入详情且时长=实际分钟
- 计时中拖拽/点空白退出：无记录生成 + 温和提示
- 超长计时（>60 分钟）时长正确保存；补记模式行为不变

---

## 53. 排版设计规范（标题字体/字号/间距统一文档化） ✅ 已应用（规范文档化 + styles.css 全面核对）

### 需求（用户 2026-08-07）
统计项目中不同等级标题的字体、大小和间距，整理成设计规范，应用到整个项目。

### 统计结果（styles.css 全量核对，2026-08-07）

#### 字号阶梯（px）
| 字号 | 用途（权重） |
|---|---|
| 9 | 日历角标 cal-badge（700） |
| 10 | 环图中心标签 ring-label（ink-2，0.08em） |
| 11 | 眉题 eyebrow（600/0.06em）、统计标签 stat-label（600/0.04em）、版本 about-ver、免责 disclaimer（行高1.8）、对话框提示 dialog-hint、报告小节眉题 report-tag（600/0.14em） |
| 12 | 卡片副题 card-sub（0.02em）、环图列表值 ring-val、最近记录副文 recent-sub、焦点副文 focus-sub、计时提示 timer-hint（行高1.6）、月度汇总 month-summary |
| 13 | 字段标签 field-label（600/0.02em）、页头副文 header-sub（行高1.6）、条形图标签 bar-label、追问问句 ask-q（700）、对话框正文 dialog-text（行高1.8）、日历明细 cal-detail（行高1.9）、最近记录时间 recent-time（600） |
| 14 | 正文/列表 pattern-row（行高1.7）、空态 empty-text（行高1.9）、开关行 switch-row、追问正文 ask-answer（行高1.85）、日历详情标题 cal-detail-title（700） |
| 14.5 | 报告正文 report-body（行高1.85） |
| 15 | 按钮文字（btn-primary/btn-ghost/record-btn，600） |
| 16 | 卡片标题 card-title（700/0.01em）、报告标题 report-title（700/0.01em）、对话框标题 dialog-title（800/0.01em）、日历标题 cal-title（700/0.01em）、关于名称 about-name（700/0.06em） |
| 17 | 弹层主标题 sheet-title（800，居中，mb 20px） |
| 22 | 时间大字 time-display（800，mt 16px） |
| 24 | 环图中心数字 ring-num（800，行高1） |
| 26 | 页面主标题 screen-title（700/-0.02em/行高1.15，line-clamp 2）、统计数字 stat-num（800/行高1.1） |
| 40 | 报告大数字 overview-num（800/-0.01em/行高1.05） |
| 44 | 首页焦点大数字 focus-num（800/-0.01em/行高1.0） |
| 52 | 计时器 timer-display（800/0.02em/行高1.1，tabular-nums） |

#### 权重体系
- **400/500**：正文、次要元素（chip-add 500）
- **600**：小标签、按钮、选中项、次级强调（stat-label/eyebrow/field-label/ask-q/recent-time）
- **700**：各类标题（screen/card/report/cal/dialog-title）
- **800**：大数字（focus/stat/ring/overview/time/timer）、弹层标题（sheet/dialog）

#### 字距规范
- **大数字/页面主标题：-0.01 ~ -0.02em**（收紧，视觉聚焦）
- **卡片/报告/日历标题：0.01em**
- **次级文字/正文：0.02em**
- **小标签：0.04 ~ 0.06em**（stat-label 0.04 / eyebrow 0.06 / about-name 0.06）
- **眉题/报告小节 tag：0.06 ~ 0.14em**（report-tag 0.14 最放开）

#### 行高规范
- 大数字：1.0 ~ 1.15
- 标题：1.15
- 次级说明（header-sub/timer-hint）：1.6
- 正文/列表/空态：1.7 ~ 1.9

#### 间距规范
- 页面标题区：padding 16px 0 20px
- 卡片头（标题+副题）：mb 16px；卡片内大标题 mb 14px（设置页）
- 字段标签：卡片内 mb 8px、块间距 16px；sheet 内 18px 0 10px（首个 4px）
- 弹层标题：sheet-title mb 20px / dialog-title mb 10px
- 报告卡：padding 22px、卡间 mb 16px、title mb 10px、小节 tag mb 12px
- 大数字下方元信息：mt 4px（focus-sub/stat-label/ring-label）

### 应用结论（全量核对后）
- 体系**已高度自洽**：report-title 与 card-title 同参数、sheet/dialog 标题同为 800、13px 次级强调统一（ask-q/recent-time 等）、无同一语义字号漂移——本轮应用 = 规范文档化 + 标注两处**有意差异**：
  1. `about-name` 字距 0.06em（品牌标识感，保留）
  2. `timer-display` 字距 +0.02em（tabular-nums 数字对齐需要，保留）
- 规范落点：本文档即规范；未来新增标题样式按阶梯取值

### 实施清单
1. 本条目即规范文档（统计/阶梯/权重/字距/行高/间距）
2. 新增样式时对照字号阶梯取值，不引入阶梯外新字号（除非设计评审）
3. 可选：将规范提炼为 styles.css 头部注释（/* 排版规范：字号阶梯 9-52px… */）

### 验收要点
- 全项目标题字号/权重/字距/间距与规范一一对应
- 新增界面元素沿用阶梯取值

---

## 52. 魅族实况通知适配（Flyme 私有胶囊 API） ✅ 已实施（v3.2）

### 需求（用户 2026-08-07 提供）
用户提供 GitHub 仓库 `Ruyue-Kinsenka/Flyme-Live-Notification-Demo`，指出魅族实况通知（锁屏胶囊）的实现方法，希望接入。

### 背景（真机已确认）
- #51 真机验证发现：魅族（Flyme，Android 16/API 36）`canPostPromotedNotifications()` = **false** → Android 标准实况通知提升在魅族不可用，当前走普通常驻通知降级链
- 魅族有**私有胶囊机制**（类似灵动岛/实况活动），可绕过标准提升限制

### 原理分析（已通读 Demo 源码）
标准通知 `Notification.Builder.addExtras(Bundle)` 注入魅族私有 key，Flyme 识别后渲染锁屏/悬浮胶囊：
- 外层：`is_live=true`、`notification.live.operation=0`、`notification.live.type=2`
- 胶囊 Bundle `notification.live.capsule`：`capsuleStatus=1`（启用）、`capsuleType=5`、`capsuleContent`（文字）、`capsuleIcon`（Icon）、`capsuleBgColor`/`capsuleContentColor`（int）、`capsule.content.remote.view`（RemoteViews 胶囊布局）
- 主通知：`notification.contentView = contentRemoteViews`（自定义 RemoteViews 布局）
- 配套：渠道 IMPORTANCE_HIGH、`setVisibility(VISIBILITY_PUBLIC)`（锁屏可见）、`setAutoCancel(false)`

### 可行性判断（已确认）
- **✅ 与现有方案互补**：魅族走私有胶囊，非魅族走标准提升/降级链；未知 extras 在非魅族上被系统忽略（无副作用），可双轨共存
- **⚠️ 必须仅魅族附加**：自定义 contentView 违反标准 Live Updates「禁 customContentView」条件——若在非魅族 Android 16 也设置会**破坏标准提升**；必须 `Build.MANUFACTURER == "Meizu"` 判断
- **⚠️ 私有 API 兼容性未知**：Demo 作者自述参数靠试（README 标注 "idk, need int"），key/值可能随 Flyme 版本变化——需真机验证
- **💡 加分实现**：胶囊 RemoteViews 可用 **Chronometer 组件**（`RemoteViews.setChronometer`，系统级走秒）——与标准通知 chronometer 同机制，魅族胶囊也能后台精准计时

### 方案（草案）
1. `TimerLiveUpdatePlugin.kt` 加 `isFlyme()` 检测（Build.MANUFACTURER == "Meizu"，忽略大小写）
2. Flyme 分支：标准通知（ongoing/chronometer/Progress）基础上：
   - `addExtras(liveBundle)`：胶囊显示「观己 · 计时中」+ Chronometer（setChronometer(startTime)）
   - 主 `contentView` 换简单 RemoteViews 布局（含 Chronometer）
   - 新布局 `res/layout/flyme_live_capsule.xml` + `flyme_live_content.xml`
3. `testLiveUpdate` 同步走 Flyme 分支（测试按钮直接验证胶囊效果）
4. 非魅族设备完全不受影响（现有路径不变）

### 实施清单
1. 两个新布局 XML（胶囊 + 主内容，均含 Chronometer + 观己图标 + 文案）
2. `isFlyme()` + Flyme extras 组装（capsuleStatus=1/capsuleType=5/operation=0/type=2，颜色用 App 主题蓝）
3. startTimer/testLiveUpdate Flyme 分支；stopTimer 不变（同 id cancel）
4. 构建 + 真机验证（用户魅族）：胶囊出现、秒数后台跳动、结束消失；非魅族回归

### 待确认问题
- 是否实施（实验性功能：私有 API 无官方文档，兼容性需在用户魅族真机验证）
- 渠道重要性：Demo 用 IMPORTANCE_HIGH（有声）vs 现有 IMPORTANCE_LOW（静默）——魅族胶囊是否需要 HIGH 才生效，真机验证决定

### 验收要点
- 魅族真机：计时开始 → 锁屏/悬浮出现胶囊（观己 + 秒数系统级跳动）→ 结束消失
- 非魅族设备：标准路径无回归（contentView 未被设置、提升条件不破坏）
- 杀进程恢复/划掉通知/权限降级行为不变

---

## 45. 【Bug】深色模式下首页日历图标不可读 ✅ 已修复（v2.6）

### 需求（用户原话）
打开深色模式后，首页的日历图标有可读性问题。

### 根因（已定位）
- `backfillBtn` 的 SVG（index.html:46）**硬编码 `stroke="#000000"`**——深色模式背景 `#121212` 上黑色图标几乎不可见；浅色模式正常所以之前未发现
- `.icon-btn`（styles.css:191）未设置 `color`，无法通过 currentColor 继承

### 方案（草案）
- SVG 的 stroke 改 `currentColor`；`.icon-btn { color: var(--ink) }`（深浅色自适应）
- 检查全站其他硬编码 `#000000`/`#FFFFFF` 的图标（header 区域）

### 验收要点
- 深色模式下首页日历图标清晰可见（浅色文字）；浅色模式不变
- 图标 hover/active 反馈正常

---

## 46. 编辑记录时直达详情页（跳过时间步骤） ✅ 已实施（v2.6）

### 需求（用户原话）
最近记录点击修改，为什么不是自己跳入记录详细页修改，而跳入记录开始页。

### 现状
- `openEditRecord` → `openSheet('edit')` → openSheet 默认显示第一步（stepTime：时间模式切换 + 时间显示），需再点「下一步」才到详情（情绪/诱因/时长/备注）
- 编辑时时间已预填（补记 seg 激活），第一步的「现在/补记」切换在编辑场景意义不大

### 方案（草案）
- `openEditRecord` 打开面板后**直接进入第二步**：隐藏 stepTime、显示 stepDetails、显示 saveBtn、隐藏 nextBtn（与 openSheet 初始状态相反）
- 保留「现在/补记」seg 在详情页顶部可见（时间仍需可改——编辑模式下可调整时间 seg 后再保存）
- 检查 updateTimeDisplay/滑块定位 initSegSlide 在直达第二步时是否正确初始化

### 验收要点
- 点「✎ 编辑」→ 面板直接显示详情（情绪/诱因/时长/备注已预填），无需再点下一步
- 编辑模式下仍可切换「现在/补记」调整时间；保存行为不变

---

## 47. 自定义添加项对话框交互与删除能力 ✅ 已实施（v2.9）

### 需求（用户原话）
记录详细页的可添加选项的逻辑有问题，点击添加按钮后，就直接弹出了键盘，在键盘上输入没有任何提醒，退出键盘就完成了添加，对应添加不满意，也没有删除选项。

### 现状（已定位）
- `openAddDialog`（app.js:1611）：打开后 120ms 自动 `focus()` → 键盘立即弹出
- 输入后按输入法「完成/回车」= `keydown Enter` → `confirmAddCustom`（app.js:1640）直接添加并关闭——无中间确认，用户感觉「退出键盘就完成了添加」
- 反馈有 toast（重复/超长/成功）但键盘遮挡下不明显；placeholder 有提示但用户未感知
- **自定义项无删除入口**：#24 实现只有 loadCustomList/saveCustomList（localStorage），chips 渲染时无删除 UI

### 方案（草案）
1. **交互确认**：对话框内加明确的「添加 / 取消」按钮（已有 addConfirm/addCancel 但键盘弹出时在键盘下方不可见？）——改为：Enter 只「确认」，并保证按钮可见（对话框整体上移/键盘弹出时 dialog 贴键盘顶）；输入中显示实时字数提示（如「3/6」）
2. **删除能力**：自定义 chip（非内置预设）增加删除入口——chip 右上角小 ×（仅自定义项显示），点击 → 确认删除 → 从 localStorage 移除并重渲染；或长按 chip 弹出删除确认
3. 删除后该选项从所有后续记录面板消失（历史记录保留原文本不受影响）

### 待确认问题
- 删除交互：~~chip 右上角 ×（直观） vs~~ **长按弹出删除确认**（✅ 已确认 2026-08-07：长按自定义 chip → 弹出删除确认弹层）

### ✅ v2.6 已修（2026-08-07）：字数提示 n/6 + data-custom 标记 + 600ms 长按删除确认 + click 抑制——但用户复测仍有三处问题

### 🆕 v2.7 复测反馈 2（2026-08-07）：删除首次长按无效 + 预览残留
- **删除情绪：第一次长按不行，第二次长按才能删除**——根因推断：Android WebView 系统长按文本选择菜单在原生层（约 500ms）触发，DOM 层 `contextmenu` 拦截对其无效（魅族定制内核尤甚），第一次长按被系统菜单抢占；取消后第二次长按才轮到我们的 600ms 定时器。方案 A（推荐）：删除交互改为**自定义 chip 右上角小 × 按钮**（绕开系统长按冲突，点击即弹确认）；方案 B：保留长按但缩短至 400ms + 真机验证是否仍被抢——待确认
- **添加框下小字残留上次输入**——根因实锤：`openAddDialog`（app.js:1679）只清空 `addCount`，**漏清 `addPreview`**（「将添加：xxx」）；修复：openAddDialog 加 `$('addPreview').textContent = ''`

### 升级实施清单（v2.7 补丁）
1. `styles.css`：删除 `.backdrop.dialog-layer.kb .dialog { transform: translateY(-24%); animation: none; }`
2. `app.js`：`syncTabbarKeyboard` 删除 addBackdrop/delBackdrop 的 kb class 联动（tabbar 隐藏保留）
3. `app.js`：`openAddDialog` 清空 `addPreview`
4. `app.js`/`styles.css`：删除交互——**方案 A（✅ 已确认 2026-08-07）：自定义 chip 右上角小 × 按钮**（仅 data-custom 项显示；chip 相对定位 + × 绝对定位右上角；点击 × 弹出删除确认弹层；长按删除逻辑移除）；~方案 B 长按缩短 400ms 弃用~
5. 验证：键盘弹出对话框不偏上；预览不残留；chip × 点击稳定弹出删除确认

### 🆕 v2.7 复测反馈（2026-08-07）：键盘弹出时添加窗口整体偏上
- 用户：**「添加情绪，没有考虑到手机键盘的弹出，然后导致添加情绪的窗口，在手机屏幕总体偏上」**
- 根因：v2.7 为防按钮被键盘遮挡加了 `kb` 时 `.dialog { transform: translateY(-24%) }` 手动上移——但 `adjustResize` 下键盘弹出时**视口本身已被压缩**、`.backdrop`（flex 居中）已自动把对话框居中在键盘上方区域；再叠加 -24% 手动上移 = 双重复合 → 窗口整体偏上
- 方案：**移除 kb 手动上移**（styles.css:686 删除该规则；app.js syncTabbarKeyboard 删除 addBackdrop/delBackdrop 的 kb 联动）——依赖系统视口压缩的自动居中即可；若个别机型 overlay 模式（视口不压缩）键盘遮住按钮，再按需加「贴键盘顶」方案（届时单独评估）

### 升级实施清单（v2.7 补丁）
1. `styles.css`：删除 `.backdrop.dialog-layer.kb .dialog { transform: translateY(-24%); animation: none; }`
2. `app.js`：`syncTabbarKeyboard` 删除 addBackdrop/delBackdrop 的 kb class 联动（tabbar 隐藏保留）
3. 验证：真机键盘弹出时添加对话框居中于剩余视口（键盘上方），不偏上、按钮不被遮

### 🆕 复测反馈与新根因（2026-08-07）
1. **长按触发手机复制功能**：Android 系统长按文本菜单（约 500ms）早于我们的 600ms 长按触发——系统复制/选择菜单先弹出。修复：chips 加 `user-select:none; -webkit-user-select:none; -webkit-touch-callout:none` + pointerdown/contextmenu `preventDefault()`
2. **删除确认卡片被记录卡片遮住（层级问题）**：`.backdrop` z-index 20 < `.sheet` z-index 30（styles.css:670/690）——记录面板内长按弹出的 delBackdrop 被面板（sheet）盖住。修复：addBackdrop/delBackdrop 单独提升 z-index 至 40（高于 sheet 30、低于 toast 50）；sheetBackdrop 保持 20
3. **添加流程依旧不透明不方便**：输入法「完成/回车」= Enter → 立即添加并关闭（用户误以为「退出键盘就完成添加」）。修复：**移除 keydown Enter 直接提交**（只能点「添加」按钮，动作明确）；键盘弹出时对话框上移（复用 isKeyboardUp 检测加 class，避免按钮被键盘遮住）；输入中实时预览「将添加：xxx」

### 升级实施清单（v2.7）
1. `styles.css`：`.backdrop.dialog-layer { z-index: 40 }`（addBackdrop/delBackdrop 加该 class）；chips `user-select:none; -webkit-touch-callout:none`；键盘弹出对话框上移样式
2. `app.js`：移除 addInput keydown Enter 提交；`initChipLongPress` pointerdown `e.preventDefault()` + chips `contextmenu` preventDefault；`isKeyboardUp` 时 addBackdrop 加键盘态 class；addInput input 更新「将添加：xxx」预览
3. `index.html`：addDialog 加预览元素（`#addPreview`）
4. 验证：长按不弹系统复制菜单、删除确认在面板之上可见、Enter 不添加、键盘弹出时按钮可见

### 验收要点
- 添加对话框：键盘弹出时按钮可见可点；有字数提示；Enter 确认有明确反馈
- 自定义项可删除：删除后不再出现在 chips；历史记录不受影响
- 内置预设项不可删除

---

## 42. 【Bug】配置 AI 时软键盘把底部 tab 栏顶起来 ✅ 已修复（v2.5）


---

## 66. 【Bug】步骤切换动画「弹出一部分 → 卡一下 → 显示完整」 ✅ 已实施（v3.4 补丁，方案 A）

### 需求（用户 2026-08-08 原话）
> 点击记录默认就现在，点击下面小字直接记录，卡片弹出时，会弹出一部分，卡一下显示完整，补记也是同样的情况，但是编辑就不会出现这个问题。

### 用户澄清后的准确复现路径（关键——问题不在弹出，在步骤切换）
1. 点击记录 → 选「补记」→ 点「下一步」→ 到记录页（stepDetails）：**动画问题在「点击下一步到记录页」**
2. 点击记录 → 点「不想计时？直接填写」→ 到记录页：**同样在切换动作**
- 编辑（openEditRecord）直达详情、不走步骤切换 → **无此问题**

### 根因（✅ 真机实测定位，魅族 461QYFDN226NF + rAF 逐帧采样 + CDP Profiler）
**`goToDetails()` 的 `transitionSheetHeight('stepDetails')` 目标高度算错 + 双向动画 + 清理定时器竞态，三重叠加：**

1. **目标高度错误（核心）**：sheet 结构 = grab 条 + 标题「记录」+ step 内容 + 按钮区 + padding（≈188px chrome）。`transitionSheetHeight` 把目标设为 `stepDetails` **自身**高度：实测 `from = sheet 681.1px`，`to = stepDetails 493.3px` → **高度过渡方向反了（收缩而非展开）**
2. **动画过程（rAF 逐帧实测）**：点下一步 → stepDetails 瞬间显示（sheet 681）→ `style.height=from` 无过渡生效（681）→ 装上 transition 后 rAF 设 `to` → **681→493 反向收缩动画**（~350ms，内容被 overflow:hidden 裁切，sheet 顶边下滑）
3. **400ms 清理竞态**：`setTimeout(400)` 在动画尾段触发 → inline 高度清空 → **瞬间弹回自然高度 681**（实测 970934 停在 493 约 216ms 后 971159 跳回 681——「卡一下显示完整」的实锤帧数据）
4. 方向切换（上一步 `goToTime` → `transitionSheetHeight('stepTime')`）同 bug；编辑直达详情从不调用该函数 → 平滑 ✓（与用户观察一致）
5. 补充排除：JS 侧非阻塞（Profiler 95% idle）、弹出动画 sheetUp 本身平滑（y 单调 851→381 无停顿）——问题仅在步骤切换

### 方案（✅ 已确认 A，2026-08-08）
- **A（推荐）：修复 transitionSheetHeight 使其正确**
  - 目标高度 = step 高度 + chrome 偏移（grab/标题/按钮区/padding ≈ 188px），或改测「切到目标 step 后 sheet 的自然高度」（先切 class 再测 rect）
  - 两段式必须正确：`transition='none'` → 设 from → 强制 reflow → 恢复 transition → rAF 设 to（当前「先设 height 后装 transition」顺序恰好避免了一次错误动画，但目标值错仍收缩）
  - 清理用 `transitionend` 事件替代固定 400ms 定时器（消除竞态；400ms < 动画实际总时长 700ms 是跳变的直接原因）
  - 时长可缩短（0.35s→0.22s easeOutCubic）与退场/入场语言一致
- **B：移除高度过渡，步骤瞬间切换**——与编辑路径一致（编辑当前即瞬间且用户无异议）；实现最简，但 470→681 高度突变可能显突兀
- **C：transform: scaleY / clip-path 替代 height 动画**——合成器驱动不触发布局重排（含 backdrop-filter 每帧重绘问题），但内容缩放变形，需配 overflow 裁切，实现复杂

### ✅ 实施记录（2026-08-08，方案 A）
- **app.js**：`transitionSheetHeight(targetId)` → `transitionSheetHeight(from)`——签名改为接收「切换前高度」；`to` 改为调用时 sheet 的自然全高（步骤已切换完，含 chrome）；清理改 `transitionend`（`e.target===sheet && propertyName==='height'` 才清理，防子元素冒泡）+ 600ms 兜底定时器（display:none 场景 transitionend 不触发）；时长 0.35s→0.22s easeOutCubic(0.33,1,0.68,1) 与退场语言一致
- **app.js**：`goToDetails()`/`goToTime()` 各在步骤切换前测 `from = sheet.getBoundingClientRect().height` 传入
- **真机验证（魅族 461QYFDN226NF，rAF 逐帧采样对比修复前后）**：
  - 补记→下一步：修复前 y 序列「170→358 收缩→停 493 约 216ms→跳回 170」；修复后「478→444→413→384→358→221→173→170」**单调展开** 373→681，无反向/无停顿/无跳变，216ms 后 transitionend 清理
  - 小字直达：单调展开 470→681 ✓（y 381→…→170 无反向）
  - 上一步：单调收缩 681→470 ✓（y 170→…→381 无反向）
  - 编辑路径：inlineSeen=0（不触发高度过渡）、直接全高打开 ✓ 无回归
  - 浏览器回归 4 项 PASS（记录打开/补记下一步/上一步返回/小字直达）+ console 零错误
- 资源版本 ?v=33/33；版本号不变（v3.4 内补丁，用户控制版本）；截图 `debug/v66_step_transition_fixed.png`


---

## 70. 【Bug】网页原型：矮视口下状态栏显示不完全 ✅ 已修复（v3.5 内补丁）

### 需求（用户 2026-08-08）
> 修改网页原型，定位状态栏显示不完全的问题。

### 根因（✅ 浏览器实测定位）
- `.phone { height: 844px }` 固定高度 + `body { display:flex; align-items:center }` 居中
- 桌面浏览器窗口高度 < ~890px 时（实测 1250×800 视口），手机顶部溢出视口且 flex 居中使上下同时裁切——**模拟状态栏 y=-21（顶部被裁 21px）**，「状态栏显示不完全」实锤
- 真机不受影响（真机媒体查询已隐藏模拟状态栏 display:none）

### 修复
- `styles.css` 新增 `@media (max-height: 920px) and (pointer: fine)`：`.stage` padding 收窄 + `.phone { height: calc(100vh - 28px); min-height: 640px }`——手机 flex column 内 `.screen` flex:1 吸收高度差，状态栏 46px 恒完整可见
- `pointer: fine` 与真机规则（coarse）互斥，真机行为零影响（已验证 matchMedia 互斥）
- **验证**：同视口状态栏 y=-21 → **y=15 完整可见**；phone 844→772 自适应；极矮视口 min-height 640 兜底
- 资源 ?v=37；已构建安装（真机无行为变化）；浏览器截图 `debug/statusbar-fixed.png`


---

## 71. 观己宣传海报系列（HTML 交付物） ✅ 已交付（2026-08-08）

### 需求（用户 2026-08-08）
> 参考「C:\Users\43124\Desktop\原型」里的手机界面截图，制作观己的 app 宣传海报（每个功能介绍一张），无生图模型 → 海报以 HTML 输出。

### 交付
- **7 张竖版海报（1080×1920 设计稿，JS 等比缩放适配任意视口）** → `C:\Users\43124\Desktop\观己海报\`：
  01-全屏计时 / 02-实况通知 / 03-首页看板 / 04-AI分析 / 05-桌面小组件 / 06-历史日历 / 07-数据安全
- 统一设计系统：Apple 风格浅色底 + 蓝渐变点缀、心形 logo、手机 mockup（按功能还原真实界面：计时页蓝渐变/锁屏胶囊+通知/AI 报告卡/小组件网格/月历/盾牌隐私卡）、卖点 chips、隐私承诺 footer
- 生成脚本 `debug/poster-gen.cjs`（模板 + 7 功能配置，可复用/扩展）
- 验证：Playwright 抽查 01/05/07 布局（缩放/居中/无溢出/关键元素渲染），console 仅 favicon 404（无碍）

### 实施清单（按方案 A）
1. `app.js` `transitionSheetHeight`：chrome 偏移补偿或「先切 step 后测 sheet 自然高度」；两段式（transition:none → from → reflow → transition → to）
2. 清理改为 `transitionend`（或与动画时长严格同步的定时器）
3. 真机验证：补记下一步 / 小字直达 / 上一步 / 编辑四路径对比采样（帧序列应单调无停顿、无反向动画、无 400ms 后跳变）

### 待确认问题
- 方案 A（修复过渡）vs B（移除过渡瞬间切换）——用户拍板

### 验收要点
- 补记/小字进记录页：sheet 高度单调变化（或瞬间），无「弹一部分卡一下显示完整」
- 上一步返回时间步骤同样平滑
- 编辑路径无回归


---

## 67. 我的页：隐私说明移至数据管理下方 ✅ 已实施（v3.5）

### 需求（用户 2026-08-08）
> 把我的页的隐私说明，移动到数据管理下面，并且更新版本号 3.5。

### 实施记录
- **index.html**：隐私说明卡从「我的」页顶部（header 之后）移至「数据管理」卡之后、「关于」卡之前——新顺序：外观 → AI 设置 → 记录提醒 → 正向反馈 → 记录方式 → 实况通知 → **数据管理 → 隐私说明** → 关于（logo/版本）；文案与结构不变（privacy-list 2 条）
- **版本升级 v3.5**（用户指定）：`android/app/build.gradle` versionCode 25→26 / versionName "3.4"→"3.5"；`index.html` about-ver「v3.4 · 数据仅存本地」→「v3.5 · 数据仅存本地」；资源 styles.css?v=34 / app.js?v=34
- **真机验证（魅族 461QYFDN226NF）**：dumpsys versionCode=26 / versionName=3.5；CDP DOM 顺序 dataBeforePrivacy=true（数据管理 index 6 < 隐私说明 index 7）；about-ver 显示 v3.5；清除确认弹窗回归正常（privacyItems=2 文案完整）
- 浏览器回归同结果（顺序一致 + v3.5）；截图 `debug/v35_me_page.png`


---

## 68. 我的页：隐私说明并入关于卡 ✅ 已实施（v3.5 内补丁，版本号不变）

### 需求（用户 2026-08-08）
> 把隐私说明和下面的关于结合到一起吧，版本号不变。

### 实施记录
- **index.html**：删除独立「隐私说明」卡，并入 about-card——品牌区（logo/观己/版本）上方，新增 `.about-privacy` 分区（标题「隐私说明」+ 原 2 条 privacy-list）置于下方；我的页卡片数 9→8
- **styles.css**：`.about-card .about-privacy`——`align-self:stretch` + `border-top: 1px solid var(--line)` 分隔线与上部品牌区分 + `text-align:left`（关于区居中、隐私长句左对齐可读）
- **版本号不变**（用户指定）：versionCode 26 / versionName 3.5 / about-ver 保持 v3.5；仅资源 ?v=35/35
- **真机验证（魅族 461QYFDN226NF）**：cardCount=8；about-card 内含 logo/观己/v3.5 + 隐私区（brandY=460 → privY=528，分隔线 `0.73px solid rgb(229,229,234)`=--line）；左对齐；2 条文案完整；数据管理仍在其上（dataBeforePrivacy=true）；清除确认弹窗回归正常
- 浏览器回归一致（cardCount=8、分隔线、2 条）；截图 `debug/v35_about_merged.png`


---

## 69. 关于卡继续优化：去分割线与隐私说明标题 ✅ 已实施（v3.5 内补丁，版本号不变）

### 需求（用户 2026-08-08）
> 继续优化一下关于卡片，其实可以不用分割线和隐私说明标题的，依旧不更新版本号。

### 实施记录
- **index.html**：移除 `.about-privacy` 内的「隐私说明」标题；`.about-privacy` 从 div 包装简化为直接挂在 about-card 下的 `ul.privacy-list`——品牌区（logo/观己/版本）之后直接跟 2 条隐私条目（苹果页脚风格）
- **styles.css**：`.about-card .about-privacy` 去掉 `border-top` 与 `padding-top`，`margin-top` 22px→18px（与版本行衔接），保留 `align-self:stretch` + `text-align:left`
- **版本号不变**（用户指定）：26/3.5/about-ver v3.5；资源 ?v=36/36
- **真机验证（魅族 461QYFDN226NF）**：`privBorderTop = 0px none`（无分割线）✓；about-card 无 card-title（无标题）✓；brandY=2077 → privY=2141（间距 64px 含品牌块）✓；2 条文案完整、左对齐；v3.5 显示正常；卡片数 8
- 浏览器回归一致（无 border/无 title/v3.5/2 条）；截图 `debug/v35_about_clean.png`


---

## 72. 动效与视觉增强候选：三个 GitHub 库调研结论 ✅ 已实施（v3.5 内补丁，anime 试点）

### 背景（用户 2026-08-08 调研）
用户提出三个 GitHub 库，考察对观己的帮助：
1. **liquid-glass-react**（https://github.com/rdev/liquid-glass-react）——苹果「液态玻璃」效果组件库（iOS 26 材质：边缘折射/位移、磨砂模糊、饱和度、色差、弹性）
2. **cult/ui**（https://github.com/nolly-studio/cult-ui）——React 设计工程师组件库（92+ AI Agent 界面模式、模板）
3. **anime.js**（https://github.com/juliangarnier/anime）——经典轻量 JS 动画库（v4 模块化，零依赖）

### 调研结论
- **两个 React 库直接不可用**：观己是零构建 vanilla 架构，React 组件装不进去；且这反证「不需要为动效库改 React 架构」——动效库（GSAP/anime/Lottie）均为框架无关，React 化只会引入构建链、报废 DOM-id 调试资产、WebView 性能负优化
- **liquid-glass-react 参考价值高**：液态玻璃视觉配方（强磨砂 + saturate + 边缘高光 inset + 弹性）可纯 CSS 模拟；风险：WebView 性能（#44 backdrop-filter 前科，需 prefers-reduced-motion/低端机关闭降级）
- **cult/ui 参考价值低**：仅 AI 产品界面模式可作灵感（观己分析页形态已定稿）
- **anime.js 唯一可落地**：无框架无构建，补 CSS 短板——真实弹簧物理（overshoot）、stagger 交错、时间线编排、SVG 动画（环图分段入场）、数字滚动

### 落地候选（待拍板）
1. **anime.js 试点（推荐先做）**：`www/vendor/anime.min.js`（v4 单文件）→ 试点两处：①面板弹出弹簧（替代 cubic-bezier 近似）②时段分布环图分段入场 → 真机 rAF 逐帧采样对比现状，满意再铺开
2. **液态玻璃纯 CSS 原型**：prototype/liquid-glass.html——tab 栏/弹层/卡片边缘高光 + 强磨砂，定稿后应用（含性能降级策略）
3. 注意：anime 只动画 transform/opacity/SVG 属性，不碰布局属性（#66 教训）

### 实施清单（若确认）
1. 下载 anime v4 单文件 → www/vendor/
2. 面板弹出（sheetUp）改造为弹簧动画 + 真机采样对比
3. 环图 canvas/SVG 入场动画试点
4. 液态玻璃原型（独立，可与 1-3 并行）

### 待确认问题
- anime 试点两处是否开始？液态玻璃原型是否要做？

### ✅ 实施记录（2026-08-08，anime 试点）
- **vendor**：`www/vendor/anime.min.js` = animejs **v3.2.2**（UMD 单文件，17KB）——v4 为纯 ESM 模块无浏览器全局构建（实测 jsdelivr v4 无 UMD），v3 完整支持 easing 体系
- **面板弹出回弹动画（playSheetOpen）**：openSheet 显示后，有 anime 且非 reduced-motion 时——关闭 CSS sheetUp（animation:'none' 防双动画）→ anime `translateY ['100%','0%']` + **easeOutBack(1.4) + 550ms**（克制的 ~13% overshoot 回弹，CSS cubic-bezier 无法回弹）；changeComplete 清 transform、animation 保持 'none'（**实测恢复 '' 会让 CSS sheetUp 重播「弹完再滑一次」**，由下次 resetSheetStyle 清理）；animateSheetClose 先 pause sheetOpenAnim 防退场冲突；vendor 缺失/reduced-motion 自动回退 CSS——**零风险接入**
- **spring easing 弃用原因**：v3 源码对 spring 无条件覆盖 duration（固定 ~1s 且不可调，实测 1003ms），对弹出动画太拖沓；easeOutBack 等效回弹且时长可控（真弹簧留待 v4 ESM 评估）
- **环图结论**：时段分布环图已有 CSS staggered 交错入场（stroke-dasharray 0.6s + 110ms 间隔），anime 化收益低——**不替换**
- **验证**：
  - 浏览器（Playwright）：回弹曲线实测 100% → -6.48% overshoot → 衰减稳定；动画完成清理（animDone/transformCleared）；面板落位 bottom 对齐；退场动画正常接管；CDP evaluate 期间 rAF 被节流导致「动画不推进」为测试方法干扰，分离式验证通过
  - 真机（魅族 461QYFDN226NF，rAF 逐帧采样）：y 序列 851→381 滑入 → **overshoot 上弹至 319**（超出锚点 62px≈13%）→ 衰减振荡 5 次 → 稳定 381；总时长 ~550ms；帧连续无停顿；无残留动画
- 资源 ?v=38/38；版本号不变（v3.5 内补丁）；后续可试点：弹层/对话框回弹、stagger 交错、数字滚动（anime 已就位）

### ✅ 液态玻璃原型（2026-08-08，已交付待定稿）
- **`prototype/liquid-glass.html`**（桌面交互原型）：手机框 + 彩色光斑背景，三组件（悬浮 tab 栏 / 记录面板 / 数据卡）液态玻璃 vs 原毛玻璃**一键切换对比** + 面板弹簧打开（anime easeOutBack，复用 #72 vendor）+ 配方说明面板
- **配方（CSS 实现）**：`backdrop-filter: blur(26px) saturate(180%)` + `border: 1px solid rgba(255,255,255,.65)` + inset 上缘高光 + 斜向折射光带 `::before`（radial+linear 叠加）+ 原毛玻璃组（blur 30px + 白 tint 72%）对照组
- **验证（Playwright）**：配方全部生效（blur 26px/saturate 1.8/亮边/高光/折射带）；切换开关 ✓；弹簧打开落位 ✓；三组件 position 正确
- **修复 2 个原型 bug**：①`.glass` 规则里 `position:relative` 覆盖组件 absolute 导致 sheet 掉进文档流（absolute 自身即 ::before 定位上下文，移除即可）②CSS 初始 `transform: translateY(120%)` 与 anime 清理冲突导致面板收回（初始态改 JS 内联）
- 截图 `debug/v72_liquid_glass_on.png` / `v72_liquid_glass_off.png`（开/关对比）
- **v2 调整（用户反馈「背景不需要白色模糊，哪里体现通透感」）**：`--lg-tint` 0.55→**0.10（近乎透明）**、`--lg-blur` 26→20px（轻磨砂）、`--lg-saturate` 180%→**200%**（背景色透过并提亮）——通透感来自 blur+saturate 而非白色填充，亮边 0.75 + 折射光带保留；对照组（原毛玻璃白雾 0.72）不变以突出对比；截图 `debug/v72_liquid_glass_v2.png`
- **v3 增强（用户确认按推荐推进）**：借鉴 cult-ui 的 `distorted-glass` 实现——**SVG feTurbulence + feDisplacementMap 折射扰动**（`baseFrequency 0.12 numOctaves 1 scale 22 seed 7`，隐藏 SVG 定义 `#lg-distort`），`.glass` 三组件加 `filter: url(#lg-distort)`——玻璃表面有了折射扭曲细节（cult-ui 分析：真透镜折射需 Three.js shader，SVG 扰动是移动 WebView 可行的近似，其余组件（edge-blur mask 渐隐 / morph-surface 多层 inset 阴影）已确认与现有原型思路一致无需再借鉴；cult-ui 克隆暂存 `C:\Users\43124\ZCodeProject\cult-ui-review\`）；截图 `debug/v72_liquid_glass_v3.png`
- **⚠️ v3 回归（用户实测「整个画面都扭曲变形」）**：整面 `filter: url(#lg-distort)` 挂玻璃主体 + 0×0 SVG（滤镜区域失效）+ scale 22 → **位移映射捕获整屏内容，全画面扭曲**——我的验证只查了 computed filter 未查视觉结果，验证方法失误；**v4 修复**：①移除玻璃主体整面滤镜 ②扰动重做为**边缘折射层**（`.lg-distort` 时 6px 透明边框 ::after 挂 `#lg-edge-distort`，inset -6px，只扰动细边）③SVG 给真实尺寸 300×300（0×0 滤镜区域失效）+ 显式 `x/y/width/height` 滤镜区域 ④参数收敛（scale 22→8、baseFrequency 0.12→0.02 温和涟漪）⑤扰动开关独立、**默认关闭**；验证：默认态 cardFilter=none + v2 配方完整（blur 20px/saturate 2/亮边/光带）、扰动开关开启后仅 ::after 边缘层带滤镜、主体 filter 仍 none；截图 `debug/v72_liquid_glass_v4_default.png` / `v72_liquid_glass_v4_distort_on.png`
- **应用前置**：定稿后应用到 App 时需真机逐帧验证（blur+saturate 每帧重绘成本高于原毛玻璃，#44 前科）+ `prefers-reduced-motion` 降级 + 低端机关闭策略（扰动滤镜作可选项，低端机降级为无扰动）——待用户看原型拍板

### ✅ 定稿应用（2026-08-08，用户「可选液体微摆不需要，其他的可以，定稿实施」）
- **应用范围**：`.tabbar`（悬浮 tab 栏）+ `.sheet`（记录面板）——原型三组件中玻璃材质对应的两个；数据卡未应用（App 卡片为白底内容容器非玻璃材质）
- **styles.css**：`:root`/深色块加 `--lg-tint`（浅色 0 / 深色 0.05 适配）+ `--lg-saturate: 2`；.tabbar/.sheet 替换为定稿配方——无磨砂（`blur(0px) saturate(2)`）+ 阴影栈（外侧发丝暗线 0.5px/内侧白亮环/上缘 1px 高光/下缘微光/内缘柔光/外投影）；共享 `::after` 渐变边框环（环形 mask content-box xor/exclude，不碰主体）+ `::before` 顶部受光/斜向光带；tabbar :active 按压增强（--lg-saturate 2.2）
- **兼容确认**：reduced-transparency 偏好（盖白底）保留 ✓；#44 退场转不透明逻辑（backdropFilter:none + var(--card)）兼容 ✓；anime 弹簧弹出不受影响 ✓
- **验证**：浏览器（Playwright）浅色/深色全过——tabbar/sheet `blur(0px) saturate(2)`、透明底、环形 mask exclude、光带、深色 tint 0.05 生效；真机（魅族 461QYFDN226NF）CDP 配方生效 + 真实点按打开面板落位 381 动画清理无残留；资源 ?v=39/39
- **原型同步清理**：liquid-glass.html 移除液体微摆（SVG 滤镜/开关/JS/CSS），保持与定稿一致；截图 `debug/v72_liquid_glass_app.png`（App 真机）

### ✅ 全 App 扩展（2026-08-08，用户「效果还可以，应用到整个app看看」）
- **扩展范围**：`.calendar-sheet`（日历弹层）+ `.dialog`（添加/删除对话框）液态玻璃化——共享 ::after 渐变边框环 / ::before 光带选择器扩展至四组件；`.card` 内容卡片保持白底（页面背景纯色无可透内容，玻璃化无收益且伤可读性——设计决策记录）
- **dialog 特殊处理**：遮罩（0.4 黑）之上透明会伤可读性 → 新增 `--lg-tint-strong`（浅色 0.85 / 深色 0.85 深底），玻璃边缘结构保留
- **兼容**：reduced-transparency 媒体查询扩展至 calendar-sheet/dialog
- **验证**：浏览器全过（日历/对话框 blur(0px) saturate(2) + 边框环 mask exclude + 光带；深色 tint 0.05/0.85 生效）；真机（魅族）CDP 配方生效 + 真实点按打开面板落位 381 清理干净；资源 ?v=40/40；截图 `debug/v72_liquid_glass_app_full.png`

### ✅ 全 App 铺开（2026-08-08，用户「直接全 App 铺开」）
- **前提**：背景增强——`.phone` 加柔和蓝晕双层 radial（`--bg-glow-1/2`，浅色 0.06/0.05、深色 0.09/0.06）——玻璃卡片有内容可透（纯色背景玻璃化无意义）
- **内容卡玻璃化**：`.card` / `.report-card` / `.ask-answer` 替换为液态玻璃配方——新增 `--lg-tint-card`（浅色 0.55 / 深色 0.06 分层）+ `position: relative`（伪元素定位上下文）+ 玻璃阴影栈（发丝暗线/白亮环/上缘高光/投影）；共享边框环/光带选择器扩展至七组件
- **交互控件保持实底**（设计决策）：按钮/chips/seg-slide/输入框/textarea/switch/icon-btn 不玻璃化（可读性与「可点击」暗示）
- **兼容**：reduced-transparency 查询扩展至内容卡
- **验证**：浏览器全过（卡片 tint 0.55/0.06 + blur(0px) saturate(2) + position relative + 边框环 + 光带；背景双层蓝晕；深色适配）；真机（魅族）配方生效 + 面板弹簧落位 381 清理干净；资源 ?v=41/41；截图 `debug/v72_liquid_glass_full_app.png`

### ✅ 按钮着色玻璃（2026-08-08，用户「按钮也可以做成带颜色的玻璃」）
- **tinted glass 配方**：半透明色底（0.55 保证白字对比，仍透出背景）+ `blur(0px) saturate(2)` + 亮边 0.55 + inset 上缘高光 + 发丝暗线 + 色相光晕投影
- **变量**：`--lg-tint-blue / -gray / -red`（+ `-hi` hover 加深）浅色/深色双套
- **改造范围**：`.btn-primary`（蓝）/ `.btn-ghost`（中性灰）/ `.btn-danger`（红）/ `.record-btn`（蓝主 CTA 更深光晕）/ `.chip`（灰 tinted）+ `.chip.active`（蓝 tinted 白字——原 accent-soft 浅底深字改为玻璃选中态）
- **验证**：浏览器全过（五类按钮 tint/backdrop/亮边/高光 + 深色 0.55）；构建安装真机；截图 `debug/v72_liquid_glass_buttons.png`；资源 ?v=42/42

### ✅ 双态化 + 按钮实色玻璃（2026-08-08，用户「按钮颜色太浅，保留原色做玻璃 + 我的页加模式切换」）
- **按钮修正**：放弃半透明 tint（太浅）→ **保留原实色 + 玻璃边缘**（visionOS 风格）：`background: var(--accent)` 实蓝 + 亮边 0.6 + inset 上缘高光 + 色相光晕；ghost/danger/chip.active 同理实底 + 玻璃边缘
- **双态架构**：CSS 全部玻璃规则改挂 `html.liquid-glass` 前缀覆盖层（文件尾部大块），默认恢复旧版（毛玻璃 tab/sheet/日历、白底 card/dialog、实色按钮、纯色背景）；`:root` 保留 --lg-tint/--lg-tint-strong/--lg-tint-card/--bg-glow-1/2 变量；废弃 --lg-tint-blue/gray/red 已删
- **我的页开关**：外观卡加「液态玻璃（实验性）」switch-row（`guanji_liquid_glass` localStorage 默认 on）；head 防闪烁脚本同步应用类（无闪烁）；app.js initLiquidGlass 同步 UI + 点击切换 + renderHome 重绘
- **验证**：浏览器双态全过——玻璃态（按钮 rgb(0,122,255)+亮边 0.6+高光、卡片 tint 0.55、tabbar blur(0px) saturate(2)、背景蓝晕）vs 旧版（按钮实色无边缘、卡片白底、tabbar blur(24px) saturate(1.8)、无蓝晕）；开关点击切换类 + localStorage 持久化 ✓；真机（魅族）默认玻璃态生效 + 开关切换 stored=off 生效；资源 ?v=43/43；截图 `debug/v72_liquid_glass_switch.png`

### ✅ P1+P2 优化（2026-08-08，基于三篇文章分析：cocos 位移场 / 掘金 Vibrancy 与内容感知 / 知乎组件规范）
- **P1 流动性（内容感知）**：tab 栏随内容滚动收缩——任意 screen 滚动 >60px → `.scrolled`（高度 58→50px + 玻璃态变实 `--lg-tint-scroll` 浅 0.4/深 0.1 + 阴影加深），滚回顶部恢复；0.25s 过渡；双态（旧版只收缩+阴影）
- **P2 材质细节**：①Vibrancy 近似——tint-card 0.55→0.60/深 0.08 ②选中 tab 图标玻璃底座（32px 圆形径向渐变 + inset 高光 + 蓝光晕，tab-pill 提 z-index 1 保内容在上）③色散近似（实验）——大数字 .stat-num/.focus-num/.overview-num 极轻 RGB 双色 text-shadow（0.6px ±红 0.18/蓝 0.18）
- **沉淀**：DESIGN-LANGUAGE.md 新增第 9 章「液态玻璃 Material 分层」——L0-L4 五级 tint 规范表 + 边缘结构/流动性/降级三小节
- **验证**：浏览器全过（滚动收缩双态/底座/色散/深色）；真机（魅族）滚动收缩 h=50+玻璃变实 0.4、底座/色散生效；资源 ?v=44/45；截图 `debug/v72_liquid_glass_p12.png`
- **v5 调整（参照 AndroidLiquidGlass 原生配方量级——读取 kyant0/backdrop 库源码）**：①`--lg-blur` 20px→**8px**（原生示例 `blur(8dp)` 量级——轻磨砂才通透，20px 偏重）②边缘层修正：v4 的透明边框空元素挂滤镜无可位移内容（实际不可见）——改为**半透明环带 `rgba(255,255,255,0.16)` + 小位移**（位移有了实际内容，产生「液体微摆」边缘）③**按压反馈**（参照原生按压驱动模型）：:active 时 `--lg-saturate 220% / 高光 1.0 / blur 12px / 亮边 0.9` + 卡片微缩放 0.985 + tab 微缩放 0.94（弹簧过渡）——玻璃「活」起来；原生算法参考价值（SDF 圆角矩形 + circleMap 边缘衰减 + 法线折射 + 色差）：确认「边缘折射+强度衰减」模型，AGSL 与 GLSL 兼容可作鸿蒙 ArkUI shader 直接翻译的算法底稿；克隆暂存 `C:\Users\43124\ZCodeProject\android-liquid-glass-review\`；截图 `debug/v72_liquid_glass_v5_default.png` / `v72_liquid_glass_v5_edge_on.png`
- **v8 修复（用户反馈「边框改动影响卡片主体，通透感没了」）**：v7 双层背景 bug——`background: 透明 padding-box, 白渐变 border-box` 中**透明层遮不住 border-box 层**（border-box 覆盖整盒），白渐变实际盖满卡片主体（白纱）；修复：主体恢复 `background: var(--lg-tint)` 纯透明 + 渐变边框改 **::after 环形 mask 独立绘制**（`-webkit-mask: linear-gradient(#000) content-box, linear-gradient(#000)` + `mask-composite: exclude`——渐变只画 1px 边框环，圆角保留，不碰主体）；液体微摆开关改为环带加宽 6px + SVG 扰动（滤镜作用于有内容的环带）；验证：主体 `rgba(255,255,255,0)` + 无磨砂保持 + 环形 mask composite exclude 生效 + 发丝暗线/白亮环/光带全在；截图 `debug/v72_liquid_glass_v8.png`
- **v7 调整（用户反馈「边框轮廓不够玻璃」）**：重构玻璃边缘——①均匀白描边 → **渐变边框**（`background: tint padding-box + linear-gradient(180deg, 白0.95→白0.55→白0.28) border-box`，上亮下暗受光感，圆角不破坏）②**外侧发丝暗线** `0 0 0 0.5px rgba(0,0,0,0.08)`（玻璃与背景分离）③**内侧白亮环** `inset 0 0 0 0.5px rgba(255,255,255,0.55)` ④上缘细高光改 1px 实线 + 内缘 12px 柔光晕 ⑤顶部转角亮斑增强（radial 130% 70% at 15% 0%）；验证：渐变边框（双层 background-clip）/发丝暗线/白亮环/高光/柔光/转角光全生效 + 圆角 24px 保留 + 无磨砂保持；截图 `debug/v72_liquid_glass_v7_edge.png`
- **v6 调整（用户要求「彻底无磨砂」）**：`--lg-blur` 8px→**0px**、`--lg-tint` 0.12→**0（完全透明）**——backdrop-filter 仅 `saturate(200%)`，通透感完全来自饱和度 + 边缘高光/折射光带/边缘层；按压反馈去掉 blur 增强项（保留 saturate 220%/高光/亮边）；**性能红利**：无 blur 后无每帧模糊重绘，#44 前科的渲染成本基本解除（饱和度叠加为轻量操作）；验证 `blur(0px) saturate(2)` + 透明底 + 高光/光带/边缘层全生效；截图 `debug/v72_liquid_glass_v6_noblur.png`


---

## 73. 我的页：设置项顺序调整（当前杂乱） ✅ 已实施（v3.5 内补丁，用户确认「按草案，液态玻璃独立成卡」）

### 需求（用户 2026-08-08）
> 调整一下我的页，设置顺序，现在有点杂乱了。

### 现状（当前顺序，index.html screen-me）
1. **外观**（主题 chips：跟随系统/浅色/深色 + 液态玻璃实验开关）
2. **AI 设置**（提供商/Base URL/模型/API 密钥/测试连接——最长卡，约 6 行）
3. **记录提醒**（每日温和提醒开关 + 时间）
4. **正向反馈**（里程碑肯定开关）
5. **记录方式**（计时记录/快速记录 chips）
6. **实况通知**（测试按钮 + 状态 + 后台引导）
7. **数据管理**（导出数据/清除全部数据/恢复演示数据）
8. **隐私说明**（并入底部关于卡）

### 杂乱点分析
- 7 张设置卡混合「偏好 / AI / 设备 / 数据」四类，无分组逻辑
- AI 设置最长，夹在中间成为滚动视觉重心，挤压高频项（记录方式/提醒）
- 液态玻璃（实验性）作为大开关混在「外观」主题下，性质不同（实验功能 vs 主题偏好）
- 记录相关项（记录方式/记录提醒/正向反馈）被 AI 卡隔开

### 理解与设计（草案）
按「使用频率 + 分组」重排（高频偏好靠上，长卡 AI 下移）：
1. **外观**（主题）
2. **液态玻璃（实验性）**——独立成卡（与主题平级，实验性标注更清晰）
3. **记录方式**
4. **记录提醒**
5. **正向反馈**
6. **实况通知**（设备能力测试）
7. **AI 设置**（下移，长卡不挡高频项）
8. **数据管理**
9. **关于**（隐私说明）

### 实施清单
1. `www/index.html` screen-me：调整 card 顺序（整块移动）+ 液态玻璃开关独立成卡
2. 检查 app.js 绑定的 id（themeChips/liquidGlassSwitch/recordModeChips 等）——按 id 绑定不依赖顺序，移动无副作用
3. 浏览器回归（我的页渲染 + 各开关/按钮功能）

### 待确认问题
- 分组排序是否按草案？液态玻璃是否独立成卡？
- 是否需要视觉分组（如卡片间加分组标题）？

### ✅ 实施记录（2026-08-08，用户确认「按草案，液态玻璃独立成卡」）
- **index.html screen-me 重排**：外观（主题）→ **液态玻璃（独立卡，实验性标注）** → 记录方式 → 记录提醒 → 正向反馈 → 实况通知 → AI 设置（下移，长卡不挡高频项）→ 数据管理 → 关于（隐私说明）
- 液态玻璃开关从外观卡独立成卡（标题「液态玻璃 实验性」+ 开关 + 说明文案）
- app.js 全部按 id 绑定，移动无副作用（确认无顺序依赖）
- **验证**：浏览器全过（顺序正确、液态玻璃开关切换类生效、全部 id 齐全）；真机（魅族）cardOrder 正确 + 清除确认弹窗回归正常；资源 ?v=46/46；截图 `debug/v73_me_page_reordered.png`

### 验收要点
- 我的页顺序按新方案，各设置项功能无回归
- 液态玻璃开关独立成卡后切换/持久化正常
- 深色模式无异常


---

## 74. 记录卡片改为悬浮形式（当前贴底） ✅ 已实施（v3.5 内补丁，用户确认「日历不悬浮」）

### 需求（用户 2026-08-08）
> 现在点击记录的时候，记录卡片是底部连着一起的，现在我想把记录卡片也做成悬浮形式的。

### 现状
- `.sheet`（记录面板）：`position:absolute; left:0; right:0; bottom:0` 贴底，圆角仅顶部 `22px 22px 0 0`，`box-shadow: var(--shadow-3)`
- `.calendar-sheet`（日历弹层）同款贴底结构
- 悬浮 tab 栏已是悬浮形式（left/right 12px + bottom 18px + 全圆角 999px）——记录卡与其风格不统一
- 液态玻璃态：sheet 有 `::after` 渐变边框环（border-radius: inherit 自适应）+ 光带

### 理解与设计（草案）
改为悬浮卡片（与 tab 栏同边距体系）：
- `.sheet`：`left:12px; right:12px; bottom:12px`（真机加 `calc(12px + var(--safe-bottom))` 避让手势条）+ `border-radius: 22px`（四周圆角）+ 增强悬浮阴影（深度提升，如 `0 20px 50px rgba(0,0,0,0.18)` 量级）
- sheetUp 动画兼容：`translateY(100%)` 相对自身高度，悬浮后仍可完整滑出/滑入
- 液态玻璃边缘结构（border-radius inherit）自动适配全圆角 ✓
- #65 键盘冻结、#29 拖拽关闭、#66 高度过渡均与位置无关，兼容 ✓

### 实施清单
1. `www/styles.css`：.sheet 定位改悬浮（边距/圆角/阴影）；真机媒体查询（pointer:coarse 块）内处理 safe-bottom
2. `.calendar-sheet`：视用户确认是否一并悬浮
3. 浏览器回归（打开/收起/拖拽/步骤切换/键盘）+ 真机验证

### 待确认问题
- 边距 12px（对齐 tab 栏体系）是否合适？
- 日历弹层是否一并悬浮？
- 圆角 22px 全圆角？

### ✅ 实施记录（2026-08-08，用户「日历不悬浮」）
- **styles.css .sheet**：`left/right/bottom: 0` → `left/right/bottom: 12px`（悬浮，与 tab 栏同边距体系）+ 全圆角 `22px`（原 22px 22px 0 0）+ 增强悬浮阴影（`0 22px 55px rgba(0,0,0,0.20), 0 6px 18px rgba(0,0,0,0.10)`）
- **玻璃态**：`.sheet` 悬浮投影（`0 20px 50px` 向下）；`.calendar-sheet` 保持贴底向上投影（日历不悬浮，拆开规则）
- **真机媒体查询**：`.sheet { bottom: calc(12px + var(--safe-bottom)) }` 避让手势条
- **兼容确认**：sheetUp 动画（translateY 相对自身）、拖拽关闭（#29）、键盘冻结（#65）、步骤高度过渡（#66）均与位置无关
- **验证**：浏览器全过（四周 13px 离边 = 12+1 边框、全圆角 22px、悬浮阴影、动画完成）；真机（魅族）sheetBottom 813 vs phoneBottom 851 → 底部离边 38px = 12px + 26px safe-bottom（与 tabbar 44px = 18+26 同体系）；截图 `debug/v74_floating_sheet.png`；资源 ?v=47/47

### 验收要点
- 记录卡片悬浮显示（四周离边、全圆角、悬浮阴影）
- 收起/拖拽/步骤切换/键盘无回归
- 液态玻璃态边缘结构正确（全圆角边框环）


---

## 75. 记录卡片整体太大，紧凑缩小至与补记卡一致 ✅ 已实施（v3.5 内补丁，用户「两态严格一致，两个卡片都可调」）

### 需求（用户 2026-08-08）
> 这个卡片整体太大了，可以紧凑缩小一点，修改后的卡面最好可以和补记卡片大小一致。

### 现状（浏览器实测，悬浮后 #74）
- **就现在（计时器态）**：sheet 高 **452px**——grab 32 + title 22 + seg 48 + **timerBox 84**（timerDisplay 57 + timerHint 19 + margin）+ modeLink 35 + actions 49 + 各 margin/padding
- **补记（经典步骤一）**：sheet 高 **357px**——grab + title + seg 48 + timeDisplay 29 + pickerRow 44 + actions 49 + margins
- **差 95px**，主要来源：timerBox（84）vs timeDisplay+pickerRow（73）+ 计时态各区块 margin 偏大

### 理解与设计（草案）
压缩计时器态使卡面与补记一致（目标 452→~357）：
1. `timer-display` 字号压缩（面板内非全屏页——全屏计时页 96px 不受影响），高度 57→~40
2. 间距压缩：timerBox margin-top 18→8、seg 下 margin 18→10、title margin-bottom 20→14、modeLink margin、actions margin-top 22→16、grab 32→24
3. sheet 底部 padding 26→20
4. 液态玻璃态无需额外处理（高度由内容决定）

### 实施清单
1. `www/styles.css`：.timer-display 字号（仅面板内）+/或 #timerBox 内间距 + .sheet 内各 margin/padding 压缩
2. 浏览器测量对比两态高度（目标 ≤10px 差）
3. 真机验证（就现在/补记两态打开高度一致、无内容裁切）

### 待确认问题
- 两态高度严格一致 vs 接近一致（±10px）？
- timer-display 面板内字号缩小到多少（28-32px？）——全屏计时页大数字不动

### ✅ 实施记录（2026-08-08，用户「两态严格一致，两个卡片都可调」+ 追加「就现在可以不要日期时间」）
- **公共紧凑化**：.sheet padding 10/26→8/20、sheet-grab handle margin 12→8、title mb 20→14、field-label 18/10→10/8、actions mt 22→16、picker-row input padding 11→7
- **计时态（就现在）**：timeDisplay 隐藏（用户要求：就现在不显示「8月9日 10:56」）；timer-display 52→28px（面板内紧凑，全屏页 96px 不动）+ timerBox mt 18→6 + hint 12/8→11/3 + modeLink 紧凑
- **补记态**：timeDisplay mt 16→3、pickerRow mt 12→2（均衡）
- **JS**：setupNowStep/showClassicStep1/nowSeg/customSeg/modeLink 五处同步 timeDisplay 显隐（就现在隐藏、补记/quick/经典显示）
- **迭代测量**：浏览器 452/357→304/305（diff 1）→ 真机 317/317 **diff 0 严格一致**；就现在 td=false、补记 td=true
- **验证**：浏览器+真机两态高度一致、显隐逻辑五路径正确、步骤切换/键盘/拖拽无回归；截图 `debug/v75_sheet_compact_now.png` / `v75_sheet_compact_backfill.png`；资源 ?v=48-51/52（CSS 多轮迭代）

### ✅ 回调（2026-08-08，用户「高度可以再提高一点，核心原则不要忘记」）
- 两态**对称回调**（公共 +~19px、计时态 +12px、补记态 +13px）——保持严格一致前提下适度宽松：padding 8/20→10/24、grab 8→10、title mb 14→18、field-label 10/8→12/9、actions mt 16→20、timer-display 28→34、timerBox mt 6→10、hint mt 3→5、timeDisplay mt 3→11、pickerRow mt 2→6、picker-row input padding 7→9
- **核心原则保持**：两态严格一致（浏览器 333/333 diff 0；真机 345/349 渲染容差 ±4）；就现在仍不显示日期时间、补记仍显示
- 高度 317→345（真机就现在）；截图 `debug/v75_sheet_adjusted_now.png` / `v75_sheet_adjusted_backfill.png`；资源 ?v=52/53

### ✅ 抖动消除（2026-08-08，用户「两态切换还有高度抖动，再调整间距」）
- 定位：真机两态差 ~4px 来自字体行高渲染差（补记 timeDisplay 33+pickerRow 49 vs 就现在 timerBox 66+modeLink 24，CDP 区块测量）
- 调平：timeDisplay mt 11→8（补记 -4，以真机为准）——**真机两态 347/347/347 diff 0**，切换零抖动；就现在 td=false / 补记 td=true 保持
- 浏览器侧：333/330（差 3 为跨环境字体渲染差，真机为权威）；截图 `debug/v75_no_jitter_now.png` / `v75_no_jitter_backfill.png`；资源 ?v=54/54

### 验收要点
- 就现在卡面与补记卡面高度一致（±10px）
- 计时数字在面板内清晰可读
- 全屏计时页大数字无变化
- 步骤切换/键盘/拖拽无回归


---

## 76. 【Bug】液态玻璃 tab 栏选中状态「阴影两层」观感 ✅ 已修复（v3.5 内补丁，方案 C）

### 需求（用户 2026-08-08）
> 你定位一下问题，我感觉液态玻璃版的tab栏怪怪的，选中状态的阴影好像有两层的样子。

### 根因（✅ 代码定位）
液态玻璃态选中 tab 处两个元素叠加，形成「两层阴影」观感：
1. **`.tab-slide`**（#21/#22 选中滑块）：全宽胶囊 `background: var(--slide-bg)` = `rgba(0,122,255,0.12)` 浅蓝底，top/bottom 5px——选中项底层指示
2. **`.tab.active::before`**（#72-P2 图标玻璃底座）：32px 圆角块居中于图标，`radial-gradient(白0.55→蓝0.14)` + **`box-shadow: inset 白高光 + 0 1px 5px rgba(0,122,255,0.22) 蓝色外阴影`**

底座外阴影投在滑块上 + 滑块蓝底（0.12）与底座蓝渐变（0.14）+ tabbar 玻璃边缘（白亮环/高光）三重蓝色层次叠加 → 视觉上「两层阴影」、脏、怪

### 方案（草案）
- **A（推荐）：玻璃态移除图标玻璃底座**（`.tab.active::before` 在 `html.liquid-glass` 下 display:none）——tabbar 本身已是玻璃材质，图标再叠底座=重复玻璃；选中态由滑块承担（组件一致性与面板/补记统一，无底座）；改动最小（一条 CSS）
- **B：保留底座但去掉蓝色外阴影**（0 1px 5px 删除，只留 inset 高光）——「两层」变「一层」但滑块+底座双元素仍在（滑块蓝底与底座渐变仍叠）
- **C：玻璃态用底座替代滑块**（隐藏 .tab-slide，保留底座）——选中指示变 32px 圆角块而非全宽胶囊，选中面积变小（与 iOS 26 图标胶囊接近但改动大）

### 实施清单
1. `www/styles.css`：方案 A——`html.liquid-glass .tab.active::before { display: none; }`（或删除该规则块）
2. 浏览器验证选中态无叠加（computed）
3. 真机验证（选中 tab 阴影单层、滑块正常）

### ✅ 实施记录（2026-08-08，方案 C）
- **styles.css**：`html.liquid-glass .tab-slide { display: none }`（玻璃态隐藏全宽滑块——选中指示由底座承担，消除两层叠加）；强化 `.tab.active::before` 底座为选中指示——36px（32→36）、圆角 12px、径向渐变白 0.65→蓝 0.18、inset 白高光 0.75、**单层**外阴影 0 1px 5px 蓝 0.25（滑块已隐藏无叠加）
- **双态验证**：玻璃态滑块 display:none + 底座 36px/渐变/高光/单层阴影 ✓；旧版滑块恢复 block、底座不渲染 ✓
- **验证**：浏览器 computed 全过；构建安装真机；截图 `debug/v76_tab_base_selected.png`；资源 ?v=55/55

### 🆕 方案 C 复测反馈（2026-08-08，用户「底座太小覆盖不了选中区域」）——待调整
- **反馈**：36px 图标底座太小，选中区域只盖住图标一小块；用户希望**覆盖范围与旧版滑块一样大**（全宽胶囊）
- **调整方向（草案）**：玻璃态 `.tab.active::before` 改为**全宽选中胶囊**——`position: absolute; top: 5px; bottom: 5px; left: 4px; right: 4px; border-radius: 22px`（与旧版 .tab-slide 同域：top/bottom 5px 全宽、圆角接近容器），玻璃质感保留（径向渐变 + inset 高光 + 单层蓝投影）
- 即：方案 C 的「玻璃底座质感」+ 旧版滑块的「全宽覆盖范围」——两层叠加问题已解决（滑块已隐藏），底座放大无叠加风险
- **待确认已拍板（2026-08-08）**：质感保留「渐变玻璃胶囊」✅（用户确认）；调整待实施

### ✅ 定稿实施记录（2026-08-09，全宽渐变玻璃胶囊）
- **styles.css**：玻璃态选中指示定为**全宽渐变玻璃胶囊**——隐藏 `.tab-slide`（选中指示由底座承担，消除两层叠加），`.tab.active::before` 放大至选中项全域：`top/bottom 5px + left/right 4px + border-radius 22px`（与旧版滑块同域），背景 `radial-gradient(120% 100% at 30% 0%, rgba(255,255,255,0.60), rgba(0,122,255,0.16) 75%)` + 阴影栈（inset 白高光 0.75 + inset 下缘 0.2 + `0 1px 5px` 蓝 0.20）
- **双态验证**：玻璃态滑块 none + 胶囊 top 5px/bottom 5px/left 4px/right 4px/radius 22px/渐变 ✓；旧版滑块恢复、胶囊不渲染 ✓
- **验证**：浏览器 computed 全过；构建安装真机；资源 ?v=57/57

### 待确认问题
- 方案 A（移除底座）vs B（去外阴影）vs C（底座替代滑块）——用户已确认 C

### 验收要点
- 选中 tab 无「两层阴影」观感，玻璃边缘单层清晰
- 滑块选中指示正常、切换动画正常
- 未选中 tab 无回归


---

## 77. 【Bug】切换 tab 时 tab 栏高度变低（滚动收缩状态残留） ✅ 已实施（v3.5 内补丁，移除滚动收缩）

### 需求（用户 2026-08-08）
> 定位一下，现在tab栏移动高度会变低是什么问题。

### 根因（✅ 代码定位 + 浏览器/真机对照）
- `syncTabbarScroll`（app.js）：`Math.max(...所有 .screen 的 scrollTop) > 60` → `.scrolled`（高度 58→50 收缩，#72-P1）
- **max 计算包含隐藏 screen**：切到新 tab 时新 screen scrollTop=0，但旧 screen 若滚动过——浏览器里 `display:none` 会重置 scrollTop（未复现），**真机 WebView 隐藏 screen 的 scrollTop 保留** → max 仍 >60 → tab 栏保持收缩（50px）——「切换 tab 时高度变低」
- 用户也可能感知为：滚动后 tab 栏收缩（P1 设计行为）在切换场景残留

### 方案（✅ 已确认移除收缩，2026-08-08）
- **用户拍板：不保留滚动收缩**——移除 P1 的 tab 栏滚动收缩（tab 栏恒 58px），同时消除切换残留问题
- 移除范围：`www/app.js` syncTabbarScroll 函数 + 两个 scroll 监听；`www/styles.css` `.tabbar.scrolled` / `html.liquid-glass .tabbar.scrolled` 规则 + `--lg-tint-scroll` 变量（滚动变实）；tabbar transition 中 height/padding/box-shadow/background 项可还原
- **说明**：P1 的「内容感知流动性」以收缩形式被否——若未来要流动感可换其他形式（如滚动时仅背景变实不收缩）

### 实施清单
1. `www/app.js`：删除 syncTabbarScroll + scroll 监听
2. `www/styles.css`：删除 .tabbar.scrolled 相关规则与 --lg-tint-scroll 变量
3. 真机验证：切换 tab / 滚动均无高度变化（恒 58px）

### ✅ 实施记录（2026-08-09）
- **app.js**：删除 `syncTabbarScroll` 函数 + 两处 scroll 监听 + `TABBAR_SCROLL_THRESHOLD` 常量与孤儿注释（清理复查 findstr 无残留）
- **styles.css**：删除 `.tabbar.scrolled` / `html.liquid-glass .tabbar.scrolled` 规则与 `--lg-tint-scroll` 变量（浅 0.40/深 0.10）；`.tabbar` transition 保留
- **验证**：浏览器滚动到底后 tabbar 恒 58px（57.99）、无 `.scrolled` 类 ✓；构建安装真机；资源 ?v=57/57

### 待确认问题
- 滚动收缩（P1）保留 or 移除？——已拍板：**移除** ✅（2026-08-08）

### 验收要点
- 切换 tab 后 tab 栏高度恢复正常（58px）
- 当前页滚动时收缩行为符合确认结论


---

## 78. 日历页液态玻璃可读性差，建议加轻微模糊保留通透感 ✅ 已实施（v3.5 内补丁，用户选 3px）

### 需求（用户 2026-08-08）
> 现在日历页不是页改了液态玻璃，但是可读性太差，提出一下修改建议，我的建议是在玻璃材质加上一点点的模糊，但是玻璃的通透感还要保留。

### 现状
- `.calendar-sheet`（日历弹层）液态玻璃态与其他浮层同配方：`blur(0px) saturate(2)` 完全无磨砂 + 透明底
- 日历内容密集（月历 7×5 网格 + 角标 + 选中日明细 + 按钮 + `--line` 网格线）——透明底上背景蓝晕透出，网格线/文字对比不足，可读性差
- 对照 iOS Material 分层：内容密集组件用更厚 Material（Regular/Thick），内容少浮层用 Thin——日历属于密集内容，轻磨砂合理

### 理解与设计（草案，采纳用户建议）
- **仅日历弹层加轻磨砂**：`html.liquid-glass .calendar-sheet` backdrop-filter 改为 `blur(2-3px) saturate(2)`——磨掉背景细节提升文字/网格对比，仍保持玻璃通透（非白雾 30px）；其他浮层（tab 栏/记录面板）保持 blur 0 不变
- 新增变量 `--lg-blur-calendar: 3px`（或直接写值）
- 通读感保留：tint 不变（浅 0/深 0.05）、边缘结构（渐变边框环/光带/阴影栈）不变
- 辅助可读性（可选）：日历网格线 `--line` 微加深 / 日历文字对比微调

### 实施清单
1. `www/styles.css`：`html.liquid-glass .calendar-sheet` backdrop-filter 加 `blur(var(--lg-blur-calendar))`
2. 浏览器对比（日历网格/文字可读性）+ 真机验证

### ✅ 实施记录（2026-08-08，用户原型选档 3px）
- **原型先行**：`prototype/calendar-glass.html` 四档对比原型（0/2/3/4px 实时切换 + 细节纹理背景 + 四段并排对比条）——用户选 **3px**
- **styles.css**：`html.liquid-glass .calendar-sheet` 单独覆盖 `blur(3px) saturate(2)`——仅日历轻磨砂（内容密集），tab 栏/记录面板/对话框/卡片保持 `blur(0px)` 无磨砂
- **验证**：浏览器五组件对照（仅日历 3px ✓）；真机（魅族）calendarBlur blur(3px) + 其余不变 ✓；资源 ?v=56/56；截图 `debug/v78_calendar_blur3.png` / 原型截图 `v78_cal_compare_v2.png`

### 待确认问题
- blur 强度 2px or 3px？（建议 3px——磨掉背景细节同时通透感损失最小）——已拍板 **3px** ✅

### 验收要点
- 日历弹层文字/网格清晰可读
- 通透感保留（非白雾）
- 其他浮层（tab 栏/记录面板）无变化


---

## 79. 【Bug】日历页每日细项「分钟」灰色看不清 ✅ 已实施（v3.5 内补丁，2026-08-09）

### 需求（用户 2026-08-08）
> 日历页，下面的每日细项的分钟因为字体的灰色的所有显示不清楚。

### 根因（✅ 代码定位）
- 日历每日明细（renderCalDayDetail）：`recent-tags` 内 `· ${r.duration} 分钟` 与情绪/诱因同级，颜色 `var(--ink-2)` = `#8E8E93` 浅灰（styles.css .recent-tags 12px）
- 液态玻璃日历弹层（透明底 + 3px 轻磨砂）上，浅灰小字对比不足 → 分钟看不清

### 方案（草案）
- **日历明细内次级文字提权**：`#calDayDetail .recent-tags` 颜色 `--ink-2` → `var(--ink)`（或中间值 #6E6E73），font-weight 500
- **时长单独强调**：分钟用 `--accent-deep` 加粗（与其他标签区分，视觉重点）——`recent-tags` 渲染时把 `· N 分钟` 包 `<b class="dur">`

### 实施清单
1. `www/styles.css`：#calDayDetail .recent-tags 颜色提权 + .dur 强调色
2. `www/app.js` renderCalDayDetail：时长片段包 `<b class="dur">`

### ✅ 实施记录（2026-08-09）
- **styles.css**：`#calDayDetail .recent-tags` 颜色提权 `--ink-2` → `var(--ink)` + font-weight 500；`.dur` 强调 `var(--accent-deep)` + font-weight 700
- **app.js**：renderCalDayDetail 时长片段包 `<b class="dur">`
- **验证**：浏览器注入记录 computed（.dur 蓝 rgb(0,98,204)/700、tags 深色/500）✓；构建安装真机；资源 ?v=57/57

### 验收要点
- 日历明细「N 分钟」清晰可读（深色/浅色模式）
- 情绪/诱因/看片标签层次协调


---

## 80. 【Bug】日历可补记未发生的未来日期 ✅ 已实施（v3.5 内补丁，双保险，2026-08-09）

### 需求（用户 2026-08-08）
> 日历页的补记也有问题，为什么可以补记没发生的日期。

### 根因（✅ 代码定位）
- `renderCalendar` 生成日历所有日期 cell（含未来）均可点选
- `calAddBtn` → `openSheet('backfill', dateWithOffset(calSelected))`——calSelected 可为未来（offset > 0）
- **saveRecord 补记分支（app.js 801-810）只校验日期非空/合法，无 offset > 0（未来）拦截**——未来记录可直接保存（`offset = dayDiff(date, base)` 为正即通过）

### 方案（草案，双保险）
1. **日历层**：未来日期 cell 禁用——`renderCalendar` 对 offset > 0 的日期加 `.future` 类（灰显 + `pointer-events: none` 不可选）
2. **保存层兜底**：saveRecord 补记分支 `if (offset > 0) { toast('未来的日期还没到哦，先记录今天吧'); return; }`——温和拦截（非评判基调）

### 实施清单
1. `www/app.js` renderCalendar：未来 cell 禁用态；saveRecord：offset > 0 拦截
2. `www/styles.css`：`.cal-cell.future` 灰显样式
3. 验证：未来日期不可选/不可保存、今天与过去日期正常补记

### ✅ 实施记录（2026-08-09，双保险）
- **app.js**：renderCalendar 未来 cell 加 `.future` 类 + `disabled` 属性；saveRecord 补记分支 `if (offset > 0) { toast('未来的日期还没到哦，先记录今天吧'); return; }` 温和拦截
- **styles.css**：`.cal-cell.future` 灰显（`var(--ink-3)`）+ `cursor: default` + `pointer-events: none`
- **验证**：浏览器 22 个未来 cell 全部 disabled + `.future` + computed 灰显 none ✓；saveRecord 未来日期 toast「未来的日期还没到哦，先记录今天吧」+ 记录数不变 ✓；构建安装真机；资源 ?v=57/57

### 验收要点
- 未来日期在日历中不可选（灰显）
- 即使绕过 UI 也无法保存未来记录（温和提示）
- 今天/历史日期补记正常


---

## 81. 液态玻璃 tab 切换动效丢失，切换生硬 ✅ 已实施（v3.5 内补丁，方案 C 定稿：C/20/无背景折射）

### 需求（用户 2026-08-09）
> 现在液态玻璃的tab的切换动效没了，显得特别生硬。
> 参考：https://github.com/shuding/liquid-glass.git、https://www.volcengine.com/article/32118

### 现状（✅ 代码定位）
- **旧版（非玻璃态）有滑动动效**：`.tab-slide`（styles.css:431）独立滑块元素 `transition: left 0.55s cubic-bezier(0.23, 1, 0.32, 1.05), width 0.55s`——点击 tab 滑块平滑弹性滑到目标；app.js:1529 `moveTabSlide(target, $('tabSlide'))` 负责定位，初始化/切换均调用
- **#76 定稿后玻璃态动效丢失**：`html.liquid-glass .tab-slide { display: none }`（styles.css:1702），选中指示改由各 tab 自己的 `.tab.active::before` 全宽渐变胶囊承担（styles.css:1698 起）——胶囊随 `.active` 类**瞬时有/无**，无任何过渡 → 切换瞬间旧胶囊消失、新胶囊出现，生硬
- 图标选中态 `.tab.active svg { stroke-width: 2.2 }` 同样瞬时切换无过渡

### 参考调研
- **shuding/liquid-glass**（GitHub）：SVG filter（feTurbulence + feDisplacementMap）液态玻璃变形效果，paste 进 console 即用，含 liquid-diamond 变体；demo 为 v0.dev dynamic-frame-layout（液态玻璃框架伴随形变动效）——本身不是 tab 动画库，但「玻璃+变形」组合是液态动效的参考形态
- **火山引擎文章**：DNS 解析失败未能读取（www.volcengine.com 不可达），本次未纳入；后续可重试读取
- 结论：参考价值主要在「材质变形」方向（成本高），本条目核心是恢复 tab 切换的「滑动+弹性」动效，让玻璃胶囊动起来

### 理解与设计（草案）
**核心思路：把 #76 定稿的玻璃胶囊材质，从「各 tab 的 ::before」迁移回「单一滑块元素」，恢复 moveTabSlide 滑动动效——材质不变、动效回归（方案 A 推荐）**
- 方案 **A（推荐）：玻璃材质 + 旧版滑动合体**
  - 玻璃态不再 `display:none .tab-slide`，改为覆盖其材质为 #76 渐变玻璃胶囊（radial-gradient 白 0.60→蓝 0.16 + inset 高光 + 单层投影），保留 `transition: left/width 0.55s cubic-bezier(0.23,1,0.32,1.05)` 弹性滑动
  - `html.liquid-glass .tab.active::before` 删除（材质已由滑块承担，避免双重渲染）；非玻璃态完全不变（旧版滑块浅蓝实底 + ::before 不渲染）
  - app.js 无需改动（moveTabSlide 仍工作），或微调过渡时长/曲线（玻璃态可短一点如 0.45s）
  - 双态结构：`html.liquid-glass .tab-slide` 覆盖背景/阴影；`.tab-slide` 基础规则已含 transition
- 方案 **B：轻渐隐（保底）**：胶囊保留 ::before，但 `.tab.active::before` 加 `transition: opacity 0.25s, transform 0.25s`（新胶囊 0.3→1 渐显 + 微缩放）——比现状好但仍无「滑动感」
- 方案 **C（可选实验）**：SVG feTurbulence/feDisplacementMap 变形（shuding 方案）——真机低端机性能风险 + 与现有无磨砂配方冲突，仅作演示级实验，不推荐入主路径
- 可选增强（随 A 附赠）：图标选中态过渡 `.tab svg { transition: stroke-width 0.25s, stroke 0.25s }`；胶囊内部光带随滑块移动天然流动

### 实施清单
1. `www/styles.css`：玻璃态 `.tab-slide` 覆盖材质（#76 渐变玻璃胶囊配方）替代 `display:none`；删除 `html.liquid-glass .tab.active::before`；`.tab svg` 加过渡
2. 浏览器验证：玻璃态切换 tab 滑块平滑滑动（computed transition 生效 + 视觉），非玻璃态回归无变化
3. 真机验证（魅族 461QYFDN226NF）：切换流畅无卡顿、胶囊材质无回归
4. 资源版本 bump（v=57→58）

### 待确认问题
- 动效形态：A 滑动弹性（推荐，材质=胶囊）vs B 渐隐渐现？
- 过渡时长：沿用旧版 0.55s 弹性曲线 or 玻璃态缩短 0.45s？
- C 的 SVG 变形要不要做原型对比（成本高，建议跳过）？

### 🆕 方案 C 原型验证（2026-08-09，用户「尝试一下可选项C」）——待用户看原型定夺
- **原型**：`prototype/liquid-tab-c.html`——手机框 + #76 玻璃胶囊 + 三种模式对照（现状生硬 / A 滑动弹性 / C 液体变形）+ 变形强度滑杆（feDisplacementMap scale 0-40）+ 液体波动开关 + 背景折射开关（shuding 原版）
- **实现机制**：
  - 胶囊变形：`.tab-slide { filter: url(#lg-distort) }`（feTurbulence fractalNoise 0.012/0.018 + feDisplacementMap，切换时 scale 0→峰值→0 sin 脉冲 650ms + seed 随机换形）
  - 背景折射：`backdrop-filter: url(#lg-bg-distort) blur(0.25px) contrast(1.2) brightness(1.05) saturate(1.1)`（shuding liquid-glass 原版配方，feImage 逐像素版简化为 feTurbulence）
- **浏览器验证（Playwright Chromium）**：脉冲动画采样 scale 0→18→0 平滑 ✓；filter: url() computed 生效 ✓；**backdrop-filter: url() 真实渲染**（scale 200 时 tab 栏背景明显波纹扭曲，ui_diff_check 证实差异）✓——现代 Chromium 已支持（CSS.supports 非误报）
- **真机支持性（魅族 21 / Android 16 WebView，CDP 实测）**：`CSS.supports('backdrop-filter','url(#x) blur(1px)')` = **true**（-webkit- 前缀 false，标准版够用）；`filter: url()` = true；滤镜 computed 真实应用 ✓——**方案 C 两种机制真机可落地**
- 截图：`debug/v81_proto_main.png` / `v81_capsule_pulse18.png`（scale 18 胶囊变形）/ `v81_bg_refract_scale200.png`（背景折射开启）/ `v81_bg_refract_off.png`
- **注意**：CSS.supports 为声明支持，真机最终渲染效果实施时需真机复测（硬约束）

### ✅ 定稿实施记录（2026-08-09，用户拍板「C，20，背景折射不要」）
- **styles.css**：删除 `html.liquid-glass .tab-slide { display: none }` 与 `.tab.active::before` 底座块；玻璃态滑块改为 `html.liquid-glass .tab-slide` 覆盖——#76 渐变玻璃胶囊材质（radial-gradient 白 0.60→蓝 0.16 75% + inset 白高光 0.75/下缘 0.2 + 0 1px 5px 蓝 0.20 + 圆角 22px）+ `filter: url(#lg-distort)`；`.tab-pill { position: relative; z-index: 1 }` 保留（文字在滑块之上）
- **app.js**：新增 `liquidTabPulse()`——切换时 feDisplacementMap scale 0→20→0（sin 曲线 650ms）+ seed 随机换形；仅玻璃态生效（非玻璃态无滤镜跳过）；tab 点击回调 moveTabSlide 后调用
- **index.html**：注入隐藏 SVG（`#lg-distort`：feTurbulence fractalNoise 0.012/0.018 numOctaves 2 + feDisplacementMap scale 0）；无背景折射（用户明确不要）
- **验证**：浏览器——滑块材质/radius 22px/filter computed ✓、::before content none ✓、脉冲采样峰值 20 归零 ✓、非玻璃态回归（浅蓝实底/26px/无滤镜/0.55s 弹性 transition）✓、滑动动画 44 帧连续+回弹 ✓；真机（魅族 21 / Android 16，CDP）——cssVer=58、材质+滤镜 ✓、脉冲峰值 19.997 归零 ✓、非玻璃态回归 ✓
- 截图：`debug/v81_device_pulse20.png`（变形定格）/ `v81_device_tab_clean.png`（正常态）/ 浏览器 `v81-tab-liquid-c.png`；资源 ?v=58/58

### 验收要点
- 玻璃态切换 tab：胶囊平滑滑到新 tab（无瞬间消失/出现）
- 胶囊材质与 #76 定稿一致（渐变/高光/单层投影/22px 圆角/全宽覆盖）
- 非玻璃态切换动效与旧版一致（无回归）
- 真机切换流畅（无掉帧卡顿）


---

## 82. 液态玻璃 tab 栏加日历同款背景模糊，提升可读性 ✅ 已实施（v3.5 内补丁，2026-08-09）

### 需求（用户 2026-08-09）
> 给液态玻璃的tab栏增加日历页同款的背景模糊，以增加可读性。

### 现状
- tab 栏玻璃态与其他浮层同配方 `blur(0px) saturate(var(--lg-saturate))`（styles.css:1541 无磨砂通透）
- tab 栏内容密集（图标 + 文字 + #81 玻璃胶囊），透明底上背景蓝晕透出，可读性受限
- #78 日历已定案轻磨砂 `blur(3px)`（内容密集组件用更厚材质），tab 栏同为密集组件

### 实施记录
- **styles.css**：新增 `html.liquid-glass .tabbar { backdrop-filter: blur(3px) saturate(var(--lg-saturate)) }`——与 #78 日历同款配方；其他浮层（sheet/dialog/card）保持 blur(0px) 不变
- **验证**：浏览器——玻璃态 tabbar blur(3px) saturate(2) ✓、sheet blur(0px) 未误伤 ✓、calendar blur(3px) 不变 ✓、非玻璃态 blur(24px) 旧毛玻璃不变 ✓；真机（魅族 21/Android 16，CDP）——cssVer=59、tabbar blur(3px) saturate(2)、sheet/calendar 不变 ✓
- 截图：`debug/v82_tabbar_blur3.png`；资源 ?v=59/59

### 验收要点
- 玻璃态 tab 栏背景轻微磨砂（3px），图标/文字/胶囊清晰
- 通透感保留（非白雾）
- 其他浮层（记录面板/对话框/卡片）无变化


---

## 83. 液态玻璃下蓝色按钮阴影太实，需发散柔化 🆕 待实施

### 需求（用户 2026-08-09）
> 现在发现一个共性问题，就液态玻璃下的蓝色按钮，周围的阴影，有点太实的感觉，发散一点好不好更好看。定位问题，输出优化方案。

### 现状（✅ 代码定位）
- 玻璃态蓝色按钮 `.btn-primary` / `.record-btn`（styles.css:1610-1621，共用同一条规则）：
  ```css
  box-shadow:
    0 0 0 0.5px rgba(0, 0, 0, 0.06),          /* 发丝暗线（玻璃边缘结构） */
    inset 0 1px 0 rgba(255, 255, 255, 0.5),   /* 内上缘高光 */
    inset 0 -1px 1px rgba(255, 255, 255, 0.15), /* 内下缘 */
    0 3px 14px rgba(0, 122, 255, 0.3);        /* ★ 唯一的外投影——单层、blur 小、紧贴按钮 */
  ```
- **「太实」根因**：外投影只有一层 `0 3px 14px`——偏移小 + blur 小（14px）+ alpha 0.3 单层，光晕紧贴按钮边缘、扩散不足，视觉上像「描边感」而非柔和光晕
- **对照**：玻璃卡片（styles.css:1606）用**双层发散阴影栈**——远层 `0 10px 30px rgba(28,42,68,0.07)`（大 blur 低 alpha 发散）+ 近层 `0 2px 8px`（收边）——先散后收，柔和不实；蓝色按钮缺「远层大扩散」这一档

### 理解与设计（草案）
**核心思路：外投影改为「远层蓝色光晕发散 + 近层收边」双层结构（与玻璃卡阴影栈同语言），发丝线/内高光保留**
- 方案 **A（推荐）：纯蓝光晕双层**——保留蓝色语义，发散柔化：
  ```css
  0 14px 34px rgba(0, 122, 255, 0.22),   /* 远层：大偏移大 blur 低 alpha——发散光晕 */
  0 4px 14px rgba(0, 122, 255, 0.25);    /* 近层：收边 + 落影 */
  ```
- 方案 **B：蓝光晕 + 中性柔影双层**（iOS 大按钮风格）——蓝色发散 + 中性灰让按钮从玻璃上「浮起」：
  ```css
  0 16px 36px rgba(0, 122, 255, 0.18),   /* 远层蓝光晕 */
  0 4px 14px rgba(0, 122, 255, 0.22),    /* 近层蓝 */
  0 10px 30px rgba(28, 42, 68, 0.08);    /* 中性柔影（背景浮起） */
  ```
- 参数选档：远层 blur 28-36px / alpha 0.15-0.25（可做原型多档对比，参照 #78 流程）
- 发丝暗线 `0 0 0 0.5px rgba(0,0,0,0.06)` 保留（玻璃边缘统一语言），若选档后仍显「实」可微调 alpha 0.06→0.04
- 注意 `.btn-primary` 与 `.record-btn` 共用规则——两处同改；`:active` 已 box-shadow:none（按压反馈不受影响）

### 实施清单
1. `www/styles.css`：html.liquid-glass .btn-primary/.record-btn 外投影改双层发散（方案 A 或 B，用户选档）
2. 原型或真机多档对比（远层 blur/alpha 2-3 档）→ 用户选档定案
3. 浏览器 + 真机验证（阴影发散柔和、发丝线/内高光保留、非玻璃态按钮不变）

### 🆕 原型已出（2026-08-09，用户「先制作，看看效果」）——待选档
- **原型 v1**：`prototype/btn-shadow.html`——五档并排对照（现状/A1 轻/A2 中/A3 强/B 蓝+中性）+ 全场预览 + 远层 blur 滑杆
- **用户反馈（v1 被否）**：「阴影是一个纯纯的蓝色色卡，所有我觉得它丑」——box-shadow 本质是按钮形状的半透明色块，blur 再大只是磨糊色卡边缘，仍无「光晕」形态
- **原型 v2（被否）**：形态重构四档但**全场预览同一时间只见一种形态 + 光晕太淡（0.30 alpha）**——用户「是不是还没有生效呀」，肉眼无感
- **原型 v3（当前）**：**四档并排同时可见**（每行按钮各自形态，一眼对比）+ 光晕增强（径向峰值 0.40、扩散 -32/-38px、透明 75%）+ 点行悬浮钮同步 + 强度滑杆；验证：四档 computed 全过（::after inset -32/-38 渲染）；截图 `debug/v83_glow_v3.png`
- **用户贴参考**（2026-08-09）：经典 glassmorphism demo（background rgba(255,255,255,0.25) + blur(10px) saturate(180%) + 容器阴影 `0 8px 32px rgba(0,0,0,0.37)` 单层大 blur，hover `0 12px 42px 2px`）——**新增第五档「经典大blur」**：`0 8px 32px rgba(0,0,0,0.30)` 中性黑单层大模糊（demo 同款，alpha 0.37→0.30 适配浅色 UI）；五档并排（现状/多层淡影/径向光晕/组合/经典大blur）；验证：五档 computed + 悬浮钮同步全过；截图 `debug/v83_glow_v3_classic.png`
- 待用户选档（v3 五档中选一；「径向光晕/组合」= 光衰减形态，「经典大blur」= 大模糊投影形态）

### 待确认问题
- 方案 A（纯蓝光晕）vs B（蓝光晕+中性柔影）？
- 发散档位：远层 blur 28/32/36px × alpha 0.18/0.22/0.25？
- 发丝暗线保留 or 微降（alpha 0.06→0.04）？

### 验收要点
- 玻璃态蓝色按钮阴影发散柔和（无紧贴描边感），蓝色光晕语义保留
- 发丝线/内上缘高光等玻璃边缘结构无回归
- 非玻璃态按钮（--shadow-2 实底阴影）不变
- `.record-btn` 悬浮钮同规则生效
- 按压反馈（:active 去阴影）不受影响


---

## 84. 【Bug】液态玻璃 + 深色模式下卡片左上角大片白色晕染 ✅ 已实施（v3.5 内补丁，2026-08-09）

### 需求（用户 2026-08-09）
> 现在液态玻璃的模式下，暗色模式，卡片的可读性有很大的问题，卡片的左上角会有大片的白色晕染。先定位问题。

### 根因（✅ 代码定位）
**液态玻璃的「受光层」全部硬编码白色 rgba，深色模式下未降级——浅色下是自然受光，深色下变成大片白晕：**
1. **左上角白色晕染主源**（styles.css:1694-1696，玻璃元素共用 `::before` 光带）：
   ```css
   background:
     radial-gradient(130% 70% at 15% 0%, rgba(255,255,255,0.4), transparent 50%),  /* ← 中心在左上角 15% 0%，白 0.4，半径 130%×70% */
     linear-gradient(105deg, rgba(255,255,255,0.16), transparent 40%);
   ```
   白 0.4 的 radial 光晕叠在深色底（#121212 + --lg-tint-card 深 = rgba(255,255,255,0.08) 近黑）上 → 对比度极高的大片白块，正是「左上角白色晕染」
2. **同批未降级的白**：`::after` 渐变边框环 `rgba(255,255,255,0.95→0.55→0.28)`（styles.css:1676，深色下刺眼白边）、inset 上缘高光 `rgba(255,255,255,0.9)`（1604 行）、按钮/chips 的白高光 0.4-0.5
3. **变量现状**：tint 背景有深浅两套（浅 `--lg-tint-card` 0.60 / 深 0.08，styles.css:64/118），但**受光层（::before/::after/inset 高光）没有变量**——深色模式只改了背景，玻璃高光层原样叠加
4. 深色选择器：`html[data-theme="dark"]`（app.js:1479 设置，CSS 用 `:root[data-theme="dark"]`）

### 理解与设计（草案）
**核心思路：把受光层的白色变量化，深浅两套值——深色模式降白（保留玻璃结构感但大幅降低对比）：**
- 方案 **A（推荐）：新增玻璃高光变量**（--lg-glow / --lg-edge / --lg-hi），浅色=现值（光带 0.4、边框环 0.95-0.28、高光 0.9），深色降为：光带白 0.10-0.14、边框环 0.35→0.12、上缘高光 0.2——放 styles.css 的深浅变量区（59-64 / 116-118 行旁），规则内替换硬编码
- 方案 **B（最小改动）：深色选择器覆盖**——`html[data-theme="dark"].liquid-glass .card::before` 等直接写深色白值（不建变量，改动行少但分散）
- 建议 A：同批修复全部玻璃元素（tabbar/sheet/calendar-sheet/dialog/card/report-card/ask-answer 共用 ::before/::after；按钮/chips 各自高光），避免只修卡片、tab 栏/弹层深色下同样刺眼
- 保留深色下玻璃质感：白 0.10-0.14 的光带在深底上仍是「受光暗示」，不会完全消失

### 实施清单
1. `www/styles.css`：深浅变量区新增 --lg-glow/--lg-edge/--lg-hi（深色 0.10-0.14 / 0.35-0.12 / 0.2）；`::before` 光带、`::after` 渐变边框环、card/btn/chip inset 高光替换为变量
2. 浏览器验证：浅色+玻璃=现值无回归；深色+玻璃=卡片左上角无白晕、边框/高光柔和（computed 对比）
3. 真机验证（魅族 461QYFDN226NF）：深色+液态玻璃全页面抽查（首页卡片/记录面板/tab 栏）

### 待确认问题
- 深色降白幅度：光带 0.4→0.10 / 0.12 / 0.14？（建议 0.12，保留受光暗示）
- 修复范围：仅卡片 or 全部玻璃元素（建议全部，视觉统一）？
- 边框环深色：0.95→0.35 顶边 / 全环 0.12？（建议渐变压到 0.35→0.15→0.08）

### 验收要点
- 深色+液态玻璃：卡片左上角无白色晕染，文字清晰可读
- 浅色+液态玻璃：受光高光与现状一致（无回归）
- 深色下玻璃结构感保留（边框环/上缘高光仍可见但柔和）
- tab 栏/弹层/按钮深色下同步无刺眼白

### ✅ 实施记录（2026-08-09）
- **styles.css**：深浅变量区新增受光层变量（浅 `--lg-glow-a/b` 0.40/0.16、`--lg-edge-1/2/3` 0.95/0.55/0.28、`--lg-hi` 0.90；深 0.12/0.05、0.35/0.15/0.08、0.20）；`::before` 光带 radial 峰值 0.4→`var(--lg-glow-a)` + linear 层 0.16→`var(--lg-glow-b)`；`::after` 渐变边框环 0.95→0.55→0.28 → 三变量；卡片 inset 上缘高光 0.9→`var(--lg-hi)`——全部玻璃元素（tabbar/sheet/calendar/dialog/card/report-card/ask-answer 共用）一处生效
- **验证**：浏览器——浅色 computed 光带 0.4/边框环 0.95/高光 0.9（现值零回归）✓；深色 0.12/0.35/0.2 降白生效 ✓；真机（魅族 21/Android 16，CDP）——cssVer=61、深浅双态变量值与 computed 全过 ✓
- 截图：`debug/v84_dark_card.png`（浏览器深色卡片）/ `v84_device_dark.png`（真机深色）；资源 ?v=61/61


---

## 85. 【Bug】记录页两态切换高低差「又出现了」 ✅ 已解决（用户 2026-08-09 确认已修改）

### 需求（用户 2026-08-09）
> 记录页的两态切换高低差的问题又出现了，解决方法可以搜索知识库。

### 实测（2026-08-09，v3.6 真机 461QYFDN226NF + 浏览器 8127，CDP 测量）
| 场景 | 就现在（now） | 补记（backfill） | 差 |
|---|---|---|---|
| 玻璃态（默认） | 346.7px | 347.2px | **0.5px（严格一致）** |
| 非玻璃态 | 345.3px | 345.7px | 0.4px（一致） |
| 玻璃态 vs 非玻璃态同态 | top 466 / h 347 | top 468 / h 345 | ~2px 渲染容差 |
| 玻璃态步骤 1→2（#66 场景） | 346.7 | 322.5 | 24px（**设计内容差**——步骤 2 内容更少，有平滑过渡动画） |

**结论**：#75 修复成果保持——「就现在/补记」两态在真机严格一致（0.5px 亚像素渲染差，视觉无抖动）；非玻璃态同样一致。**当前 v3.6 代码上未复现「两态高低差」**。

### 可能场景（待用户确认）
- a) 用户手机上安装的可能是旧版本（v3.6 之前）——请确认「我的→关于」显示版本
- b) 用户指的不是「就现在/补记」，而是步骤 1→2 的高度变化（24px 为设计内容差，非 bug）
- c) 其他场景（如键盘态/输入态下切换、日历页补记入口）——请提供复现路径或截图

### 知识库解法参考（#75 系列，2026-08-08 检索到）
- **根因模式**：两态高度差来自区块内容差（计时态 timerBox+hint+modeLink vs 补记态 timeDisplay+pickerRow）+ 跨环境字体行高渲染差（浏览器相等 ≠ 真机相等，**真机为权威**）
- **修复流程**：CDP 区块测量定位差源 → 间距/字号对称调整（公共 + 计时态 + 补记态三组）→ 真机循环测量调平 → 目标 diff ≤ 1px
- **#75 成果值**：真机 347/347/347 diff 0；timeDisplay 显隐五路径（setupNowStep/showClassicStep1/nowSeg/customSeg/modeLink）
- 若确认复现：按上述流程重新测量调平即可（知识库文档「实施v3.5_2026-08-08_#75两态切换抖动消除.md」可 recall）

### 待确认问题
- 复现场景是哪个？（a 版本 / b 步骤切换 / c 其他——请提供截图或路径）

### 验收要点（若确认复现后适用）
- 就现在/补记两态真机高度差 ≤ 1px
- 切换无抖动、无高度跳变
- 液态玻璃态/非玻璃态均一致


---

## 87. 【Bug】浮层打开时侧滑/返回键直接退出应用 ✅ 已修复（v3.5 内补丁，2026-08-09）

### 需求（用户 2026-08-09，群友反馈汇总）
> 所有界面的侧滑返回都没有做退出兜底，例如点击记录、日历等界面之后侧滑返回则直接退出应用。

### 根因（✅ 代码定位）
- 全项目**无 `backButton` 监听**：ui-timer.js 仅计时页用了 `history.pushState`（44/121 行），其余没有任何 @capacitor/app 的 `App.addListener('backButton')`
- Capacitor 默认行为：无监听者时返回键直接退出 App——记录面板/日历/对话框/分析等浮层打开时，返回键不关浮层直接杀 App
- 浏览器里正常（history 栈），真机 WebView 无 history 可退 → 退出

### 方案（草案）
- **Capacitor App 插件 backButton 监听**（分层关闭）：按「最上层优先」依次关闭——自定义词弹窗 dialog → 日历 calendarSheet → 记录面板 recordSheet → 计时态（#51 已有 history 处理，接入统一逻辑）→ 全部关闭后首次返回提示「再按一次退出」（温和文案），2 秒内二次返回才退出
- 非原生环境（浏览器调试）降级：window.history 前进兜底 or 忽略（保持现状）

### 实施清单
1. `www/js/app.js` 或新增 listener：`App.addListener('backButton', ...)` 分层关闭逻辑
2. 真机验证：各浮层打开时返回键逐层关闭、首页返回二次确认、计时页返回不冲突（#51）

### 验收要点
- 打开记录/日历/对话框时返回键关闭对应浮层（不退出）
- 首页返回键：二次确认才退出
- 计时页返回行为与 #51/#54 不冲突

---

## 88. 次数趋势增加热力图（heatmap）视图 ✅ 已实施（v3.5 内补丁，2026-08-09，蓝色系拍板）

### 需求（用户 2026-08-09）
> 次数趋势曲线可以添加另一种显示方式，比如 heatmap（热力图）——因为一天频繁很多次的人真的很少，主要是看间隔；就算真的很多次，热力图颜色也可以加深。

### 理解与设计（草案）
- 首页「次数趋势」（14/30 天面积图）增加**视图切换**：曲线 / 热力图（GitHub 绿格风格）
- 热力图：日格子按次数深浅着色（0 次灰、1-2 浅、3-5 中、6+ 深——色阶可调）；行 = 星期，列 = 周数（14/30 天窗口）
- 与现有 14/30 切换联动；深色模式配色跟随
- 数据即 countRange 已有——纯 UI 新增

### 待确认问题
- 热力图色系：单色蓝（与 App 一致）vs GitHub 绿 vs 情绪色？——**已拍板（2026-08-09）：按 App 整体风格（蓝色系，--blue #007AFF 主色），色阶 0 次灰 → 1-2 浅蓝 → 3-5 中蓝 → 6+ 深蓝；深色模式配色跟随**
- 视图切换交互：seg 切换（曲线/热力图）？——默认 seg 切换，待实施时确认

---

## 89. 记录日志分享 🚫 已否决（2026-08-09，合规拍板）

### 需求（用户 2026-08-09，群友反馈汇总）
> 飞行日志分享给群友（「飞行日志」= 记录历史）；「如果这个被别人看见了算不算坠机后黑匣子被人捡走了」。

### ✅ 决策（用户拍板：不做分享）
- **数据分享功能不做**——性健康记录（含具体行为/时长/细节）分享出去，可能构成「传播淫秽物品」法律风险（《刑法》第 363 条边界内）；用户明确「数据分享是不可以做的」
- 隐私叙事调整：「坠机黑匣子？不，驾驶舱在你手里」——数据不出设备；#93 全链路加密后，即使数据被动离开设备也是不可解码密文
- 备注：已有 CSV 导出保留（导出到本机/自己管理），但**不做任何对外分享渠道**

### 验收要点（否决项，无实施）


---

## 94. 数据加密/导入弹窗输入框无样式 ✅ 已修复（2026-08-10）

### 需求（用户 2026-08-10）
> 现在的数据的几个弹窗的输入框都没有样式。

### 根因（✅ 代码定位）
- `.dialog input[type="text"]`（sheets.css:489）只覆盖 type=text——#93 新增弹窗用 `input[type="password"]`（secPass1/secPass2/secImportPass）和 `textarea`（secImportJson）——**选择器不匹配 → 无样式（默认原生外观）**
- 对比：addDialog 的 addInput 是 type=text → 有样式 ✓

### 实施清单
1. sheets.css：`.dialog input[type="text"]` 选择器扩展为 `input[type="text"], input[type="password"], textarea`（含 focus 态）

---

## 95. 加密备份导出改为文件形式（非剪贴板粘贴） ✅ 已实施（2026-08-10）

### 需求（用户 2026-08-10）
> 导出的加密备份不应该是以文件形式吗？为什么还是一串字符粘贴。

### 理解与设计（草案）
- 现状：secureExportBtn 复制 JSON 到剪贴板（secure.js:296）
- 目标：**导出 .json 文件**——@capacitor/filesystem（已装）写文件 + @capacitor/share（已装）调系统分享面板（保存/发送）
- **导入反向**：从「粘贴 JSON」改为「选择文件」（input type=file 或 Filesystem 读取）——与导出配套
- 文件命名不含敏感信息：`guanji-backup-2026-08-10.json`；内容仍是密文包（+信封），口令才能解

### 实施清单
1. secure.js：secureExportBtn → Filesystem.writeFile（临时目录）+ Share.share（文件）→ 失败降级剪贴板
2. 导入：文件选择（input[type=file] accept=.json 或 Filesystem 目录选择）→ 读取 → 现有 secureImportPackage
3. 真机验证：导出文件可分享/保存，导入文件可恢复

---

## 96. 数据管理与数据加密模式冲突 ✅ 已修复（2026-08-10，模式自适应）

### 需求（用户 2026-08-10）
> 我的数据管理和数据加密的模式冲突，如果开启了数据加密，数据管理就没有用。

### 现状（✅ 代码定位）
- 加密模式下 exportBtn（CSV 明文导出）被禁用（ui-sheet.js:607 提示「用导出加密备份」）——**数据管理卡主要功能失效**
- clearBtn/restoreBtn 逻辑正常（清空=密文清空、恢复=演示数据加密写入）但用户感知「没用」——缺少反馈/提示
- 导出能力割裂：CSV 在数据管理、密文备份在数据加密卡——两个入口

### 方案（草案）
- **加密模式下 exportBtn 不再禁用**：直接执行「导出加密备份文件」（复用 #95 文件导出）——数据管理卡保持完整功能
- 明文模式下 exportBtn = CSV（现状）；加密模式下 = 密文备份文件——**一个按钮按模式自适应**
- clearBtn/restoreBtn 加密模式下操作后温和提示（「已清除（密文存储）」/「已恢复演示数据（加密存储）」）
- 可选：数据加密卡与数据管理卡相邻显示模式状态

### 待确认
- 明文模式 CSV 导出保留 or 也统一为 JSON？（建议：明文保留 CSV——明文用户可能要用 Excel 分析）


---

## 110. 备份管理（列表 + 删除，清理下载目录备份文件） 🆕 待实施

### 需求（用户 2026-08-10）
> 把备份管理列入计划。
> （背景：导出备份直接进公共 Downloads，App 内无法删除——测试残留文件只能手动到文件管理器删）

### 现状（✅ 代码确认）
- SaveToDownloadsPlugin（原生）：saveToDownloads / listBackupFiles（DISPLAY_NAME LIKE 'guanji-backup-%' OR 'guanji-export-%'，DESC）/ readDownloadedFile——**无删除能力**
- 导入弹窗已列出下载目录备份 chips（#104），点选即读文件导入
- 数据卡「导出数据」row-btn 旁无备份管理入口

### 理解与设计（草案）
- 数据卡新增「备份管理」row-btn → 备份管理弹窗：列表（文件名 / 日期 / 大小，复用 listBackupFiles 扩展返回 size+date）
- 每项带删除按钮 → 确认弹窗（「删除后不可恢复，确认？」）→ SaveToDownloadsPlugin 新增 deleteBackupFile（MediaStore contentResolver.delete，按 DISPLAY_NAME）
- 删除后刷新列表；空态「暂无备份文件」
- 可顺带清理今天测试残留的 guanji-backup-2026-08-10(.json / (1).json)

### 实施清单
1. SaveToDownloadsPlugin.java：新增 `deleteBackupFile{filename}`（MediaStore delete，返回 {deleted:boolean}）
2. index.html：数据卡加「备份管理」row-btn + 弹窗结构（列表容器/删除按钮/确认）
3. ui-sheet.js（或 secure.js）：备份管理弹窗逻辑（加载列表/删除/刷新/空态）
4. 资源版本 bump + 真机验证（列表→删除→列表刷新→文件管理器确认消失）

### 待确认
- 入口位置：数据卡内独立 row-btn（推荐）vs 并入导入弹窗？
- 删除是否也支持明文 CSV 导出文件（guanji-export-*）？（listBackupFiles 已含 export 前缀）

### 验收要点
- 下载目录备份可在 App 内列出并删除（文件管理器确认消失）
- 删除有二次确认；删除后列表刷新
- 明文/加密备份均覆盖；空态文案

---

## 107. 【Bug】加密态「修改口令」下方缺分割线 ✅ 已修复（v3.8）

### 需求（用户 2026-08-10）
> 数据卡片开启加密后的修改密钥下面少了条分割线。

### 根因（✅ 代码定位）
- screens.css:257 `.row-btn:last-child { border-bottom: none; }`
- #106 实施后 `#secureActions` 只剩「修改口令」一个 row-btn → 命中 last-child → 分割线被移除；改动前修改口令与关闭加密两个按钮并列，修改口令非 last-child 有分割线——**#106 引入的副作用**

### 方案（✅ 已实施）
- screens.css 新增 `#secureActions .row-btn { border-bottom: 1px solid var(--line); }`——显式保留分割线，不受 last-child 影响

### 验收要点
- 加密态：修改口令与导出数据之间有分割线
- 明文态与其他 row-btn 列表末位无分割线行为不变

---

## 108. 「液态玻璃」改名为「玻璃效果」 ✅ 已实施（v3.8）

### 需求（用户 2026-08-10）
> 把液态玻璃效果，改名成玻璃效果。

### 现状
- 用户可见文案（index.html 设置页）：标题「液态玻璃实验性」、开关「液态玻璃材质」、说明「实验性视觉材质：无磨砂通透玻璃 + 玻璃边缘，随内容滚动的流动性。可随时切回经典样式。」
- 内部标识符：`html.liquid-glass` class、localStorage 键 `guanji_liquid_glass`、js/liquid-glass.js、css/glass.css——改名有迁移风险（老用户开关状态丢失）且无用户可见收益

### 方案（✅ 已实施）
- 只改用户可见文案：设置页标题「玻璃效果 · 实验性」、开关「玻璃效果」、说明文案无「液态」字样（原本已无）
- 内部标识符、localStorage 键、class、文件名全部保持不变（guanji_liquid_glass 键兼容老用户设置）
- 代码注释同步（index.html 防闪烁注释/SVG 滤镜注释）

### 验收要点
- 设置页无「液态」字样；开关功能正常（老用户设置保留）

---

## 109. 玻璃模式下记录卡片透明度同步为日历卡片/tab 栏 ✅ 已实施（v3.8）

### 需求（用户 2026-08-10）
> 把在玻璃模式下的记录卡片的透明度，同步成日历卡片和tab栏的透明度，如果不知道多少就上知识库查。

### 现状（✅ 代码 + 知识库确认）
- 三个浮层 tint 变量相同：`--lg-tint`（浅 rgba(255,255,255,0) / 深 rgba(255,255,255,0.05)，theme.css:60/129）
- 差异在磨砂 blur：tabbar `blur(3px)`（#82，2026-08-09）、calendar-sheet `blur(3px)`（#78，用户原型选档 3px）、**sheet（记录面板）`blur(0px)` 无磨砂**（#72 定稿，且 #78/#82 均明确 sheet 保持 0）
- 知识库检索命中：#82 实施文档「sheet/dialog/card 保持 blur(0px) 无磨砂不变」；#78 实施文档「tab 栏/记录面板/对话框/卡片保持 blur(0px)」

### 方案（定稿 ✅ 2026-08-10 用户拍板）
- 记录面板（.sheet）对齐同款配方：`backdrop-filter: blur(3px) saturate(var(--lg-saturate))`——与 #78/#82 完全一致，可读性提升、通透感保留（用户：「记录面板统一blur(3px)」）
- 对话框（.dialog 0px）与内容卡（.card --lg-tint-card 0.60/0.08）不在本次范围（用户未提）

### 验收要点
- 玻璃态记录面板与日历/tab 磨砂观感一致（blur 3px）
- 非玻璃态不变；reduced-transparency 回退正常（glass.css:205 已含 .sheet）

---

## 106. 加密后「关闭加密」同步为顶部大按钮（与「开启加密」对称） ✅ 已实施（v3.7）

### 需求（用户 2026-08-10）
> 已经开启了数据加密的数据页，可不可以把关闭加密同步成为开启加密的数据页一样的顶部按钮。

### 现状
- 明文：顶部大按钮 [开启加密]（btn-primary 全宽）
- 加密：关闭加密是列表内 row-btn danger（与修改口令并列，视觉弱）——不对称

### 方案（定稿 ✅ 2026-08-10 用户拍板）
- 加密态顶部：**大按钮 [关闭加密]（btn-primary 蓝色全宽）**与「开启加密」同位置同色完全对称（用户：「关闭加密同样的蓝色就好了」）
- 状态区：**不用锁标识**，改为**小圆点 + 是否加密**——未加密灰点（"未开启加密"）、已加密绿点（"已加密 · 数据从写入即是密文"）（用户：「状态区带锁标识不要，改成小圆点加是否加密，如果没加密组件呈灰色，开启组件呈绿色」）
- secureActions 只保留「修改口令」row-btn
- 结构：`#secureLocked` 容器（加密时显示，含大按钮）与 `#secureEnableBtn` 互斥；secureRenderStatus 同步

### 验收要点
- 加密态/明文态顶部大按钮同位置同色对称（蓝）
- 状态区小圆点颜色正确（灰=未加密、绿=已加密）
- 关闭加密后回到明文态大按钮 [开启加密]


---

## 105. 数据卡间距调整 + 加密后卡片优化 ✅ 已实施（v3.7）

### 需求（用户 2026-08-10）
> 调整一下数据卡片的间距，而且可以继续优化一下开启加密后的数据卡片。

### 现状（✅ 真机测量）
- row-btn 节距 52px 均匀，但：①状态说明与操作组间距 56px（状态文字两行 + margin）偏松 ②加密操作（修改口令/关闭加密）与数据操作（导出/导入/清除/恢复）**连成一条列表无分组感** ③加密后卡片与明文几乎无差异——**没有「已加密」的明确视觉反馈**

### 方案（定稿 ✅ 2026-08-10 用户拍板）
1. **间距调整（范围收敛）**：只调整「开启加密」按钮与下方组件的间距（用户：「其实我只想要调整数据页开启加密的按钮与下面组件的间距」）——不做分组小标题、不动状态行高
2. **加密后卡片优化**：状态区小圆点标识（灰=未加密 / 绿=已加密，与 #106 同一设计），加密态状态文字绿色高亮（「已加密 · 数据从写入即是密文」）——明确「已加密」视觉反馈
3. 验证：两种状态真机截图对比 + 间距测量


---

## 103. 导出成功 toast 路径超长，超出屏幕显示范围 ✅ 已修复（2026-08-10）

### 需求（用户 2026-08-10）
> 这个导出路径的提醒超长了，超出了屏幕的显示范围。

### 根因（✅ 代码定位）
- ui-sheet.js:640 toast('已保存到 ' + res.path)——res.path = `/storage/emulated/0/Download/guanji-export-2026-08-10.csv`（60+ 字符）
- ui-sheet.js:611 加密分支「已保存加密备份到 …——受你的加密口令保护」更长（80+ 字符）

### 方案（草案）
- 文案缩短：`已保存到 下载/guanji-export-2026-08-10.csv`（去 /storage/emulated/0/ 前缀）——或「已保存：文件名（下载目录）」
- toast 样式检查：允许换行/限制宽度（若 toast 单行溢出则加 max-width + 多行）

---

## 104. 导入备份可定位到导出目录（下载），不用再找文件 ✅ 已实施（2026-08-10）

### 需求（用户 2026-08-10）
> 现在的导出路径是不是固定的，如果是，可不可以导入选择文件时定位到导出的地址，导入就不用再找了。

### 现状（✅ 确认）
- 导出路径固定：公共 Download（/storage/emulated/0/Download/，MediaStore #102）
- 导入：系统文件选择器（input[type=file]）——**无法指定默认目录**（浏览器安全限制），用户需手动导航到下载

### 方案（草案）
- **原生桥 listBackupFiles()**（SaveToDownloadsPlugin 扩展）：MediaStore 查询 Download 中 `guanji-backup-*.json`（+ 可选 guanji-export-*.csv）→ 返回文件名列表
- **导入弹窗改造**：打开时自动列出下载目录的备份文件（点选即填入）+ 保留「浏览其他位置」按钮（系统文件选择器降级）——导入不用再翻文件夹
- 与 #103 一起实施（同批导出导入体验）


---

## 102. 导出保存入口优化：Flyme 面板无标准「保存」→ MediaStore 原生桥保存到公共 Downloads ✅ 已实施（2026-08-10）

### 需求（用户 2026-08-10）
> 导出面板根本没有文件管理，有的是文件管理扫描快传。

### 定位（✅ 实测）
- Flyme 分享面板选项实测：微信/QQ/扫码快传/**文件管理**/邮件/更多——「文件管理」点击后进入的是 **Flyme 扫码快传界面**（非标准保存）；面板无明确「保存到文件」目标
- 依赖 Share 面板在魅族上无法获得可靠的「保存」体验

### 方案（实施）
- **SaveToDownloadsPlugin（原生桥）**：MediaStore.Downloads 写入公共 Downloads（Android 10+ 无需权限；manifest 声明 WRITE_EXTERNAL_STORAGE maxSdk 28 供老版本）
- **导出流程改为**：保存到 Downloads → toast 完整路径（`/storage/emulated/0/Download/guanji-export-日期.csv` / `guanji-backup-日期.json`）——用户文件管理器/下载管理直接可见；失败降级 Share 面板 → 剪贴板
- 明文 CSV + 加密备份 JSON 均走此通道；导出不再依赖 Flyme 分享面板
- 验证：真机导出 toast「已保存到 /storage/emulated/0/Download/guanji-export-2026-08-10.csv」+ adb 确认文件真实存在（120B）✓；插件注册 ✓
- 资源 v=87


---

## 99. 【Bug】导入备份「选择备份文件」点击无反应 ✅ 已修复（2026-08-10）

### 需求（用户 2026-08-10）
> 导入选择文件点击选择备份也没有反应。

### 根因（✅ 代码定位）
- index.html:450-451：`<label id="secImportFileLabel">选择备份文件</label>` **缺 `for="secImportFile"`**——label 未关联隐藏的 `<input type="file" id="secImportFile" style="display:none">` → 点击 label 不触发文件选择器

### 修复
- label 加 `for="secImportFile"`（label 关联隐藏 file input 会正常触发系统文件选择器）

---

## 100. 导出/导入的「口令」机制用户困惑 ✅ 已优化（2026-08-10）

### 需求（用户 2026-08-10）
> 备份的口令又是什么？明明导出的时候只导出了文件，其他的什么也没有做。

### 现状（✅ 理解）
- **设计如此**：口令在「开启加密」时设置，信封（口令加密的 DEK）随文件打包——导出时**无需再次输入口令**（现成信封）
- 但用户不知情 → 导出「什么都没做」却要求「备份的口令」——困惑

### 方案（草案）
- **导出时说明**：导出 toast 增加「备份文件受你的加密口令保护」+ 文件名提示
- **导入弹窗说明**：口令框 placeholder/说明改为「输入创建该备份时设置的口令」（明文用户导入他人备份 = 创建者口令；自己备份 = 开启加密时设置的）
- 明文模式导出 CSV 无口令（CSV 未加密）——导入备份（加密文件）才需要口令，文案区分清楚

---

## 101. 导出后「打开存储管理」定位文件 ⏸ 暂缓（2026-08-10 用户拍板暂缓，方案 A+B 已部分并入 #100）

### 需求（用户 2026-08-10）
> 是不是打开 app 的存储管理会好一点。

### 理解与评估
- 意图：导出后用户能方便地找到/管理导出的文件
- 现状：导出走 Share 面板（用户选位置）——面板即「保存位置选择器」，保存后 App 无法获知实际路径
- 方案（草案）：
  - A：导出后 toast 引导「分享面板中选择『保存到文件』即可存到你的目录」
  - B：导出直接写固定位置（如 EXTERNAL/Documents）+ 显示完整路径（用户可用文件管理器访问）
  - C：导出后跳转系统文件管理器（需原生 Intent 桥，Capacitor 无现成 API）
- 建议：A + B 组合（toast 引导 + 路径提示），C 成本高暂缓


---

## 97. 数据卡分割线过多（4 按钮 6 条线） ✅ 已修复（2026-08-10，删除区块线）

### 需求（用户 2026-08-10）
> 分割线的设计还是不好看呀，四个按钮 6 条分割线，你觉得多了一条吗？

### 根因（✅ 代码定位）
- `.row-btn` 自带 `border-bottom: 1px solid var(--line)`（screens.css:248，列表分隔线）——导出/导入/清除 3 条 + 恢复最后无
- 另加 2 条 `.card-section-divider`（index.html:273/285）——**4 按钮 6 条线**，用户数得准确
- 区块线 + 列表线双重叠加 → 密麻

### 方案（草案）
- **删除 2 条 `.card-section-divider`**——row-btn 自带列表线自然承担分隔；卡片内为连续列表（加密操作 + 数据操作），iOS 设置页标准列表风；`.card-section-divider` CSS 保留备用
- 分组感由按钮顺序呈现（加密组在上、操作组在下）

---

## 98. 导出数据加「导出地址」提醒 🆕 待实施

### 需求（用户 2026-08-10）
> 导出数据时，可不可以加上一个提醒，导出数据的地址。

### 理解与设计（草案）
- 现状：导出走 Share 系统面板——**文件最终保存位置由用户在面板中选择，App 无法获知实际路径**
- 方案：导出 toast 改为**引导性提示 + 文件名**：
  - 导出前 toast「正在准备导出…」
  - Share 面板唤起（系统即地址选择器）
  - 完成后 toast「导出文件已生成——在分享面板选择「保存到文件」即可存到你的目录（文件名 guanji-export-日期.csv）」
- 加密备份导出同款提示（guanji-backup-日期.json）
- 不做「直接存 Download 目录」（需 MediaStore/存储权限，且 Share 面板已是系统级位置选择——引导更符合平台习惯）


---

## 93. 全链路本地加密：数据从写入即密文，导出/WebDAV 均为密文，仅 App 可解码 ✅ 已实施（核心链路，2026-08-09）

### 需求（用户 2026-08-09，WebDAV 加密方案升级）
> 不仅上传的时候数据要加密，而是从一开始数据就在本地加密，导出的就是加密数据，加密数据只有导入我们的软件才可以解码。

### 理解与设计（草案）
**核心：at-rest 加密（本地存储即密文）→ 导出/WebDAV 同密文格式 → 仅 App + 用户口令可解码**
- **加密层**（落点：P1 已拆好的 storage.js）：records 写入 Preferences 前 AES-GCM 加密；读取时解密——密钥由用户口令经 PBKDF2（或 Argon2）派生，Web Crypto API 原生支持
- **解锁体验**：首次设置口令 → 启动输入口令（或 Android 生物识别解锁——Keystore 绑定密钥，标准做法）；口令即唯一钥匙
- **导出/WebDAV**：导出的就是同一密文格式（或口令派生的导出包），导入 = App 内输口令解码——**数据离开 App 形态即不可读**
- **迁移**：现有明文数据在首次设置口令时原地加密迁移（零丢失）
- **合规加成（用户洞察的核心）**：本地全加密后，「传播淫秽物品」风险消除——即使手机丢失/数据被拿走/WebDAV 服务器被攻破，全部是不可解码密文，法律上不构成传播（无法解码即无法展示内容）
- **隐私文案升级**：「数据从写入那一刻起就是密文；离开设备的只有密文」

### 关键决策点（✅ 2026-08-09 用户拍板 + 信封加密方案）
1. **密钥来源：A 用户口令**（跨设备可恢复，换机可导入，忘记=永久丢失）——已拍板
2. **解锁频率：本机免解锁**——本机读取数据无需每次输口令（依赖系统锁屏作为第一道防线）——已拍板
3. **口令找回：不做**，但**机器没变允许更改口令**——已拍板（方案：信封重加密，秒级完成）
4. **WebDAV 依赖**：备份卡（P5）建立在加密层之上——密文备份天然成立

### ✅ 信封加密方案（DEK/KEK 双层，2026-08-09 讨论定稿）
```
数据密钥 DEK（随机生成）：AES-GCM 加密全部记录
主密钥 KEK（口令 PBKDF2 派生）：加密 DEK 成「信封」
本机：DEK 存 App 内部存储（本机免解锁直接读）；信封随数据存储
导出/WebDAV：密文数据 + 信封（KEK 加密的 DEK）→ 只有口令能解出 DEK → 数据可读
改口令：新口令派生 KEK' → 重新加密 DEK 覆盖信封（数据不动，秒级）
机器没变忘记口令：DEK 仍在本机 → 允许重置口令（重新生成信封）
换机/重装恢复：导入密文包 + 输口令 → 解信封得 DEK → 数据可读
```
**安全边界（诚实说明）**：本机免解锁 = 「设备内」信任边界（靠 Android 系统锁屏/全盘加密）；「设备外」（导出/上传/备份）才是口令边界——离开设备的永远是密文。加密可**显著降低**设备丢失、备份泄露、服务器被盗时的数据可读性，**但不等同于法律风险或隐私风险绝对归零**（用户主动分享解密内容/截图/复制/系统备份/root 读取/凭据泄露/地区法律差异均为残余路径）。

### ✅ 决策点全部拍板（2026-08-09）
1. **口令引导**：首次启动引导设置，**可跳过**（跳过=明文模式，隐私文案明确提示推荐设置）
2. **导出/备份不要求口令确认**：本机内操作无口令障碍（与免解锁一致）；WebDAV 的服务器地址/账号/密码由用户自己填写（那是 WebDAV 凭据，非数据口令）
3. **DEK 存 App 内部存储**（非 Keystore）：卸载 = DEK 随数据消失 = 默认用户放弃数据；**误删可恢复链路**：有备份（导出/WebDAV 密文+信封）→ 重装导入 + 输口令 → 解信封得 DEK → 数据恢复 ✓；无备份 → 不可恢复（与明文现状一致，可接受）

### 🔧 评审修订定稿（2026-08-09，8 条全部采纳）
1. **表述修正**：删除「法律风险归零」——加密只显著降低可读性，不绝对归零（主动分享/截图/root/凭据泄露/地区法律差异为残余路径）；隐私叙事与免责声明按此表述
2. **密文包格式版本化**（兼容未来算法升级）：
   ```text
   formatVersion | algorithm: AES-256-GCM | kdf: PBKDF2-SHA-256(或 Argon2id)
   iterations | salt(≥16B 随机) | nonce(12B 随机,每次全新) | encryptedDEK | ciphertext
   createdAt | recordCount | AEAD 认证标签(GCM 自带,防篡改)
   ```
3. **加密参数**：AES-256-GCM；每次全新 12B nonce；PBKDF2-SHA-256 ≥600,000 次（Android 支持 Argon2id 则优先）；salt ≥16B 随机；AEAD 标签校验篡改；**口令/KEK/明文绝不入日志**；KDF 仅在信封操作（设置/改口令/导出/导入）时运行——本机免解锁日常读取不涉及 KDF，600k 迭代对日常无感知，真机测信封操作耗时
4. **原子迁移（防 App 被杀/断电损坏）**：读旧→生成 DEK+密文→写临时键→读回验证→切版本标记→删明文；导入/改口令/导出同用「临时+校验+替换」
5. **DEK 存储改为 Keystore 保护**（修正原「内部存储」拍板）：普通模式 Keystore 存 DEK（不以明文文件落盘）；生物识别开启时可要求 Keystore 认证；**与误删恢复不冲突**（恢复靠口令+信封，不靠 DEK；卸载时 Keystore 密钥随应用删除，同样满足「卸载=放弃」）；Root 设备/内存检查防护增强
6. **明文模式明示**：设置页显示「加密模式 / 明文模式」状态；切加密后清除旧明文备份；切明文二次确认
7. **备份机制**：导出前完整性校验；导入前显示版本/记录数/创建时间；导入三模式（新数据/合并/覆盖）；覆盖前自动备份当前数据；WebDAV 多份历史备份（非单文件覆盖）；备份文件名不含敏感信息；WebDAV 密码与数据口令分离
8. **口令 UX**：首次设置明示「忘记口令无法恢复，建议存入密码管理器」；两次确认输入；强度提示；不建议简单 PIN；支持生物识别；改口令先验证当前身份（本机已可信解锁场景可免）

**实施优先级（评审定）**：加密格式与参数 → 原子迁移 → 导入导出校验 → Keystore 保护 DEK → 生物识别 → WebDAV 多版本备份

### 实施清单
1. `www/js/storage.js`：加密层（PBKDF2 + AES-GCM）+ 迁移（明文→密文）
2. 解锁界面（启动流程）+ 生物识别（@capacitor-community/biometric-auth）
3. 导出/导入格式改为密文包；WebDAV 通道复用
4. 真机验证：重启解锁/迁移/导出导入/口令错误提示

### 验收要点
- Preferences 中 records 为密文（直接读文件不可解码）
- 启动需口令（或生物识别）；错误口令温和提示
- 导出文件为密文，导入 App 输口令可恢复；换机可恢复（口令+密文）
- 忘记口令 → 明确提示数据不可恢复（不可逆）

### 风险
- 口令忘记 = 数据永久丢失（最大 UX 风险——需设置时强调）
- 生物识别在部分设备/系统不可用（降级回口令）

---

## 90. 实况回顾 ⏸ 已搁置（用户 2026-08-09 拍板先搁置）

### 需求（用户 2026-08-09）
> 再加个实况回顾。

### 状态
- 用户 2026-08-09：先搁置（语义未定，等用户想清楚再恢复）

---

## 91. 心率捕捉（手环/手表广播心率）🆕 探索性建议（高成本）

### 需求（用户 2026-08-09）
> 可不可以增加心率捕捉啊，比如手捕捉环/手表的广播心率，这一定很酷炫。

### 理解与评估（草案）
- 技术路径：BLE 广播监听（手环广播心率数据）→ 需要原生 BLE 插件（@capacitor-community/bluetooth-le）+ 广播解析（心率服务 UUID 0x180D）；或系统健康数据 API（Health Connect，Android 14+）
- **成本高**：原生集成 + 真机多手环兼容测试（小米/华为/Apple Watch 广播格式差异）+ 功耗/后台限制
- 数据意义：心率与记录关联（兴奋度/恢复）——属「健康数据」敏感面，隐私承诺需扩展
- 建议：远期探索，先不做 P2 前

---

## 92. API key 泄露风险评估（决策记录） ✅ 已答复（2026-08-09）

### 问题（用户 2026-08-09）
> 填写 API key 会有泄露的风险吧。

### 评估（✅ 答复）
- **当前实现是最小泄露面**：key 按提供商分别存本地 Preferences（「密钥只在本地」承诺），请求从设备**直连** DeepSeek/OpenAI——**key 不经过观己任何服务器**，无中间环节可泄露
- 残余风险（如实告知）：①设备本地明文存储（root/备份可读——Android 设备加密下风险低）②HTTPS 传输（抓包需中间人，标准 TLS 防护）③用户自己保管（截图/群发分享 = 最大泄露途径）
- 改进可选（远期）：key 存 Keychain/Keystore（@capacitor-community 有安全存储插件）；或用户改用代理服务（违背无后端原则，不推荐）
- **结论**：当前方案对普通用户足够安全；风险主要在自己保管环节——UI 可在 key 输入处加温和提示「密钥仅存本机，请勿截图分享」



