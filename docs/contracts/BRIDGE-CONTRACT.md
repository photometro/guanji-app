# Behavior Snapshot Bridge Contract

这是 #221 固化的 Kotlin ↔ WebView 对偶桥契约。桥只传递聚合结果，不传输全量记录。

## 单次请求

请求名固定为 `requestBehaviorSnapshot`，一次请求包含当前 `dataRevision`、`schemaVersion`、`requestedAtMs` 和 `timezone`：

```json
{
  "type": "behaviorSnapshot",
  "schemaVersion": 1,
  "dataRevision": 42,
  "requestedAtMs": 1788681600000,
  "timezone": "Asia/Shanghai",
  "behaviorInput": "{\"inputVersion\":1,\"baselineDays\":56,\"currentWindowDays\":28,\"dailySeries\":[] }"
}
```

`behaviorInput` 是 #225 的可选聚合输入：只包含 56 天按日计数、持续时间数值分布和覆盖元数据，不包含记录 ID、备注、观察原文、精确时间戳或完整事件数组。缺失时 Kotlin 返回 `baseline.status=insufficient`，不阻塞既有快照回退。

## 单次响应

一次响应必须返回完整 `StatsSnapshot`、`BehaviorModelSnapshot`、模型结果和（可选的）`EvidenceGraph`。不得按六张卡片分别调用，也不得把 `RecordEvent[]` 放进响应。

```json
{
  "ok": true,
  "schemaVersion": 1,
  "dataRevision": 42,
  "statsSnapshot": { "...": "StatsSnapshot" },
  "snapshot": { "...": "BehaviorModelSnapshot" },
  "evidenceGraph": { "...": "EvidenceGraph" }
}
```

失败使用结构化错误，不覆盖页面已有可信快照：

```json
{
  "ok": false,
  "error": { "code": "STALE_REVISION", "retryable": true, "message": "snapshot is older than requested revision" }
}
```

## 时序与去重

- WebView 以 `dataRevision` 去重防抖；同一 revision 的并发请求最多保留一个。
- Kotlin 侧在一次请求内完成统计、模型、证据图和 JSON 序列化。
- JS 只渲染桥返回的快照，不重新扫描记录、不按卡片重算。
- 桥不可用、超时或版本不兼容时，沿用现有 `buildStatsSnapshot()` 与 last-known-good 降级链路。
- `timezone`、`todayKey`、`revision` 和 `freshness` 必须保持与现有小组件协议一致。

## EvidenceGraph（#226）

- 每个节点必须带 `evidenceId`、`dataRevision` 和 `modelVersion`；节点 ID 由指标与当前修订号确定（例如 `ev-recorddensity-42`），不可跨快照复用。
- 节点只描述聚合统计或个人基线结果，可包含状态、幅度、持续性、置信度和限制；当前持续性尚未计算时使用 `not_evaluated`，不得伪造持续结论。
- AI 返回结构化 `claims` 时，每条 claim 必须包含 `claimId`、允许的 `claimType`、短文本和至少一个 `evidenceRefs`。WebView 只接受当前图中存在且版本/修订号同时匹配的 Evidence ID；未知或过期引用整条结果拒绝并保留旧报告。
- #230：AI 只有在 claims 包含跨维度综合、时间比较、模式假设、不确定性解释、反证或下一步观察等新增价值类型时才进入 AI 单态；仅重复本地事实的报告保留缓存但不显示，并记录 `aiAddedValue=false`。
- 生成成功的 AI 缓存会连同当次 EvidenceGraph 保存；重启后先用缓存中的证据图校验 claims，再决定是否恢复报告，避免因桥尚未初始化而丢弃可验证的旧报告。
- EvidenceGraph 不包含原始记录、备注、附件、精确时间线或可逆的单条事件标识。桥不可用时不阻塞旧的聚合 AI 流程。

## Persistence（#227）

- `snapshot.persistence` 按不重叠的周一至周日生成证据块；首尾不完整自然周只作为覆盖限制，不参与持续性判定。
- 每个指标使用前半段完整周块作为个人参考期、后半段作为近期观察期，沿用 #225 的 Median/IQR/MAD 稳健偏离尺度，输出 `stable`、`single_shift`、`repeated_shift`、`returning` 或 `uncertain`。
- `persistence` 条目必须包含指标、规则版本、状态、方向、置信度、证据周块和限制说明；它只描述相对个人基线的变化，不代表健康、正常值或因果关系。
- 完整周块不足 4 个、近期有效块不足或方向混合时返回 `uncertain`；不得把偶发尖峰标记为持续变化。
- EvidenceGraph 的指标节点将 `persistence` 映射为上述状态，AI 只能在当前 `dataRevision` 与 `modelVersion` 范围内引用该结果。

## Candidate Change Period（#228）

- 每个 `persistence` 条目增加 `changePoint`：使用近期完整自然周的滚动偏离序列与持续性状态，给出 `candidate`、`not_detected` 或 `uncertain`。
- `candidate` 只包含起止周区间、偏离方向、`evidenceBlockIds`、置信度和限制说明；证据块 ID 必须对应同一条目已经输出的 `week-*` 周块。
- 单个偏离周、方向混合、未知周块或有效块不足不会生成可靠起点；结果是候选变化期，不代表正式变化点、健康判断或因果关系。
- 方法版本固定为 `rolling-deviation+persistence-v1`，复杂 PELT、CUSUM、Bayesian Change Point 等算法留待后续任务评估。

## Co-occurrence and Temporal Co-movement（#229）

- `behaviorInput.observationPairCounts` 只允许传递最近 28 天按稳定状况 key 聚合的组合计数与样本数，不包含单条记录、备注、精确时间或事件 ID。
- `snapshot.relations` 同时承载 `event_cooccurrence`（同一记录内共同出现）与 `temporal_co_movement`（完整自然周之间的方向共同变化），关系枚举固定为 `supports`、`contrasts`、`weakly_aligned`、`insufficient_relation`。
- 共同出现和时间共同变化只表示聚合数据中的并存、相似或相反方向，不代表因果；样本不足时必须显式返回 `insufficient_relation` 并附限制说明。
- EvidenceGraph 为每条关系建立带 `relationEvidence` 的可引用节点，并绑定当前 `dataRevision`/`modelVersion`；不按卡片重复请求或重算。

## Record Authority Bridge（#236）

v4.1.3 起，原生环境的 Room 是记录权威；WebView 仍保留页面内存态和浏览器兼容路径。桥只接收/返回 `RecordEvent[]`，不改变现有 JSON/CSV、WebDAV 或 AI 聚合协议。

### `loadRecords`

请求只携带由原生适配层注入的派生数据库密钥；响应一次返回完整记录数组、迁移状态和记录数量：

```json
{
  "ok": true,
  "records": "[RecordEvent]",
  "recordCount": 12,
  "state": "COMPLETED",
  "schemaVersion": 2,
  "sourceRevision": 236001,
  "encrypted": true
}
```

`records` 只包含公共 `RecordEvent` 字段。实体内部 `rawRecordJson` 用于保留未知字段，但不得作为响应字段返回；不得返回 DEK、数据库口令或内部密文。

### `replaceRecords`

覆盖型恢复、演示数据和清空共用同一事务入口：先删除旧记录，再批量写入新 `RecordEvent[]`，最后将迁移状态置为 `COMPLETED`。事务失败时 Room 保持原快照，WebView 可沿用兼容回退。

### WebView 适配规则

- `Storage.loadRecords()` 传入惰性旧 Storage 回退函数；Room 已完成时不得预先解密或扫描旧 Storage。
- `Storage.saveRecords()` 统一调用 `commitRecords()`；增量操作由 `applyDelta` 串行提交，Room 成功后才更新旧加密 Storage 镜像。
- 原生桥不可用时，浏览器/旧桥继续使用原有加密 Storage；该降级不得清空或覆盖已有 Room 快照。
- 一次用户动作只允许一个持久化入口；UI 不直接调用 Room 插件，也不按卡片拆分写入。

## Personal Signature / Kotlin Stats / Unified Consumer（#231–#235）

- `behaviorInput` 可包含 56 天按日记录密度、有效时长分布、离散时段计数、稳定状况计数和覆盖元数据；不包含单条记录、备注、附件或精确事件时间线。
- `snapshot.personalSignature` 使用 `personal-signature-v1` 描述典型间隔、持续时间、时段、状况与 IQR 波动；历史跨度、覆盖日或样本不足时必须为 `insufficient`，不生成固定类型或健康判断。
- `statsSnapshot.statsEngineVersion` 标记 Kotlin 统计引擎，`periodRules` 固化自然周/自然月/滚动 14/30 天和时区；`calculationPasses=1` 表示单次计算。
- `snapshotProtocol.serializedOnce=true` 与 `dataRevision` 绑定；WebView 通过 `GuanjiSnapshotBus` 获取同一快照，旧 revision 回调返回 `STALE_REVISION`，不得覆盖较新状态。
- #232 的 AI 仍沿用既有聚合外传边界。EvidenceGraph 中已有的持续性、候选变化期、反证/不确定性节点可供结构化 claim 引用；新增 AI 价值不得通过上传个人签名或原始记录实现。
