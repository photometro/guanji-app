# #279 备份、恢复与 WebDAV 经典模式迁移契约

基线：v4.1.5 WebView（versionCode 113，commit `c113bcf4c7729d0978ded3f37f3ab76496334af1`）。

## 宿主与层级

- 仍由唯一 `MainActivity → NativeRoot → NativeRegionSurface` 承载；不新建 Activity、Tab 或第二个全屏 SheetHost。
- 入口为「我的 → 数据与隐私 → 备份与恢复」，在设置页上方以同树前景面板显示；关闭后回到设置页，子页返回到 `home → source → local/server` 的原有父级。
- `backup`, `localManage`, `serverManage`, `source`, `local`, `server`, `webdavConfig` 是同一 route stack 的状态，不是多个同时存在的 dialog。
- 经典/普通模式由 Compose 承接；玻璃模式仍由 WebView 的 `backupSyncBackdrop` / `wdCfgBackdrop` 唯一承接。

## WebView 事实来源

- DOM 入口：`#backupSyncBackdrop`, `#backupHubSheet`, `#wdCfgBackdrop`。
- 页面选择器：`[data-backup-hub-view]`、`[data-backup-hub-footer]`、`.backup-source-action`、`.backup-list-host`、`.history-list`、`.sheet__footer`。
- 既有导航：`www/js/ui-sheet.js` 的 `BACKUP_HUB_PARENT`；既有协议：`www/js/secure.js`、`www/js/webdav.js`、`www/js/backup-picker.js`。
- Native 不复制 BackupEnvelope、WebDAV、加密/解密或未知字段处理；动作通过 JS 既有函数/Capacitor 插件回到原协议链。

## 视觉与状态契约

- 普通卡片：`.sheet--task` 的悬浮几何、22px 外圆角、经典 `var(--card)`、阴影和固定 footer。
- 入口卡片沿用 `.backup-source-action`：15px 圆角、15px/14px 内边距、30px 图标容器、标题 13px、小字 11px、箭头 19px。
- 列表：最新文件/备份独立主卡片；更早列表默认展示 3 行，超过 5 条在列表内部滚动；底部操作区始终固定。
- HOME 恢复卡片后不显示“正在读取备份状态”占位文案，也不为该文案预留尾部高度；加载过程保持安静，真实错误才显示可操作的重试行。HOME 内容底部留白采用紧凑节奏，不能把剩余高度推到恢复卡片与固定 footer 之间；LOCAL/SERVER 输入页仍保留键盘专用滚动尾部。
- 必须覆盖：空数据、未配置、已配置、上传中、失败、重试、WebDAV 配置表单、明文/加密文件、服务器/本机文件及旧备份。

## 迁移禁止项

- 不得隐藏或重建底部 Tab 来解决遮挡；由同一 Compose 绘制顺序 `页面 → Tab → Backup Sheet` 解决层级。
- 不得把玻璃规则复制到 Native；不改备份协议、文件名、BackupEnvelope、未知字段保留和恢复模式。
- 不得用固定全屏列表替代内部滚动，也不得把历史条数写死为只保留 5 条数据。

## 验收证据

- 同一视口/密度/主题下，完成 home、localManage、serverManage、source、local、server、webdavConfig 七个状态的 WebView/Native 对照。
- 每个状态记录入口、父子返回、列表滚动、footer 固定、配置未完成/错误态；玻璃模式确认仍为 WebView owner。
