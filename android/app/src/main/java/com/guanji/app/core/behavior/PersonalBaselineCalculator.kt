package com.guanji.app.core.behavior

import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min

/**
 * #225：个人历史基线与偏离检测。
 *
 * 只接收 WebView 生成的按天聚合输入，不接触原始记录、备注或精确时间线。
 * 56 天是个人基线窗口，最近 28 天是自适应观察窗口；所有结果只描述相对
 * 于同一个人的历史变化，不推断健康、正常值或因果关系。
 */
object PersonalBaselineCalculator {
    private const val REQUIRED_DAYS = 56
    private const val CURRENT_WINDOW_DAYS = 28

    data class Result(
        val baseline: JSONObject,
        val deviations: JSONArray,
        val persistence: JSONArray,
        val relations: JSONArray,
        val signature: JSONObject,
    )

    private data class WeekBlock(
        val startKey: String,
        val daysPresent: MutableSet<String> = mutableSetOf(),
        var observedDays: Int = 0,
        var recordCount: Int = 0,
        val durationValues: MutableList<Double> = mutableListOf(),
    ) {
        val endKey: String get() = shiftDateKey(startKey, 6)
        val complete: Boolean get() = daysPresent.size == 7 && daysPresent.contains(startKey) && daysPresent.contains(endKey)
    }

    private data class BlockObservation(
        val week: WeekBlock,
        val value: Double?,
        val direction: String,
        val magnitude: String,
        val robustScore: Double?,
    )

    private data class ShiftRun(
        val startIndex: Int,
        val endIndex: Int,
        val direction: String,
    ) {
        val length: Int get() = endIndex - startIndex + 1
    }

    fun build(input: JSONObject?): Result {
        val safe = input ?: JSONObject()
        val historySpanDays = safe.optInt("historySpanDays", 0).coerceAtLeast(0)
        val coverageDays = safe.optInt("coverageDays", 0).coerceAtLeast(0)
        val recordCount = safe.optInt("recordCount", 0).coerceAtLeast(0)
        val currentCoverageDays = safe.optInt("currentCoverageDays", 0).coerceAtLeast(0)
        val daily = safe.optJSONArray("dailySeries") ?: JSONArray()
        val densityBaseline = mutableListOf<Double>()
        val densityCurrent = mutableListOf<Double>()
        for (index in 0 until daily.length()) {
            val day = daily.optJSONObject(index) ?: continue
            if (!day.optBoolean("observed", false)) continue
            val count = day.optInt("count", 0).coerceAtLeast(0).toDouble()
            densityBaseline += count
            if (day.optInt("daysAgo", REQUIRED_DAYS) < CURRENT_WINDOW_DAYS) densityCurrent += count
        }
        val durationBaseline = numberList(safe.optJSONArray("baselineDurationValues"))
        val durationCurrent = numberList(safe.optJSONArray("currentDurationValues"))
        val ready = historySpanDays >= REQUIRED_DAYS && coverageDays >= 3 && recordCount > 0
        val deviations = JSONArray()
        val metrics = JSONObject()
        appendMetric(metrics, deviations, "recordDensity", densityBaseline, densityCurrent, ready) {
            if (densityCurrent.isEmpty()) null else densityCurrent.average()
        }
        appendMetric(metrics, deviations, "duration", durationBaseline, durationCurrent, ready) {
            median(durationCurrent)
        }

        val persistence = JSONArray()
        val weekBlocks = buildWeekBlocks(daily)
        persistence.put(buildPersistence("recordDensity", weekBlocks, ready) { block ->
            block.recordCount.toDouble()
        })
        persistence.put(buildPersistence("duration", weekBlocks, ready) { block ->
            median(block.durationValues)
        })

        val relations = buildRelations(safe, persistence)
        val signature = buildPersonalSignature(
            safe = safe,
            daily = daily,
            durationValues = durationBaseline,
            ready = ready,
            historySpanDays = historySpanDays,
            coverageDays = coverageDays,
            recordCount = recordCount,
        )
        val baseline = JSONObject()
            .put("status", if (ready) "ready" else "insufficient")
            .put("requiredDays", REQUIRED_DAYS)
            .put("windowDays", CURRENT_WINDOW_DAYS)
            .put("historySpanDays", historySpanDays)
            .put("coverageDays", coverageDays)
            .put("currentCoverageDays", currentCoverageDays)
            .put("recordCount", recordCount)
            .put("metrics", metrics)
            .put("persistenceRuleVersion", "natural-week-v1")
            .put("comparison", "current_28_vs_personal_56")
        return Result(baseline, deviations, persistence, relations, signature)
    }

    /**
     * #231：个人特征签名只描述“这个人自己的典型模式”，不分配人口类型，也
     * 不把偏离解释成健康风险。输入仍是按日、时段和状况的聚合数据；有效历史
     * 不足时明确返回 insufficient，避免用少量记录制造伪画像。
     */
    private fun buildPersonalSignature(
        safe: JSONObject,
        daily: JSONArray,
        durationValues: List<Double>,
        ready: Boolean,
        historySpanDays: Int,
        coverageDays: Int,
        recordCount: Int,
    ): JSONObject {
        val limitations = JSONArray()
            .put("个人特征只描述历史记录中的典型模式，不代表类型、健康或正常值")
            .put("记录缺失不等于没有发生")
        if (!ready || historySpanDays < REQUIRED_DAYS || recordCount < 8 || coverageDays < 7) {
            limitations.put("至少需要 56 天历史、8 条记录和 7 个覆盖日，当前不足")
            return JSONObject()
                .put("status", "insufficient")
                .put("method", "personal-signature-v1")
                .put("windowDays", REQUIRED_DAYS)
                .put("sampleCount", recordCount)
                .put("coverageDays", coverageDays)
                .put("updatedAtMs", safe.optLong("generatedAtMs", 0L))
                .put("timezone", safe.optString("timezone", "local"))
                .put("limitations", limitations)
        }

        val observedDates = mutableListOf<String>()
        for (index in 0 until daily.length()) {
            val day = daily.optJSONObject(index) ?: continue
            if (day.optBoolean("observed", false)) day.optString("dateKey").trim()
                .takeIf { it.isNotBlank() }?.let { observedDates += it }
        }
        val gaps = observedDates.sorted().zipWithNext().mapNotNull { (from, to) ->
            dateDifference(from, to)?.takeIf { it > 0 }
        }
        val interval = signatureDistribution(gaps.map { it.toDouble() }, "days")
        val duration = signatureDistribution(durationValues, "minutes")
        val timeCounts = objectCounts(safe.optJSONObject("timeBucketCounts"))
        val topTime = timeCounts.entries.maxWithOrNull(compareBy<Map.Entry<String, Int>> { it.value }.thenBy { it.key })
        val observations = objectCounts(safe.optJSONObject("observationCounts"))
            .entries.sortedWith(compareByDescending<Map.Entry<String, Int>> { it.value }.thenBy { it.key })
            .take(5)
            .map { JSONObject().put("key", it.key).put("count", it.value) }
        return JSONObject()
            .put("status", "ready")
            .put("method", "personal-signature-v1")
            .put("windowDays", REQUIRED_DAYS)
            .put("sampleCount", recordCount)
            .put("coverageDays", coverageDays)
            .put("updatedAtMs", safe.optLong("generatedAtMs", 0L))
            .put("timezone", safe.optString("timezone", "local"))
            .put("typicalInterval", interval ?: JSONObject.NULL)
            .put("typicalDuration", duration ?: JSONObject.NULL)
            .put("typicalTimeBucket", topTime?.let { JSONObject().put("key", it.key).put("count", it.value) } ?: JSONObject.NULL)
            .put("commonObservations", JSONArray().apply { observations.forEach { put(it) } })
            .put("variability", JSONObject()
                .put("intervalIqrDays", interval?.optDouble("iqr", Double.NaN)?.takeUnless { it.isNaN() } ?: JSONObject.NULL)
                .put("durationIqrMinutes", duration?.optDouble("iqr", Double.NaN)?.takeUnless { it.isNaN() } ?: JSONObject.NULL))
            .put("limitations", limitations)
    }

    private fun objectCounts(input: JSONObject?): Map<String, Int> {
        if (input == null) return emptyMap()
        val result = mutableMapOf<String, Int>()
        val keys = input.keys()
        while (keys.hasNext()) {
            val key = keys.next().trim()
            val value = input.optInt(key, 0).coerceAtLeast(0)
            if (key.isNotBlank() && value > 0) result[key] = value
        }
        return result
    }

    private fun signatureDistribution(values: List<Double>, unit: String): JSONObject? {
        if (values.isEmpty()) return null
        val med = median(values) ?: return null
        val q1 = percentile(values, 0.25) ?: med
        val q3 = percentile(values, 0.75) ?: med
        return JSONObject()
            .put("median", med)
            .put("q1", q1)
            .put("q3", q3)
            .put("iqr", q3 - q1)
            .put("sampleCount", values.size)
            .put("unit", unit)
    }

    private fun dateDifference(from: String, to: String): Int? {
        val fromParts = from.split('-')
        val toParts = to.split('-')
        if (fromParts.size != 3 || toParts.size != 3) return null
        return runCatching {
            fun millis(parts: List<String>): Long {
                val calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC"), Locale.US)
                calendar.clear()
                calendar.isLenient = false
                calendar.set(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt())
                return calendar.timeInMillis
            }
            ((millis(toParts) - millis(fromParts)) / 86_400_000L).toInt()
        }.getOrNull()
    }

    /**
     * #229：把单条记录内的状况共现与指标随时间的共同变化统一成关系证据。
     * 关系只描述聚合数据中的一致/相反方向，不表达因果；输入缺失时显式返回
     * insufficient_relation，避免把“没有证据”误写成“没有关系”。
     */
    private fun buildRelations(input: JSONObject, persistence: JSONArray): JSONArray {
        val result = JSONArray()
        val pairCounts = input.optJSONArray("observationPairCounts")
        if (pairCounts != null) {
            val limit = min(pairCounts.length(), 12)
            for (index in 0 until limit) {
                val pair = pairCounts.optJSONObject(index) ?: continue
                val from = pair.optString("from").trim()
                val to = pair.optString("to").trim()
                if (from.isBlank() || to.isBlank() || from == to) continue
                val count = pair.optInt("count", 0).coerceAtLeast(0)
                val sampleCount = pair.optInt("sampleCount", 0).coerceAtLeast(0)
                val rate = if (sampleCount > 0) count.toDouble() / sampleCount.toDouble() else 0.0
                val relation = when {
                    count >= 2 && rate >= 0.25 -> "supports"
                    count == 0 || sampleCount < 2 -> "insufficient_relation"
                    else -> "weakly_aligned"
                }
                val confidence = when {
                    relation == "insufficient_relation" -> "low"
                    count >= 4 && rate >= 0.4 -> "high"
                    count >= 2 -> "medium"
                    else -> "low"
                }
                result.put(JSONObject()
                    .put("type", "event_cooccurrence")
                    .put("from", from)
                    .put("to", to)
                    .put("relation", relation)
                    .put("count", count)
                    .put("sampleCount", sampleCount)
                    .put("pairRate", (rate * 10000.0).toInt() / 10000.0)
                    .put("window", "recent_28_days")
                    .put("confidence", confidence)
                    .put("evidenceBlockIds", JSONArray())
                    .put("limitations", relationLimitations(
                        "共同出现只表示同一记录内的并存，不代表因果关系",
                        if (relation == "insufficient_relation") "样本不足，暂不判断共同出现关系" else null,
                    )))
            }
        }
        result.put(buildTemporalRelation(persistence))
        return result
    }

    private fun buildTemporalRelation(persistence: JSONArray): JSONObject {
        val byMetric = mutableMapOf<String, JSONObject>()
        for (index in 0 until persistence.length()) {
            val item = persistence.optJSONObject(index) ?: continue
            val metric = item.optString("metric").trim()
            if (metric.isNotBlank()) byMetric[metric] = item
        }
        val densityBlocks = byMetric["recordDensity"]?.optJSONArray("evidenceBlocks")
        val durationBlocks = byMetric["duration"]?.optJSONArray("evidenceBlocks")
        if (densityBlocks == null || durationBlocks == null) {
            return temporalRelationResult("insufficient_relation", "low", 0, 0, JSONArray()
                .put("缺少两个指标的完整周块，暂不判断时间共同变化"))
        }
        val paired = min(densityBlocks.length(), durationBlocks.length())
        var comparable = 0
        var same = 0
        var opposite = 0
        val evidenceIds = JSONArray()
        for (index in 0 until paired) {
            val density = densityBlocks.optJSONObject(index) ?: continue
            val duration = durationBlocks.optJSONObject(index) ?: continue
            val densityDirection = density.optString("direction", "unknown")
            val durationDirection = duration.optString("direction", "unknown")
            if (densityDirection == "unknown" || durationDirection == "unknown") continue
            comparable += 1
            if (densityDirection == durationDirection && densityDirection != "stable") same += 1
            if (densityDirection != durationDirection
                && densityDirection != "stable" && durationDirection != "stable") opposite += 1
            val blockId = density.optString("blockId").ifBlank { duration.optString("blockId") }
            if (blockId.isNotBlank()) evidenceIds.put(blockId)
        }
        if (comparable < 2) {
            return temporalRelationResult("insufficient_relation", "low", comparable, same, evidenceIds
                .put("可比较周块少于 2 个，暂不判断时间共同变化"))
        }
        val threshold = max(2, ceil(comparable * 0.6).toInt())
        val relation = when {
            same >= threshold -> "supports"
            opposite >= threshold -> "contrasts"
            else -> "weakly_aligned"
        }
        val confidence = when {
            comparable >= 6 && (same >= 3 || opposite >= 3) -> "high"
            comparable >= 4 -> "medium"
            else -> "low"
        }
        return temporalRelationResult(relation, confidence, comparable, same, evidenceIds)
    }

    private fun temporalRelationResult(
        relation: String,
        confidence: String,
        comparableBlocks: Int,
        sameDirectionBlocks: Int,
        evidenceIds: JSONArray,
    ): JSONObject {
        val limitations = JSONArray().put("时间共同变化只表示指标方向在同一阶段的相似或相反，不代表因果关系")
        if (relation == "insufficient_relation") limitations.put("证据不足，后续记录可能改变结论")
        return JSONObject()
            .put("type", "temporal_co_movement")
            .put("from", "recordDensity")
            .put("to", "duration")
            .put("relation", relation)
            .put("window", "recent_complete_weeks")
            .put("comparableBlocks", comparableBlocks)
            .put("sameDirectionBlocks", sameDirectionBlocks)
            .put("confidence", confidence)
            .put("evidenceBlockIds", evidenceIds)
            .put("limitations", limitations)
    }

    private fun relationLimitations(primary: String, secondary: String?): JSONArray = JSONArray().apply {
        put(primary)
        if (!secondary.isNullOrBlank()) put(secondary)
    }

    /**
     * #227：以不重叠的周一至周日作为证据块。首尾不完整周只记录为覆盖限制，
     * 不参与持续性判定；每个状态都由同一批完整周块按可解释规则得到。
     */
    private fun buildPersistence(
        metricName: String,
        blocks: List<WeekBlock>,
        baselineReady: Boolean,
        valueProvider: (WeekBlock) -> Double?,
    ): JSONObject {
        val complete = blocks.filter { it.complete }
        val limitations = mutableListOf<String>()
        if (blocks.any { !it.complete }) limitations += "首尾自然周不完整，未用于持续性判定"
        limitations += "状态只描述相对个人基线的变化，不代表健康判断或因果关系"
        if (metricName == "duration") limitations += "持续时间仅基于有有效时长的记录"

        val base = JSONObject()
            .put("metric", metricName)
            .put("ruleVersion", "natural-week-v1")
            .put("state", "uncertain")
            .put("direction", "unknown")
            .put("confidence", "low")
            .put("requiredBlocks", 4)
            .put("totalBlocks", blocks.size)
            .put("completeBlocks", complete.size)
            .put("partialBlocks", blocks.count { !it.complete })
            .put("evidenceBlocks", JSONArray())
            .put("changePoint", unavailableChangePoint("uncertain", "low", "有效周块不足，暂不确定候选起点"))
            .put("limitations", JSONArray().apply { limitations.forEach { put(it) } })

        if (!baselineReady || complete.size < 4) {
            limitations += "至少需要 4 个完整自然周证据块，当前不足"
            base.put("limitations", JSONArray().apply { limitations.forEach { put(it) } })
            return base
        }

        val split = complete.size / 2
        val reference = complete.take(split)
        val recent = complete.drop(split)
        val referenceValues = reference.mapNotNull(valueProvider)
        val recentValues = recent.map(valueProvider)
        base.put("referenceBlocks", reference.size)
            .put("recentBlocks", recent.size)
            .put("recentKnownBlocks", recentValues.count { it != null })
            .put("referenceMedian", median(referenceValues))

        if (referenceValues.size < 3 || recentValues.count { it != null } < 2) {
            limitations += "有效周块不足，无法稳定比较参考期与近期"
            base.put("limitations", JSONArray().apply { limitations.forEach { put(it) } })
            return base
        }

        val sorted = referenceValues.sorted()
        val referenceMedian = median(sorted) ?: return base
        val q1 = percentile(sorted, 0.25) ?: referenceMedian
        val q3 = percentile(sorted, 0.75) ?: referenceMedian
        val mad = median(sorted.map { abs(it - referenceMedian) }) ?: 0.0
        val scale = max(max(q3 - q1, mad * 1.4826), 1e-6)
        val observations = recent.map { block ->
            val value = valueProvider(block)
            val score = value?.let { (it - referenceMedian) / scale }
            val direction = when {
                score == null -> "unknown"
                abs(score) < 0.5 -> "stable"
                score > 0 -> "higher"
                else -> "lower"
            }
            val magnitude = when {
                score == null -> "unknown"
                abs(score) < 0.5 -> "none"
                abs(score) < 1.5 -> "small"
                abs(score) < 2.5 -> "moderate"
                else -> "large"
            }
            BlockObservation(block, value, direction, magnitude, score)
        }
        val evidenceBlocks = JSONArray()
        observations.forEach { observation ->
            evidenceBlocks.put(JSONObject()
                .put("blockId", "week-${observation.week.startKey}")
                .put("weekStartKey", observation.week.startKey)
                .put("weekEndKey", observation.week.endKey)
                .put("complete", observation.week.complete)
                .put("daysPresent", observation.week.daysPresent.size)
                .put("observedDays", observation.week.observedDays)
                .put("recordCount", observation.week.recordCount)
                .put("value", observation.value)
                .put("direction", observation.direction)
                .put("magnitude", observation.magnitude)
                .put("robustScore", observation.robustScore))
        }

        val known = observations.filter { it.direction != "unknown" }
        val shifted = known.filter { it.direction != "stable" }
        val directions = shifted.map { it.direction }.toSet()
        val allKnown = known.size == observations.size
        val state = when {
            !allKnown || known.size < 2 || directions.size > 1 -> "uncertain"
            shifted.isEmpty() -> "stable"
            shifted.size == 1 -> "single_shift"
            observations.last().direction == "stable" && maxShiftRun(observations.dropLast(1)) >= 2 -> "returning"
            else -> "repeated_shift"
        }
        val shiftedDirection = when {
            directions.size == 1 -> directions.first()
            else -> "mixed"
        }
        val confidence = when {
            state == "uncertain" -> "low"
            complete.size >= 6 && allKnown -> "high"
            else -> "medium"
        }
        base.put("state", state)
            .put("direction", shiftedDirection)
            .put("confidence", confidence)
            .put("referenceMedian", referenceMedian)
            .put("referenceScale", scale)
            .put("shiftedBlockCount", shifted.size)
            .put("maxShiftRun", maxShiftRun(observations))
            .put("evidenceBlocks", evidenceBlocks)
            .put("changePoint", candidateChangePoint(observations, state, complete.size, allKnown))
            .put("limitations", JSONArray().apply { limitations.forEach { put(it) } })
        return base
    }

    /**
     * #228：从连续周块中给出候选变化期，而不是宣称一个精确变化点。
     * 单个偏离周、方向混合或未知周块不会生成起点；候选区间只引用已输出的
     * week-* 证据块，方便 EvidenceGraph/AI 追溯且不暴露原始记录。
     */
    private fun candidateChangePoint(
        observations: List<BlockObservation>,
        state: String,
        completeBlocks: Int,
        allKnown: Boolean,
    ): JSONObject {
        val method = "rolling-deviation+persistence-v1"
        val commonLimitations = mutableListOf("候选区间由连续自然周偏离推断，不是正式变化点或因果结论")
        if (!allKnown) {
            commonLimitations += "存在未知周块，候选起点需要更多完整记录确认"
            return unavailableChangePoint("uncertain", "low", commonLimitations)
        }
        when (state) {
            "stable" -> return unavailableChangePoint("not_detected", confidenceForChangePoint(completeBlocks, 0), "未观察到连续偏离周块")
            "single_shift" -> return unavailableChangePoint("not_detected", "low", "单个偏离周视为偶发波动，不生成候选起点")
            "uncertain" -> return unavailableChangePoint("uncertain", "low", "方向混合或有效周块不足，暂不确定候选起点")
        }

        val runs = shiftRuns(observations).filter { it.length >= 2 }
        val selected = when (state) {
            "returning" -> runs.lastOrNull { run ->
                run.endIndex < observations.lastIndex && observations[run.endIndex + 1].direction == "stable"
            }
            else -> runs.maxWithOrNull(compareBy<ShiftRun> { it.length }.thenBy { it.startIndex })
        }
        if (selected == null) {
            commonLimitations += "未形成连续至少 2 个偏离周块，暂不确定起点"
            return JSONObject()
                .put("status", "uncertain")
                .put("method", method)
                .put("confidence", "low")
                .put("limitations", JSONArray().apply { commonLimitations.forEach { put(it) } })
                .put("evidenceBlockIds", JSONArray())
        }

        val start = observations[selected.startIndex].week
        val end = observations[selected.endIndex].week
        val evidenceIds = JSONArray()
        for (index in selected.startIndex..selected.endIndex) {
            evidenceIds.put("week-${observations[index].week.startKey}")
        }
        return JSONObject()
            .put("status", "candidate")
            .put("method", method)
            .put("direction", selected.direction)
            .put("confidence", confidenceForChangePoint(completeBlocks, selected.length))
            .put("startWeekStartKey", start.startKey)
            .put("startWeekEndKey", start.endKey)
            .put("endWeekStartKey", end.startKey)
            .put("endWeekEndKey", end.endKey)
            .put("evidenceBlockIds", evidenceIds)
            .put("shiftedBlockCount", selected.length)
            .put("limitations", JSONArray().apply { commonLimitations.forEach { put(it) } })
    }

    private fun shiftRuns(observations: List<BlockObservation>): List<ShiftRun> {
        val runs = mutableListOf<ShiftRun>()
        var start = -1
        var direction = ""
        observations.forEachIndexed { index, observation ->
            val current = observation.direction
            if (current != "unknown" && current != "stable") {
                if (start < 0 || current != direction) {
                    if (start >= 0) runs += ShiftRun(start, index - 1, direction)
                    start = index
                    direction = current
                }
            } else if (start >= 0) {
                runs += ShiftRun(start, index - 1, direction)
                start = -1
                direction = ""
            }
        }
        if (start >= 0) runs += ShiftRun(start, observations.lastIndex, direction)
        return runs
    }

    private fun confidenceForChangePoint(completeBlocks: Int, runLength: Int): String = when {
        completeBlocks >= 6 && runLength >= 3 -> "high"
        completeBlocks >= 4 && runLength >= 2 -> "medium"
        else -> "low"
    }

    private fun unavailableChangePoint(status: String, confidence: String, limitation: String): JSONObject =
        unavailableChangePoint(status, confidence, listOf(limitation))

    private fun unavailableChangePoint(status: String, confidence: String, limitations: List<String>): JSONObject = JSONObject()
        .put("status", status)
        .put("method", "rolling-deviation+persistence-v1")
        .put("confidence", confidence)
        .put("evidenceBlockIds", JSONArray())
        .put("limitations", JSONArray().apply { limitations.forEach { put(it) } })

    private fun maxShiftRun(observations: List<BlockObservation>): Int {
        var longest = 0
        var current = 0
        var previousDirection = ""
        observations.forEach { observation ->
            if (observation.direction != "unknown" && observation.direction != "stable" && observation.direction == previousDirection) {
                current += 1
            } else if (observation.direction != "unknown" && observation.direction != "stable") {
                current = 1
            } else {
                current = 0
                previousDirection = ""
            }
            if (observation.direction != "unknown" && observation.direction != "stable") previousDirection = observation.direction
            longest = max(longest, current)
        }
        return longest
    }

    private fun buildWeekBlocks(daily: JSONArray): List<WeekBlock> {
        val byStart = mutableMapOf<String, WeekBlock>()
        for (index in 0 until daily.length()) {
            val day = daily.optJSONObject(index) ?: continue
            val dateKey = day.optString("dateKey").trim()
            val weekStart = mondayOf(dateKey)
            if (weekStart.isBlank()) continue
            val block = byStart.getOrPut(weekStart) { WeekBlock(weekStart) }
            block.daysPresent += dateKey
            if (day.optBoolean("observed", false)) block.observedDays += 1
            block.recordCount += day.optInt("count", 0).coerceAtLeast(0)
            val durations = day.optJSONArray("durationValues")
            if (durations != null) {
                for (durationIndex in 0 until durations.length()) {
                    val value = durations.optDouble(durationIndex, Double.NaN)
                    if (!value.isNaN() && value.isFinite() && value >= 0.0 && value <= 24 * 60) block.durationValues += value
                }
            }
        }
        return byStart.values.sortedBy { it.startKey }
    }

    private fun mondayOf(dateKey: String): String {
        val parts = dateKey.split('-')
        if (parts.size != 3) return ""
        return try {
            val calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC"), Locale.US)
            calendar.clear()
            calendar.isLenient = false
            calendar.set(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt())
            val dayOfWeek = calendar.get(Calendar.DAY_OF_WEEK)
            val daysBack = if (dayOfWeek == Calendar.SUNDAY) 6 else dayOfWeek - Calendar.MONDAY
            calendar.add(Calendar.DAY_OF_MONTH, -daysBack)
            formatDate(calendar)
        } catch (_: Exception) {
            ""
        }
    }

    private fun shiftDateKey(dateKey: String, amount: Int): String {
        val parts = dateKey.split('-')
        if (parts.size != 3) return ""
        return try {
            val calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC"), Locale.US)
            calendar.clear()
            calendar.isLenient = false
            calendar.set(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt())
            calendar.add(Calendar.DAY_OF_MONTH, amount)
            formatDate(calendar)
        } catch (_: Exception) {
            ""
        }
    }

    private fun formatDate(calendar: Calendar): String = String.format(
        Locale.US,
        "%04d-%02d-%02d",
        calendar.get(Calendar.YEAR),
        calendar.get(Calendar.MONTH) + 1,
        calendar.get(Calendar.DAY_OF_MONTH),
    )

    private fun appendMetric(
        metrics: JSONObject,
        deviations: JSONArray,
        name: String,
        baselineValues: List<Double>,
        currentValues: List<Double>,
        baselineReady: Boolean,
        currentValueProvider: () -> Double?,
    ) {
        val currentValue = currentValueProvider()
        val summary = JSONObject().put("metric", name)
            .put("available", baselineReady && baselineValues.isNotEmpty() && currentValue != null)
            .put("baselineSampleCount", baselineValues.size)
            .put("currentSampleCount", currentValues.size)
        if (baselineValues.isEmpty() || currentValue == null) {
            metrics.put(name, summary)
            return
        }
        val sorted = baselineValues.sorted()
        val med = median(sorted) ?: return
        val q1 = percentile(sorted, 0.25) ?: med
        val q3 = percentile(sorted, 0.75) ?: med
        val iqr = q3 - q1
        val mad = median(sorted.map { abs(it - med) }) ?: 0.0
        val scale = max(max(iqr, mad * 1.4826), 1e-6)
        val robustScore = (currentValue - med) / scale
        val direction = when {
            abs(robustScore) < 0.5 -> "stable"
            robustScore > 0 -> "higher"
            else -> "lower"
        }
        val magnitude = when {
            abs(robustScore) < 0.5 -> "none"
            abs(robustScore) < 1.5 -> "small"
            abs(robustScore) < 2.5 -> "moderate"
            else -> "large"
        }
        val item = JSONObject()
            .put("metric", name)
            .put("available", baselineReady && currentValues.isNotEmpty())
            .put("baselineSampleCount", baselineValues.size)
            .put("currentSampleCount", currentValues.size)
            .put("currentValue", currentValue)
            .put("median", med)
            .put("q1", q1)
            .put("q3", q3)
            .put("iqr", iqr)
            .put("mad", mad)
            .put("p10", percentile(sorted, 0.10) ?: med)
            .put("p50", med)
            .put("p90", percentile(sorted, 0.90) ?: med)
            .put("percentileRank", percentileRank(sorted, currentValue))
            .put("robustScore", robustScore)
            .put("direction", direction)
            .put("magnitude", magnitude)
        metrics.put(name, item)
        if (baselineReady && currentValues.isNotEmpty()) deviations.put(item)
    }

    private fun numberList(values: JSONArray?): List<Double> {
        if (values == null) return emptyList()
        val result = mutableListOf<Double>()
        for (index in 0 until values.length()) {
            val value = values.optDouble(index, Double.NaN)
            if (!value.isNaN() && value.isFinite()) result += value
        }
        return result
    }

    private fun median(values: List<Double>): Double? {
        if (values.isEmpty()) return null
        val sorted = values.sorted()
        val middle = sorted.size / 2
        return if (sorted.size % 2 == 0) (sorted[middle - 1] + sorted[middle]) / 2.0 else sorted[middle]
    }

    private fun percentile(values: List<Double>, probability: Double): Double? {
        if (values.isEmpty()) return null
        val sorted = values.sorted()
        val position = (sorted.size - 1) * probability.coerceIn(0.0, 1.0)
        val lower = position.toInt()
        val upper = min(lower + 1, sorted.lastIndex)
        val fraction = position - lower
        return sorted[lower] + (sorted[upper] - sorted[lower]) * fraction
    }

    private fun percentileRank(values: List<Double>, value: Double): Double {
        if (values.isEmpty()) return 0.0
        val atOrBelow = values.count { it <= value }
        return (atOrBelow.toDouble() / values.size * 100.0).let { (it * 100.0).toInt() / 100.0 }
    }
}
