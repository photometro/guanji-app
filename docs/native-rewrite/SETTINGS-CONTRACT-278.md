# #278 设置页原生迁移契约

状态：实现完成，待视觉签收（v4.2.5 / versionCode 125）<br>
基线：v4.1.5 WebView（经典/普通模式）；玻璃模式仍由 WebView 唯一渲染。

## 迁移边界

- 唯一宿主仍为 `MainActivity → NativeRoot`，没有新增 Activity 或第二套设置页面。
- `me` 路由由 `NativeSettingsSurface` 承担经典/普通模式；关于和隐私等静态说明继续走同一 Activity 的 WebView 路由。#280 VC3 收尾新增的“开源软件许可”入口是明确例外：由 `NativeRoot` 内原生 Sheet 离线展示 APK 中的完整许可文本。
- 玻璃模式不在 #278 制作 Native 版本；主题判断为玻璃时沿用 WebView 回退，禁止 Native 与 WebView 双层叠加。
- 现有 JS/SecureStorage 仍是设置写入和密钥存取的唯一业务入口，Native 层只读安全快照并转发动作。

## WebView 视觉基线

来源：`www/index.html` 的“我的”结构，以及 `www/css/base.css`、`theme.css`、`screens.css`、`sheets.css`。

| 元素 | WebView 规则 | Compose 映射 |
| --- | --- | --- |
| 页面容器 | 左右 22px；顶部 `4px + safe-top`；底部 `104px + safe-bottom` | `NativeSettingsSurface` 的 `verticalScroll` + 22.dp horizontal + 104.dp bottom |
| 页面标题 | 26px / 700；标题下 20px | `SettingsHeader` / `FontWeight.Bold` |
| 设置卡片 | 白色/主题 surface；圆角 16px；`shadow-2`；内边距 20px；卡片间距 16px | `SettingsCard`：16.dp radius、2.dp shadow、20.dp padding、16.dp spacing |
| 分段控件 | 胶囊背景、选中项白色浮层、原有字号/颜色 | `SettingsSegment` 自绘，不使用 Material SegmentedButton |
| 行控件 | 标题 14px；副标题/说明 12px；底部分隔规则由原 CSS 决定 | `SettingsTimeField`、`SettingsSwitchRow`、`SettingsDescription` |
| AI 卡片 | 需要更大上下留白（原卡片 26px padding），保存态/编辑态字段显隐不同 | `AiSettingsCard` 使用独立 26.dp vertical padding |
| 关于卡片 | 居中内容、图标 52px、名称 16px、版本 11px | `AboutCard`；关于/隐私静态路由仍交给 WebView；许可入口打开本地 Native Sheet |

## 2026-09-16 后续校准

- `SettingsMetrics` 统一承载页面左右/底部安全区、卡片间距、卡片内边距、标题/分组/行/说明/分割线节奏；后续设置页改动不得散落新增未登记的 `Spacer` 或 Material 默认尺寸。
- 分段控件未选中底色固定复用 WebView `--bg-elev`（浅色 `#E5E5EA`、深色 `#2C2C2E`）；开关尺寸固定为 46×27dp、滑块 21dp。
- 实况通知区域保持 WebView 的扁平层级：单条分隔线 + 标题/说明/状态 + 原按钮位置的操作区，不再包一层额外卡框；状态文案来自快照并支持测试中/完成/提示状态。
- 设置开关、分段切换和测试动作先更新 Native 乐观状态，再异步回读 JS 快照，避免等待存储或桥接导致点击无响应；快照回读使用短延迟合并。
- 关于卡片复用 WebView 原版 `www/assets/guanji-icon-01c.svg` 的几何资源（Native VectorDrawable）并保留对应阴影，避免在 Compose 中直接解码 API 26 自适应 XML；隐私说明恢复为 WebView 的两条项目。
- WebView 的 AI 设置只有 Provider 分段和“模型”文本输入（没有独立模型分段控件）；Native 不新增基准不存在的模型选择器，模型仍通过同一文本字段编辑/保存。

## 数据与安全契约

Native 快照只包含渲染必需的派生状态：主题、玻璃/模糊状态、记录/提醒开关、保护模式摘要、当前 Provider/模型/Base URL 的脱敏状态、`hasApiKey`、AI 编辑/测试状态和版本号。原始 API Key 永不进入快照、日志或 Compose 状态树。

保存动作通过 `window.__guanjiNativeSettingsAction` 转回既有 JS 处理器；空 API Key 代表保留已保存密钥，避免编辑后误覆盖。Provider、Base URL、模型校验和 SecureStorage 写入规则全部复用既有实现。

## 动作与返回

| Native 动作 | 既有处理器 | 所有权 |
| --- | --- | --- |
| 主题、玻璃、模糊、记录方式、提醒/通知/积极反馈/每日话语 | `setThemeSeg`、`applyTheme`、`saveRecordMode`、既有开关 | Native 行为 + JS 持久化 |
| AI Provider、编辑、保存、连接测试 | `switchProvider`、`saveAIConfig`、既有测试按钮 | Native 表单 + JS/SecureStorage |
| 提醒时间、保护模式 | 既有 DOM/系统选择器入口 | 迁移期兼容路径；需要让出对应正文宿主 |
| 备份/恢复/导出/清理 | `NativeBackupSurface` / `NativeDataMaintenanceSurface` | Native Sheet；业务协议按 #279/#280 的 Gateway 边界执行 |
| 修改口令 / 数据范围 | `NativeSecureChangeSurface` / `NativeDataScopeSurface` | #280 P0 已收口为 NativeRoot 路由；JS 仅保留无 UI 的口令业务 owner |
| 关于/隐私 | WebView 静态路由 | WebView |
| 开源软件许可 | `NativeOpenSourceLicensesSurface` | NativeRoot Sheet；离线读取 APK 内的许可文本 |

任何需要系统选择器或弹层的动作都必须先隐藏 Native 正文，操作完成后由路由回调恢复 `me` 的 Native 所有权；返回键只返回当前路由栈，不创建新 Activity。

## 验收门槛

- `npm run verify:272`、`npm run verify:native-ui-v2:preflight -- 278`、`npm run verify:278`、`npm run verify:277` 及历史 `verify:274/275/276` 全部通过。
- 编译必须使用 `tools/build-apk.ps1 -Mode debug -Install`；包名 `com.guanji.app`、调试签名策略和版本单调递增由构建摘要确认。
- 对比浅色、深色、降低透明度、大字号、已配置/未配置/编辑态、键盘、滚动、弹层、返回和重启；玻璃模式只验证 WebView 回退。
- 发现视觉偏差时先回到 WebView CSS/DOM 与共享 token，不通过新增散落 dp 或 Material 默认组件“凭感觉”修补。

## 2026-09-17 设置细节回归

- 分段选择器复用 WebView `.seg-row/.seg-slide/.seg`：4px 外层内边距、4px 间隔、40px 控件高度、选中层 1dp 阴影与 400ms cubic-bezier 滑动；不使用 Material3 默认 SegmentedButton。
- 磨砂强度按 WebView `.glass-blur-row` 收口为 12dp 行间距、4dp 轨道、22dp 拇指、38dp 数值列，并限制轨道最大宽度，避免权重布局把滑条拉满。
- 每日温和提醒改回可点击时间输入样式；动作点击既有 WebView `#reminderTime`，Native 通过延迟快照回读用户选择后的持久化时间。
- 实况通知结果恢复“系统 / 通知权限 / 显示方式”三行结构，快照增加三项脱敏字段，保留 WebView 结果区域间距与单条分隔线。
- AI 设置 Provider 分段常显；API 密钥与保存按钮恢复同一行，编辑态使用“已保存的密钥（留空保持不变）”占位；保存态显示状态点，数据范围标题与小字同行并截断长文案。
- 开关行、危险操作行统一使用 WebView 标题/辅助文字层级；关于卡片改用 `guanji_icon_01c` VectorDrawable + 4dp 阴影。
- 本文为 #278 初始边界记录；#279/#280 已将备份/恢复/导出/清理、修改口令和数据范围迁入同一 NativeRoot 宿主，只有业务协议或静态说明仍可通过明确 Gateway/白名单回落，不得再由 Native 点击直接打开旧 DOM 弹层。
- 版本保持 versionName 4.2.5，versionCode 125，CSS/JS 标识更新为 `v=198 / v=209`。
