# #280 VC2.1：字体一致性复核

日期：2026-09-22<br>
基线：`4.2.10 / code 132`，`com.guanji.app`<br>
前置：VC2 字体来源准入、VC3-T0 语义角色映射

## 目的

VC2 已确认 WebView 使用系统字体栈，Native 暂不引入未经审核的字体资产。但 VC0 真机证据出现字形覆盖和阴影红灯，不能把 `FontFamily.SansSerif` 的准入结果误认为跨设备视觉一致性已经通过。

VC2.1 先排除测试条件差异，再决定是否需要进入字体候选评估；本阶段不直接替换字体、不修改版本号、不修改业务数据。

## 复核规则

1. 三台设备统一 `fontScale=1.0`；原始字号必须记录并在 `finally` 中恢复。
2. 不修改设备 density，只记录有效/物理 density；截图、UI dump、包版本和前台 Activity 必须保存。
3. 使用同一 APK、主题、fixture 和启动入口；不执行记录增删改、清除、恢复或导入导出。
4. 继续使用 `FontFamily.SansSerif + FontSynthesis.None` 作为系统字体基准组。
5. 归一化采集完成后仍须执行渲染对照；若字形差异仍超过 VC0 阈值，再进入经许可证、字重、API 24（项目 minSdk）、包体和 WebView 兼容审查的内置字体候选评估。

## 验证入口

```text
npm run verify:280:vc2.1
```

报告：

```text
debug/visual-migration/#280-p6-vc0-20260922/vc2.1-font-consistency/vc2.1-font-consistency-report.json
```

归一化条件完成后，使用三台设备共有的静态标题进行渲染对照：

```text
npm run verify:280:vc2.1:rendered
```

报告：

```text
debug/visual-migration/#280-p6-vc0-20260922/vc2.1-font-consistency/vc2.1-rendered-font-report.json
```

## 完成边界

`normalized_capture_ready_font_comparison_pending` 只代表条件归一化采集完成，不代表 VC2.1 或 VC3 通过。三设备静态文字覆盖差异 `≤5%` 时保留系统字体；超过阈值则进入经许可证、API 24（项目 minSdk）、包体和 WebView 兼容审查的字体候选评估。只有渲染对照或字体候选评估重新通过 VC0/T0，才能进入 VC3-T1。

本轮归一化渲染结果：魅族 21 → 魅族 18S 为约 `1.77%`，通过；魅族 21 → OnePlus PLZ110 为约 `13.79%`，未通过，当前进入 `needs_audited_font_candidate`，不能继续 T1。
