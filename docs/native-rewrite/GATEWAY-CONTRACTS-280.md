# #280 分领域 Gateway 契约与迁移边界

## 目标

将原生页面与迁移期 JS/Capacitor 实现解耦。Native Surface 只依赖领域 Gateway，不直接调用 `window.__guanji*`、DOM 点击、backdrop 或可见性轮询。#281 只替换 Gateway 的 Adapter，不再改动页面调用方。

## 公共协议

`GatewayCommand`：

- `requestId`：一次动作或读取请求的唯一标识，用于防重复与回执关联；
- `action`：仅允许当前领域登记的动作名；
- `value`：脱敏的展示/动作参数，禁止放入 API Key、口令、原始记录、备份正文；
- `dataRevision`：读取快照的版本号，旧回调不得覆盖新版本。

`GatewayResult`：

- `requestId`；
- `status`：`started`、`ready`、`completed`、`cancelled`、`failed`；
- `dataRevision`；
- `errorCode`；
- `message`：只允许脱敏快照或用户可展示的安全文案。

`GatewayRevisionGate` 对每个领域独立维护 in-flight/completed revision，阻止同一 revision 的重复读取和旧回调覆盖新状态。它不保存业务数据。

## 领域所有权

| Gateway | Native 调用方 | #280 迁移期 Adapter | #281 目标 Adapter | 禁止跨界 |
| --- | --- | --- | --- | --- |
| `RecordFlowGateway` | 记录/计时/补记 Surface | `LegacyJsRecordFlowGateway` | Kotlin/Room 记录流程 | 不读取设置或备份文件 |
| `InsightGateway` | 洞悉 Surface | `LegacyJsInsightGateway` | Kotlin Insight/AI Provider | 不读取原始记录或 API Key |
| `SettingsGateway` | 我的/设置 Surface | `LegacyJsSettingsGateway` | Native preferences/SecureStorage | 不渲染其他领域 Sheet |
| `BackupGateway` | 备份/恢复 Surface | `LegacyJsBackupGateway` | Filesystem/WebDAV/BackupEnvelope | 不传递口令、密钥或文件正文 |
| `DataMaintenanceGateway` | 导出/清除/演示恢复 | `LegacyJsDataMaintenanceAdapter` | Kotlin/Room/Filesystem | 不改变页面路由宿主 |

## 读取规则

读取是异步单次请求：

```text
Surface → Gateway.readSnapshot(command, callback)
       → 当前 Adapter/owner
       → callback(GatewayResult)
       → Surface 按 requestId + dataRevision 收敛状态
```

不得把 Promise 直接作为 `evaluateJavascript` 返回值；JS 异步结果必须通过已登记的回调回传。`loading`、`ready`、`empty`、`error` 必须可区分，空对象不能当作成功快照。

## 写入规则

写入使用显式回执，不通过 DOM 或页面可见性猜测完成：

```text
Surface → Gateway.dispatch(command, callback)
       → owner 执行
       → callback(started/completed/failed)
       → Native 局部更新，不重建宿主 Sheet
```

设置允许先显示乐观反馈，权威状态随后由快照回读收敛；备份上传/删除/刷新必须是局部 action state；危险操作只在确认后执行。

## 路由与宿主边界

- 只有 `MainActivity → NativeRoot` 一个可见宿主；Gateway 不得创建 Activity、Tab、Sheet 或 WebView backdrop。
- 经典/普通模式由 NativeRoute 渲染；玻璃模式在 #280 仍由 WebView 兼容路径承载，#281 不删除静态说明页以外的核心 JS 前，必须先完成稳定签收。
- Gateway 只传递领域数据和结果，不决定页面导航。导航由 `NativeRoot`/`RouteHost` 持有。
- `DataMaintenanceGateway` 的导出、清除、演示恢复属于迁移期业务 Adapter，不能把 WebView fallback 误标成 Native 业务已完成。

## 隐私边界

永不进入命令、回执、日志、UI 树或调试证据：原始记录正文、备注、精确事件时间、API Key、WebDAV 密码、恢复口令、DEK、BackupEnvelope 和文件内容。只传递渲染所需的脱敏摘要、状态和错误码。

## 替换条件

当 #281 替换某领域 Adapter 时：

1. 先用同一组黄金 fixture 比较旧 Adapter 与新 Adapter 的 `GatewayResult`；
2. 再执行该领域 verifier、冷/热启动和进程重启回归；
3. 确认 UI 不需要改动后，才删除对应 Legacy JS Adapter；
4. 若必须改 UI，说明 #280 契约泄漏了实现细节，应退回修正，不能边删边改页面。

## 验证证据

- `debug/visual-migration/#280-preflight.json`
- `debug/visual-migration/#280-device-evidence/`
- `debug/verify-280-settings-regression.cjs`
- `debug/apk-build-summary.json`
- `npm run verify:280`、`npm run verify:279`、`npm run verify:276`
