# 洞悉数据来源契约（#270 补充 / #277）

状态：当前迁移期契约，已冻结现状与后续目标

基线：WebView v4.1.5（commit `c113bcf4c7729d0978ded3f37f3ab76496334af1`）
当前实现：Native UI v4.2.4 / versionCode 122（#277 补充 4）

## 1. 三个概念必须分开

```text
洞悉 UI 原生化
≠ 洞悉数据链路原生化
≠ 统计模型完全原生化
```

- **UI 原生化**：`NativeInsightSurface` 在 `MainActivity → NativeRoot` 内渲染经典/普通洞悉页。
- **统计模型原生化**：`Room` 是记录权威，`KotlinStatsEngine` 与 `BehaviorSnapshotBuilder` 已提供原生统计/行为快照能力。
- **数据链路完全原生化**：当前尚未收口，洞悉 UI 仍通过共享兼容快照接收部分展示字段。

## 2. 当前真实运行链路

```text
Room（记录权威）
  ↓
KotlinStatsEngine / BehaviorSnapshotBuilder（统计与行为模型）
  ↓
WebView/JS 兼容桥：records.js → getNativeInsightContext()
  ↓
NativeHomeSnapshot（聚合快照持久化缓存）
  ↓
NativeRoot → NativeInsightSurface（Compose 渲染）
```

当前字段职责：

| 字段/职责 | 当前来源 | 备注 |
| --- | --- | --- |
| 记录事实、统计窗口、趋势和时段聚合 | Room/Kotlin StatsSnapshot（经共享桥传递） | Native UI 不读取单条记录 |
| `insight.labels`、`cooccurrence`、空/不足/错误状态 | `getNativeInsightContext()` 组装的聚合快照 | Native 负责校验、key→label 映射和展示 |
| `insightAI`、AI 报告、缓存状态、免责声明 | `ai.js` 现有 AI owner | 保持既有 Provider、过滤和缓存边界 |
| 追问状态和回答 | `ai.js`，经 `insight-ask` 动作桥 | Native 不复制网络调用 |
| `BehaviorSnapshotPlugin` | 原生能力已存在 | 当前洞悉 Surface 尚未直接调用该插件作为唯一输入 |

`NativeHomeSnapshot` 只允许承载聚合结果和脱敏 AI 状态，不得包含单条记录、备注、附件、精确时间或 API Key。

## 3. 目标运行链路

后续洞悉原生改造任务必须收口为：

```text
Room
  ↓
KotlinStatsEngine
  ↓
BehaviorSnapshotBuilder
  ↓
NativeInsightSnapshot
  ↓
NativeInsightSurface
```

`NativeInsightSnapshot` 至少携带：

```text
dataRevision
statsEngineVersion
source = native | js-fallback
fallbackReason = null | unavailable | stale | schema-error | migration
```

原生路径优先；JS 只能作为迁移期间的兼容/降级路径。Compose 层不得重新计算统计或重新生成业务结论。

## 4. Fallback 规则

```text
优先请求 NativeInsightSnapshot
  ├─ 可用且 revision 匹配 → source=native
  └─ 不可用/过期/协议错误 → source=js-fallback，并写明 fallbackReason
```

- 同一 `dataRevision` 只计算一次，重复渲染不得重复请求。
- Native 与 JS fallback 对同一输入必须产生相同业务结果。
- fallback 不是正常主路径；任何长期 fallback 都阻止删除 JS 核心。

## 5. #281 前置验收

在允许 #281 删除旧 JS 洞悉核心逻辑前，必须全部满足：

- [ ] `NativeInsightSnapshot` 已实现并由 `NativeInsightSurface` 直接消费；
- [ ] `dataRevision`、`statsEngineVersion`、`source`、`fallbackReason` 全链路可追踪；
- [ ] Native 与 JS 同状态对照一致；
- [ ] 真机重启、刷新、AI 缓存命中/过期/失败均通过；
- [ ] 不存在只有 JS 才能生成的必要洞悉字段；
- [ ] 无原始记录、备注、精确时间或密钥进入洞悉输入。

本文件只冻结契约和验收闸门，不在 #270/#277 中提前重构完整 NativeInsightSnapshot。
