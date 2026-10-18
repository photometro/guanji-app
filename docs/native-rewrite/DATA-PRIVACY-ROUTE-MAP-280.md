# #280 数据与隐私功能链路收口

## 本轮结论

“备份与恢复”不是只有“恢复数据”。WebView 的父 Sheet 由 `backupSyncBackdrop` 承载，首页包含服务器备份、自动同步、上传新备份、本机文件管理和恢复数据五组入口；恢复再进入 `source → local/server`，管理进入 `localManage/serverManage`。Native 现在由同一个 `NativeBackupSurface` 承载这些页面，并使用单一 `AnimatedContent` 内容槽。

## 本次回归根因

`AnimatedContent` 只有一个内容槽，但 `NativeBackupHome` 等页面原先直接发出多个并列顶层 Composable。Compose 将它们叠放在同一原点，最后渲染的“恢复数据”覆盖了前面的服务器、本机和上传入口。修复方式不是补按钮，而是为每个备份视图提供唯一布局根（当前为 `Column(fillMaxWidth())`），再在根内排列所有入口。

第二个根因是异步桥接误用：`window.__guanjiNativeBackupContext()` 返回 Promise，直接把它作为
`evaluateJavascript` 的返回值会被 WebView 序列化成 `{}`，Native 随后错误进入
`legacy-unavailable`。现在由 `GuanjiNativeBackup.onContext` 接收 Promise 完成后的脱敏快照；
加载、成功、失败和旧桥不可用仍保持独立状态，Native 不再把“桥未就绪”当成“没有文件”。

## 路由所有权

| 功能 | 当前所有者 | 说明 |
| --- | --- | --- |
| 备份与恢复首页 | NativeBackupSurface | Native UI；状态来自脱敏 JS 快照，动作回到既有协议 |
| 服务器备份/自动同步/上传 | Native UI + JS WebDAV 协议 | 不复制 WebDAV 口令、加密包或原始记录 |
| 本机文件管理 | Native UI + Capacitor GuanjiSave | 文件枚举/删除仍由插件完成 |
| 恢复来源、文件选择 | Native UI + Native Restore Engine | 本机下载文件与服务器备份均由同一无 UI 恢复引擎识别、校验、按方案合并/新增/覆盖并原子提交；“浏览其他位置”仍使用系统文件选择兼容入口，选择后的执行回到 Native Engine |
| 导出数据 | Native UI + `DataMaintenanceGateway` → `LegacyJsDataMaintenanceAdapter` | Native 任务面板承载确认、层级和 Tab 遮罩；导出协议仍由 `runDataExport()` / Capacitor 执行，不再打开 `exportBackdrop`；#281 只替换 Adapter，不改变 Native 调用方 |
| 清除全部数据 | Native UI + LegacyJsDataMaintenanceAdapter | Native 确认面板提交 `clearServer` 意图；WebDAV 删除、记录清空和缓存失效仍由既有 JS owner 执行 |
| 恢复演示数据 | Native 任务确认 Sheet + LegacyJsDataMaintenanceAdapter | 由统一 Native Sheet 承载确认、Header 右侧状态和 Tab 遮罩；既有数据协议执行后通过 requestId/dataRevision 回传，关闭后设置行保留状态 |
| 加密切换确认（已加密 → 未加密） | Native SecureMode Sheet + Legacy JS secureDisable 协议 | 确认界面、取消、遮罩和状态回传由 NativeRoot 持有；实际解密仍由现有 `secureDisable()` owner 执行，完成后才刷新 `secureMode` |
| 加密切换确认（未加密 → 已加密） | Native SecureEnable Sheet + Legacy JS secureEnable 协议 | Native 收集并二次确认口令，取消不改变状态；只有 `secureEnable()` 完成后才刷新权威快照，口令不回传 Android |
| 修改口令（已加密） | Native SecureChange Sheet + Legacy JS secureChangePassphrase 协议 | 修改口令表单、键盘适配、取消和状态回传由 NativeRoot 持有；只有确认后调用无 UI `secureChangePassphrase(null, passphrase)`，不再打开 `secBackdrop` |
| AI 数据范围说明 | Native DataScope Sheet | NativeRoot 直接承载说明内容和关闭动画，不再点击 WebView `aiDataScopeBackdrop`；不涉及业务数据写入 |

完整机器可读映射见 `debug/visual-migration/#280-data-privacy-feature-map.json`。

## 验收顺序

1. 先确认 Native 备份首页的五组入口和顺序。
2. 再确认 `home → source → local/server`、`home → localManage/serverManage` 的 push/pop 与返回目标。
3. 对 Native 数据维护面板确认入口、关闭、分享/选择器返回和 requestId 回执；导出/清除/演示恢复不得再显示 WebView backdrop。
4. 最后才进行字号、间距和动画视觉校准；结构缺失时不得进入视觉精修。

## 当前证据

- `debug/visual-migration/backup-fixed2.xml`：备份首页所有入口。
- `debug/visual-migration/localmanage-fixed.xml`：本机文件管理 Native 路由。
- `debug/visual-migration/source-fixed.xml`：恢复来源 Native 路由。
- `debug/visual-migration/export-fixed.xml`：导出 WebView fallback Sheet。

本轮不把静态 verifier 通过当作完整功能签收；服务器动作、真实文件选择/恢复和分享回收仍需在真机回归矩阵中逐项记录。

## 备份卡片计划的本轮落地

- NativeBackupSurface 采用自适应 Sheet 高度：模块区按内容增长，文件列表超过可视区时只在内容区滚动，footer 始终保持稳定。
- 同步、服务器、本机、恢复四类入口复用同源 VectorDrawable 图标、模块卡片 token、统一 footer 分隔线与等宽关闭按钮；上传按钮在不可用时保留蓝色语义但明确禁用状态。
- `dataState`、`localFilesState`、`serverFilesState` 分开表达 ready / loading / empty / error / not-configured，错误状态只显示对应区域的重读入口，不把“无数据”误报为失败。
- Sheet 入场、退出、内容淡入和自适应高度过渡均由同一个 NativeBackupSurface 管理；WebView 的二级路由是在同一 Sheet 内原位切换并过渡高度，不使用横向 push/pop。关闭动作等待退出动画完成后再交回 NativeRoot，不新建 Activity 或 Tab 宿主。
- 加密选项只接受设置快照中的 `secureMode` 权威值；口令对话框取消不会乐观写入“已加密”。
