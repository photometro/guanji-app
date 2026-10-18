# #280「我的」页面功能与交互回归收口

## 目标

本任务不是重新设计「我的」页面，而是把原生页面恢复到可用状态：WebView 仍是视觉、文案、弹层和设置存储的事实来源；Compose 只负责经典模式的渲染、即时反馈和脱敏快照展示。

## 根因

1. 原生设置动作调用既有 WebView/Capacitor 处理器后，会先设置 `nativeHomeSuppressed=true`。旧实现缺少统一的“弹层关闭/动作完成”回收路径，导致一次导出、清除、恢复、数据范围或安全设置动作可能让原生设置页永久消失。#280 P0 已把“修改口令”和“数据范围”从该兼容集合移出，二者不再设置 suppressed 或打开旧 DOM overlay。
2. 设置控件先等异步快照才更新，点击反馈滞后；本轮由 `NativeSettingsData.optimistic` 先更新当前 Compose 状态，再由 JS 持久化快照覆盖。
3. 备份二级页面直接替换内容，没有表达一级→二级和二级→一级的层级关系；本轮在同一 `NativeBackupSurface` 内增加方向感知的 `AnimatedContent`，不创建第二个 Activity、Tab 或 Sheet Host。
4. 设置快照只传 `hasApiKey`/配置状态，不传原始 API Key；AboutCard 复用项目当前图标资源，避免临时 Material 图标漂移。

## 实施边界

- P0：功能链路、状态持久化、Native/WebView 路由回收；
- P1：点击立即反馈，禁止同步 IO 阻塞首帧；
- P2：复用 WebView 既有弹层动效；Native 仅新增备份二级路由的方向过渡；
- P3：保持单 `MainActivity -> NativeRoot` 与单 Tab/Sheet 所有权；
- P4：布局继续以 #278 契约和 WebView 测绘为准，不用 Material3 默认组件重画；
- P5：使用 `guanji_icon_01c` 同源资源，不能用相似 Material/Emoji 图标替代。

## 运行时回归要求

每个功能必须完成：点击、状态变化、返回、重新进入、进程重启、Native/JS 所有权检查。代理 WebView 弹层关闭后必须恢复 Native 设置页面；若动作没有找到旧入口，也不能把 Native 页面永久隐藏。

证据清单与功能矩阵见 `debug/visual-migration/#280-settings-feature-matrix.json`。本文件不把“静态检查通过”当作视觉签收；#279/#280 的同状态真机对照仍需单独记录。
