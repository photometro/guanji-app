package com.guanji.app.core.stats

import com.guanji.app.core.data.BehaviorSnapshotRequest
import org.json.JSONObject

/**
 * #234：Kotlin 统计引擎的公共入口。
 *
 * v4.1.x 期间 WebView 仍负责提供已聚合输入，因此这里不再重新扫描记录；
 * Kotlin 对自然日、自然周/月、滚动窗口、连续记录和质量字段执行唯一的
 * 规范化/口径封装，并带出引擎版本与一次计算标记。Room 成为权威后，输入
 * 由同一个快照请求提供，后续可把原始聚合器替换为 Room 查询而不改消费者。
 */
object KotlinStatsEngine {
    const val ENGINE_VERSION = "4.1.1-kotlin-stats-v1"

    fun compute(input: JSONObject?, request: BehaviorSnapshotRequest): JSONObject {
        val output = StatsSnapshotNormalizer.normalize(input, request)
        output.put("statsEngine", "kotlin")
        output.put("statsEngineVersion", ENGINE_VERSION)
        output.put("calculationPasses", 1)
        output.put("calculationMode", "single-snapshot")
        output.put("periodRules", JSONObject()
            .put("week", "monday-sunday")
            .put("month", "calendar-month")
            .put("rolling", "14/30-calendar-days")
            .put("timezone", request.timezone))
        return output
    }
}
