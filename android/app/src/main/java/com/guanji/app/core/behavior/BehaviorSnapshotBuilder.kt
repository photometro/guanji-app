package com.guanji.app.core.behavior

import com.guanji.app.core.data.BehaviorSnapshotRequest
import com.guanji.app.core.data.ContractVersions
import com.guanji.app.core.stats.KotlinStatsEngine
import org.json.JSONArray
import org.json.JSONObject

/**
 * #225/#229：行为模型快照构建器。
 * 输入仍是聚合 StatsSnapshot，个人基线由 Kotlin core.behavior 计算；不接收原始记录。
 */
class BehaviorSnapshotBuilder {
    fun build(request: BehaviorSnapshotRequest, inputStats: JSONObject?, behaviorInput: JSONObject? = null): JSONObject {
        /* #234：所有统计字段先经过 Kotlin Stats Engine；一次请求只计算一次。 */
        val stats = KotlinStatsEngine.compute(inputStats, request)
        val baselineResult = PersonalBaselineCalculator.build(behaviorInput)
        val cards = JSONArray().apply {
            listOf("overview", "time", "observations", "cooccurrence", "change", "suggestions")
                .forEach { put(JSONObject().put("id", it).put("ready", true).put("source", "local")) }
        }
        val model = JSONObject()
            .put("schemaVersion", request.schemaVersion)
            .put("modelVersion", ContractVersions.MODEL_VERSION)
            .put("dataRevision", request.dataRevision)
            .put("generatedAtMs", request.requestedAtMs)
            .put("timezone", request.timezone)
            .put("statsSnapshot", stats)
            .put("baseline", baselineResult.baseline)
            .put("deviations", baselineResult.deviations)
            .put("persistence", baselineResult.persistence)
            .put("relations", baselineResult.relations)
            .put("personalSignature", baselineResult.signature)
            .put("statsEngineVersion", stats.optString("statsEngineVersion", KotlinStatsEngine.ENGINE_VERSION))
            .put("quality", JSONObject()
                .put("status", baselineResult.baseline.optString("status", "insufficient"))
                .put("source", "aggregate-behavior-input")
                .put("rawRecordsIncluded", false)
                .put("measurement", stats.optJSONObject("dataQuality") ?: JSONObject()))
            .put("cards", cards)

        val evidence = EvidenceGraphBuilder.build(
            request,
            stats,
            baselineResult.baseline,
            baselineResult.persistence,
            baselineResult.relations,
        )

        return JSONObject()
            .put("ok", true)
            .put("schemaVersion", request.schemaVersion)
            .put("dataRevision", request.dataRevision)
            .put("statsSnapshot", stats)
            .put("snapshot", model)
            .put("evidenceGraph", evidence)
            /* #235：消费者只接收这一个已序列化结果，避免逐卡桥调用。 */
            .put("snapshotProtocol", JSONObject()
                .put("dataRevision", request.dataRevision)
                .put("generatedAtMs", request.requestedAtMs)
                .put("calculationPasses", 1)
                .put("serializedOnce", true))
    }
}
