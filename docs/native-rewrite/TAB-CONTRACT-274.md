# #274 共享 Tab 视觉迁移契约

基线：观己 v4.1.5 WebView（`www/css/tabbar.css`、`www/css/glass.css`、`www/index.html`、`www/js/app.js`）。本条只迁移底部三个 Tab；首页正文、记录面板、日历和其他页面仍由 WebView 所有。

## 几何与材质

| 项目 | WebView 基线 | Native 实现约束 |
| --- | --- | --- |
| 外层位置（真机） | `left/right: 12px`；`bottom: 18px + safe-bottom` | NativeRoot 内同一 `ComposeView`，左右 12dp、底部 18dp；不贴屏、不占满正文 |
| 外层高度 | 58px | 58dp |
| 外圆角 | 26px | 26dp |
| 外层内边距 | `padding: 0 10px` | Row 水平 10dp |
| 选中层 | `top/bottom: 5px`，圆角 22px（玻璃态） | 每格上下 5dp，圆角 22dp，单一移动层 |
| Tab 内容 | `tab-pill`：水平 18px、垂直 7px、图标 22px、gap 3px | 同值；文字 11sp、行高 13sp；活动字重 700 |
| 背景 | 经典：`--glass`；玻璃：`--lg-tint` + `blur(var(--lg-blur)) saturate(var(--lg-saturate))` | **当前仅迁移经典模式**：Native 使用不透明同主题底色，避免正文分割线透过形成白线；Android 宿主使用同胶囊 outline 的 `10dp` 阴影维持层级；玻璃模式由 WebView 继续负责，`NativeTabBackdropView` 与材质桥仅作为后续玻璃迁移预留；API <31 使用同主题安全降级，不得出现额外白壳/黑色覆盖 |

## 三项与路由

```text
首页  data-screen=home      → GuanjiRoute.HOME
洞察  data-screen=analysis  → GuanjiRoute.INSIGHT
我的  data-screen=me        → GuanjiRoute.SETTINGS
```

WebView 原始 SVG 路径记录在 `www/index.html` 的 `#tabbar`。Native 图标必须保持 22dp 画布、同色 currentColor、线宽 1.6/1.8，禁止使用系统图标替代。

## 动画与交互

- `tab-slide` 只做同宽横向位移，550ms，`cubic-bezier(0.23, 1, 0.32, 1)`；无弹簧回弹、缩放、ripple、黑色 pressed overlay。
- 经典模式下选中状态由 Native 唯一渲染；玻璃模式保持 WebView `#tabbar` 可见并由 WebView 唯一渲染，禁止两套 Tab 同时显示。
- Native 点击调用 WebView 既有 Tab click 入口；WebView 仅回传 `data-screen` 路由和主题，不重算业务数据。
- 反复点击、系统 Back、前后台恢复和重启必须保持单一选中态。
- 主题/材质事实由 WebView 初始化与切换事件回传；NativeRoot 同步宿主背景并在 Android View 层按胶囊轮廓裁剪，不能依赖系统 `uiMode` 重建。

## 状态覆盖

浅色/深色、经典/玻璃、三项路由、窄屏、fontScale ≥ 1.3、手势导航、魅族 Flyme 底部横条、横竖屏锁定。证据必须包含同 viewport/density/fontScale 的 WebView 与 Native 截图、bounds、无障碍树和动画采样。
