# 洞悉页 Typography 对照表（#277 补充）

基线：v4.2.4 WebView 经典模式，`www/css/base.css`、`www/css/theme.css` 与 `www/css/screens.css`。
原生实现：`NativeInsightSurface.kt` 的 `InsightTypography`。表中的 CSS 值来自源码，不用截图目测；Compose token 是唯一实现入口。

颜色解析（经典模式）：`--ink = #000000`、`--ink-2 = #8E8E93`、`--ink-3 = #C7C7CC`、`--line = #E5E5EA`；深色模式对应 `#FFFFFF / #B0B0B4 / #6E6E73 / #3A3A3C`。正文、解释和辅助文字必须使用 `--ink-2` 或 `--ink-3`，不能使用标题色替代。

| WebView 元素/选择器 | CSS 基线 | Compose token | 备注 |
| --- | --- | --- | --- |
| 页面眉题 `.eyebrow` | 11px / 600 / `var(--ink-2)` / letter-spacing .06em / margin-bottom 6px | `eyebrow` | 页面“洞察” |
| 页面主标题 `.screen-title` | 26px / 700 / `var(--ink)` / letter-spacing -.02em / line-height 1.15 | `pageTitle` | 26px、30sp 行高 |
| 页面副标题 `.header-sub` | 13px / 400 / `var(--ink-2)` / margin-top 6px / line-height 1.6 | `pageSubtitle` | 21sp 行高 |
| 卡片眉题 `.report-tag` | 11px / 600 / `var(--ink-3)` / letter-spacing .14em / margin-bottom 12px | `cardTag` | 1.54sp 字距 |
| 卡片标题 `.report-title` | 16px / 700 / letter-spacing .01em / margin-bottom 10px | `cardTitle` | 21sp 行高 |
| 事实/正文 `.insight-card-fact`, `.report-body` | 14.5px / 400 / `var(--ink-2)` / line-height 1.8–1.85 / letter-spacing .02em | `narrative` / `body` | 保留 WebView 的长行距 |
| “AI 观察”来源 `.insight-ai-source` | 11px / 600–700 / `var(--ink-3)`，前置 5px 蓝点 | `aiLabel` | 蓝点由布局单独绘制 |
| 概览数字 `.insight-overview-metrics strong`, `.overview-num` | 40–42px / 800 / `var(--accent)` / letter-spacing -.04em | `metricNumber` | 40sp 行高，数字不使用 Material 默认字重 |
| 概览单位 `.insight-overview-metrics span` | 12px / 400 / `var(--ink-2)` | `metricLabel` | |
| 清晰度 `.insight-overview-metrics em` | 11px / 400–500 / `var(--accent-deep)` | `clarity` | 胶囊边距由布局保留 |
| 图表数值 `.insight-time-cell strong` | 13px / 700 / `var(--ink-2)` | `dataValue` | 峰值复制 accent 颜色 |
| 图表标签 `.insight-time-cell small` | 10–11px / 400 / `var(--ink-3)` | `dataLabel` | |
| 共同出现 `.insight-pair-row` | 14px / 400 / `var(--ink)` | `pair` | key 先映射为 label |
| 共同出现次数 `.insight-pair-row strong` | 12px / 700 / `var(--accent-deep)` | `pairCount` | |
| 变化结论 `.insight-change-result strong` | 14px / 700 / `var(--accent-deep)` | `changeResult` | 下降/持平使用 secondary |
| 变化说明 `.insight-change-result p` | 12px / 400 / `var(--ink-3)` / line-height 1.65 | `changeNote` | |
| 变化条标签/数值 | 12px / 400；13px / 400 | `changeLabel` / `changeValue` | |
| 建议编号 `.insight-suggestion-list li > span` | 12px / 800 / `var(--accent)` / letter-spacing .05em | `suggestionNumber` | |
| 建议正文 `.insight-suggestion-list p` | 14.5px / 400 / `var(--ink-2)` / line-height 1.75 | `suggestion` | |
| “AI 建议” `.insight-suggestion-source` | 11px / 700 / `var(--accent-deep)` / margin-right 6px | `suggestionSource` | 以内联 span 保持同一行 |
| AI 动作眉题 `.insight-action-eyebrow` | 11px / 700 / `var(--accent-deep)` / letter-spacing .04em | `actionEyebrow` | |
| AI 动作说明 `.insight-action-title` | 12px / 400 / `var(--ink-2)` / line-height 1.65 | `actionTitle` | |
| AI 动作状态 | 13px / 400 / `var(--ink-2)` | `actionStatus` | |
| 免责声明 `.insight-action-disclaimer` | 11px / 400 / `var(--ink-3)` / line-height 19px | `disclaimer` | |
| 主按钮 `.insight-action-content .btn-primary` | 15px / 600 / white / line-height 1 | `button` | 46px 高、999px 圆角 |
| 追问标题 `.ask-title` | 14px / 700 / `var(--ink)` / letter-spacing .02em / margin-bottom 12px | `askTitle` | |
| 追问 chip `.chip` | 13px / 400 / `var(--ink-2)`；1px `var(--line)` 边框；999px 圆角；padding 9px 15px；min-height 38px | `askChip` | 内容自适应宽度、垂直排列、点击无系统 ripple |
| 追问问题 `.ask-q` | 13px / 700 / `var(--accent-deep)` / letter-spacing .02em | `askQuestion` | |
| 追问回答 `.ask-answer` | 14px / 400 / `var(--ink-2)` / line-height 1.85 / letter-spacing .02em | `askAnswer` | 同 WebView 卡片内边距 20px |
| 空状态 `.insight-card-empty` | 14.5px / 400 / `var(--ink-3)` / line-height 1.75–1.8 | `empty` | 与读取错误分开 |

## 使用约束

1. 洞悉页 Composable 不得新增 `TextStyle(fontSize = …)` 或散落的字号/字重/颜色；必须引用 `insightTypography(colors)` 的 token。
2. CSS 颜色使用 `InsightColors` 映射；Material3 `Typography` 不得覆盖本表。
3. 390px 以下的 WebView 字号收缩由本轮暂不复制的页面媒体查询处理；Native 仅在同一断点建立明确 token 覆盖，不能在组件内猜测。
4. 任何新增文案先登记 WebView 选择器、CSS 值和 Compose token，再修改实现与回归截图。
