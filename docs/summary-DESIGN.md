# DESIGN — 汇总页（基于观己 v3.3 计时页视觉语言）

生成日期：2026-08-08
适用范围：timerScreen 内「汇总视图」（计时结束同容器切换）

## 1. Visual Theme & Atmosphere
延续 v3.3 全屏计时页的「沉浸运动感」：主题蓝渐变 + 白色大数字 + 白色大圆按钮。汇总页与计时页同容器切换，视觉必须连续——同一渐变背景、同一白色文字体系、同一按钮语言。氛围关键词：沉浸、克制、运动记录感。

## 2. Color Palette（复用 styles.css 现有变量，零新增主色）
- 背景渐变：`--timer-bg-1: #0A84FF` → `--timer-bg-2: #0040A8`（180deg，复用 .timer-screen）
- 主文字：#FFFFFF（白，渐变上）
- 次级文字：rgba(255,255,255,0.75) / rgba(255,255,255,0.6)
- chips 底：rgba(255,255,255,0.16) + 边框 rgba(255,255,255,0.28)
- chips 选中底：#FFFFFF / 文字 #0040A8
- 主按钮：#FFFFFF 底 + #0040A8 字（= .timer-finish-btn）
- 次按钮：rgba(255,255,255,0.2) 底 + #FFF 字
- 放弃：透明 + rgba(255,255,255,0.6) 字
- 开关：on 态 #34C759（--sage）

## 3. Typography（延续计时页 + #53 规范）
- 眉题「本次计时」：11px / 600 / letter-spacing 0.14em / rgba(255,255,255,0.7)
- 时长「已计时 12 分钟」：40px / 800 / letter-spacing -0.02em / line-height 1.1 / #FFF / tabular-nums（居中，延续 .timer-big 大数字语言，尺寸收敛防过猛）
- 开始时刻：13px / rgba(255,255,255,0.6)
- 区块标题（情绪/诱因）：13px / 700 / rgba(255,255,255,0.85)
- chips 文字：13px / 600 / #FFF
- 主按钮：17px / 700 / #0040A8（= .timer-finish-btn）
- 次级按钮：13px / 600 / #FFF

## 4. Component Stylings
- **chips（渐变上胶囊）**：default rgba(255,255,255,0.16) + 边框 0.28；active #FFF 底 + #0040A8 字；添加项 dashed 边框 rgba(255,255,255,0.5)；padding 7px 14px；radius 999px
- **主按钮**：全宽 340px max、白底、#0040A8 字 17px/700、radius 999px、shadow 0 8px 32px rgba(0,0,0,0.22)（= .timer-finish-btn）
- **次按钮（继续计时）**：全宽、rgba(255,255,255,0.2) 底、白字、radius 999px、padding 12px
- **放弃**：透明、rgba(255,255,255,0.6) 字 13px、padding 10px
- **开关**：轨道 rgba(255,255,255,0.4)，on #34C759，白色 knob
- 状态：active 均 scale(0.97)；focus-visible 白 outline

## 5. Layout Principles
- 容器：居中 flex 列（延续 .timer-screen-inner：padding 48px/28px + safe-area）
- 间距梯度：数字下 6px（meta）→ 24px（chips 区）→ 区块 20px → 按钮区 28px
- 内容宽度 max 340px；数字居中（延续计时页 centered 语言）

## 6. Depth & Elevation
- 主按钮：0 8px 32px rgba(0,0,0,0.22)（= .timer-finish-btn 阴影，浮起感）
- 数字：text-shadow 0 4px 24px rgba(0,0,0,0.18)（= .timer-big）
- 渐变背景自带纵深，不另加卡片阴影

## 7. Animation & Interaction
- 同容器视图切换（计时↔汇总）：瞬间切换，无转场（延续 #62 决策）
- 按钮/开关：active scale(0.97) / 开关 knob 0.2s 过渡（现有语言）
- 尊重 prefers-reduced-motion（开关过渡降为 opacity）

## 8. Do's and Don'ts
- ✅ 延续计时页渐变+白色体系；✅ 数字是唯一焦点（40px 收敛）；✅ 信息三分组（情绪/诱因/看片）紧凑
- ✅ 按钮主次明确（白主按钮 > 半透明次按钮 > 透明放弃）
- ❌ 不用大白卡片区（v1 失败：白纸贴渐变上突兀）；❌ 数字不超 44px（v3 失败：56px 过猛）
- ❌ 不做浅色背景回归（v2/v4 失败：与计时页割裂）；❌ 不加装饰性元素（克制）
- ❌ chips 不用浅色系统样式（渐变上不可读）；❌ 不引入新主色

## 9. Responsive
- 移动端竖屏为主；内容 max 340px 居中；安全区 bottom padding；触摸目标 ≥ 44px（chips padding 7px 14px + 间距达标）
