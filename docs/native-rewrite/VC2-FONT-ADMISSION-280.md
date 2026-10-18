# #280 VC2 字体准入与来源结论

状态：`passed`（2026-09-22）

## 1. WebView 事实源

`www/css/theme.css` 的 `--font` 是系统字体栈：

```css
-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
"Helvetica Neue", "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei",
sans-serif
```

它不是随观己 APK 分发的品牌字体。VC2 不把 SF Pro、PingFang、HarmonyOS Sans 或其他第三方字体复制进 APK。

## 2. Native 准入决策

- Native 候选：Android `FontFamily.SansSerif`，交给系统按设备语言和字体配置解析；
- 字体合成：`FontSynthesis.None`，不让设备伪造缺失字重；
- 字体资源：当前不新增 `ttf/otf/woff/woff2`；
- 许可证：无嵌入字体，因此不产生额外字体版权/许可证包；
- ABI：不增加字体或渲染原生库，沿用现有 Android ABI；
- fontScale 准入档位：`1.0 / 1.15 / 1.30`，VC0 固定基线仍使用 `1.0`。

VC2 只冻结来源和准入边界，不在本阶段批量替换页面 `TextStyle`。实际页面角色映射放在 VC3，避免把字体来源审查和视觉修复混成一次大改动。

## 3. 真机准入证据

脚本：`debug/verify-280-vc2-font-admission.cjs`

报告：`debug/visual-migration/#280-p6-vc0-20260922/vc2-font-admission-report.json`

两台魅族设备在线并通过同一版本校验：

- Meizu 18S：`[序列号已省略]`
- Meizu 21：`[序列号已省略]`

报告同时记录设备 API、尺寸、density、fontScale、导航模式和已安装包版本，确保后续 VC3 不是无条件假设字体环境一致。

## 4. 边界与下一步

VC2 不修改 Sheet、Insets、Footer、Tab、动画或业务逻辑，也不升版本号。若未来要嵌入字体，必须先新增字体许可证、APK 体积、ABI 和字体渲染回归评审，不能直接把字体文件放入 `res/font`。

下一步是 VC3：按 WebView CSS 角色分批把页面 Typography 映射到 `NativeTypography`，每一批重跑 VC0，并保持 R9/IME/弹性布局不回归。
