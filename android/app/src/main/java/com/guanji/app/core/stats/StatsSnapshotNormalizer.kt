package com.guanji.app.core.stats

import com.guanji.app.core.data.BehaviorSnapshotRequest
import com.guanji.app.core.data.ContractVersions
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId

/**
 * #222：把 WebView 传入的聚合快照补齐为公共 StatsSnapshot。
 * 不读取原始记录，不做全量扫描；#223 才接入 Room 影子库作为输入。
 */
object StatsSnapshotNormalizer {
    fun normalize(input: JSONObject?, request: BehaviorSnapshotRequest): JSONObject {
        val output = if (input == null) JSONObject() else JSONObject(input.toString())
        val zone = runCatching { ZoneId.of(request.timezone) }.getOrElse { ZoneId.systemDefault() }
        val today = runCatching { LocalDate.now(zone) }.getOrElse { LocalDate.now() }
        val mondayOffset = (today.dayOfWeek.value + 6) % 7
        val weekStart = today.minusDays(mondayOffset.toLong())
        val weekEnd = weekStart.plusDays(6)
        val monthStart = today.withDayOfMonth(1)
        val generatedAtMs = output.optLong("generatedAtMs", request.requestedAtMs)

        output.put("schemaVersion", output.optInt("schemaVersion", request.schemaVersion))
        output.put("statsRuleVersion", output.optString("statsRuleVersion", ContractVersions.STATS_RULE_VERSION))
        output.put("generationId", output.optString("generationId", "native-${request.dataRevision}-$generatedAtMs"))
        output.put("revision", request.dataRevision)
        output.put("generatedAtMs", generatedAtMs)
        output.put("timezone", request.timezone)
        output.put("todayKey", output.optString("todayKey", today.toString()))
        output.put("weekStartKey", output.optString("weekStartKey", weekStart.toString()))
        output.put("weekEndKey", output.optString("weekEndKey", weekEnd.toString()))
        output.put("monthStartKey", output.optString("monthStartKey", monthStart.toString()))
        output.put("todayCount", nonNegative(output.optInt("todayCount", 0)))
        output.put("weekCount", nonNegative(output.optInt("weekCount", 0)))
        output.put("weekCounts", fixedArray(output.optJSONArray("weekCounts") ?: output.optJSONArray("week"), 7))
        output.put("weekDayIndex", output.optInt("weekDayIndex", (today.dayOfWeek.value + 6) % 7).coerceIn(0, 6))
        putNullableInt(output, "weekDelta", output.opt("weekDelta"))
        output.put("previousWeekCount", nonNegative(output.optInt("previousWeekCount", 0)))
        output.put("monthCount", nonNegative(output.optInt("monthCount", 0)))
        putNullableInt(output, "monthDelta", output.opt("monthDelta"))
        output.put("previousMonthCount", nonNegative(output.optInt("previousMonthCount", 0)))
        output.put("streak", nonNegative(output.optInt("streak", 0)))
        output.put("rolling7Count", nonNegative(output.optInt("rolling7Count", 0)))
        output.put("rolling14", fixedArray(output.optJSONArray("rolling14"), 14))
        output.put("rolling30", fixedArray(output.optJSONArray("rolling30"), 30))
        val freshness = output.optString("freshness", "fresh")
        output.put("freshness", if (freshness in setOf("fresh", "stale", "unknown")) freshness else "unknown")
        output.put("excludedInvalidRecords", nonNegative(output.optInt("excludedInvalidRecords", 0)))
        output.put("excludedFutureRecords", nonNegative(output.optInt("excludedFutureRecords", 0)))
        output.put("dataQuality", normalizeDataQuality(output.optJSONObject("dataQuality"), today.toString()))
        return output
    }

    private fun normalizeDataQuality(input: JSONObject?, todayKey: String): JSONObject {
        val quality = input?.let { JSONObject(it.toString()) } ?: JSONObject()
        val windowDays = quality.optInt("windowDays", 7).coerceAtLeast(1)
        val coverageDays = quality.optInt("coverageDays", 0).coerceAtLeast(0)
        val recordCount = quality.optInt("recordCount", 0).coerceAtLeast(0)
        val coverageRatio = quality.optDouble("coverageRatio", (coverageDays.toDouble() / windowDays).coerceIn(0.0, 1.0)).coerceIn(0.0, 1.0)
        val backfillCount = quality.optInt("backfillCount", 0).coerceIn(0, recordCount)
        val completenessRatio = quality.optDouble("completenessRatio", if (recordCount > 0) 1.0 else 0.0).coerceIn(0.0, 1.0)
        val status = quality.optString("status", if (recordCount == 0) "insufficient" else "partial")
            .takeIf { it in setOf("insufficient", "partial", "usable") } ?: "unknown"
        quality.put("windowDays", windowDays)
        quality.put("windowEndKey", quality.optString("windowEndKey", todayKey))
        quality.put("recordCount", recordCount)
        quality.put("coverageDays", coverageDays)
        quality.put("coverageRatio", coverageRatio)
        quality.put("backfillCount", backfillCount)
        quality.put("backfillRatio", quality.optDouble("backfillRatio", if (recordCount > 0) backfillCount.toDouble() / recordCount else 0.0).coerceIn(0.0, 1.0))
        quality.put("completenessRatio", completenessRatio)
        quality.put("status", status)
        if (!quality.has("sourceCounts")) quality.put("sourceCounts", JSONObject())
        return quality
    }

    private fun fixedArray(source: JSONArray?, size: Int): JSONArray {
        val result = JSONArray()
        for (index in 0 until size) {
            val value = source?.optInt(index, 0) ?: 0
            result.put(nonNegative(value))
        }
        return result
    }

    private fun nonNegative(value: Int): Int = value.coerceAtLeast(0)

    private fun putNullableInt(target: JSONObject, key: String, value: Any?) {
        val number = when (value) {
            is Number -> value.toInt()
            is String -> value.toIntOrNull()
            else -> null
        }
        if (number == null) target.put(key, JSONObject.NULL) else target.put(key, number)
    }
}
