# 观己 · 既有规则复用索引

> 用途：任何新方案、原型、Bug 修复或实施开始前，先检索本文件。
>
> 原则：**先找到最接近的已验证规则，再决定如何复用；不能因为实现更快就新建一套同类规则。**
>
> 本文件记录的是当前代码已存在且可复用的规则，不是新的视觉或产品提案。各规则的最终事实来源仍是对应代码文件。

## 0. 方案生成的强制流程

### 0.1 复用优先级

按以下顺序寻找实现，不得跳级：

1. **同一用户任务的现有流程**：例如“记录 → 记录详细页”的 Sheet 状态切换和高度过渡。
2. **同类交互的通用函数或结构**：例如通用 Sheet 打开/关闭、分段滑块、固定 footer、备份列表。
3. **同一视觉语义的基础样式**：例如 `.sheet`、`.card`、`.row-btn`、`.chip`、`.switch-row`。
4. **主题变量与横切层**：颜色走 `theme.css`，玻璃态走 `glass.css`，真机适配走 `responsive.css`。
5. **仅当以上均不能满足时才新增规则**。

### 0.2 每份方案必须先写的“复用映射”

在描述新设计前，先给出下表。没有明确映射，不进入实施。

| 新需求元素 | 必须复用的现有规则 | 代码位置 | 是否需要扩展 |
| --- | --- | --- | --- |
| 示例：恢复详情 | `transitionSheetHeight()` + `.sheet.details-active` | `ui-sheet.js` / `sheets.css` | 仅增加恢复流程状态 |

### 0.3 新增规则的例外门槛

只有同时满足下面三项才可以新增：

1. 已检索本文件并说明没有等价规则；
2. 现有规则无法通过参数、状态或轻量变体安全扩展；
3. 方案中明确写出新增规则的职责、调用入口、影响范围、替代关系和删除条件。

禁止只为“看起来相似”而新建第二套：遮罩、Sheet、圆角、阴影、滑块、滚动容器、动画时序、状态点、z-index 或数据转换规则。

### 0.4 实施前检查

- [ ] 新 UI 是否已有同语义 class 或 HTML 结构？
- [ ] 新交互是否已有函数可调用或泛化？
- [ ] 新颜色、间距、圆角、阴影是否全部来自变量或既有 token？
- [ ] 玻璃态是否只在 `glass.css` 添加覆盖，而非散落在业务 CSS？
- [ ] 真机窄屏、键盘、安全区、减少动效是否继承既有规则？
- [ ] 是否避免了新遮罩层、重复 z-index、重复缓存状态或重复数据映射？

---

## 1. 视觉基础规则

### 1.1 主题 token：唯一颜色与材料来源

**来源**：`www/css/theme.css`

| 语义 | 必须使用 | 不应自行硬编码 |
| --- | --- | --- |
| 页面底 / 提升底 / 卡片底 | `--bg` / `--bg-elev` / `--card` | 白色、灰色背景值 |
| 三层文字 | `--ink` / `--ink-2` / `--ink-3` | 新的黑灰色阶 |
| 主操作 / 强调 / 柔和强调 | `--accent` / `--accent-deep` / `--accent-soft` | 新蓝色、单独透明蓝 |
| 成功 / 提醒 | `--sage` / `--sage-soft` / `--amber` | 新绿、黄、红状态色 |
| 分隔 / 阴影 / 圆角 | `--line`、`--shadow-1` 至 `--shadow-4`、`--radius-md/lg` | 页面局部独立阴影、圆角 |
| 安全区 / 动效 / 字体 | `--safe-top` / `--safe-bottom`、`--ease-spring`、`--font` | 单页字体栈、硬编码安全区 |

- 深色模式由 `:root[data-theme="dark"]` 重写同一组变量。任何新组件默认必须同时正确适配深色模式。
- `--bg-glow-*`、`--lg-*`、`--heat-*`、`--ring-*` 和 `--timer-bg-*` 也是主题 token，不在业务样式中复制其实际色值。

### 1.2 设计语言：层级、间距与信息密度

**来源**：`DESIGN-LANGUAGE.md`，实际视觉实现见 `theme.css`、`components.css`、`screens.css`。

- 信息层级：主强调蓝 → 主文字深色 → 次/弱文字灰；不额外制造“第四层”颜色。
- 常用节奏：大节奏 `40px`、区块 `24px`、标题到控件 `12px`；具体组件已有规则时，以组件规则优先。
- 移动端界面优先用留白表达分组；不要为了分组额外加大量横线。
- 设置卡遵守低密度原则：单卡内容明显超过 6 个独立元素时，优先按用户任务拆分。
- 所有可操作元素应保持明确文字/图标语义和约 `44px` 的可触达区域。

### 1.3 液态玻璃：横切层，不是新组件

**来源**：`www/css/glass.css`、`www/js/liquid-glass.js`

- 基础组件先在其所属 CSS 文件定义经典态；玻璃态**只**在 `glass.css` 以 `html.liquid-glass` 前缀覆盖。
- 已有材料层级：
  - L0：计时全屏/汇总全屏，不加入玻璃；
  - L1：`tabbar`、记录 Sheet、日历 Sheet；
  - L2：`dialog`；
  - L3：`card`、`report-card`、`insight-module`、`ask-answer`；
  - L4：主按钮、选中 chips。
- 玻璃结构复用现有受光层、边缘环、内高光和阴影栈；禁止为某张卡单独制作另一套“玻璃阴影”。
- 备份与恢复任务卡片（`.backup-source-action`、`.backup-sync-switch`、`.primary-card`、`.history-list`）在液态玻璃模式复用 L3 内容卡配方；`.history-row` 保持透明内容行，固定 `.backup-panel-footer` 复用记录页 footer 的透明延续语义。经典态与 reduced-transparency 仍回退 `var(--card)`。
- 只要组件的玻璃 `::before` / `::after` 受光层使用 `z-index: 2`，可读内容层必须显式使用 `position: relative; z-index: 3`；标题区、卡片内容和固定操作区按需提权，禁止把文字留在伪元素下方。备份/恢复面板已按此规则接入，后续新玻璃卡片优先复用该内容层规则。
- 不把 `backdrop-filter` 放在持续移动元素上；系统要求减少透明度时回退 `var(--card)`。

### 1.4 响应式与无障碍是默认约束

**来源**：`www/css/responsive.css`、`www/js/app.js`（键盘布局）

- `pointer: coarse` 的真机始终使用铺满画布；不要用单纯 `max-width` 判断手机。
- Sheet、tabbar、screen 底部均使用 `--safe-bottom`；新浮层不得自己猜测手势条高度。
- `prefers-reduced-motion: reduce` 已统一将动画/过渡压缩到极短时长；不得绕过该规则。
- `prefers-reduced-transparency: reduce` 已有实底回退；新玻璃组件必须加入同一回退语义。
- 键盘存在时复用 `isKeyboardUp()` / `syncKbLayout()` 与 `body.keyboard-up`，不要以固定屏幕高度判断键盘。

---

## 2. 通用 UI 结构与组件

### 2.1 页面、卡片与设置行

| 需求 | 复用规则 | 位置 | 使用边界 |
| --- | --- | --- | --- |
| 常规信息容器 | `.card` / `.report-card` / `.insight-module` | `components.css`、`screens.css` | 根据内容语义选已有 class，不克隆“新卡片” |
| 设置入口行 | `.row-btn` + `.row-sub` + 既有 chevron | `screens.css`、`index.html` | 行是“进入/执行任务”，不是伪下拉框 |
| 设置开关 | `.switch-row` / `.switch` | `screens.css` | 与行共享同一组间距、状态与 hairline 语言 |
| 状态 | `.dot` / `.state-line` | `screens.css` / `docs/DESIGN.md` | 一处状态只保留一个主要状态点，避免重复 |
| 主/次/危险操作 | `.btn-primary` / `.btn-ghost` / `.btn-danger` | `components.css` | 主按钮蓝色，危险操作仅在明确危险场景使用 |
| 空状态 | `.empty` | `components.css` | 不自行拼出不同版式空状态 |

**设置页分隔规则**：同一个“行列表”可使用统一 hairline；卡片之间、功能组之间优先用留白。不要在同一页面让相同任务层级的一部分有线、一部分无线。

### 2.2 标签、分段控件与滑块

| 需求 | 必须复用 | 位置 |
| --- | --- | --- |
| 多选标签 | `.chip` + `renderObservationChips()` / `normalizeObservationValues()` | `sheets.css`、`ui-sheet.js`、`storage.js` |
| 添加自定义标签 | `makeAddChip()` 与既有添加/删除弹窗 | `ui-sheet.js` |
| 时间/主题/图表单选 | `.seg` + `.seg-slide` + `moveSegSlide()` / `initSegSlide()` | `sheets.css`、`ui-home.js` |
| Tab 选择 | `.tabbar` / `.tab` / `.tab-slide` + `moveTabSlide()` | `tabbar.css`、`app.js` |
| 玻璃态 Tab 反馈 | `liquidTabPulse()` | `app.js` |

- 标签数据必须存稳定 key，不存只会随文案变动的展示文字。`storage.js` 的 `observationKeyFromValue()`、`observationLabelFromValue()`、`normalizeObservationValues()` 负责新旧兼容与互斥规则。
- `unsure`（界面文案“原因不确定”）是可并存的不确定性标记；`none`（界面文案“没有明显情绪/诱因”）只与同一状态维度互斥，可与时段、环境和不确定性标记并存。新增标签不得绕过 `normalizeObservationValues()`。
- 新的单选任务先判断是分段控件还是设置行，不把普通跳转按钮伪装成 seg 或下拉控件。

### 2.3 Sheet、弹窗与全屏页：按任务层级选择

| 场景 | 复用结构 | 关键规则 |
| --- | --- | --- |
| 记录、日历等主任务 | `.backdrop` + `.sheet` | 悬浮卡片、统一安全区、拖拽/点击遮罩关闭 |
| 任务型 Sheet（备份/恢复等） | `.backdrop--sheet` + `.sheet--task` + `.sheet--fixed-footer` + `sheet__header/body/footer` | 同一套悬浮几何、内容滚动、固定 footer |
| 简短确认/添加 | `.backdrop.dialog-layer` + `.dialog` | 居中、键盘可见区适配，不用于复杂多步骤任务 |
| 计时运行/汇总 | `#timerScreen` | 全屏沉浸任务，不加入普通 Sheet/玻璃层 |

选择规则：

- 用户在同一个任务中继续填写、选择、返回时，优先使用**同一个 Sheet 内的状态切换**。
- 只有独立任务才新开一级 Sheet；不得为了显示下一步而叠第二层 backdrop。
- 弹窗交互元素不宜超过 3 个；复杂文件管理、恢复、表单不退回 dialog。
- `z-index` 沿用现有层级：基础遮罩 20、Sheet 30、toast 50、全屏计时 60、dialog layer 70。新增层级必须说明为何现有层级不能表达。

### 2.4 固定 footer 与内容滚动

**来源**：`www/css/sheets.css` 中 `.sheet.details-active`、`.sheet-content-scroll`、`.sheet-actions`、`.sheet--fixed-footer`。

- 内容短：Sheet 自然收紧，不人为填满高度。
- 内容长：外层高度受安全区约束，只有内容区滚动；操作区固定可见。
- 详情态须先调用 `updateDetailsScrollState()`，由真实 `scrollHeight/clientHeight` 决定是否可滚动；不以标签数量等猜测。
- 不为了固定按钮新增另一个容器、绝对定位或独立底部规则。

---

## 3. 动画与手势复用规则

### 3.1 Sheet 生命周期

**来源**：`www/js/ui-sheet.js`

| 需求 | 函数/规则 | 不应新增 |
| --- | --- | --- |
| 记录 Sheet 打开 | `openSheet()` → `playSheetOpen()` | 新的上滑/回弹实现 |
| 通用任务 Sheet 打开/关闭 | `openSheetPanel()` / `closeSheetPanel()` | 单个功能的自制开关动画 |
| Sheet 关闭 | `animateSheetClose()` | 新的下滑、淡出时序 |
| 清除上次残留 | `resetSheetStyle()` | 在调用点零散清 `transform` / `transition` |
| 拖拽关闭 | `initSheetDrag()` | 新的横向或底部手势逻辑 |

- `playSheetOpen()` 使用 `anime` 时从底部进入并带克制回弹；缺少库或系统减少动效时由 CSS 回退处理。
- `animateSheetClose()` 负责关闭时的动画与状态清理；隐藏 DOM 应在其回调中完成。
- 任何新任务 Sheet 都应先尝试接入 `openSheetPanel()` / `closeSheetPanel()`，而非复制 CSS keyframes。

### 3.2 同一 Sheet 的“步骤 → 详情”动画

**来源**：`transitionSheetHeight()`、`goToDetails()`、`goToTime()`（`www/js/ui-sheet.js`）

这是项目中已验证的“同任务继续”的标准转场：

```text
测量旧 Sheet 完整高度
  → 切换内容、滚动区和底部操作区状态
  → 读取新内容的自然高度
  → 固定为旧高
  → 下一帧过渡到新高（220ms）
  → transitionend 清理内联样式并重新检查滚动
```

- 适用于：同一任务下的来源 → 详情、填写步骤 → 详细填写、状态页 → 可逆详情。
- 不适用于：独立一级任务、全屏计时、需要离开当前上下文的页面。
- 不得把它替换为“视觉上差不多”的横向滑入、第二遮罩、第二张卡片或独立 z-index。
- 回退同样使用这套函数反向过渡；关闭任务才使用 `animateSheetClose()`。

### 3.3 轻量交互反馈

- 主按钮和记录按钮：已有 `:active { transform: scale(.97) }`。
- 设置行：已有轻量按压反馈；不叠加夸张弹跳。
- 开关：轨道/knob 使用 `0.2s` 过渡。
- Tab 滑块：已有弹性位置跟踪；玻璃态附加液体脉冲，非玻璃态不强行启用滤镜。
- 新内容替换时先优先复用容器高度或已有状态切换；只有确有必要才增加内容级淡入，且不得与 Sheet 进入动画叠加造成双重运动。

---

## 4. 业务流程与数据规则

### 4.1 记录模型与兼容性

**来源**：`www/js/storage.js`、`www/js/records.js`

- 全局记录入口是 `Storage.loadRecords()` / `Storage.saveRecords()`；加密模式由 `secure.js` 在内部处理，调用方不得绕过。
- 新记录通过 `saveRecord()` 写入，并由 `afterRecordsChanged()`、`renderHome()`、小组件同步等既有链路更新界面。
- 日期以 `dateKey` 为准，并由 `normalizeOffsets()` 保持旧 `offset` 兼容；新增记录/导入逻辑不得只依赖相对 offset。
- 发生前状况使用 `observations` 稳定 key；旧 `observation`、`moods`、`triggers`、`media` 仍需通过既有映射兼容，禁止批量改写历史原始数据。
- 成人内容相关的新展示名为“成人内容影响”，但 CSV/旧记录仍兼容历史命名。

### 4.2 两套记录入口的汇合规则

| 入口 | 现有流程 | 汇合点 |
| --- | --- | --- |
| 直接填写 / 补记 | `openSheet()` → `goToDetails()` → `saveRecord()` | 统一记录模型与发生前状况 |
| 就现在计时 | `startTimedRecord()` → 全屏计时 → `finishTimedRecord()` → `showTimerSummary()` → 保存 | 统一记录模型与发生前状况 |

- 不在两个入口分别发明标签、时长、保存或统计逻辑。
- 计时中关闭/返回表示取消计时，已有 `cancelTimer()` / `cancelFromTimerScreen()` 语义；不要通过隐藏 UI 代替状态清理。

### 4.3 统计、洞察与 AI 边界

**来源**：`www/js/stats.js`、`www/js/ai.js`、`www/js/ui-home.js`

- 本地统计优先复用 `countRange()`、`hourOf()`、`countStreak()`、时间桶和首页渲染函数；不要在单卡片里手算另一份口径。
- 洞察页本地事实由 `renderInsightLocal()` 生成；六张卡片及其 AI 观察沿用既有卡片渲染和触发规则。
- AI 只使用 `buildAggregatePayload()` 产生的聚合数据；不得将单条记录的时间、备注或完整时间线加入请求。
- AI 文案保持中性、非羞耻化，不能做露骨内容、心理/医疗诊断或确定性因果判断。
- 每日话语遵循现有“AI 可选增强、本地话语回退”链路，不能因为洞察页调整而破坏首页回退。

### 4.4 AI 设置与提供商配置

**来源**：`www/js/ui-sheet.js`、`www/js/ai.js`

- 提供商配置按提供商分别保存与回显；DeepSeek、OpenAI 和自定义都可展示 Base URL，默认值由既有配置提供。
- 连接测试与保存是不同动作，不能把“测试成功”当作已保存。
- 保存态遵循既有“AI 已配置 / 编辑”收纳语义，不为某一个提供商单独造一套字段显示规则。

### 4.5 加密、导入导出与 WebDAV

**来源**：`www/js/secure.js`、`www/js/webdav.js`、`www/js/backup-picker.js`

- 加密数据路径只使用 `secure.js` 的信封、口令、导入/导出接口；不直接读写密文格式。
- WebDAV 仅在加密模式下可用；未加密/未配置/离线/失败均应复用现有状态文案和降级反馈。
- 备份列表统一复用 `backup-picker.js`：最新备份突出，更早条目有限高度内滚动，操作 footer 固定。
- “立即上传新备份”当前仅上传服务器；不擅自改成“本机加服务器双副本”。
- 自动同步已有冷启动、回到前台、网络恢复、数据变化、去重与重试逻辑；只调整文案或入口时不得破坏触发条件。

**v3.46 文件名与来源标识规则（#185）**

- 新生成文件统一调用 `buildGuanjiFilename()` / `uniqueGuanjiFilename()`（`www/js/storage.js`），格式为 `guanji-类型-YYYY-MM-DD-HH-mm-ss.ext`。
- `secure`、`plain`、`server`、`restore` 分别表示本机加密、本机明文导出、服务器备份和恢复前保护副本；同秒冲突追加 `-2`、`-3`。
- 旧前缀只读兼容并继续出现在列表中；不得批量改名、删除或改变密文/CSV 内容。

**v3.46 备份与恢复状态规则（#184）**

- `backupSyncBackdrop` 是唯一父 Sheet；首页、本机管理、服务器管理、恢复来源和恢复详情通过 `setBackupHubView()` 切换。
- 管理状态返回首页，恢复详情返回来源，来源返回首页；只有首页关闭才退出到“我的”。所有状态沿用 `transitionSheetHeight()`、固定 footer 和现有安全区。
- 服务器管理在业务上独立，但不再创建第二个遮罩或平行一级 Sheet；入口与列表数据流继续复用 `loadWdManage()`、`backupPicker` 和已有 WebDAV 接口。

**v3.46 观察维度规则（#186）**

- `normalizeObservationValues()` 是所有记录入口的唯一归一化入口。普通观察可多选；`unsure` 可与任何普通事实并存；`none` 只清除同一 `state` 维度的标签。
- 统计与 AI 聚合使用稳定 key，过滤自定义/旧原文；旧 CSV 的情绪、诱因列在统一观察列为空时回退映射。

---

## 5. 页面与原生能力复用

### 5.1 首页、洞察、日历、我的

| 页面 | 主要复用入口 |
| --- | --- |
| 首页 | `renderHome()`、`renderChart()`、`renderHeatmap()`、`renderAreaChart()`、`renderRingDist()`、`renderRecentRecords()` |
| 洞察 | `renderInsightLocal()`、AI 卡片渲染、既有免责声明与生成触发 |
| 日历 | `openCalendar()`、`renderCalendar()`、`renderCalDayDetail()`、`closeCalendar()` |
| 我的 | 既有 `.card`、`.row-btn`、`.switch-row`、`refreshMeSegs()`、各功能的 `init*UI()` |

页面切换由 `app.js` 的 tab 绑定统一处理。新增入口先接入对应屏幕或现有 Sheet，不另建平行页面切换机制。

### 5.2 Android / Capacitor

**来源**：`android/app/src/main/java/com/guanji/app/`、`capacitor.config.json`

- Web 层调用原生能力前先查现有 Capacitor 插件：安全存储、文件系统、分享、通知、App 生命周期，以及项目自定义的桌面小组件和计时实况通知插件。
- 计时通知、魅族实况通知、Android Live Updates 的检测与降级必须共用已有能力链；不要仅按一个厂商或 Android 标准单独判断“是否支持”。
- 原生功能改动需同时考虑 WebView 冷启动、前后台切换、App 被杀恢复、设备厂商差异与权限状态。

### 5.3 跨平台品牌图标资源

**来源**：`www/assets/guanji-icon-01c.svg`、`www/index.html`、`android/app/src/main/res/`

- 01-C 的几何构图、玻璃切片层次和配色是跨平台视觉基准；Android 启动器继续使用自适应图标与各密度 PNG 管线。
- WebView 内的“观己介绍”与 favicon 统一引用 `www/assets/guanji-icon-01c.svg`，不再各自维护内联 SVG。
- Web 资源保留透明圆角安全区，不能直接把 Android `mipmap` 成品图当作 Web 图标；不得改变启动器安全区来适配网页小尺寸。
- 适用：关于卡片品牌区、favicon 和其他需要 Web 品牌识别的静态入口。不适用：Android 自适应图标蒙版、通知图标或需要单色语义的系统图标。
- 验证：浏览器检查资源与尺寸、390px 窄屏、浅/深主题、真机 WebView 截图；同时确认 Android 启动器资源未被 Web 资源替换。

---

## 6. 启动、关闭与状态管理

### 6.1 启动顺序不可随意调整

**来源**：`www/index.html` 脚本顺序、`docs/component-inventory.md`、`www/js/app.js`

当前 JS 依赖顺序：

```text
backup-picker → secure → storage → records → stats → ai
→ ui-home → ui-timer → ui-sheet → ui-calendar → liquid-glass → webdav → app
```

- 顶层执行文件会调用后续模块提供的函数；调整顺序前必须完整检查调用关系。
- 新代码优先进入职责已有的文件；不要仅因方便把业务逻辑都放进 `app.js`。
- `app.js` 负责绑定、键盘与启动编排；它不是新业务逻辑的默认落点。

### 6.2 Android 返回键与遮罩关闭顺序

**来源**：`handleBackButton()`（`www/js/app.js`）

已有关闭优先级：自定义词弹窗 → AI 数据说明 → 删除确认 → 数据管理确认 → 本机文件管理 / 服务器管理 / 导出数据（独立任务） → 备份与恢复（在同一 Sheet 内逐级返回） → 日历 → 全屏计时 → 记录 Sheet → 二次返回退出。

- 新弹层接入时必须声明其层级，并插入正确的关闭优先级。
- 不新增“后台仍存在的隐藏遮罩”；每次关闭应清理对应状态、焦点、动画内联样式和必要的临时选择。

**备份任务关闭规则（v3.46 已验证）**

- 调用入口：`handleBackButton()`（`www/js/app.js`）与 `backupHubBack()`（`www/js/ui-sheet.js`）。
- 适用：备份与恢复的首页、本机文件管理、服务器备份管理、恢复来源、本机恢复和服务器恢复；后退按“管理/来源 → 首页 → 关闭”或“详情 → 来源 → 首页 → 关闭”逐级回退。导出数据仍是独立任务。
- 不适用：记录 Sheet、日历、确认 Dialog 与全屏计时；它们仍按自身已有关闭语义处理。
- 验证方式：v3.46 真机 CDP 已覆盖同一父 Sheet 内的本机/服务器管理、恢复来源 → 本机/服务器恢复、所有返回目标与无旧管理遮罩。

---

## 7. 验证与发布复用

### 7.1 浏览器与真机验证链

**来源**：`debug/`、README、历史实施记录。

- 前端改动先做 `node --check` 与浏览器回归；使用缓存参数避免 WebView 读到旧资源。
- 真机优先走现有 CDP 链：`adb forward` → WebView DevTools → WebSocket 脚本做 DOM 级检查；截图以 `adb shell screencap` 后 `adb pull` 保存，避免 PowerShell 二进制重定向。
- UI 变更至少验证：浅/深主题、窄屏、安全区、长内容、键盘、返回键、动效降级和不影响现有数据。
- 发布时复用既有 Capacitor 同步、Gradle JDK 21 构建、覆盖安装和版本/cache 参数更新流程。

### 7.2 版本与缓存纪律

- Android `versionCode` 和 `versionName` 按发布规则同步更新。
- `www/index.html` 的所有 CSS、模块 JS `?v=` 缓存参数必须整体更新，不能只更新本次修改的单个文件。
- 版本变更、功能说明和实施状态同步写入 `CHANGELOG.md` 与 `IMPROVEMENTS.md`；实施记录使用唯一文件名。

---

## 8. 历史反例：#183 恢复流程

v3.44 的 #183 首次实现曾新增横向二级页、第二层遮罩和 `z-index: 71`，虽然功能可用，但没有复用既有的“记录 → 记录详细页”高度过渡。这是**不应重复的历史反例**；v3.45 已按下述规则返工完成。

已确认的返工方向：

```text
恢复来源
  → 同一张 Sheet 内切换内容
  → transitionSheetHeight()
  → 本机恢复 / 服务器恢复
  → 同一函数反向回到来源
```

服务器备份管理保留业务上的独立状态，但复用 #184 的唯一父 Sheet，不再创建平行遮罩。详见 `IMPROVEMENTS.md` 的 #183/#184。

---

## 9. 快速检索词

| 想做什么 | 先检索 |
| --- | --- |
| 新卡片 / 设置区 | `.card`、`.row-btn`、`.switch-row`、`DESIGN-LANGUAGE.md` |
| 新 Sheet / 固定按钮 | `.sheet`、`.sheet--task`、`.sheet--fixed-footer`、`openSheetPanel()` |
| 同任务下一步 / 返回 | `transitionSheetHeight()`、`goToDetails()`、`goToTime()` |
| 打开/关闭/拖拽浮层 | `playSheetOpen()`、`animateSheetClose()`、`initSheetDrag()` |
| 标签 / 多选 / 自定义项 | `OBSERVATION_OPTIONS`、`normalizeObservationValues()`、`renderObservationChips()` |
| 分段滑块 / Tab | `moveSegSlide()`、`initSegSlide()`、`moveTabSlide()` |
| 玻璃效果 | `glass.css`、`html.liquid-glass`、`--lg-*` |
| 深色、窄屏、键盘 | `theme.css`、`responsive.css`、`syncKbLayout()` |
| 记录保存和旧数据兼容 | `Storage`、`saveRecord()`、`recordObservationValues()`、`normalizeOffsets()` |
| 本地洞察 / AI | `renderInsightLocal()`、`buildAggregatePayload()`、`generateAnalysis()` |
| 加密 / 导入导出 / WebDAV | `secure.js`、`webdav.js`、`backup-picker.js` |
| 真机回归 | `debug/cdp-eval.cjs`、`debug/`、README 的构建与 CDP 说明 |

## 10. 维护规则

- 新增一个真正可复用的规则后，同步更新本文件：写明名称、职责、调用入口、适用/不适用边界和验证方式。
- 只记录已落地或已经验证的事实；讨论中的设计方案写入 `IMPROVEMENTS.md`，不要污染本索引。
- 当本文件与代码冲突时，以代码和近期真机验证为准，并修正本文件。
