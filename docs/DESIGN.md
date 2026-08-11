# DESIGN.md — 观己「我的」页 · 数据管理区设计规范

> 场景：移动 App 设置页（单列手机布局），非落地页。
> 基座：观己既有 Apple 设计语言（theme.css 变量体系）。本规范只约束「我的」页数据管理区（数据保护 / 备份与恢复 / 危险操作）。

## 1. Visual Theme & Atmosphere

**设计哲学**：轻盈、克制、留白充足、柔和层级（Apple 语言）。
**一句话定调**：数据管理区 = 冷静可信的安全角落——不要堆叠、不要噪音，每个操作一眼可见。
**氛围关键词**：冷静 / 透气 / 可信 / 克制。
**治丑原则**：**一卡 ≤ 6 个元素**；密度超标时拆卡，不堆单卡。

## 2. Color Palette & Roles

全部继承 `www/css/theme.css` 变量（浅/深两套），零新硬编码色：

| 变量 | 值（浅） | 值（深） | 角色 |
|---|---|---|---|
| `--bg` | #F2F2F7 (242,242,247) | #121212 (18,18,18) | 页面底 |
| `--card` | #FFFFFF (255,255,255) | #1E1E1E (30,30,30) | 卡片底 |
| `--ink` | #000000 | #FFFFFF | 主文字 |
| `--ink-2` | #6E6E73 (110,110,115) | #98989F | 次级文字/组标签 |
| `--ink-3` | #C7C7CC (199,199,204) | #6E6E73 | 说明/占位 |
| `--line` | #E5E5EA (229,229,234) | #3A3A3C | 分隔线 |
| `--accent` | #007AFF (0,122,255) | #0A84FF | 主操作（开启加密/立即备份） |
| `--accent-deep` | #0062CC | #409CFF | 危险/强调文字 |
| `--sage` | #34C759 (52,199,89) | #32D74B | 已加密状态点 |
| `--shadow-2` | 0 4px 14px rgba(0,0,0,.08) | 同上 | 卡片层级 |

## 3. Typography Rules

- 字体族（沿用观己）：`-apple-system, BlinkMacSystemFont, "SF Pro SC", "PingFang SC", "Segoe UI", sans-serif`
- 字号层级：
  | 角色 | 字号/字重 | 颜色 |
  |---|---|---|
  | 卡标题 | 15px / 700 | --ink |
  | 行主文字 | 14px / 400 | --ink |
  | 行副说明 | 11px / 400 | --ink-3 |
  | 组标签 | **13px / 500**（中文，**禁用 uppercase**） | --ink-2 |
  | 状态行 | 12px / 400 | --ink-2 |
  | 页脚说明 | 11px / 400 | --ink-3 |
- 中文行高 ≥ 1.6；禁全大写英文标题（外来语言）。

## 4. Component Stylings

### 4.1 卡片 `.card`
```css
.card {
  background: var(--card);
  border-radius: 16px;
  padding: 6px 14px 8px;
  box-shadow: var(--shadow-2);
  margin-bottom: 14px;
}
```
hover: 无（移动端）；focus-visible: 2px accent outline。

### 4.2 组标签 `.group-label`（治丑关键——去 uppercase）
```css
.group-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--ink-2);
  padding: 12px 2px 4px;
  letter-spacing: 0.02em;
}
.group-label.danger { color: var(--accent-deep); }
```
组间分隔：**不用分隔线**，用 `margin-top: 6px` 的组标签自带留白（删除 group-sep 横线——生硬）。

### 4.3 主操作按钮（开启/关闭加密、立即备份）
```css
.btn-primary {
  display: flex; align-items: center; justify-content: center;
  background: var(--accent); color: #FFF;
  border-radius: 999px; padding: 13px;
  font-size: 15px; font-weight: 600;
  box-shadow: var(--shadow-2);
  transition: transform .15s ease, background .2s ease;
}
.btn-primary:active { transform: scale(0.97); }
.btn-primary.disabled { opacity: .45; }
```

### 4.4 行 `.row-btn`
```css
.row-btn {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 14px 2px;
  font-size: 14px; color: var(--ink);
  border-bottom: 0.5px solid var(--line);
  background: none; text-align: left;
}
.row-btn:last-child { border-bottom: none; }
.row-btn:active { opacity: .6; }
.row-btn.danger { color: var(--accent-deep); }
```
箭头 chevron：--ink-3，16px，flex-shrink:0。

### 4.5 开关行 `.switch-row`（#117：与 row-btn 统一 hairline——全页一套分割线语言）
```css
.switch-row { display: flex; align-items: center; justify-content: space-between; padding: 13px 2px; gap: 12px; border-bottom: 0.5px solid var(--line); }
.switch-row:last-child { border-bottom: none; }
.switch { width: 51px; height: 31px; border-radius: 16px; background: #E9E9EB; transition: background .2s; }
.switch.on { background: var(--sage); }
.switch .knob { width: 27px; height: 27px; left: 2px; transition: left .2s; }
.switch.on .knob { left: 22px; }
```
> **分割线统一规则**：全页所有设置行（row-btn / switch-row）使用 0.5px hairline，**每组最后一行无线**——数据区与提醒/外观等卡同一语言，禁止「数据区有线、其他无线」的分裂。

### 4.6 状态行（加密状态）
```css
.state-line { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-2); padding: 2px 4px 12px; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.dot.gray { background: var(--ink-3); }
.dot.green { background: var(--sage); }
```

### 4.7 chips（外观/记录方式选择）
```css
.chip { border-radius: 999px; padding: 8px 16px; font-size: 13px; background: var(--bg-elev); border: 1px solid var(--line); color: var(--ink); transition: all .2s; }
.chip.active { background: var(--accent); border-color: var(--accent); color: #FFF; }
```

## 5. Layout Principles

- 页面容器：左右 16px，卡间距 14px，卡内 padding 14px
- **密度红线：一卡 ≤ 6 个元素；超标拆卡**
- 数据区三卡结构（治丑核心）：
  ```
  数据保护（≤4 元素：状态行/开启或关闭加密/修改口令）
  备份与恢复（≤5 元素：立即备份/恢复数据/备份文件/服务器备份/自动开关）
  危险操作（≤2 元素：清除全部/恢复演示；独立卡，红字）
  ```
- WebDAV 配置折叠在「服务器备份」行内（不展开成表单堆）

## 6. Depth & Elevation

- 卡片：`--shadow-2`（0 4px 14px rgba(0,0,0,.08), 0 1px 4px rgba(0,0,0,.05)）
- 弹层（dialog/sheet）：`--shadow-4`（0 20px 50px rgba(0,0,0,.2)）
- 主按钮：`--shadow-2`；按压 scale(.97) 去阴影

## 7. Animation & Interaction

**档位 L1**（精致静态，移动设置页无需滚动叙事）：
- 卡片入场：fadeInUp 0.3s easeOut（首屏 stagger 60ms）
- 开关：background/knob 0.2s
- chips 选中：0.2s 平滑
- 行按压：opacity .6（即时反馈）
- 全部动效尊重 `prefers-reduced-motion: reduce`（时长 0.01ms）
- 性能红线：`backdrop-filter` 不用于移动中元素；无大范围 blur

## 8. Do's and Don'ts

**Do's**
1. 一卡 ≤6 元素，密度超标拆卡
2. 每个控件有明确标签（无浮空无标签按钮）
3. 危险操作独立卡 + 红字
4. 数据区按「用户目标频率」置顶（数据 > 记录 > AI > 显示）
5. 颜色全走 CSS 变量
6. 触摸目标 ≥ 44×44px
7. 状态用一句话 + 小圆点表达

**Don'ts**
1. ❌ 单卡塞 8+ 元素（E2 的病根）
2. ❌ 用 `text-transform: uppercase` 大写小标题（外来语言）
3. ❌ 组间加生硬横分隔线（用留白）
4. ❌ 无标签按钮浮空（A 方案的三个 chip 病根）
5. ❌ 危险操作与普通操作同卡混排
6. ❌ 技术术语进操作文案（id/指纹/密文格式）
7. ❌ 设置项与其作用域隔页（外观设置不与效果分离）
8. ❌ 弹窗堆叠控件（单弹窗 ≤3 交互元素）
9. ❌ 分割线风格分裂（数据区有线、其他卡无线——全页统一 hairline）

## 9. Responsive Behavior

- 单列布局，页面容器 16px 边距
- 触摸目标 ≥ 44×44px（行高 48px、开关 31px 高但整行可点）
- 卡片宽度 100% - 32px；>600px（平板）卡片最大 400px 居中
- 深色模式：变量自动切换，无额外规则
