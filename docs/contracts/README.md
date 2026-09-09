# 观己 P0 协议与准入契约（#221）

本目录是 #220 长期路线进入 v4.x 之前的公共契约层。它只固化协议、黄金样本和准入条件，不提前切换 Room、Kotlin 统计权威或 Compose UI。

## 六类协议

| 协议 | 用途 | 当前复用来源 |
| --- | --- | --- |
| `RecordEvent` | 直接记录、计时记录、补记和旧记录的统一事件边界 | `www/js/records.js`、`Storage` |
| `StatsSnapshot` | 首页、洞悉、AI 聚合、小组件共享的单次统计快照 | `buildStatsSnapshot()`、`syncWidgetStats()` |
| `BehaviorModelSnapshot` | 个人基线、偏离、自然周持续性、候选变化期和个人模式的模型结果 | #225–#229；#228 已实现 |
| `EvidenceGraph` | 将模型事实转换成可追溯证据与关系 | #226 已实现；#227/#228 已接入持续性与候选变化期 |
| `InsightCache` | AI 结构化报告的脱敏缓存和失效指纹 | `www/js/ai.js` |
| `BackupEnvelope` | 加密备份包、版本兼容和未知字段保留边界 | `secureExportPackage()`、WebDAV |

## 验证入口

```powershell
node debug/verify-221-contracts.cjs
```

脚本只使用 Node 内置模块，不依赖联网或第三方包。它校验：

- 六个 Schema 和黄金样本的类型、必填字段与嵌套结构；
- 未知字段往返保留；
- AI 输入不包含单条记录、备注或精确时间线；
- 桥接一次返回完整快照，而不是按卡片多次请求；
- v3.53/v3.87、CSV、WebDAV、时区、异常日期、小组件、AI 缓存和迁移中断样本均有覆盖。

## 版本策略

`schemaVersion`、`modelVersion`、`dataRevision`、`timezone` 和 `Evidence` 版本必须随协议一起传递。新增字段默认向前兼容；导入和迁移不得丢弃未知字段。
