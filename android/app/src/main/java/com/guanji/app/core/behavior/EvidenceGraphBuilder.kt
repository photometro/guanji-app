package com.guanji.app.core.behavior

import com.guanji.app.core.data.BehaviorSnapshotRequest
import com.guanji.app.core.data.ContractVersions
import org.json.JSONArray
import org.json.JSONObject

/**
 * #226/#227/#228/#229：把个人基线、持续性、候选变化期与共同变化关系转换为
 * 可追溯、可校验的 EvidenceGraph。
 *
 * Evidence 只引用聚合模型结果，不携带原始记录、备注或精确时间线。
 * ID 由 dataRevision 和 metric 确定，避免不同快照之间误复用引用。
 */
object EvidenceGraphBuilder {
    fun build(
        request: BehaviorSnapshotRequest,
        stats: JSONObject,
        baseline: JSONObject,
        persistence: JSONArray = JSONArray(),
        relationsInput: JSONArray = JSONArray(),
    ): JSONObject {
        val nodes = JSONArray()
        val relations = JSONArray()
        val statsId = "ev-stats-${request.dataRevision}"
        nodes.put(node(
            evidenceId = statsId,
            dimension = "stats",
            metric = "aggregateSnapshot",
            state = "available",
            magnitude = "none",
            persistence = "not_evaluated",
            confidence = if (stats.optString("freshness") == "fresh") "high" else "low",
            status = if (stats.optString("freshness") == "stale") "stale" else "available",
            request = request,
            limitation = "统计快照只描述当前聚合数据，不代表因果关系",
        ))

        val metrics = baseline.optJSONObject("metrics")
        val persistenceByMetric = mutableMapOf<String, JSONObject>()
        for (index in 0 until persistence.length()) {
            val item = persistence.optJSONObject(index) ?: continue
            val metricName = item.optString("metric").trim()
            if (metricName.isNotEmpty()) persistenceByMetric[metricName] = item
        }
        if (metrics != null) {
            val keys = metrics.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                val metric = metrics.optJSONObject(key) ?: continue
                val metricName = metric.optString("metric", key)
                val available = metric.optBoolean("available", false)
                val persistenceItem = persistenceByMetric[metricName]
                val evidenceId = "ev-${safeMetric(metricName)}-${request.dataRevision}"
                val metricNode = node(
                    evidenceId = evidenceId,
                    dimension = when (metricName) {
                        "recordDensity" -> "rhythm"
                        "duration" -> "duration"
                        else -> "behavior"
                    },
                    metric = metricName,
                    state = if (available) metric.optString("direction", "stable") else "insufficient",
                    magnitude = if (available) metric.optString("magnitude", "none") else "unknown",
                    persistence = if (available) {
                        persistenceItem?.optString("state")?.ifBlank { "uncertain" } ?: "uncertain"
                    } else "uncertain",
                    confidence = if (available && baseline.optString("status") == "ready") "high" else "low",
                    status = if (available) "available" else "insufficient",
                    request = request,
                    limitation = if (available) {
                        "变化仅表示相对个人基线的偏离，不是健康或正常值判断"
                    } else {
                        "历史跨度或样本不足，暂不判断变化方向"
                    },
                    changePoint = persistenceItem?.optJSONObject("changePoint"),
                )
                nodes.put(metricNode)
                relations.put(JSONObject()
                    .put("from", evidenceId)
                    .put("to", statsId)
                    .put("relation", "derived_from"))
            }
        }

        /* #229：关系本身也是可引用证据；只保留聚合关系，不把原始事件带回图中。 */
        for (index in 0 until relationsInput.length()) {
            val relation = relationsInput.optJSONObject(index) ?: continue
            val type = relation.optString("type", "relation")
            val from = relation.optString("from", "from")
            val to = relation.optString("to", "to")
            val relationName = relation.optString("relation", "insufficient_relation")
            val relationId = "ev-relation-${safePart(type)}-${safePart(from)}-${safePart(to)}-${request.dataRevision}"
            val relationNode = node(
                evidenceId = relationId,
                dimension = "relation",
                metric = "${safePart(from)}-${safePart(to)}",
                state = relationName,
                magnitude = relationName,
                persistence = "not_evaluated",
                confidence = relation.optString("confidence", "low"),
                status = if (relationName == "insufficient_relation") "insufficient" else "available",
                request = request,
                limitation = relation.optJSONArray("limitations")?.optString(0)
                    ?: "关系只描述聚合数据中的共同变化，不代表因果关系",
                relationEvidence = relation,
            )
            nodes.put(relationNode)
            relations.put(JSONObject()
                .put("from", relationId)
                .put("to", statsId)
                .put("relation", "derived_from"))
            if (type == "temporal_co_movement") {
                val fromId = "ev-${safeMetric(from)}-${request.dataRevision}"
                val toId = "ev-${safeMetric(to)}-${request.dataRevision}"
                relations.put(JSONObject()
                    .put("from", fromId)
                    .put("to", toId)
                    .put("relation", relationName))
            }
        }

        return JSONObject()
            .put("schemaVersion", request.schemaVersion)
            .put("modelVersion", ContractVersions.MODEL_VERSION)
            .put("dataRevision", request.dataRevision)
            .put("generatedAtMs", request.requestedAtMs)
            .put("nodes", nodes)
            .put("relations", relations)
            .put("limitations", JSONArray()
                .put("证据只来自聚合统计与个人历史基线")
                .put("记录缺失不等于没有发生")
                .put("不输出健康、正常值或确定性因果结论"))
    }

    private fun node(
        evidenceId: String,
        dimension: String,
        metric: String,
        state: String,
        magnitude: String,
        persistence: String,
        confidence: String,
        status: String,
        request: BehaviorSnapshotRequest,
        limitation: String,
        changePoint: JSONObject? = null,
        relationEvidence: JSONObject? = null,
    ): JSONObject = JSONObject()
        .put("evidenceId", evidenceId)
        .put("dimension", dimension)
        .put("metric", metric)
        .put("state", state)
        .put("magnitude", magnitude)
        .put("persistence", persistence)
        .put("confidence", confidence)
        .put("status", status)
        .put("modelVersion", ContractVersions.MODEL_VERSION)
        .put("dataRevision", request.dataRevision)
        .put("limitations", JSONArray().put(limitation))
        .apply {
            if (changePoint != null) put("changePoint", JSONObject(changePoint.toString()))
            if (relationEvidence != null) put("relationEvidence", JSONObject(relationEvidence.toString()))
        }

    private fun safeMetric(metric: String): String = metric
        .lowercase()
        .replace(Regex("[^a-z0-9]+"), "-")
        .trim('-')
        .ifBlank { "metric" }

    private fun safePart(value: String): String = value
        .lowercase()
        .replace(Regex("[^a-z0-9\\u4e00-\\u9fff]+"), "-")
        .trim('-')
        .take(48)
        .ifBlank { "value" }
}
