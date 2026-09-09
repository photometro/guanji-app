package com.guanji.app.core.data

import org.json.JSONObject

/**
 * #222：跨 Kotlin、WebView 与后续 Room 的最小公共契约。
 *
 * 这些包装器刻意保留原始 JSONObject，未知字段不会在桥接层被丢弃；
 * 具体字段校验仍由 #221 的 JSON Schema 和黄金样本负责。
 */
object ContractVersions {
    const val SCHEMA_VERSION = 1
    const val MODEL_VERSION = "4.1.3-room-authority"
    const val STATS_RULE_VERSION = "3.60"
}

data class BehaviorSnapshotRequest(
    val schemaVersion: Int = ContractVersions.SCHEMA_VERSION,
    val dataRevision: Long,
    val requestedAtMs: Long,
    val timezone: String,
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("type", "behaviorSnapshot")
        put("schemaVersion", schemaVersion)
        put("dataRevision", dataRevision)
        put("requestedAtMs", requestedAtMs)
        put("timezone", timezone)
    }
}

data class RecordEventContract(val json: JSONObject) {
    fun copyJson(): JSONObject = JSONObject(json.toString())
}

data class StatsSnapshotContract(val json: JSONObject) {
    fun copyJson(): JSONObject = JSONObject(json.toString())
}

data class BehaviorModelSnapshotContract(val json: JSONObject) {
    fun copyJson(): JSONObject = JSONObject(json.toString())
}

data class EvidenceGraphContract(val json: JSONObject) {
    fun copyJson(): JSONObject = JSONObject(json.toString())
}

data class InsightCacheContract(val json: JSONObject) {
    fun copyJson(): JSONObject = JSONObject(json.toString())
}

data class BackupEnvelopeContract(val json: JSONObject) {
    fun copyJson(): JSONObject = JSONObject(json.toString())
}
