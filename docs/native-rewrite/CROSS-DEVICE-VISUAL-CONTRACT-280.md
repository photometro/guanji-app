# #280 跨设备视觉契约（VC1）

状态：`vc0_baseline_red`（2026-09-22）

本契约只约束经典 Native 页面在同一状态下的视觉一致性。玻璃模式仍由 WebView 负责；本文件不授权新增玻璃材质、Sheet、IME、Tab 或弹性布局实现。

## 1. 固定基线

| 项目 | 值 |
| --- | --- |
| 包名 | `com.guanji.app` |
| 版本 | `4.2.10` |
| versionCode | `132` |
| fixture | `record-details-fixed-footer-v1` |
| route | `record-details-sheet` |
| 主题 | `classic-light` |
| fontScale | `1.0` |
| 键盘 | 关闭 |
| 参考设备 | 魅族 21 |
| 对照设备 | 魅族 18S、OnePlus PLZ110 |

证据目录：`debug/visual-migration/#280-r9-record-details-layout-20260921/`。

VC0 必须先使用同一 APK、fixture、route、主题、fontScale 和键盘状态；不得拿不同数据量或不同系统字体设置的截图直接判定视觉差异。

## 2. 视觉角色映射

WebView 的 CSS 是唯一事实源：`www/css/theme.css`、`www/css/screens.css`、`www/css/sheets.css`。

| 角色 | WebView 事实 | Native 迁移要求 |
| --- | --- | --- |
| pageTitle | 页面对应 selector 的 `font-size/font-weight/line-height/letter-spacing/color` | 记录到 Native Typography，不在页面散落猜值 |
| cardTitle | 卡片标题 selector 的完整 CSS | 与 pageTitle 分离登记，不因设备切换 |
| body | 正文 selector 的完整 CSS | 允许正文换行，不允许固定单行裁切 |
| secondaryBody | `--ink-2/--ink-3` 及对应字号行高 | 保持层级，不套 Material 默认颜色 |
| meta | 状态、时间、辅助数字 | 必须保留 baseline 和可读性 |
| button | 按钮字号、字重、状态层 | 禁止默认 ripple、scale、min padding |
| metric | 数字字号、数字字形和单位间距 | 不能由系统合成粗体替代 |
| badge | 最小宽度、横向 padding、圆角 | 两位/三位数字不得裁切 |
| input | 输入框字号、行高、边框和内边距 | 继续复用 #279 IME/Sheet owner |
| tab | #274 Tab 契约 | 本阶段冻结，不因视觉修复重写 Tab |
| timer | `www/css/sheets.css` 的 `.timer-*` 角色 | 保持计时数字、说明和按钮层级；不在本分支改计时交互 |

## 3. 阴影与几何边界

WebView 当前阴影 token：

```css
--shadow-1: 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-2: 0 1px 3px rgba(0, 0, 0, 0.06);
--shadow-3: 0 -2px 16px rgba(0, 0, 0, 0.08);
--shadow-4: 0 12px 40px rgba(0, 0, 0, 0.16);
```

Native 阴影只参与绘制，不参与测量。不得通过加大 `padding`、Sheet 高度或 Footer reserve 来“补偿”阴影。

固定关系：

- 共享组件 bounds 误差 `≤1dp`；
- 页面容器关系误差 `≤2dp`；
- #280 R9 记录详情 Footer 到卡片底部 `20dp ±2dp`；
- 卡片外部为导航安全区加 `12dp` 悬浮距离；
- Header、正文、Footer 不相交；
- 选项区是唯一滚动 owner，Footer 不参与滚动。

## 4. 闸门阈值

- 字形覆盖相对差异 `≤5%`；
- baseline 差异 `≤1dp`；
- 阴影轮廓相对差异 `≤10%`；
- 关键单行文本零裁切、零异常换行；
- Footer/Tab/Sheet 重叠为 `0`；
- 新增 FATAL/ANR 为 `0`。

当前 VC0 报告必须保留红灯，不得通过放宽阈值、删除设备或白名单变绿。VC1 只建立契约；VC2/VC3/VC4 才能在证据支持下逐批调整字体和阴影。

## 5. 迁移顺序

1. VC2：字体候选、许可证、API/ABI 和 fontScale 准入；
2. VC3：按 T0–T3 小批次接入 `NativeTypography`，每批重跑 #274–#280；
3. VC4：比较 Compose elevation、参数化阴影和 alpha-mask 方案；
4. VC5：保护 R9/Insets/IME/滚动几何；
5. VC6：三设备同 fixture 视觉自动闸门和最终签收。

任何一批导致 R9 或既有回归失败，只回退该批渲染改动，不修改 `NativeWindowMetrics`、Footer 或 Sheet 高度来掩盖问题。
