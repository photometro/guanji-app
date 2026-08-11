# DESIGN.md — 观己 v3.10 设计规范

> 版本：2026-08-11 · 适用：观己 App v3.10（当前代码事实，非未来方案）
> 来源：知识库「观己设计语言 v2」（2026-08-08 汇总页 v23 定稿）+ theme.css 全量变量 + 组件代码（P1 拆分后 css/）
> 定位：全 App 设计系统基线；修改任何样式前以此为准

---

## 1. Visual Theme & Atmosphere

**设计哲学**：Apple/iOS 设计语言——克制、轻盈、留白充足、柔和层级。
**一句话定调**：观己是「安静的工具」——信息密度克制，核心数据突出，操作一目了然。
**氛围关键词**：冷静 / 透气 / 可信 / 温和（文案与视觉同调）。
**视觉特征**：iOS systemGroupedBackground 底色 + 白色大圆角卡（16px）+ 无重阴影（分层靠底色与发丝线）+ 蓝色系统强调色（#007AFF）。
**实验性层**：玻璃效果（#72 起，可开关，默认关 #116）——无磨砂通透配方，通透感来自饱和度 + 边缘结构。

## 2. Color Palette & Roles

全部变量定义于 `www/css/theme.css`（浅 `:root` / 深 `:root[data-theme="dark"]`），引用一律走变量，零硬编码。

### 浅色

| 变量 | 值 | RGB | 角色 |
|---|---|---|---|
| `--bg` | #F2F2F7 | 242,242,247 | 页面底（systemGroupedBackground） |
| `--bg-elev` | #E5E5EA | 229,229,234 | 抬升面（chips 未选中底） |
| `--card` | #FFFFFF | 255,255,255 | 卡片底 |
| `--ink` | #000000 | 0,0,0 | 主文字（systemLabel） |
| `--ink-2` | #8E8E93 | 142,142,147 | 次级文字/组标签（secondaryLabel） |
| `--ink-3` | #C7C7CC | 199,199,204 | 说明/占位/箭头（tertiaryLabel） |
| `--accent` | #007AFF | 0,122,255 | 强调（systemBlue）：主按钮/选中/链接 |
| `--accent-deep` | #0062CC | 0,98,204 | 强调深/危险文字/按压 |
| `--accent-soft` | #E8F1FF | 232,241,255 | 强调浅底（图例/背景块） |
| `--sage` | #34C759 | 52,199,89 | 成功/已加密状态点（systemGreen） |
| `--sage-soft` | #E9F7EC | 233,247,236 | 成功浅底 |
| `--amber` | #FF9500 | 255,149,0 | 提醒/警示（systemOrange） |
| `--line` | #E5E5EA | 229,229,234 | 分割线（systemSeparator，hairline 0.5px） |
| `--ring-1..5` | #FFCC00/#FF9500/#34C759/#32ADE6/#007AFF | — | 时段环多彩（晨光黄→日间橙→正午绿→暮色青→夜色蓝） |
| `--heat-0..3` | rgba 灰→浅蓝→中蓝→深蓝 | — | 热力图 4 档（#88 蓝系） |
| `--timer-bg-1/2` | #0A84FF/#0040A8 | — | 全屏计时渐变（主题蓝运动感） |
| `--bg-glow-1/2` | rgba(0,122,255,.06/.05) | — | 玻璃卡可透背景蓝晕（#72） |

### 深色（Material #121212 标准 + iOS 深色系统色）

| 变量 | 值 | 说明 |
|---|---|---|
| `--bg` | #121212 | 页面底 |
| `--card` | #1E1E1E | 卡片 |
| `--ink-2` | #B0B0B4 | 次级（深色提亮） |
| `--ink-3` | #6E6E73 | 说明 |
| `--accent` | #0A84FF / `--accent-deep` #409CFF | iOS 深蓝 |
| `--sage` | #32D74B | 成功 |
| `--line` | #3A3A3C | 分割线 |
| 阴影 | 加深（.5/.6 级） | 深色层级靠阴影 |
| 环色/热力 | 提亮版 | 深底可读 |

### 玻璃效果层（#72/#84/#113，浅/深两套变量）

| 变量 | 浅 | 深 | 角色 |
|---|---|---|---|
| `--lg-tint` | rgba(255,255,255,0) | rgba(255,255,255,.05) | 浮层底（通透） |
| `--lg-tint-strong` | .85 | rgba(28,28,30,.85) | 对话框底（遮罩上可读） |
| `--lg-tint-card` | .60 | .08 | 内容卡半透明底（Vibrancy 近似） |
| `--lg-saturate` | 2 | 2 | 通透饱和度 |
| `--lg-blur` | 3px（默认，可调 0-10） | 同 | 日历/tab/记录面板磨砂（#113 滑块） |
| `--lg-glow-a/b` | .40/.16 | .12/.05 | ::before 光带（深色去光带 #112） |
| `--lg-edge-1/2/3` | .95/.55/.28 | .35/.15/.08 | ::after 渐变边框环 |
| `--lg-hi` | .90 | .20 | 卡片 inset 上缘高光 |

## 3. Typography Rules

- 字体族：`-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", sans-serif`（`--font`，系统字体零下载）
- 层级（来自组件代码）：
  | 角色 | 字号/字重 | 示例 |
  |---|---|---|
  | 页面大标题 | 28px / 800 | 首页「下午好」、设置「我的」 |
  | 卡标题 | 15-16px / 700 | 「次数趋势」「数据保护」 |
  | 主按钮文字 | 15px / 600 | 开启加密/记录 |
  | 行/正文 | 14px / 400 | row-btn、设置行 |
  | 次级/组标签 | 12-13px / 400-500 | 状态行、chips |
  | 说明 | 11px / 400 | disclaimer、卡底注释 |
  | 核心大数字 | 34px+ / 800 | 今日次数、时长（stat-num） |
- 中文行高 ≥ 1.6；`letter-spacing: 0.02em`（正文/按钮）；禁用全大写英文标题（#117 Don't）

## 4. Component Stylings

### 卡片 `.card`
16px 圆角 / 白底（深 #1E1E1E）/ `--shadow-2` / 内边距 6-14px / 卡距 14px / 卡标题 15px 700。
玻璃态：`--lg-tint-card` 半透明 + 渐变边框环 ::after + 顶部受光 ::before（浅 0.40 / 深无 #112）。

### 按钮
| 组件 | 样式 | 状态 |
|---|---|---|
| `.btn-primary` | accent 底 白字 999px 胶囊 14-15px 600 `--shadow-2` | hover accent-deep（fine）/ active scale(.97) 去影 / disabled .45 |
| `.btn-ghost` | bg-elev 底 ink 字 1px line 边 999px | hover 加深 / active scale(.97) |
| `.btn-danger` | accent-deep 底 白字 999px | 同 primary |
| 玻璃态 | 实色保留 + 玻璃边缘（1px 白边 .6 + inset 高光 + 蓝色光晕 0 3px 14px .3） | 同 |

### 列表行 `.row-btn`
14px / 左右 space-between + chevron（16px ink-3）/ 0.5px hairline 分割线（**全页统一，末行无线 #117**）/ padding 14-15px 2px / active opacity .6 / danger 红字 accent-deep。

### 开关 `.switch-row` + `.switch`
51×31 圆角 16 / off #E9E9EB、on sage / knob 27px 白 + 微影 / 0.2s 过渡 / 行 13px padding / 0.5px hairline（#117 统一）。

### 选择 chips `.chip`
bg-elev 底 1px line 边 999px 13px / active accent 底白字 / 0.2s 过渡 / 触摸 ≥ 44px。

### 滑块（磨砂强度 #113）
`input[type=range]`：4px 轨道 --line / 22px 蓝圆 thumb（--accent + 2px 白边 + 微影）/ webkit+moz。

### 弹窗 `.dialog`
`--lg-tint-strong` 底（玻璃态）/ 16px 圆角 / `--shadow-4` / 标题 17px 700 居中 / 正文 12px ink-2 / actions 双按钮 flex 1。

### 状态点 `.sec-dot`（#105/#106）
8px 圆点：灰 --ink-3（未加密）/ 绿 --sage（已加密）+ 状态文字 11-12px ink-2。

### 热力图 `.heat-cell`（#88）
7 列网格 / 8px 圆角 / 平涂（无阴影）/ `--heat-0..3` 蓝系 4 档 / 固定行数 ceil(days/7)。

### 时段环（#5/#18）
`--ring-1..5` 多彩 5 段 / 环图 dasharray 动画。

## 5. Layout Principles

- 页面容器：左右 16px；内容卡宽度 100%-32px
- 卡片间距 14px；卡内 padding 14px；行高 48px（触摸标准）
- 悬浮 tab 栏：左右 12px / bottom 18px+safe-area / 恒 58px（#77 去滚动收缩）
- 数据管理区：一卡 ≤6 元素，超标拆卡（#117）；按用户目标频率排序（数据置顶 #117）
- 全屏计时页：主题蓝渐变（#54）

## 6. Depth & Elevation

| 层级 | 变量 | 用途 |
|---|---|---|
| 1 | `--shadow-1` 0 1px 2px .04 | 轻微悬浮 |
| 2 | `--shadow-2` 0 1px 3px .06 | 卡片 |
| 3 | `--shadow-3` 0 -2px 16px .08 | 贴底浮层（日历上投影） |
| 4 | `--shadow-4` 0 12px 40px .16 | 对话框/弹层 |
| 玻璃 | 发丝暗线 + inset 白高光 + 渐变边框环 | 玻璃态专用（#72/#84） |

深色：阴影加深（.4-.6 级）。

## 7. Animation & Interaction

**档位 L1**（克制精致，无滚动叙事——设置/记录 App 不需要 L2/L3）：
- tab 滑块：`--ease-spring` 0.55s（#81 液体变形脉冲仅玻璃态）
- 开关/滑块/chips：0.2s ease
- 按钮按压：scale(.97) 即时反馈
- 弹层：上滑进入/下滑淡出 0.3s easeOut（#29）
- 卡片入场：fadeUp 0.3s stagger（原型 #117；正式代码渐进）
- 全部动效尊重 `prefers-reduced-motion: reduce`（时长 0.01ms）
- 性能红线：`backdrop-filter` 仅静态浮层（≤3px 磨砂），禁用于移动元素

## 8. Do's and Don'ts

**Do's**
1. 所有颜色走 CSS 变量（浅/深两套同时维护）
2. 系统字体栈，零下载字体
3. 核心数据大数字突出（stat-num），辅助信息 ink-2/ink-3 退后
4. 触摸目标 ≥ 44×44px
5. 全页统一 hairline 分割线语言
6. 文案温和非评判、非医学诊断（与视觉同调）
7. 数据操作按用户目标频率排序（数据置顶）
8. 动效克制（L1），尊重 reduced-motion

**Don'ts**
1. ❌ 硬编码色值（新增颜色必须入 theme.css 变量）
2. ❌ 单卡塞 8+ 元素（#117 密度红线）
3. ❌ 无标签浮空按钮 / 无上下文的控件
4. ❌ 危险操作与普通操作同卡混排（独立红字区）
5. ❌ 技术术语进用户文案（id/指纹/密文格式）
6. ❌ 分割线风格分裂（数据区与其他卡必须同语言）
7. ❌ 大面积 blur/backdrop-filter 动效（性能红线）
8. ❌ 破坏「数据仅存本地」隐私承诺的文案（如「不经过观己服务器」类废话）

## 9. Responsive Behavior

- 真机铺满：`@media (pointer: coarse)` 全屏无壳（#114 修复——不依赖视口宽度）
- 桌面原型：.phone 390×844 居中带壳（fine 指针）
- 安全区：`--safe-top/bottom` env() 变量适配刘海/手势条
- 平板 >600px：卡片最大 400px 居中（可选）
- 深色模式：data-theme 属性切换，全变量自动
- 玻璃模式：html.liquid-glass 类切换（默认关 #116）
