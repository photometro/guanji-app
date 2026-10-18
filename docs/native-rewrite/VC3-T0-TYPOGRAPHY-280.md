# #280 VC3-T0：Native Typography 首批映射

> 历史批次记录。页面角色与几何验收仍可复用；字体资源/权重结论由 VC3-R2 替换，须按变量字体重新验收。

日期：2026-09-22<br>
基线：`4.2.10 / code 132`，包名 `com.guanji.app`<br>
状态：T0 批次通过，已纳入 VC3 三设备最终同 fixture 验收

## 本批范围

T0 只处理三类高风险文字区域：

- 首页问候标题；
- 首页常规卡片标题与副标题（次数趋势、时段分布、最近记录）；
- 记录时间页/记录详情页的字段标题、日期/时长、备注、选项和底部按钮。

## 事实来源与实现

- WebView 唯一事实源：`www/css/base.css`、`www/css/components.css`、`www/css/sheets.css`、`www/css/theme.css`。
- Native 入口：`android/app/src/main/java/com/guanji/app/NativeTypography.kt`。
- 本批新增语义角色：`HomeGreeting`、`HomeCardTitle`、`HomeCardSubtitle`、`RecordFieldLabel`、`RecordDuration`、`RecordDateDisplay`、`RecordBody`、`RecordPlaceholder`、`RecordHeader`、`RecordChip`、`RecordFooterButton`。
- VC2.2 已选定 Noto Sans CJK SC 静态 400/500/700；T0 的字号、padding、Sheet 高度和 Insets 不变，`FontSynthesis.None` 继续生效。T1 扩展同一字体和语义角色，不另起字体配置。
- 页面入口：`NativeHomeSurface.kt`、`NativeRecordSurface.kt` 已改为消费语义角色，不再在 T0 目标区域散落字体家族/合成策略。

## 验证

- `npm run verify:280:vc3`：通过。
- 真机：魅族 18S（API 33）与魅族 21（API 36）在线，均为 `4.2.10/code132`；fontScale 已记录。
- `debug/visual-migration/#280-p6-vc0-20260922/vc3-t0-typography-report.json`：通过。
- `debug/visual-migration/#280-p6-vc0-20260922/vc3-final/vc3-final-report.json`：三设备同 fixture 通过。
- 统一构建钩子 `tools/build-apk.ps1 -Mode debug`：通过；未升级版本号。

## 边界与下一步

本批已完成 T0 的字体映射与三设备运行时证据；VC3 是否最终收口仍以 T1–T3 报告及最终发布合规/性能收尾为准。
