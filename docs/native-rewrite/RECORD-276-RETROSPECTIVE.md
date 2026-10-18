# #276 记录模块原生化复盘与迁移基线

日期：2026-09-16<br>
基线：v4.1.5 WebView（commit `c113bcf4c7729d0978ded3f37f3ab76496334af1`）<br>
实施版本：v4.2.3 / versionCode 117<br>
设备：魅族 21，Android，1080×2340，density 440<br>
范围：记录、计时、补记、编辑、详情、保存汇总，以及日历来源页和底部 Tab 层级。

## 1. 总结结论

276 暴露的不是单个 Compose 参数错误，而是一套迁移方法没有把 WebView 的“事实”转换成可执行契约：

```text
WebView 源码与运行时事实
        ↓
逐状态测绘与契约冻结
        ↓
单宿主 Compose 实现
        ↓
同状态、同设备、同时间点对照
        ↓
运行时闸门与历史回归
```

此前经常跳过中间的测绘和状态契约，直接凭截图或感觉重画页面。结果是大结构相似，但字体、基线、间距、圆角、动画、键盘、返回栈和层级都发生漂移；修复一个状态时又破坏另一个状态。

本次已经修复并沉淀的关键经验：

1. 原生化不是重新设计，而是以 WebView 为唯一视觉和交互事实源的迁移。
2. 所有页面、Tab、Sheet 必须位于同一个 `MainActivity → NativeRoot` 宿主中。
3. 弹层状态必须按来源持有；日历来源页和记录 Sheet 不能共用一个“是否有弹层”布尔值。
4. 底部 Tab 的显示只能是宿主层门禁的结果，不能依赖调用方“先隐藏、随后希望它不再出现”。
5. 静态脚本通过不代表视觉等价；必须有同入口、同状态、同设备的运行时证据。

## 2. 276 实际出现的问题总表

| 类别 | 已出现的现象 | 影响 | 处理结论 |
| --- | --- | --- | --- |
| UI 视觉还原 | 记录 Sheet、计时页、汇总页、补记详情与 WebView 的颜色、字体、字重、圆角、阴影和层级不同 | 用户感知为“另一个页面” | 以 WebView CSS/DOM/真机 bounds 重新冻结，不接受“原生风格不同”解释 |
| 组件尺寸与位置 | Sheet 高度、顶部抓手、标题、内容区、固定 footer、计时数字和按钮位置偏移 | 页面靠上/靠下、按钮被推出或悬空 | 使用真实 viewport、safe-area、CSS bounds 和 Compose bounds 对照，禁止凭感觉加 padding |
| 字体与基线 | 默认 Compose 行高、font padding、字重和 baseline 与 WebView 不同；部分文字显示不全或视觉偏下 | 标题、时间、徽标、按钮文字裁切或层级错误 | 记录 font family、weight、size、line-height、baseline 和 font padding；长文案/1、2、3 位数字单独验收 |
| 记录入口 | 首页点击记录后曾出现白屏/空背景，或弹层不是覆盖首页而像切换页面 | 破坏 WebView 的 Sheet 语义 | 首页保留为同一宿主底层，NativeRecordSurface 作为覆盖层 |
| 就现在/补记 | 分段控件高度、圆角、内边距、选中层、文字颜色与 WebView 不一致；“就现在”曾显示日期而非 `00:00` | 主流程语义和视觉均漂移 | 自定义分段控件，默认状态和直接填写行为与 WebView 一致 |
| 计时页面 | 背景偏浅、数字尺寸/位置、开始时间、结束/取消按钮与 WebView 不同；内容一度垂直居中 | 沉浸任务的节奏和重点错误 | 按 WebView 的固定顶部信息 + 底部操作区重构，复用动态 status inset |
| 计时汇总 | 结束后错误切换为白色；缺少小勾图标；文字颜色/行距不一致 | 运行态与结果态断裂 | 汇总继续使用深蓝全屏上下文，状态图标/文案/颜色作为同一契约验收 |
| 补记时间/日期 | 日期、时间控件字体、位置、间距和默认值不一致 | 补记无法建立可信的时间上下文 | 依据 WebView 的日期/时间选择器和本地日期规则实现，不用系统默认布局替代 |
| 时长控件 | 顶部时长滑条缺失“未记录”状态，拖动后不实时显示具体时长 | 用户无法知道当前是否有时长 | 明确 `unrecorded → value` 状态转换、滑块几何和拖动反馈 |
| 发生前状况 | 胶囊颜色、边框、圆角、选中态、未选中态、添加入口与 WebView 不一致；自定义删除确认样式不一致 | 选项认知和操作反馈不稳定 | 自定义 Chip/添加/删除流程；危险确认使用项目蓝色/既有对话层规则 |
| 备注与 Footer | 备注下方空白过大或 footer 上移；两个底部按钮尺寸/间距/颜色不一致 | 操作区不稳定，键盘时更明显 | 内容区可滚动、footer 固定；备注到 footer 间距和 safe-area 由契约控制 |
| Bottom Sheet | Sheet 打开首帧延迟；打开/关闭时长、缓动、遮罩时序不一致；`AnimatedVisibility` 父级变化导致全屏测量 | 白屏、跳帧、卡片占满屏幕、层级割裂 | Sheet 统一宿主、统一 motion token；父级保持 `BoxScope` 底部约束，首帧先渲染再异步补数据 |
| 拖动与返回 | 小横杠拖动关闭、短距离回弹、详情滚动和 Android Back 的优先级曾不一致 | 返回路径和手势体验不一致 | 抓手热区、阈值、回弹、详情→时间→关闭的状态机必须独立验证 |
| IME/键盘 | 添加状况未自动聚焦；键盘弹出后输入框/按钮位置与 WebView 不同；备注不可见或无法回到正确位置 | 输入体验断裂 | `FocusRequester + keyboardController + BringIntoViewRequester`；不要用固定屏幕高度猜键盘 |
| WindowInsets | 状态栏/手势条/Navigation Bar 被重复消费或完全忽略；footer 和 Tab 重叠 | 底部悬空、按钮被遮挡、不同设备表现不一致 | NativeRoot 单点读取 status/navigation inset，子页面只消费一次 |
| Material 默认样式 | 默认 Button/Slider/Segmented/点击 ripple/pressed overlay/最小触控尺寸/弹簧动画泄漏 | 黑色半透明覆盖、缩放、回弹、圆角和高度错误 | 默认 Material 仅作为语义基础，视觉组件必须显式覆盖或自绘 |
| 状态管理 | 记录阶段、日历来源、关闭动画、Tab 请求、WebView 回调各自维护状态 | 异步回调会重新显示 Tab；嵌套返回丢失来源页 | 统一 RecordFlow 状态机和来源弹层所有权；所有异步回调经过宿主门禁 |
| 状态恢复 | 计时重启/Activity 重建曾依赖页面内状态；恢复后 Tab/弹层状态可能不同步 | 计时继续但页面丢失，或出现错误层级 | 计时起点由持久化状态保存；恢复时一次性建立完整上下文并验证 Tab 门禁 |
| 性能与响应 | 记录上下文等待 WebView 500ms 重试，导致首帧不及时；大状态/键盘/动画期间容易产生“没响应”的感觉 | 用户以为点击无效或页面卡顿 | 先用最小上下文同步显示首帧，完整数据异步补齐；不在首帧扫描全量数据 |
| 业务回归 | 原生迁移过程中误触 WebView `quick` 偏好和记录入口语义，“就现在/补记”主次关系被改坏 | 稳定 WebView 路径被迁移代码反向影响 | UI 迁移只调用既有 UseCase/JS-Room 权威链，不重定义业务语义 |
| 历史回归 | 修复某一状态后，另一状态重新出现旧问题；例如记录关闭释放了仍打开的日历门禁 | 问题反复出现 | 每次记录改动必须执行 #276 Regression Checklist，不能只验当前截图 |

## 3. 分类根因分析

### 3.1 UI 视觉还原问题

根因不是“dp 写错一个数”，而是没有把 WebView 的实际约束完整提取出来。早期实现只抄了“标题、卡片、按钮、图表”的大结构，没有冻结：

- CSS 计算后的 bounds，而不是源码中的猜测值；
- 字体实际渲染高度、baseline、font padding；
- SVG path、viewBox、stroke、currentColor 和图标画布；
- 圆角、阴影、分割线和受光层的层级；
- 空、单条、密集、长文案、键盘、大字号和深色状态。

因此自建的视觉契约一度反过来验证自建实现，脚本通过了，但没有证明“像 WebView”。

**防复发规则**：任何视觉常量必须带 WebView 来源（CSS selector、computed style、bounds、截图或动画采样）；Native 实现不得成为基线来源。

### 3.2 布局与坐标问题

Web CSS px、Android dp、物理 px、density、viewport、status/navigation inset 和 fontScale 被混在一起使用，导致固定 `padding` 反复试错。另一个直接原因是把内容放进了错误的 Compose 父级：改动 `AnimatedVisibility` 的父容器后，Bottom Sheet 失去 `BoxScope` 的底部对齐约束，被当成全屏内容测量。

**防复发规则**：先锁定设备和 viewport，再记录 CSS bounds 与 Compose bounds；Insets 由 NativeRoot 单点读取并以明确单位传递；禁止以“看起来差不多”追加 Spacer 或页面级硬编码。

### 3.3 Compose 状态管理问题

早期状态分散在 Activity、WebView、Compose 页面局部状态和异步桥接回调中。最典型的错误是使用单个 `nativeModalVisible` 表示所有弹层：从日历进入补记时，记录关闭把它清成 false，但日历仍然可见，异步 Tab 显示请求就越过了门禁。

**防复发规则**：

- 记录流程使用明确的 `RecordFlowState`：`Closed / Time / Details / TimerRunning / TimerSummary / Closing`；
- 来源页使用独立 ownership（至少 `calendarVisible` 与 `recordContext != null`，必要时升级为 modal stack）；
- 所有“显示 Tab、关闭 Sheet、返回来源页、保存后刷新”都经过 NativeRoot；
- WebView 回调只传事件，不直接操作可见层级。

### 3.4 动画与手势问题

Compose 默认 spring、ripple、pressed overlay、scale 和最小触控目标与 WebView 的 `anime/CSS` 时序不同。动画父级、内容测量和状态切换同时变化时，容易出现跳帧、全屏、回弹或遮罩与卡片不同步。

**防复发规则**：每个动画登记触发条件、属性、时长、缓动、关键帧、退场清理和 reduced-motion 分支；只允许已登记属性动起来；禁止 Material 默认动效偷偷参与。抓手拖动、点击遮罩、Android Back 需分别验证。

### 3.5 IME / 键盘问题

WebView 使用 `visualViewport`、`keyboard-up` 和滚动定位；Compose 若只使用固定高度或仅调用 `show()`，就会出现输入框被键盘遮住、footer 跳动、焦点不一致。

**防复发规则**：输入控件统一使用 `FocusRequester`、`BringIntoViewRequester`、`WindowInsets.ime`/`imePadding` 和明确的焦点清理；添加、自定义删除、备注三类输入必须分别验证“打开、聚焦、可见、提交、取消、返回”。

### 3.6 WindowInsets / Safe Area 问题

状态栏与手势条的高度被不同层重复消费，或由页面猜测固定值。Sheet footer、全屏计时按钮和底部 Tab 因而在魅族与其他设备上发生漂移。

**防复发规则**：

```text
MainActivity / NativeRoot 读取 WindowInsets
        ↓
NativeRecordSurface / SheetHost 消费一次
        ↓
组件内部禁止再次猜测手势条高度
```

同一状态必须同时覆盖手势导航、三键导航、键盘、窄屏和 fontScale。

### 3.7 Material 默认样式问题

Material3 组件的默认外观不是 WebView 的设计系统。直接使用 Button、Slider、SegmentedButton、Dialog 或默认 `clickable`，会带来默认内边距、圆角、颜色、ripple、minimum touch target、字体和动画。

**防复发规则**：优先做项目级无默认样式组件，显式指定 `indication = null`、`interactionSource`、形状、尺寸、颜色、文字样式和语义；如果使用 Material，仅复用语义与无障碍，不继承其视觉。

### 3.8 性能与响应问题

记录首帧等待完整 WebView 上下文，造成点击后延迟；若在桥接层序列化全量记录或首帧计算全部统计，又会复发历史全量扫描问题。动画和键盘期间的多次重组会放大“卡顿”感。

**防复发规则**：首帧只消费轻量上下文（模式、当前时间、必要选项）；业务提交和完整快照走既有权威链；一次请求完成计算和序列化；列表/统计使用稳定 key、派生状态和可见区域滚动。

### 3.9 修改后的旧问题回归

问题反复出现的根本原因是“当前截图验收”取代了“历史状态矩阵验收”。例如修复记录关闭后 Tab 隐藏时，没有验证“日历 → 补记 → 返回日历”；修复 Sheet 对齐时，没有重新验证计时汇总、键盘和 Activity 重建。

**防复发规则**：任何页面改动都必须执行目标页面的完整 Regression Checklist；缺一项只能标记“功能完成/待视觉修复”，不得进入下一页面或发布。

## 4. 后续 WebView → Compose 原生化规范

### 阶段 A：冻结基线

1. 固定基线版本、commit、APK、包名、设备、分辨率、density、fontScale、主题、材质和 fixture。
2. 记录唯一入口、前台 Activity、route、来源页、返回目标和 owner。
3. 玻璃/经典/深色/降低透明度明确由谁渲染；迁移期同一职责只能有一个可见 owner。
4. 没有 `baseline-frozen` 不能开始 Compose 页面。

### 阶段 B：从源码和运行时测绘

必须同时阅读：

- HTML 结构与选择器；
- CSS token、computed style、媒体查询和 `env(safe-area-inset-*)`；
- JS 状态、事件、动画、拖动、键盘、返回和数据桥；
- 浏览器运行时 DOM bounds、截图、动画关键帧和 UI 状态；
- 同设备 WebView 截图与 UI dump。

每个元素登记：

```text
selector / state / x / y / width / height
font family / weight / size / line-height / baseline / font padding
color / background / border / radius / shadow / z-index
gesture / focus / keyboard / safe-area / animation
owner / source / tolerance / forbidden behavior
```

### 阶段 C：先设计宿主，再写组件

统一结构：

```text
MainActivity
└── NativeRoot
    ├── LegacyWebViewRegion（未迁移区域）
    ├── NativeRoute（已验收区域）
    ├── GuanjiBottomTabs（唯一实例）
    └── SheetHost（唯一实例）
```

禁止新增页面 Activity、透明 Overlay Activity、第二套 Tab、第二套 Sheet、第二套 footer 或页面级遮罩。

### 阶段 D：建立可追溯 Design Token

新增或修改 token 时必须标注 WebView 来源和测量日期。至少包含：

- `GuanjiTypography`：字体、字重、字号、行高、baseline、font padding；
- `GuanjiShape`：圆角、抓手、胶囊、徽标；
- `GuanjiSpacing`：页面边距、卡片内边距、section gap、footer gap；
- `GuanjiColors`：经典/深色/降低透明度；
- `GuanjiMotion`：Sheet、Tab、按钮反馈、拖动回弹；
- `GuanjiInsets`：status、navigation、IME 的来源和消费方。

页面不得散落同一语义的硬编码 dp；一次性特殊值必须登记为页面契约，而不是复制到其他页面。

### 阶段 E：统一状态与交互

1. 页面流程使用单一状态机，状态转换表先于 Compose 代码。
2. Modal 来源使用 ownership/stack；嵌套来源关闭子层后必须恢复来源层，不得恢复全局 Tab。
3. 所有 WebView/JS/Room 事件先进入 UseCase 或 Host，再改变可见状态。
4. 保存、删除、编辑、计时恢复使用幂等事件；UI 不能拥有第二套写入权威。
5. 返回优先级明确：输入法 → 当前步骤 → 来源 Sheet → 首页/路由。

### 阶段 F：实现和对照

实现顺序固定为：

```text
宿主/路由 → 空状态首帧 → 主结构 → 组件几何 → 字体/颜色 → 交互状态 → 动画 → 键盘/Insets → 数据桥
```

每一步都用相同 fixture 与 WebView 并排，不允许先用占位页证明“逻辑通了”。

### 阶段 G：运行时闸门

必须记录：

- `topResumedActivity`、route、owner、dataRevision；
- WebView 与 Native 截图、bounds、UI dump；
- 动画首帧/中间帧/终帧；
- 设备状态栏、手势条、键盘和字体缩放；
- Tab/Sheet 数量和无障碍树可见性；
- 崩溃、ANR、返回栈和数据一致性。

硬失败项：白屏、白条、黑色覆盖、ripple、缩放、未登记回弹、裁切、全屏 Sheet、Tab 重叠、键盘遮挡、footer 漂移、来源丢失。

## 5. 需要继续优化的架构点

这些是 276 已识别、后续页面应逐步收口的工程项，不应在每个页面复制：

| 架构点 | 当前风险 | 后续统一方案 |
| --- | --- | --- |
| Record Flow 状态 | `phase`、关闭状态、来源状态分散在 Composable/Activity | 提取 `RecordFlowState` 与显式 transition reducer，保留既有 JS/Room 提交桥 |
| 设计 Token | `NativeRecordSurface` 内仍有大量局部 dp/sp/颜色常量 | 建立带来源注释的 `GuanjiVisualTokens`，页面只引用 token |
| Sheet Insets | 页面分别计算 navigation/status/IME | 由 NativeRoot 读取并通过 `SheetHost` 注入，子组件只消费一次 |
| IME | 添加状况、备注各自处理焦点/滚动 | 建立统一 `GuanjiImeController` 与输入场景矩阵 |
| 动画 | Sheet、Tab、拖动各自维护参数 | 建立 `GuanjiMotion`，统一曲线、时长、reduced-motion 和清理时机 |
| Modal owner | 布尔门禁容易丢来源 | 继续使用来源 ownership；复杂嵌套时升级为 `ModalStack` |
| 运行时证据 | 静态检查和截图路径容易错配 | 每个任务生成带 route/fixture/device/state 的 evidence manifest，并由脚本阻断缺失证据 |

本次不直接大规模重写上述组件，避免在 276 收尾阶段重新引入视觉回归；后续页面迁移前必须先选择性提取并通过 #276 回归集。

## 6. 完成判定

一个原生页面只有同时满足以下条件，才可标记视觉等价完成：

```text
WebView 基线冻结
→ 目标状态矩阵完整
→ 单宿主/单 owner 通过
→ 同设备 bounds 与截图对照通过
→ IME / Insets / 动画 / 手势通过
→ #276 历史回归通过
→ 数据桥、返回栈、重启恢复通过
→ APK 构建收尾和真机证据齐全
```

“能打开”“能保存”“静态脚本通过”“APK 能安装”都不能单独替代视觉等价验收。

最终原则：

> 同一种问题只允许出现一次。修复后必须进入组件、规则、自动化检查或 Regression Checklist；后续页面不得再次凭感觉重写同一行为。
