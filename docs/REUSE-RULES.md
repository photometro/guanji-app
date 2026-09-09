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

#### 1.2.1 共享视觉节奏 token（#211 N3）

**职责**：为跨页面迁移提供统一的间距、卡片容器和文字层级参数，避免同一视觉语义在业务 CSS 中重复写死。

- **调用入口**：`www/css/theme.css` 的 `--space-1` 至 `--space-6`、`--type-card-title`、`--type-card-sub`、`--type-meta`、`--card-padding`、`--card-radius`、`--card-shadow`；组件 CSS 使用 `var(...)` 引用。
- **适用边界**：常规内容卡、首页统计/趋势和设置代表卡片等共享层级；经典与液态玻璃均沿用这些几何 token，玻璃材质仍只能由 `glass.css` 覆盖。
- **不适用边界**：计时全屏、品牌图标、特殊任务 Sheet 或经过原型明确指定的独立尺寸；不得为了单页微调扩展同名 token。
- **验证方式**：浏览器 390px 视口和魅族真机 CDP 检查 token 解析值、卡片 padding/圆角与无重叠；主题切换只验证材质覆盖不改变几何 token。

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

### 2.4.1 局部滚动条视觉规则（v3.87，#219）

**来源**：`www/css/sheets.css` 的 `.app-scroll-region`，由 `theme.css` / `glass.css` 提供主题变量。

- `.app-scroll-region` 是局部滚动区域的统一滚动条入口：透明轨道、4–5px 胶囊滑块、隐藏 WebKit 箭头、稳定滚动槽；保留原生触摸滚动和 WebView 回退。
- 滑块颜色必须使用 `--scroll-thumb` / `--scroll-thumb-active`，经典、液态玻璃和深色模式由主题变量适配；蓝色只用于主操作和数据强调，不用于滚动条。
- 适用：日历明细、Sheet 内容、备份历史等需要局部滚动的区域。内容短时应关闭溢出或自然收紧，避免显示多余滚动条。
- 不适用：整页 `.screen` 和需要隐藏系统滚动条的根级容器；不得为单个页面复制独立 scrollbar 规则或自绘 JavaScript 滚动条。
- 验证：至少覆盖 0/1/2/3+ 条记录、长文本、经典/玻璃/深色主题、Android WebView 与桌面浏览器，确认滚动条不遮挡操作区且不造成布局跳动。

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

### 3.1.1 根级 Sheet 统一动效（v3.62，#199；替代 #197 的任务专用分支）

**来源**：`openSheetPanel()`、`playSheetOpen()`、`animateSheetClose()`（`www/js/ui-sheet.js`）。

- 记录、日历、备份与恢复、服务器备份管理和导出等根级 Sheet 统一从下方 `translateY(100%) scale(.98)` 进入，550ms 克制缓出；关闭沿同一路径反向下滑并淡出，300ms 无回弹。
- `ROOT_SHEET_MOTION` 是唯一根级参数源；anime 与 CSS fallback 使用同一起点、终点、时长和缓出曲线，`.sheet--task` 仅承担布局/固定 footer 职责，不再决定动画。
- 动画状态以 Sheet 为粒度通过 `WeakMap` 与序号/token 隔离；重开、关闭和高度过渡的旧回调不得清理新一轮状态。
- 备份/恢复继续使用唯一父 Sheet、固定 footer 和 `transitionSheetHeight()`；二级恢复状态不新建遮罩或横向过渡，服务器备份管理保持独立业务状态但复用根级生命周期。
- 不适用：全屏计时、确认 Dialog、独立横向页面及没有现成拖拽入口的任务 Sheet；不新增遮罩、z-index 或平行动画系统。
- 验证：v3.62 浏览器与 Android 真机 CDP 实测记录/日历/备份根级进退场、二级返回、关闭清理和无控制台错误。

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

### 4.1.1 #253 统一观察字段三态兼容

**来源**：`RoomRecordEntity.toJson()/fromJson()`、`recordHasUnifiedObservationField()`、`recordObservationValues()`、`displayRecordTags()`。

- 统一观察字段必须保留三态语义：字段缺失或 `null` 表示旧记录并回退 `moods/triggers`；`observations: [...]` 表示新版统一字段并以其为准；`observations: []` 表示用户明确未选择，不能重新合并旧字段。
- Room 序列化依据 `rawRecordJson` 的字段存在性投影，不得把旧记录内部的空数组默认值输出成新版统一字段；未知字段和历史原始数据继续保留。
- 展示、洞悉统计、行为模型、AI 聚合和导出必须复用同一兼容读取入口，不在卡片或单个消费者中另写回退逻辑。
- **适用**：Room 权威读取、旧记录升级、JSON/CSV/WebDAV 恢复及所有发生前状况消费端。
- **不适用**：批量合并新旧字段、静默改写历史记录或把 AI/UI 判断当作数据来源。
- **验证方式**：`npm run verify:253`、`npm run verify:253:browser`，并回归 #236 Room 记录链和旧备份恢复路径。

### 4.2 两套记录入口的汇合规则

| 入口 | 现有流程 | 汇合点 |
| --- | --- | --- |
| 直接填写 / 补记 | `openSheet()` → `goToDetails()` → `saveRecord()` | 统一记录模型与发生前状况 |
| 就现在计时 | `startTimedRecord()` → 全屏计时 → `finishTimedRecord()` → `showTimerSummary()` → 保存 | 统一记录模型与发生前状况 |

- 不在两个入口分别发明标签、时长、保存或统计逻辑。
- 计时中关闭/返回表示取消计时，已有 `cancelTimer()` / `cancelFromTimerScreen()` 语义；不要通过隐藏 UI 代替状态清理。

### 4.3 #231–#235 行为模型、统计与权威数据复用边界（v4.1.3 批次）

- 个人特征只由 `www/js/behavior-model.js` 输出的按日、离散时段和状况聚合输入计算；Kotlin `PersonalBaselineCalculator` 是唯一算法实现，不在 JS 和每张卡片重复计算。
- #234 统一使用 `KotlinStatsEngine.compute()`，自然周固定周一至周日、自然月按日历月、滚动窗口保留 14/30 天；消费者只接收一个 `StatsSnapshot`。
- #235 通过 `requestBehaviorSnapshot()` 的 `dataRevision` 去重、旧回调保护和 `GuanjiSnapshotBus` 共享快照；桥不可用时才回退既有 `buildStatsSnapshot()`，不新建第二套统计口径。
- #233/#236 v4.1.3 起 Room 为原生记录权威，`RoomShadowPlugin` 的事务、严格解析、最后可信状态和未知字段保留规则是唯一写入边界；旧加密 Storage 只能作为兼容镜像/降级输入。
- #232 AI 只复用既有 EvidenceGraph 和聚合统计外传边界；时间顺序、竞争解释、反证和下一步观察通过 claimType 表达，不新增个人签名字段外传，不允许诊断、因果或羞耻化输出。

### 4.3 统计、洞察与 AI 边界

**来源**：`www/js/stats.js`、`www/js/ai.js`、`www/js/ui-home.js`

- 本地统计优先复用 `countRange()`、`hourOf()`、`countStreak()`、时间桶和首页渲染函数；不要在单卡片里手算另一份口径。
- 洞察页本地事实由 `renderInsightLocal()` 生成；六张卡片及其 AI 观察沿用既有卡片渲染和触发规则。
- AI 只使用 `buildAggregatePayload()` 产生的聚合数据；不得将单条记录的时间、备注或完整时间线加入请求。
- AI 文案保持中性、非羞耻化，不能做露骨内容、心理/医疗诊断或确定性因果判断。
- 每日话语遵循现有“AI 可选增强、本地话语回退”链路，不能因为洞察页调整而破坏首页回退。

### 4.3.1 统一 StatsSnapshot（v3.60，#196）

**来源**：`buildStatsSnapshot()`（`www/js/stats.js`）、`syncWidgetStats()`（`www/js/records.js`）、`WidgetStatsPlugin`（Android）。

- 首页、趋势、洞悉、AI 与小组件只消费同一统计快照；自然周固定周一至周日，自然月按本地月份，趋势使用滚动 14/30 天。
- 日期边界通过可信时间戳、IANA 时区和严格 `YYYY-MM-DD` 校验生成；未来或异常日期不进入统计，旧值保留并可回滚。
- 小组件接收版本化 JSON 快照，按 `revision` 拒绝旧数据，采用临时值→正式值原子提交；解析失败保留 last-known-good，不回退为全零。
- 不适用：在单个页面或卡片内重新实现周期算法，或把原始记录直接同步到小组件；完整原生记录数据库另行规划。
- 验证：v3.60 统计边界测试、浏览器首页标签回归、Android 真机冷启动与小组件协议编译验证。

### 4.3.2 统计性能与快照复用（v3.61，#198）

**来源**：`createStatsContext()` / `buildStatsSnapshot()`（`www/js/stats.js`）、`afterRecordsChanged()` / `syncWidgetStats()`（`www/js/records.js`）、`renderHome()`（`www/js/ui-home.js`）。

- 一次用户动作先建立一个 `StatsContext`/`StatsSnapshot`；日期格式化器按统计时区缓存，日期计数从上下文 Map 查询，禁止在每个日期格或每个页面重新扫描全量记录。
- 首页、洞悉、AI 聚合、每日话语、图表/月度汇总/时段分布和小组件同步优先接收同一快照；快照内部 context 用不可枚举字段传递，不能进入原生小组件或 AI JSON。
- 保存、恢复、导入、删除、计时和快速记录先完成页面反馈，再异步同步原生小组件；洞悉页不可见时只保留进入页面时的既有刷新与 AI 触发语义。
- 不适用：改变自然周/自然月/滚动趋势/连续记录统计口径、上传原始记录、增加启动加载 UI，或为某个页面另建统计服务。
- 验证：浏览器恢复演示数据无错误；Android 真机操作无 ANR，快照与首页/洞悉/小组件核心数值一致；离线 APK 构建通过。

### 4.3.3 小组件快照新鲜度与传输边界（v3.63，#200）

**来源**：`syncWidgetStats()`（`www/js/records.js`）、`appStateChange`/跨午夜调度（`www/js/app.js`）、`WidgetStats.parseJson()` 与 `WidgetStatsHelper`（Android）。

- 快照协议的变化率字段只按可表示的整数校验，不能复用 UI 文案的百分比范围；自然月基数较小时的合法高变化率不得让整份快照失效。
- 小组件按 `todayKey` 和快照生成时的 IANA `timezone` 判断今日新鲜度；带日期的旧快照只在显示层将今日次数替换为“今天尚未同步”，不修改或删除原始缓存。旧 v1 管道无 `todayKey`，按兼容规则继续展示。
- App 冷启动、回到前台、驻留跨过午夜均复用 `buildStatsSnapshot()` → `syncWidgetStats()`；原生桥失败最多重试一次，不能阻塞记录保存、首屏渲染或后台自动备份。
- 不适用：在小组件内另算自然周/自然月、把过期缓存静默当作“今天 0 次”、或为某个小组件复制一套同步协议；历史快照仍由 last-known-good 原子提交规则保护。
- 验证：覆盖 `monthDelta=5600`、跨日旧缓存、冷启动、前台恢复和新增记录；确认今日类小组件显示一致，离线 APK 构建与真机日志无 `reason:"invalid"`、崩溃或 ANR。

### 4.3.4 AI 洞察缓存生命周期（v3.64，#202）

**来源**：`insightCache*()`、`renderAIReport()`、`reportStale()`（`www/js/ai.js`）、记录替换入口（`www/js/ui-sheet.js`、`www/js/webdav.js`）。

- 只缓存最近一次通过 `normalizeInsightAIData()`、`validateInsightAIData()` 和 `violatesAIOutputBoundary()` 的结构化结果；缓存必须绑定完整数据指纹、窗口、时区、统计规则版本、服务商和模型。
- 加密模式复用 `secure.js` 的 DEK/AES-GCM，明文模式使用本地存储；读取时再次校验结构与安全边界，并兼容两种存储模式迁移。缓存不得包含单条记录、备注、API Key 或完整提示词。
- 启动只异步恢复缓存，不因缓存存在或过期主动请求 AI；数据替换、清空或服务器覆盖恢复必须调用统一失效函数。过期结果继续沿用 `ready-stale` 和现有刷新入口。
- 不适用：另建报告渲染/状态体系、仅按 `records.length` 判断新鲜度、把原始记录写入缓存，或让缓存恢复阻塞首页、小组件、WebDAV 和每日话语。
- 验证：浏览器无网重启恢复、记录变更标记过期、加密读写、损坏回退、模型/时区/规则变化，以及 Android 真机无崩溃/ANR。

### 4.3.5 洞察页 AI/local 单态与变化视觉状态（v3.84，#213/#214）

**来源**：`renderInsightLocal()`、`insightCardBodyHTML()`、`insightSuggestionsHTML()`、`renderWeekDelta()`（`www/js/ai.js`、`www/js/ui-home.js`）。

- 洞察页沿用同一组六张 `report-card`：有可用 AI 报告时只渲染对应 AI 正文；无 AI 报告时才渲染完整本地事实、图表、标签、比较和本地建议。首次生成没有旧报告时保持本地内容，有旧报告刷新失败时保持旧 AI 单态并标记过期。
- AI 建议模式只使用 AI 返回的最多 3 条建议；字段为空时显示中性占位，禁止把本地建议悄悄混入 AI 卡片。页面级生成入口、免责声明、缓存和聚合隐私边界继续复用既有链路。
- 首页“较上周”变化只通过 `down` / `up` / `plain` 互斥类表达方向；不改变 `StatsSnapshot`、自然周算法或文案。渲染异常/不可比较时必须清理旧方向类。
- 不适用：另建 AI 报告页、在 AI 模式重复渲染本地证据、在单卡片重新计算统计、用颜色表达好坏评价，或新增第二套变化状态机。
- 验证：AI ready/stale/loading、无 Key/无旧报告、建议为空、浏览器与真机经典/玻璃/深色/窄屏/大字号，以及周变化负数、正数、零值、空值状态。

### 4.4 AI 设置与提供商配置

**来源**：`www/js/ui-sheet.js`、`www/js/ai.js`

- 提供商配置按提供商分别保存与回显；DeepSeek、OpenAI 和自定义都可展示 Base URL，默认值由既有配置提供。
- 连接测试与保存是不同动作，不能把“测试成功”当作已保存。
- 保存态遵循既有“AI 已配置 / 编辑”收纳语义，不为某一个提供商单独造一套字段显示规则。
- SecureStorage 的异步回填必须通过统一字段同步入口完成；只在字段未聚焦且未被用户编辑时回填，切换提供商才强制刷新。读取失败不得用空值覆盖已有配置，旧明文迁移必须在安全写入成功后才清理。
- 不适用：在多个事件处理器各自写入字段、异步 hydration 自动聚焦/滚动页面，或把 API Key 写回原生 localStorage、导出文件和日志。

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

### 6.1.1 系统启动保护层与 WebView 稳定首帧（v3.72，#201/#203/#204/#205/#206/#207/#208）

**来源**：`MainActivity`、`StartupReadyPlugin`（`android/app/src/main/java/com/guanji/app/`）、`www/js/app.js`、`Theme.SplashScreen`（`android/app/src/main/res/values/styles.xml`）。

- Android 只使用系统 `Theme.SplashScreen` 作为必要启动保护层，背景必须与首页同源；产品层不展示独立品牌图形、字标或切片动画，透明占位 drawable 仅用于满足 Android 12+ 的启动图标要求。
- 系统 `Theme.SplashScreen` 只做有上限的首帧保护：WebView 首帧通过 `StartupReady.ready()` 后退出，异常或慢加载最多由约 1200ms watchdog 放行；根窗口、根布局和 WebView 必须使用同源背景，避免退出后出现白底。不得等待业务、AI、WebDAV 或小组件。
- 首页启动应直接使用真实 `#screen-home` 的最终状态：首次 `renderHome()` 后不追加产品层显现动画，首页主体、统计、按钮和卡片保持首帧稳定。不得新建独立 HTML 开屏、复制首页 DOM 或让后续 `renderHome()`/Tab 切换触发启动动画。
- 产品层不再维护问候文案转场时间线；从后台返回、Tab 切换和首页重绘均不播放开屏动画。系统减少动态效果时直接呈现最终首页。
- 禁止恢复 #204 的切片、高光、字标和原生退出淡出，禁止在 `MainActivity` 对启动图标叠加平移/缩放，禁止 WebView 追加第二套启动过渡。
- 文案继续来自 `getGreeting()`/`getDailyTip()`，不在启动链路等待网络；`prefers-reduced-motion` 无需额外处理，因为产品层没有启动动画。
- `StartupReady.ready()` 仅用于结束系统 Splash 首帧保护；不得再派发 `splashExit`、直接 JS 回调或待发标记，也不得把每日话语、AI、WebDAV 或小组件同步接入启动等待链。
- 不适用：把 Android 自适应 launcher 成品直接当 Web/开屏素材、设置固定长等待、加入网络加载进度或在多个模块重复维护启动状态。
- 验证：浅/深主题、不同密度和 Android 版本的冷启动、进程恢复、后台返回、低性能设备与 reduced-motion；确认启动层与 WebView 同源背景、首页显现可见、首页统计和小组件同步不被阻塞且无 ANR。

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

### 6.5 P0 协议与桥接复用（#221，P0 基线）

**来源**：`docs/contracts/`、`debug/fixtures/221-golden.json`、`debug/verify-221-contracts.cjs`。

- 六类公共协议固定为 `RecordEvent`、`StatsSnapshot`、`BehaviorModelSnapshot`、`EvidenceGraph`、`InsightCache` 和 `BackupEnvelope`；后续 Kotlin、Room、Compose 与原生迁移阶段必须复用，不得另起同义 DTO。
- 统计消费者继续复用 `buildStatsSnapshot()` 的 `schemaVersion`、`statsRuleVersion`、`revision`、`timezone`、`todayKey` 和 `freshness`；桥接一次返回完整快照，不按卡片分次调用。
- #222 的 `BehaviorSnapshotPlugin`、`core.behavior` 与 `behavior-bridge.js` 是该桥接规则的首个运行实现：输入只允许聚合 `StatsSnapshot`，JS 以 `dataRevision` 去重，同一 revision 不得并发重复请求；桥不可用必须回退现有 JS 统计链路。
- AI 仅接收聚合统计、行为模型和证据图，不传输单条记录、备注、附件或精确时间线；无新增价值时不显示 AI 内容。
- 导入、备份和迁移默认保留未知字段；旧 v3.53/v3.87、CSV、WebDAV、时区、异常日期、小组件、AI 缓存和中断迁移样本沿用 P0 黄金集。
- SQLCipher 只按 `docs/contracts/SQLCIPHER-ADMISSION.md` 进入准入评估；#223 已将其限定为发行版内的加密 Room 影子库依赖，不改变 Room 权威切换和发行版 Local-first 边界；实际依赖、SBOM、真机和损坏恢复门禁仍需在后续权威迁移前完成。
- **适用**：后续 Schema、Kotlin↔JS 桥、Room 迁移、AI Evidence 和备份恢复。
- **不适用**：临时页面 JSON、第三方 AI 原始响应、仅用于展示的本地 DOM 状态；不把协议文件当作运行时统计实现。
- **验证方式**：`npm run verify:221` 与 `npm run verify:222`；前者必须包含 `schemas=6`、`unknownFieldRoundTrip=passed`、`aiPrivacyBoundary=passed`、`bridge=single-snapshot`，后者必须包含 `nativeBridge=single-snapshot`、`jsDedupe=revision`、`rawRecordBoundary=passed`。

---

## 7. 验证与发布复用

### 7.1 浏览器与真机验证链

**来源**：`debug/`、README、历史实施记录。

- 前端改动先做 `node --check` 与浏览器回归；使用缓存参数避免 WebView 读到旧资源。
- 真机优先走现有 CDP 链：`adb forward` → WebView DevTools → WebSocket 脚本做 DOM 级检查；截图以 `adb shell screencap` 后 `adb pull` 保存，避免 PowerShell 二进制重定向。
- UI 变更至少验证：浅/深主题、窄屏、安全区、长内容、键盘、返回键、动效降级和不影响现有数据。
- 发布时复用既有 Capacitor 同步、Gradle JDK 21 构建、覆盖安装和版本/cache 参数更新流程。

### 7.1.1 统一 APK 构建钩子（v3.65 起）

**实现**：`tools/build-apk.ps1`；npm 入口为 `build:apk:debug`、`build:apk:release`。

- **职责**：固定 `ANDROID_HOME`、JDK 21、`GRADLE_USER_HOME`、`JAVA_TOOL_OPTIONS=-Duser.home=C:\Users\43124` 与 `ANDROID_USER_HOME=C:\Users\43124\.android`，避免生成第二份 debug.keystore；检查依赖、写权限和同项目并发进程。
- **同步**：默认执行 `cap sync android`，仅在捕获到已知 `uv_os_get_passwd` 环境错误时进行一次本地 CLI shim 重试；随后比较关键 Web 资源与 Android assets 的 SHA-256，禁止带着旧资源构建。
- **构建**：使用 Gradle wrapper 的 `--offline --build-cache`，保留 daemon 以缩短增量构建时间；日常 `debug` 直接使用 `:app:assembleDebug`，保持正式包名 `com.guanji.app` 与固定 Android Debug 签名，不创建额外 QA flavor，确保可覆盖既有调试安装。
- **依赖补齐**：离线缓存缺少新依赖时，必须显式传 `-Online` 给统一构建钩子；默认仍保持 `--offline`，避免普通构建隐式联网。依赖下载完成后恢复离线构建。
- **发布签名**：`release` 只接受 `GUANJI_RELEASE_KEYSTORE`、`GUANJI_RELEASE_STORE_PASSWORD`、`GUANJI_RELEASE_KEY_ALIAS`、`GUANJI_RELEASE_KEY_PASSWORD`，变量缺失即阻断，不生成“看似正式”的错误签名包。
- **产物校验**：使用 `aapt` 读取包名/版本，使用 `apksigner` 读取签名指纹和 SHA-256；Gradle 报告 `UP-TO-DATE/FROM-CACHE` 时允许安全复用已存在产物，否则拒绝使用构建前旧 APK。
- **真机安装**：只有显式传 `-Install` 才操作设备；安装前读取设备中同包名 APK 的签名指纹，发现不一致立即阻断，避免 `INSTALL_FAILED_UPDATE_INCOMPATIBLE`；成功后启动并记录设备状态。
- **收尾**：无论成功或失败都删除临时 APK、释放构建锁、写入 `debug/apk-build-*.log` 与 `debug/apk-build-summary.json`，供后续诊断和发布复核。
- **适用**：所有 APK 构建、真机安装、发布前产物准备。
- **不适用**：纯前端浏览器开发；不得替换为直接执行 `gradlew assemble*` 或手工 `adb install`。
- **验证**：至少执行一次 `powershell -NoProfile -ExecutionPolicy Bypass -File tools\build-apk.ps1 -Mode debug -SkipSync`；真机回归使用 `-Install`，正式发布使用 `-Mode release` 并核对摘要中的签名指纹。

### 7.1.2 Room 影子库迁移与增量规则（#223）

**实现**：`android/app/src/main/java/com/guanji/app/core/data/`、`RoomShadowPlugin.kt`、`www/js/room-shadow-bridge.js`。

- **职责**：把现有 WebView Storage 映射为可查询的加密 Room 影子投影，为后续原生统计迁移提供真实数据管线。
- **边界**：旧 WebView Storage 在 v4.0.x 期间是唯一权威；自 v4.1.3/#236 起 Room 成为原生环境权威，旧 Storage 降级为一次性迁移输入和兼容镜像。任一桥失败都不得阻塞浏览器回退、首页渲染或导出/备份。
- **迁移**：首次迁移固定 50 条批次，使用 `lastRecordId` 和 `RUNNING/COMPLETED` 检查点；相同 source revision 重启时跳过已完成数据，revision 改变时才重置影子库。
- **增量**：记录保存后计算 baseline diff，只提交 upsert/delete；不得重新扫描或重写全部 Room 表。
- **安全**：使用现有 DEK 经 HKDF-SHA256 和固定 info `guanji-room-sqlcipher-v1` 派生 SQLCipher 数据库密钥；每条影子记录保留 `rawRecordJson`，未知字段不得丢失。
- **验证**：静态执行 `npm run verify:223`；真机通过 CDP 检查 `encrypted=true`、重复迁移 `skipped=true` 或等价幂等结果、Room 记录数稳定，且 `authority=webview-storage`。

### 7.1.10 Room 权威记录链与兼容镜像（#236）

**实现**：`www/js/storage.js`、`www/js/room-shadow-bridge.js`、`www/js/native-capabilities.js`、`android/app/src/main/java/com/guanji/app/RoomShadowPlugin.kt`、`android/app/src/main/java/com/guanji/app/core/data/RoomRecordEntity.kt`、`RoomRecordDao.kt`。

- **职责**：把直接记录、补记、编辑、删除、演示数据和恢复数据统一接入 Room；WebView 继续负责界面和内存态，所有持久化动作经 `Storage.saveRecords()` 进入 `GuanjiRoomShadow.commitRecords()` 或 `replaceRecords()`。
- **读取**：原生启动优先从加密 Room 一次性读取完整 `RecordEvent[]`；只有 Room 不可用、首次初始化或迁移未完成时，才惰性解密旧 Storage 作为种子/回退，避免每次启动重复扫描旧数据。
- **写入**：增量新增/编辑/删除使用 `commitRecords()` 的串行队列和 upsert/delete；覆盖型恢复、演示数据与清空使用事务性 `replaceRecords()`。Room 成功后才更新旧加密 Storage 兼容镜像；镜像失败不回滚 Room 权威结果。
- **兼容**：Room 实体保存 `rawRecordJson`，`toJson()` 返回已知字段并保留未知字段；不返回 `rawRecordJson` 本身、DEK 或内部加密状态。浏览器与旧版本桥接继续走原有加密 Storage。
- **边界**：不改变 RecordEvent、JSON/CSV、WebDAV 或 AI 脱敏协议；不在 UI 层新增第二套记录状态，不按页面或卡片分别写库。
- **验证**：`npm run verify:236` 必须覆盖方法暴露、单次权威加载、惰性回退、增量/覆盖写入、未知字段保留和所有入口持久化路径；真机 CDP 检查 `authorityReady=true`、重启后记录一致及无原始密钥泄露。

### 7.1.3 记录测量质量与覆盖快照（#224）

**实现**：`www/js/records.js`、`www/js/stats.js`、`docs/contracts/record-event.schema.json`、`docs/contracts/stats-snapshot.schema.json`、`debug/verify-224-quality.cjs`。

- **职责**：为每条记录保留可解释的 `localDate`、`zoneId`、`timePrecision`、`source` 和 `backfill` 元数据，并在统一 `StatsSnapshot.dataQuality` 中计算最近 7 个自然日的覆盖、来源分布、补记比例和元数据完整度。
- **边界**：质量状态只描述样本是否足以观察，不推断“没有记录就没有发生”，不输出健康、正常值或因果结论；异常/未来日期计入排除计数且不进入统计。
- **兼容**：旧记录启动时通过 `normalizeOffsets()` 只补齐缺失元数据；未知来源归入 `legacy`，原始观察、备注和未知字段不改写。
- **原生映射**：Room 影子表使用 1→2 迁移增加 `localDate` 与 `backfill` 列，同时继续保存 `rawRecordJson`；新增字段不能让影子库失败阻塞 WebView 主存储。
- **适用**：个人基线、偏离检测、Evidence 质量和后续原生 Stats Engine 的输入准入。
- **不适用**：用覆盖比例替代行为频率、把补记当作低质量行为，或在页面内另起一套统计口径。
- **验证**：`npm run verify:224` 必须通过；真机 CDP 检查 `dataQuality`、异常日期隔离、旧记录元数据归一化，并与 #221/#222/#223 回归一起执行。

### 7.1.4 个人基线与稳健偏离快照（#225）

**实现**：`www/js/behavior-model.js`、`www/js/behavior-bridge.js`、`android/app/src/main/java/com/guanji/app/core/behavior/PersonalBaselineCalculator.kt`、`BehaviorSnapshotBuilder.kt`。

- **职责**：把本地记录压缩为 56 天按日聚合输入，由 Kotlin 核心以最近 28 天作为观察窗口，计算 Median、IQR、MAD、Percentile、偏离方向和幅度，并输出 `baseline.status` 与 `deviations`。
- **调用入口**：`buildBehaviorModelInput(statsSnapshot)` → `requestBehaviorSnapshot(statsSnapshot)` → `BehaviorSnapshotPlugin.requestBehaviorSnapshot` → `PersonalBaselineCalculator.build()`。
- **适用边界**：个人历史对比、行为模式观察、数据覆盖质量；输入只允许按日计数、持续时间数值分布和质量摘要，桥不可用时继续回退现有 JS 统计。
- **不适用边界**：人群正常值、医学/健康判断、成瘾判定、因果结论；缺失记录不得解释为没有发生，数据跨度不足 56 天必须返回 `insufficient`。
- **验证方式**：`npm run verify:225` 验证窗口、确定性、隐私边界和短历史；`debug/verify-225-device.cjs` 通过真机 CDP 验证 Kotlin 输出与 `rawRecordsIncluded=false`。

### 7.1.5 EvidenceGraph 与 AI 引用校验（#226）

**实现**：`android/app/src/main/java/com/guanji/app/core/behavior/EvidenceGraphBuilder.kt`、`www/js/evidence-graph.js`、`www/js/behavior-bridge.js`、`www/js/ai.js`、`docs/contracts/evidence-graph.schema.json`。

- **职责**：将聚合 StatsSnapshot 与个人基线指标转换为可追溯 Evidence 节点；每个节点绑定 `dataRevision` 和 `modelVersion`，并提供状态、幅度、持续性、置信度与限制。
- **ID 规则**：统计根节点使用 `ev-stats-{dataRevision}`；指标节点使用 `ev-{metric}-{dataRevision}`。同一指标在不同修订号下不得复用 Evidence ID。
- **AI 边界**：AI `claims` 只能引用当前 EvidenceGraph 中存在且版本/修订号同时匹配的 `evidenceRefs`；未知、过期或无证据引用的 claim 拒绝，不覆盖已有可信报告。
- **降级**：桥不可用时保持现有聚合 AI 流程；无 EvidenceGraph 时不要求旧版响应生成 claims。EvidenceGraph 和 claim 均不得包含原始记录、备注、附件或精确时间线。
- **缓存**：若 AI 返回 claims，InsightCache 必须连同生成时 EvidenceGraph 保存；重启恢复优先使用缓存证据图校验，不因桥尚未初始化丢弃可验证报告。
- **适用**：个人基线解释、跨维度 AI 观察和后续持续性/变化点模型；当前未实现的持续性字段必须明确为 `not_evaluated`，不得伪造结论。
- **验证**：`npm run verify:226` 校验 ID 确定性、版本/修订绑定、失效引用拒绝和隐私边界；`debug/verify-226-device.cjs` 通过真机 CDP 检查原生图与 JS 校验链。

### 7.1.6 自然周持续性证据块（#227）

**实现**：`android/app/src/main/java/com/guanji/app/core/behavior/PersonalBaselineCalculator.kt`、`BehaviorSnapshotBuilder.kt`、`EvidenceGraphBuilder.kt`、`docs/contracts/behavior-model-snapshot.schema.json`。

- **职责**：把 56 天按日聚合输入划分为不重叠的周一至周日证据块，使用参考期与近期观察期的稳健偏离结果区分 `stable`、`single_shift`、`repeated_shift`、`returning` 和 `uncertain`。
- **调用入口**：`buildBehaviorModelInput()` → `requestBehaviorSnapshot()` → `PersonalBaselineCalculator.build()` → `buildPersistence()`；快照中的 `persistence` 与 EvidenceGraph 指标节点保持同一 `dataRevision` 和 `modelVersion`。
- **适用边界**：个人纵向变化观察、持续性和覆盖限制说明；至少需要 4 个完整自然周证据块，首尾不完整周不参与判定。
- **不适用边界**：医学/健康判断、行为成因或人群正常值；偶发尖峰、方向混合或有效周块不足必须返回 `uncertain`。
- **隐私边界**：证据块仅包含周级聚合计数、有效时长汇总和覆盖元数据，不包含单条记录、备注、精确时间线或事件标识。
- **验证方式**：`npm run verify:227` 校验规则接线、状态枚举和 EvidenceGraph 投影；`debug/verify-227-device.cjs` 通过真机 CDP 复现五种状态并检查原始字段边界。

### 7.1.7 候选变化期识别（#228）

**实现**：`android/app/src/main/java/com/guanji/app/core/behavior/PersonalBaselineCalculator.kt`、`EvidenceGraphBuilder.kt`、`www/js/evidence-graph.js`、`docs/contracts/behavior-model-snapshot.schema.json`。

- **职责**：在 #227 自然周证据块和稳健偏离结果上，按连续偏离周块识别候选变化期，输出起止周区间、证据块 ID、方向、置信度与限制说明。
- **调用入口**：`buildBehaviorModelInput()` → `requestBehaviorSnapshot()` → `PersonalBaselineCalculator.build()` → `buildPersistence()` → `candidateChangePoint()`；EvidenceGraph 指标节点透传同一 `changePoint` 对象。
- **适用边界**：个人纵向变化的候选起点提示；仅消费聚合周块，不读取原始记录、备注或精确时间线；方法版本为 `rolling-deviation+persistence-v1`。
- **不适用边界**：正式变化点检测、健康/医学判断、人群正常值或因果解释；单个偏离周、方向混合、未知周块或有效块不足时返回 `not_detected`/`uncertain`。
- **验证方式**：`npm run verify:228` 与 `debug/verify-228-device.cjs` 验证候选起止区间、偶发尖峰隔离、回归模式、不确定性和 EvidenceGraph 引用边界。

### 7.1.8 共现与时间共同变化（#229）

**实现**：`www/js/behavior-model.js`、`android/app/src/main/java/com/guanji/app/core/behavior/PersonalBaselineCalculator.kt`、`BehaviorSnapshotBuilder.kt`、`EvidenceGraphBuilder.kt`、`www/js/evidence-graph.js`、`docs/contracts/*`。

- **职责**：复用既有 `recordObservationValues()`/`normalizeObservationValues()` 与 #227/#228 自然周证据块，同时输出单条记录内的 `event_cooccurrence` 和指标跨周的 `temporal_co_movement`。
- **输入边界**：WebView 只发送最近 28 天状况组合计数、样本数和既有按日聚合数据；不发送单条记录、备注、精确时间线或事件标识。
- **关系规则**：仅输出 `supports`、`contrasts`、`weakly_aligned`、`insufficient_relation`；共同出现或共同变化不得被解释为因果，证据不足必须保留不确定性。
- **图投影**：关系作为 EvidenceGraph 可引用节点，节点与当前 `dataRevision`/`modelVersion` 绑定；时间关系额外连接 `recordDensity` 与 `duration` 指标节点。
- **验证方式**：`npm run verify:229` 与 `debug/verify-229-device.cjs` 覆盖多选兼容、支持/相反/弱对齐/不足四种关系、证据引用和隐私边界，并回归 #221–#228。

### 7.1.9 AI 证据增强与新增价值门控（#230）

- **职责**：在 #229 EvidenceGraph 与既有聚合 AI 请求之上，向 AI 提供“本地已显示事实”上下文，要求输出跨维度综合、变化排序、稳定项对照、不确定性或下一步观察；仅在这些内容相对本地事实有新增价值时显示 AI 单态。
- **调用入口**：`prepareInsightEvidence()` → `buildAggregatePayload()` → `generateAnalysis()`；`validateInsightEvidenceClaims()` 校验当前 `dataRevision`/`modelVersion`，`insightHasAddedValue()` 判断 claim 类型和事实重复度，`persistInsightCache()` 保存 `aiAddedValue`。
- **适用边界**：个人洞察页的可选 AI 增强、跨卡片综合和报告缓存；无 AI、桥不可用、请求失败或 claims 无法验证时继续显示完整本地洞察。
- **不适用边界**：不替代本地统计、个人基线或关系计算；不接受因果、健康/医学、人格、成瘾或羞耻化判断；不上传单条记录、备注、附件或精确时间线；仅 `single_evidence_explanation` 的重复事实不得单独开启 AI 单态。
- **验证方式**：`npm run verify:230` 覆盖 EvidenceRefs、重复事实隐藏、跨维度 claim 显示、缓存字段和隐私边界；`debug/verify-230-device.cjs` 在 Android WebView 真机 CDP 回归桥接与运行时门控。

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
