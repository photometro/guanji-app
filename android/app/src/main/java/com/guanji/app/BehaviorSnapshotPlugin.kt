package com.guanji.app

import com.guanji.app.core.behavior.BehaviorSnapshotBuilder
import com.guanji.app.core.data.BehaviorSnapshotRequest
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.util.TimeZone

/**
 * #222：Kotlin → WebView 单次行为快照桥。
 * 输入只允许聚合 StatsSnapshot 与按天行为模型输入，输出一次返回六卡所需的完整快照；不接收原始记录。
 */
@CapacitorPlugin(name = "BehaviorSnapshot")
class BehaviorSnapshotPlugin : Plugin() {
    private val builder = BehaviorSnapshotBuilder()

    @PluginMethod
    fun requestBehaviorSnapshot(call: PluginCall) {
        /* Capacitor 将来自 WebView 的整数解析为 Integer，getLong 只接受 Long；
           统一兼容 Long/Integer/数字字符串，避免证据 ID 静默退化为 revision=0。 */
        val revision = readLong(call, "dataRevision", 0L)
        val schemaVersion = call.getInt("schemaVersion", 1) ?: 1
        val requestedAtMs = readLong(call, "requestedAtMs", System.currentTimeMillis())
        val timezone = call.getString("timezone")?.ifBlank { null } ?: TimeZone.getDefault().id
        val statsRaw = call.getString("statsSnapshot")
        val behaviorRaw = call.getString("behaviorInput")
        if (revision < 0L || statsRaw == null) {
            call.resolve(JSObject()
                .put("ok", false)
                .put("schemaVersion", schemaVersion)
                .put("dataRevision", revision)
                .put("error", JSObject()
                    .put("code", "INVALID_INPUT")
                    .put("retryable", false)
                    .put("message", "aggregate statsSnapshot is required")))
            return
        }
        try {
            val request = BehaviorSnapshotRequest(schemaVersion, revision, requestedAtMs, timezone)
            val input = JSONObject(statsRaw)
            val behaviorInput = behaviorRaw?.let { JSONObject(it) }
            val response = builder.build(request, input, behaviorInput)
            call.resolve(JSObject(response.toString()))
        } catch (error: Exception) {
            call.resolve(JSObject()
                .put("ok", false)
                .put("schemaVersion", schemaVersion)
                .put("dataRevision", revision)
                .put("error", JSObject()
                    .put("code", "SNAPSHOT_BUILD_FAILED")
                    .put("retryable", true)
                    .put("message", error.message ?: "snapshot build failed")))
        }
    }

    private fun readLong(call: PluginCall, key: String, defaultValue: Long): Long {
        call.getLong(key)?.let { return it }
        call.getInt(key)?.let { return it.toLong() }
        return call.getString(key)?.toLongOrNull() ?: defaultValue
    }
}
