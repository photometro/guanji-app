# UI 原生化 V2 硬闸门

本闸门适用于 #273–#281。任何一项失败，当前任务只能标记为“脚手架/待修复”，不能升级版本、构建发布包、写成功实施报告或进入下一节点。#275–#281 的原生视觉范围仅是经典/普通模式（含浅色、深色和降低透明度回退）；玻璃模式在 #281 前只作为 WebView 对照/兼容状态，不能被 NativeRoute 接管。

长期复用入口：实施前必须同时读取 `docs/native-rewrite/RECORD-276-RETROSPECTIVE.md`（记录流程问题根因）、`docs/native-rewrite/RECORD-277-FOLLOWUP4-RETROSPECTIVE.md`（异步卡片与证据采样复盘）、`docs/native-rewrite/NATIVE-MIGRATION-CHECKLIST.md`（通用清单、#276 和 #277 回归清单）和 `docs/REUSE-RULES.md` 的 8.1–8.4（视觉闸门、记录流程、洞悉 owner、异步状态共享规则）。证据 manifest 必须逐项引用清单编号；缺少引用视为闸门未通过。

## 1. 架构闸门

必须满足：

```text
MainActivity（唯一可见 Activity）
└── NativeRoot
    ├── RouteHost
    │   ├── LegacyWebViewRegion（尚未迁移页面/区域）
    │   └── NativeRoute（已验收页面/区域）
    ├── GuanjiBottomTabs（唯一实例）
    └── SheetHost（唯一实例）
```

- 核心页面不得新增 `Native*Activity`；
- 不使用透明 Activity 叠加 WebView；
- 迁移期可采用同 Activity、同 NativeRoot 内的分区式混合界面，例如“WebView 页面正文 + 原生 Tab”；但同一职责区域只能有一个所有者，旧 WebView Tab 被原生 Tab 接管后必须隐藏、不可点击且退出无障碍树。NativeRoute 的页面、唯一活动 Tab、记录/日历等前景 Sheet 必须在同一个 Compose 树中按 `页面 → Tab → 遮罩/Sheet` 固定顺序绘制；弹层不得改变整个页面宿主的 elevation、可见性或 Tab 宿主。禁止创建第二个全屏 ComposeView 承载弹层，也禁止在关闭时隐藏、重建、换宿主或重新绑定 Tab；旧 `NativeModalRegion` 仅可作为不可见迁移探针保留。
- 整页 NativeRoute 可见时，对应 WebView 页面必须不可见、不可点击、不可参与无障碍树；
- WebViewRoute 与 NativeRoute 使用同一业务数据/UseCase，不形成两套写入权威；
- 系统 Back、页面返回和手势返回使用同一原生返回栈。

## 2. 实施前闸门

每个页面必须先产出任务清单：

1. 基线 commit、APK、设备、分辨率、density、fontScale、主题；
2. 页面 route、父级来源、返回目标、前台 Activity；
3. DOM/CSS 选择器到 Compose 组件的映射；
4. 字体、行高、baseline、padding、gap、圆角、阴影、颜色、图标；
5. 空/单条/密集/长文案/大字号/深色/键盘/滚动状态；
6. 动画触发、时长、缓动、关键帧、遮罩时序和减少动效分支；
7. 该页面允许修改的文件白名单。
8. 明确经典/玻璃 owner：经典由 NativeRoute 接管，玻璃在 #281 前由 WebView 接管；列出不可出现的第二实例、默认 pressed 行为和回归用例。
9. 将 `NATIVE-MIGRATION-CHECKLIST.md` 的目标页清单和历史回归项复制到本任务 evidence manifest，明确每项的执行结果和证据路径。

缺少任一项，不得开始 Compose 页面代码。

## 3. 实施中闸门

- 先完成最小页面骨架和静态几何，再接交互，最后接动画；
- 禁用 Material 默认 ripple、scale、elevation、min touch padding 和弹簧，除非 WebView 明确存在；
- 文案和图标必须使用 WebView 原内容/原 SVG path；
- 页面迁移不得修改 WebView 稳定实现、记录语义、统计口径、AI 策略或数据迁移；
- 不创建下一阶段页面的占位 Activity/占位 UI；
- 不得在 #275–#281 新增或接入原生玻璃材质、backdrop、玻璃专属卡片或第二套玻璃动画；如需验证玻璃，只能确认 WebView 唯一渲染且没有双层重叠。
- 公共组件变更必须重跑所有已迁页面的视觉回归。

## 4. 同状态证据闸门

WebView 和 Native 必须使用相同：

- 数据 fixture/dataRevision；
- 设备 viewport、density、fontScale 和系统栏；
- 经典主题（浅色、深色、降低透明度回退）；玻璃状态只采集 WebView 对照，不要求 Native 绘制玻璃；
- 页面 route、滚动位置、键盘状态；
- 动画采样时刻。

每个状态至少留存：

- WebView 截图和 bounds；
- Native 截图和 Compose semantics/layout bounds；
- overlay/diff 结果；
- 前台 Activity、route、Tab 数量、Sheet 层级；
- 人工/代理视觉结论和未通过项。

## 5. 误差与禁止项

目标不是“肉眼大致相似”，而是可量化等价：

- 共享组件几何误差：`≤1dp`；
- 页面容器误差：`≤2dp`；
- 动画关键帧位置误差：`≤3dp`；
- 文案、图标 path、层级、返回关系：零差异；
- 字号、字重、行高、圆角、阴影、分割线、图表线宽：必须逐项登记并通过对照。

禁止出现：

- 内容裁切或 baseline 偏移；
- 黑色/半透明系统 pressed overlay；
- 未定义 ripple；
- 图标/文字切换缩放；
- 未定义 bounce/spring；
- Sheet 全屏化、底部悬空或三层壳；
- 顶部白条、安全区错位；
- 两个 Tab、两个宿主或两个可见页面层。

## 6. 完成闸门

一个版本只有同时满足以下条件才完成：

1. 架构静态检查通过；
2. WebView 原路径未被破坏；
3. 目标 NativeRoute 的全部状态对照通过；
4. 真机入口、返回、旋转锁定、前后台和进程恢复通过；经典模式由 NativeRoute 渲染，玻璃模式在 #281 前由 WebView 回退渲染；
5. 记录/统计/Room/备份/AI/小组件相关回归按影响范围通过；
6. 当前版本只包含计划内页面，没有下一阶段占位实现；玻璃原生重做不提前混入；
7. 迁移台账标记为 `verified`，并写明证据路径。
8. 公共 Tab、主题或宿主发生变化时，#274 回归包（浅/深经典、窄屏、大字号、手势导航、魅族底部横条、重启、玻璃 WebView 回退）必须全部通过。

若失败，不允许通过修改阈值、修改基线截图或把差异写成“原生优化”来绕过。

## 7. #281 之后的玻璃边界

- #275–#280 只要求玻璃 WebView 回退仍可用且与 NativeRoute 不重叠；#281 完成时必须删除全部旧 JS 核心，因此不得把玻璃 WebView 回退带入 #281 之后。
- #281 之后，玻璃模式请求统一安全回落到已验收的 Native 经典界面并保留用户偏好，直到独立玻璃原生重做任务完成；不得显示空白壳、旧 JS 页面或第二个宿主。
- 后置玻璃原生重做必须从 Native 经典界面开始，重新测绘、建立契约并重新通过本闸门，不得把经典模式的验收结果直接视为玻璃验收结果。

## 8. 洞悉数据来源契约（#270 补充）

#277 的 Compose 洞悉页面可以消费迁移期共享快照，但不得把这条兼容桥误报为“洞悉数据已完全原生化”。当前字段来源、fallback 规则和 #281 前置条件统一记录在：

`docs/native-rewrite/INSIGHT-DATA-SOURCE-CONTRACT-277.md`

实施洞悉相关任务时必须同时确认：

- Room/Kotlin 统计模型仍是事实来源；
- `NativeHomeSnapshot`/JS 仅是当前兼容投影；
- Native UI 不重新计算统计；
- 完整 `NativeInsightSnapshot` 直接驱动洞悉 UI 前，不得删除 JS 洞悉核心。
