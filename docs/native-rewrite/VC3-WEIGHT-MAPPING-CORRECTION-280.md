# #280 VC3 字重映射修正

> 历史静态字体实施记录。其 400/500/700 静态脸映射已由 VC3-R2 可变字体单一路径完整替代；不要再把本文件中的静态映射作为当前生产实现或验收结论。保留本文仅用于解释迁移历史与历史证据。

状态：实施中，构建验收版本 `4.2.11 / versionCode 133`。源代码与历史验收基线为 `4.2.10 / 132`；范围只修正 Native Typography 的字重映射，不重选字体、不改布局。

## 基线与根因

- 基线：`4.2.10 / versionCode 132`；Native 字体家族继续使用已准入的 Noto Sans CJK SC Sans2.004 / OFL-1.1。
- `res/font` 只有真实静态 Regular 400、Medium 500、Bold 700 三个字体文件。
- 旧 `NativeTypography.family` 把 Bold 700 文件同时登记成 SemiBold 600、Bold 700、ExtraBold 800；因此 CSS 600 的文字会错误地落到 Bold 文件，600/700/800 的层级也无法被诚实地区分。
- 当前字体栈没有为 CSS 650、750 建立明确数字权重映射；若有页面样式直接创建 `TextStyle`，该文字会绕过已准入的 Noto 字体并回到 Compose/OEM 默认字体。
- CSS 事实来源：`www/css/base.css`、`components.css`、`sheets.css`、`screens.css`、`tabbar.css`；Compose 目标是 `NativeTypography.kt` 和迁移页面。

## 本次决定

保持 Noto Sans CJK SC 家族和现有三份静态资源，避免改变 VC2.2 的 API 24 静态兼容决策及已验收跨设备字体基线。先准确表达 CSS 请求的数字字重，并显式绑定到可用的静态脸：

| WebView CSS weight | Compose 请求 weight | 已准入静态脸 | 说明 |
|---:|---:|---|---|
| 400 | 400 | Noto Regular 400 | 精确静态脸 |
| 500 | 500 | Noto Medium 500 | 精确静态脸 |
| 600 | 600 | Noto Medium 500 | 受当前静态资产约束的明确回退；不再误用 Bold |
| 650 | 650 | Noto Bold 700 | 中间值显式请求并映射，不再丢成通用 SemiBold |
| 700 | 700 | Noto Bold 700 | 精确静态脸 |
| 750 | 750 | Noto Bold 700 | 中间值明确映射 |
| 800 | 800 | Noto Bold 700 | 受当前静态资产约束的明确回退 |

这次不引入额外字库。官方 Noto Sans CJK SC 变量 TTF 的当前文件约 36.1 MB（压缩约 20.4 MB）；若还保留 API 24–25 的三份静态回退，APK 预计增加约 20 MB。超出既有字体包体预算，故本次不擅自纳入。后续若用户希望让 600/650/750/800 获得真正独立的轮廓字重，须先单独审定变量字体的包体和旧 API 回退方案。

## 已实施的映射收口

1. 字体脸映射明确为 400→Regular、500/600→Medium、650/700/750/800→Bold；不再将 Bold 文件登记成 600。
2. CSS 明确使用 650 的记录选项、备份分区标题/选中态、备份紧凑操作、页脚主按钮均保留数值 `FontWeight(650)` 请求。
3. 备份页 CSS 600 的历史文件名、CSS 600 的 Ghost 页脚按钮分别使用 Bold700 / SemiBold600；普通文字按钮仍为 Regular400。
4. 迁移页面中直接创建、未绑定 Noto 字体家族的 `TextStyle` 改用统一 Typography helper；原字号、行高、字距、颜色和几何参数不变。
5. 新增 `npm run verify:280:vc3:weights` 静态闸门，核对 CSS 证据、字体脸映射、数值字重角色、无字体旁路和 OFL 声明。

本次仅证明了“请求字重与静态字体脸的映射明确且稳定”。由于现有字体只有 400/500/700 三个真实字形，600、650、750、800 的轮廓仍分别落到最近的 500 或 700 静态字形；这不能声称为与 CSS 可变字体插值后的物理笔画粗细完全相同。若两台设备观感一致但仍与 WebView 有粗细差异，下一步需要基于对照证据审定字形资源/包体，不继续调字号或布局掩盖。

## 2026-09-28：WebView 字体来源取证补充

- 两台魅族的 CSS 字体栈相同，WebView 中文实际报告为 Noto Sans CJK SC / Regular；系统 `zh-Hans` fallback 却不等价：魅族 18s 只声明常规 400 face，魅族 21 的 TTC 声明 `wght` 100–900 轴。
- 相同中文字对 CSS 400/500/600/650/700/750/800 的归一化 Canvas 墨迹响应在两台设备上出现不同分档；因此 WebView 的字重表现受系统 fallback/字重轴能力影响，不能把单一设备的渲染直接当作 Native 的固定字形目标。
- 当前决定维持 Noto 静态 400/500/700 与现有映射；不因本次取证新增静态字重或变量字体。此为阶段性 NO-GO，不是永久否决。只有出现可复现的 Native/WebView 单元素字形证据，且证明缺少某个指定字重是主要原因，才重开最小必要资源评估。
- 详细设备数据、测量值、局限与风险见 `debug/visual-migration/#280-vc3-font-source-20260928/font-source-and-weight-decision.md`；原始 CDP/Canvas 数据见同目录 `webview-font-source-probe.json`。本轮未修改产品代码/字体/映射/版本，未构建 APK。

## 禁止扩大范围

- 不换字体家族或重新评估 Source Han Sans。
- 不引入设备品牌/型号判断。
- 不改字号、line-height、letter-spacing、padding、Insets、卡片尺寸、动画、数据/路由逻辑。
- 不把现有 VC3 三设备历史报告改写成这次映射修正的通过证据。
- 不触碰 VC4 阴影、VC5 稳定性、VC6 收尾，也不执行 #280.1 自然周统计子待办。

## 验收条件

- `NativeTypography` 的资源声明不再把 Bold 700 文件登记成 600。
- 400、500、600、650、700、750、800 的请求权重有明确、可审计的实际静态脸映射。
- 所有本次核定的迁移页面文字继续使用 Noto 字体和 `FontSynthesis.None`，无系统字体逃逸。
- 运行静态 VC3 与本专项检查；布局类 #276/#279/#280 闸门继续通过。
- 两台魅族使用同一个新 APK、只读 fixture、主题和 `fontScale` 完成逐页复核；OnePlus 仍保留为最后的 VC3 三设备签收门。
