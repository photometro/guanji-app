# #222 Kotlin 边界

## 当前节点

- `core.data`：公共契约版本、请求和六类 JSON 包装器；未知字段保留。
- `core.stats`：只消费聚合 `StatsSnapshot`，补齐协议必需字段，不扫描原始记录。
- `core.behavior`：生成可供六张洞悉卡渲染的最小行为快照，暂不实现个人基线算法。
- `core.ai`：Provider、结构化错误和 `InsightCacheKey` 接口；现有 JS AI 请求继续运行。
- `core.migration`：旧 Storage → Room 的迁移边界；实际 Room 影子库由 #223 接入。

## 桥接规则

`BehaviorSnapshotPlugin.requestBehaviorSnapshot` 一次接收聚合 StatsSnapshot 和可选的 #225 `behaviorInput`，一次返回 `statsSnapshot`、`snapshot` 和 `evidenceGraph`。WebView 适配器按 `dataRevision` 去重，同一 revision 不并发重复请求；桥不可用时继续使用现有 JS 统计和 last-known-good 降级链路。`behaviorInput` 只含按日计数、持续时间分布和质量摘要，不含原始记录。

## 发行版边界

本节点没有加入发行版后端、Room 权威存储或 SQLCipher 运行时；它只定义原生化阶段的 Kotlin/JS 协议边界。历史上用于毕业设计验证的 `server/` 实验目录不属于本仓库后续路线。
