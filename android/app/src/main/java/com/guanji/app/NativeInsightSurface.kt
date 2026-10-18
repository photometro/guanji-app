package com.guanji.app

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.foundation.Canvas
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * #277：v4.1.5 当前洞悉页的经典/普通模式原生迁移。
 *
 * 这里只渲染 WebView 已经聚合好的 insight 快照；统计、AI 触发、缓存、
 * 隐私边界和页面动作仍由既有 JS/Room 链持有。玻璃模式不会进入此 Surface。
 */
@Composable
fun NativeInsightSurface(
    snapshotJson: String?,
    darkTheme: Boolean,
    windowMetrics: NativeWindowMetrics = NativeWindowMetrics(),
    onConfigureAI: () -> Unit,
    onGenerateAI: () -> Unit,
    onAskQuestion: (String) -> Unit,
) {
    val root = remember(snapshotJson) {
        runCatching { JSONObject(snapshotJson.orEmpty()) }.getOrElse { JSONObject() }
    }
    val insight = root.optJSONObject("insight") ?: JSONObject()
    val ai = root.optJSONObject("insightAI") ?: JSONObject()
    val colors = insightColors(darkTheme)
    val aiReport = ai.optJSONObject("report")
    val aiStatus = ai.optString("status", "idle")
    val aiVisible = aiReport != null && ai.optBoolean("valueAdded", true) &&
        aiStatus in setOf("ready", "ready-stale", "loading")
    val inferredReadStatus = when {
        !root.has("insight") || insight.length() == 0 -> "error"
        insight.optInt("recordCount", 0) == 0 -> "empty"
        insight.optInt("recordCount", 0) < 3 || insight.optInt("coverageDays", 0) < 2 -> "insufficient"
        else -> "ready"
    }
    /* 旧版缓存没有状态字段时按快照内容推断，避免升级后把已有组合误报为读取失败。 */
    val insightReadStatus = root.optString("insightReadStatus", inferredReadStatus)
    val cooccurrenceStatus = root.optString("cooccurrenceStatus", insightReadStatus)
    val ask = root.optJSONObject("insightAsk") ?: JSONObject()
    val scroll = rememberScrollState()

    Box(Modifier.fillMaxSize().background(colors.background)) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scroll)
                .padding(start = 22.dp, end = 22.dp, top = 36.dp, bottom = 120.dp + windowMetrics.navigationBarDp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            InsightHeader(colors)
            InsightCardFrame("整体观察", "整体概览", colors) {
                InsightNarrative(
                    local = localOverview(insight),
                    ai = aiText(aiReport, "overview"),
                    visible = aiVisible,
                    colors = colors,
                )
                InsightOverviewMetrics(insight, colors)
            }
            InsightCardFrame("时段观察", "时段分布", colors) {
                InsightNarrative(
                    local = localTime(insight),
                    ai = aiText(aiReport, "timeInsight"),
                    visible = aiVisible,
                    colors = colors,
                )
                InsightTimeBars(insight.optJSONObject("timeBuckets"), colors)
            }
            InsightCardFrame("状况观察", "发生前状况", colors) {
                InsightNarrative(
                    local = localLabels(insight),
                    ai = aiText(aiReport, "labelInsights").ifBlank { aiText(aiReport, "moodInsight") },
                    visible = aiVisible,
                    colors = colors,
                )
                InsightLabelRows(insight.optJSONArray("labels"), colors)
            }
            InsightCardFrame("关联观察", "共同出现", colors) {
                InsightNarrative(
                    local = localPairs(insight),
                    ai = aiText(aiReport, "pairInsights").ifBlank { aiText(aiReport, "patterns") },
                    visible = aiVisible,
                    colors = colors,
                )
                InsightPairRows(
                    insight = insight,
                    labels = insight.optJSONArray("labels"),
                    status = cooccurrenceStatus,
                    colors = colors,
                )
            }
            InsightCardFrame("变化观察", "变化观察", colors) {
                InsightNarrative(
                    local = localChange(insight),
                    ai = aiText(aiReport, "changeInsight"),
                    visible = aiVisible,
                    colors = colors,
                )
                InsightChange(insight, colors)
            }
            InsightCardFrame("可选建议", "可以试试", colors) {
                InsightSuggestions(insight, aiReport, aiVisible, colors)
            }
            InsightActionCard(ai, aiStatus, colors, onConfigureAI, onGenerateAI)
            if (aiVisible) {
                InsightAskSection(
                    ask = ask,
                    colors = colors,
                    onAskQuestion = onAskQuestion,
                )
            }
        }
    }
}

private data class InsightColors(
    val background: Color,
    val card: Color,
    val ink: Color,
    val secondary: Color,
    val tertiary: Color,
    val line: Color,
    val accent: Color,
    val accentDeep: Color,
    val accentSoft: Color,
)

/**
 * #277 follow-up：洞悉页 Typography 单一入口。
 * 数值来自 WebView `base.css` / `screens.css` 的洞悉选择器；各 Composable
 * 只引用这里的语义 token，避免用 Compose/Material 默认文字样式漂移。
 */
private data class InsightTypography(
    val eyebrow: TextStyle,
    val pageTitle: TextStyle,
    val pageSubtitle: TextStyle,
    val cardTag: TextStyle,
    val cardTitle: TextStyle,
    val narrative: TextStyle,
    val aiLabel: TextStyle,
    val metricNumber: TextStyle,
    val metricLabel: TextStyle,
    val clarity: TextStyle,
    val dataLabel: TextStyle,
    val dataValue: TextStyle,
    val body: TextStyle,
    val empty: TextStyle,
    val pair: TextStyle,
    val pairCount: TextStyle,
    val changeResult: TextStyle,
    val changeNote: TextStyle,
    val changeLabel: TextStyle,
    val changeValue: TextStyle,
    val suggestionNumber: TextStyle,
    val suggestion: TextStyle,
    val suggestionSource: SpanStyle,
    val actionEyebrow: TextStyle,
    val actionTitle: TextStyle,
    val actionStatus: TextStyle,
    val disclaimer: TextStyle,
    val button: TextStyle,
    val askTitle: TextStyle,
    val askChip: TextStyle,
    val askAnswer: TextStyle,
    val askQuestion: TextStyle,
)

private fun insightTypography(colors: InsightColors): InsightTypography {
    fun s(role: NativeTypography.Role, color: Color) = NativeTypography.style(role, color)
    return InsightTypography(
        eyebrow = s(NativeTypography.Role.InsightEyebrow, colors.secondary),
        pageTitle = s(NativeTypography.Role.InsightPageTitle, colors.ink),
        pageSubtitle = s(NativeTypography.Role.InsightPageSubtitle, colors.secondary),
        cardTag = s(NativeTypography.Role.InsightCardTag, colors.tertiary),
        cardTitle = s(NativeTypography.Role.InsightCardTitle, colors.ink),
        narrative = s(NativeTypography.Role.InsightNarrative, colors.secondary),
        aiLabel = s(NativeTypography.Role.InsightAiLabel, colors.tertiary),
        metricNumber = s(NativeTypography.Role.InsightMetricNumber, colors.accent),
        metricLabel = s(NativeTypography.Role.InsightMetricLabel, colors.secondary),
        clarity = s(NativeTypography.Role.InsightClarity, colors.accentDeep),
        dataLabel = s(NativeTypography.Role.InsightDataLabel, colors.tertiary),
        dataValue = s(NativeTypography.Role.InsightDataValue, colors.secondary),
        body = s(NativeTypography.Role.InsightNarrative, colors.secondary).copy(lineHeight = 25.4.sp),
        empty = s(NativeTypography.Role.InsightEmpty, colors.tertiary),
        pair = s(NativeTypography.Role.InsightPair, colors.secondary),
        pairCount = s(NativeTypography.Role.InsightPairCount, colors.accentDeep),
        changeResult = s(NativeTypography.Role.InsightChangeResult, colors.accentDeep),
        changeNote = s(NativeTypography.Role.InsightChangeNote, colors.tertiary),
        changeLabel = s(NativeTypography.Role.InsightChangeLabel, colors.tertiary),
        changeValue = s(NativeTypography.Role.InsightChangeValue, colors.secondary),
        suggestionNumber = s(NativeTypography.Role.InsightSuggestionNumber, colors.accent),
        suggestion = s(NativeTypography.Role.InsightSuggestion, colors.secondary),
        suggestionSource = SpanStyle(
            color = colors.accentDeep,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = NativeTypography.family,
            fontSynthesis = NativeTypography.synthesis,
        ),
        actionEyebrow = s(NativeTypography.Role.InsightActionEyebrow, colors.accentDeep),
        actionTitle = s(NativeTypography.Role.InsightActionTitle, colors.secondary),
        actionStatus = s(NativeTypography.Role.InsightActionStatus, colors.secondary),
        disclaimer = s(NativeTypography.Role.InsightDisclaimer, colors.tertiary),
        button = s(NativeTypography.Role.InsightButton, Color.White),
        askTitle = s(NativeTypography.Role.InsightAskTitle, colors.ink),
        askChip = s(NativeTypography.Role.InsightAskChip, colors.secondary),
        askAnswer = s(NativeTypography.Role.InsightAskAnswer, colors.secondary),
        askQuestion = s(NativeTypography.Role.InsightAskQuestion, colors.accentDeep),
    )
}

private fun insightColors(dark: Boolean) = if (dark) InsightColors(
    Color(0xFF121212), Color(0xFF1E1E1E), Color.White, Color(0xFFB0B0B4),
    Color(0xFF7D7D82), Color(0xFF3A3A3C), Color(0xFF0A84FF), Color(0xFF409CFF), Color(0x332A8BFF)
) else InsightColors(
    Color(0xFFF2F2F7), Color.White, Color.Black, Color(0xFF8E8E93),
    Color(0xFFC7C7CC), Color(0xFFE5E5EA), Color(0xFF007AFF), Color(0xFF0062CC), Color(0xFFE8F1FF)
)

@Composable
private fun InsightHeader(colors: InsightColors) {
    val type = insightTypography(colors)
    Column(Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 20.dp)) {
        BasicText("洞察", style = type.eyebrow)
        Spacer(Modifier.height(6.dp))
        BasicText("个人洞察", style = type.pageTitle)
        Spacer(Modifier.height(6.dp))
        BasicText("按主题看看近 7 天的节奏", style = type.pageSubtitle)
    }
}

@Composable
private fun InsightCardFrame(tag: String, title: String, colors: InsightColors, content: @Composable () -> Unit) {
    val type = insightTypography(colors)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(2.dp, RoundedCornerShape(16.dp), clip = false)
            .clip(RoundedCornerShape(16.dp))
            .background(colors.card)
            .padding(22.dp),
    ) {
        BasicText(tag, style = type.cardTag)
        Spacer(Modifier.height(12.dp))
        BasicText(title, style = type.cardTitle)
        Spacer(Modifier.height(4.dp))
        content()
    }
}

@Composable
private fun InsightNarrative(local: String, ai: String, visible: Boolean, colors: InsightColors) {
    val type = insightTypography(colors)
    val text = if (visible && ai.isNotBlank()) ai else local
    if (text.isBlank()) return
    Column(Modifier.padding(top = 9.dp, bottom = 14.dp)) {
        if (visible && ai.isNotBlank()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(5.dp).clip(RoundedCornerShape(50)).background(colors.accent))
                Spacer(Modifier.width(7.dp))
                BasicText("AI 观察", style = type.aiLabel)
            }
            Spacer(Modifier.height(8.dp))
        }
        BasicText(text, style = type.narrative)
    }
}

@Composable
private fun InsightOverviewMetrics(insight: JSONObject, colors: InsightColors) {
    val type = insightTypography(colors)
    val count = insight.optInt("recordCount", 0)
    val coverage = insight.optInt("coverageDays", 0)
    val clarity = insight.optJSONObject("clarity")?.optString("label", "") ?: ""
    Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.Bottom) {
        MetricNumber(count.toString(), "次记录", colors)
        Spacer(Modifier.width(22.dp))
        MetricNumber(coverage.toString(), "天有记录", colors)
        if (clarity.isNotBlank()) {
            Spacer(Modifier.weight(1f))
            BasicText(clarity, modifier = Modifier.padding(start = 12.dp), style = type.clarity)
        }
    }
}

@Composable
private fun MetricNumber(number: String, label: String, colors: InsightColors) {
    val type = insightTypography(colors)
    Row(verticalAlignment = Alignment.Bottom) {
        BasicText(number, style = type.metricNumber)
        Spacer(Modifier.width(5.dp))
        BasicText(label, modifier = Modifier.padding(bottom = 4.dp), style = type.metricLabel)
    }
}

@Composable
private fun InsightTimeBars(buckets: JSONObject?, colors: InsightColors) {
    val type = insightTypography(colors)
    val keys = listOf("清晨", "上午", "下午", "傍晚", "深夜")
    val values = keys.map { buckets?.optInt(it, 0) ?: 0 }
    val maxValue = max(1, values.maxOrNull() ?: 0)
    Row(Modifier.fillMaxWidth().height(122.dp), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.Bottom) {
        keys.forEachIndexed { index, key ->
            val value = values[index]
            val height = (10 + (value.toFloat() / maxValue.toFloat()) * 54).roundToInt().coerceAtLeast(8)
            val peak = value == values.maxOrNull() && value > 0
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Bottom) {
                Box(Modifier.width(22.dp).height(height.dp).clip(RoundedCornerShape(topStart = 9.dp, topEnd = 9.dp, bottomStart = 3.dp, bottomEnd = 3.dp)).background(if (peak) colors.accent else colors.line))
                Spacer(Modifier.height(7.dp))
                BasicText(value.toString(), style = type.dataValue.copy(color = if (peak) colors.accentDeep else colors.secondary))
                BasicText(key, style = type.dataLabel.copy(color = if (peak) colors.accentDeep else colors.tertiary))
            }
        }
    }
}

@Composable
private fun InsightLabelRows(labels: JSONArray?, colors: InsightColors) {
    val type = insightTypography(colors)
    val count = labels?.length() ?: 0
    if (count == 0) {
        BasicText("还没有足够的发生前状况可供比较。", style = type.empty)
        return
    }
    Column(Modifier.fillMaxWidth()) {
        for (index in 0 until minOf(count, 3)) {
            val item = labels?.optJSONObject(index) ?: continue
            val label = item.optString("label", item.optString("key", ""))
            val value = item.optInt("count", 0)
            Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(7.dp).clip(RoundedCornerShape(50)).background(colors.accent))
                Spacer(Modifier.width(8.dp))
                BasicText(label, style = type.pair)
                Spacer(Modifier.weight(1f))
                BasicText(value.toString(), style = type.dataValue.copy(color = colors.accentDeep))
            }
            if (index < minOf(count, 3) - 1) Spacer(Modifier.fillMaxWidth().height(1.dp).background(colors.line))
        }
    }
}

private sealed interface PairReadResult {
    data class Ready(val items: List<PairDisplay>) : PairReadResult
    data object Empty : PairReadResult
    data object Insufficient : PairReadResult
    data object Error : PairReadResult
}

private data class PairDisplay(val labels: List<String>, val count: Int)

/**
 * 共同出现的状态必须区分“没有组合”和“快照字段读坏”。WebView 的事实源是
 * `cooccurrence: [{ pair: "key + key", count, ratio }]`；这里同时完成字段校验
 * 与 key→label 映射，避免把原始 key 直接画到界面上。
 */
private fun readPairRows(insight: JSONObject, labels: JSONArray?, status: String): PairReadResult {
    if (status == "insufficient") return PairReadResult.Insufficient
    if (status == "empty") return PairReadResult.Empty
    if (status == "error") return PairReadResult.Error
    if (!insight.has("cooccurrence") || insight.isNull("cooccurrence")) return PairReadResult.Error
    val array = insight.optJSONArray("cooccurrence") ?: return PairReadResult.Error
    if (array.length() == 0) return PairReadResult.Empty
    val labelMap = mutableMapOf<String, String>()
    for (index in 0 until (labels?.length() ?: 0)) {
        val item = labels?.optJSONObject(index) ?: continue
        val key = item.optString("key", "").trim()
        val label = item.optString("label", key).trim()
        if (key.isNotEmpty()) labelMap[key] = if (label.isNotEmpty()) label else key
    }
    val rows = mutableListOf<PairDisplay>()
    for (index in 0 until array.length()) {
        val item = array.optJSONObject(index) ?: return PairReadResult.Error
        val rawPair = item.optString("pair", "").trim()
        val countValue = item.opt("count")
        val count = when (countValue) {
            is Number -> countValue.toInt()
            else -> return PairReadResult.Error
        }
        val keys = rawPair.split(Regex("\\s+\\+\\s+|\\s+·\\s+")).map { it.trim() }.filter { it.isNotEmpty() }
        if (keys.size < 2 || count < 0) return PairReadResult.Error
        rows += PairDisplay(keys.map { labelMap[it] ?: it }, count)
    }
    return if (rows.isEmpty()) PairReadResult.Empty else PairReadResult.Ready(rows)
}

@Composable
private fun InsightPairRows(insight: JSONObject, labels: JSONArray?, status: String, colors: InsightColors) {
    val type = insightTypography(colors)
    when (val result = readPairRows(insight, labels, status)) {
        PairReadResult.Empty -> BasicText("记录中出现多个状况后，这里会显示它们的共同出现。", style = type.empty)
        PairReadResult.Insufficient -> BasicText("记录还不够，积累几条并覆盖不止一天后再观察共同出现。", style = type.empty)
        PairReadResult.Error -> BasicText("共同出现暂时无法读取，请稍后重试。", style = type.empty)
        is PairReadResult.Ready -> {
            Column(Modifier.fillMaxWidth()) {
                result.items.take(2).forEachIndexed { index, item ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 11.dp), verticalAlignment = Alignment.CenterVertically) {
                        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                            item.labels.forEachIndexed { labelIndex, label ->
                                if (labelIndex > 0) BasicText("·", style = type.dataLabel)
                                BasicText(label, modifier = Modifier.widthIn(max = 120.dp), style = type.pair)
                            }
                        }
                        BasicText("${item.count} 次", style = type.pairCount)
                    }
                    if (index < minOf(result.items.size, 2) - 1) Spacer(Modifier.fillMaxWidth().height(1.dp).background(colors.line))
                }
                if (result.items.size > 2) BasicText("还有 ${result.items.size - 2} 组组合", modifier = Modifier.padding(top = 10.dp), style = type.changeNote)
            }
        }
    }
}

@Composable
private fun InsightChange(insight: JSONObject, colors: InsightColors) {
    val type = insightTypography(colors)
    val changes = insight.optJSONObject("changes") ?: JSONObject()
    val current = insight.optInt("recordCount", 0)
    val previous = changes.optJSONObject("previous")?.optInt("recordCount", 0)
        ?: insight.optJSONObject("previous")?.optInt("recordCount", 0) ?: 0
    val maxValue = max(1, max(current, previous))
    Column(Modifier.fillMaxWidth()) {
        ChangeBar("近 7 天", current, maxValue, colors.accent, colors)
        Spacer(Modifier.height(9.dp))
        ChangeBar("前 7 天", previous, maxValue, colors.line, colors)
        Spacer(Modifier.height(12.dp))
        val delta = current - previous
        BasicText(
            if (previous == 0) "前 7 天还没有记录，先积累一些数据再比较。"
            else if (delta > 0) "比前 7 天多 $delta 次"
            else if (delta < 0) "比前 7 天少 ${-delta} 次"
            else "与前 7 天相同",
            style = type.changeResult.copy(color = if (delta > 0) colors.accentDeep else colors.secondary)
        )
        Spacer(Modifier.height(3.dp))
        BasicText("这里只比较记录数量，不代表好坏。", style = type.changeNote)
    }
}

@Composable
private fun ChangeBar(label: String, value: Int, maxValue: Int, fill: Color, colors: InsightColors) {
    val type = insightTypography(colors)
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        BasicText(label, modifier = Modifier.width(58.dp), style = type.changeLabel)
        Box(Modifier.weight(1f).height(5.dp).clip(RoundedCornerShape(999.dp)).background(colors.line)) {
            Box(Modifier.fillMaxWidth(value.toFloat() / maxValue.toFloat()).height(5.dp).background(fill))
        }
        Spacer(Modifier.width(9.dp))
        BasicText("$value 次", modifier = Modifier.widthIn(min = 34.dp), style = type.changeValue.copy(textAlign = TextAlign.End))
    }
}

@Composable
private fun InsightSuggestions(insight: JSONObject, report: JSONObject?, aiVisible: Boolean, colors: InsightColors) {
    val type = insightTypography(colors)
    val suggestions = if (aiVisible) jsonStrings(report?.opt("suggestions")) else localSuggestions(insight)
    if (suggestions.isEmpty()) {
        BasicText(if (aiVisible) "本次未生成可选建议。" else "记录更多后，这里会显示可以尝试的小调整。", style = type.empty)
        return
    }
    Column(Modifier.fillMaxWidth()) {
        suggestions.take(3).forEachIndexed { index, suggestion ->
            Row(Modifier.fillMaxWidth().padding(vertical = 9.dp), verticalAlignment = Alignment.Top) {
                BasicText(String.format("%02d", index + 1), modifier = Modifier.width(28.dp), style = type.suggestionNumber)
                BasicText(
                    text = if (aiVisible) {
                        AnnotatedString.Builder().apply {
                            pushStyle(type.suggestionSource)
                            append("AI 建议")
                            pop()
                            append("  ")
                            append(suggestion)
                        }.toAnnotatedString()
                    } else AnnotatedString(suggestion),
                    modifier = Modifier.weight(1f),
                    style = type.suggestion,
                )
            }
            if (index < minOf(suggestions.size, 3) - 1) Spacer(Modifier.fillMaxWidth().height(1.dp).background(colors.line))
        }
    }
}

@Composable
private fun InsightActionCard(
    ai: JSONObject,
    status: String,
    colors: InsightColors,
    onConfigureAI: () -> Unit,
    onGenerateAI: () -> Unit,
) {
    val type = insightTypography(colors)
    val report = ai.optJSONObject("report")
    val configured = report != null || status in setOf("ready", "ready-stale", "loading", "error")
    val title = when {
        status == "ready-stale" -> "数据有更新，上次 AI 观察已过期，可以重新生成。"
        status == "error" -> "AI 观察暂时没有生成，可以稍后重试。"
        status == "loading" && report == null -> "正在生成 AI 增强观察…"
        !configured -> "基础洞察无需 AI；如果愿意，可以生成一段增强观察。"
        else -> "基于近 7 天聚合数据，为每张卡片生成可选的温和观察。"
    }
    Column(
        Modifier.fillMaxWidth().shadow(1.dp, RoundedCornerShape(16.dp), clip = false).clip(RoundedCornerShape(16.dp)).background(colors.card).padding(22.dp)
    ) {
        BasicText("AI 增强观察", style = type.actionEyebrow)
        Spacer(Modifier.height(12.dp))
        BasicText(title, style = type.actionTitle)
        Spacer(Modifier.height(16.dp))
        Box(Modifier.fillMaxWidth().height(46.dp), contentAlignment = Alignment.CenterStart) {
            when {
                status == "loading" -> InsightLoadingState(colors, type)
                !configured -> InsightPillButton("配置 AI", colors, onConfigureAI)
                else -> InsightPillButton("重新生成分析", colors, onGenerateAI)
            }
        }
        val disclaimer = ai.optString("disclaimer", "")
        if (status != "loading" && disclaimer.isNotBlank()) {
            Spacer(Modifier.height(16.dp))
            BasicText(disclaimer, modifier = Modifier.padding(horizontal = 4.dp), style = type.disclaimer)
        }
    }
}

/** WebView `.insight-action-loading` 的完整状态：保留 14px 转圈，并显示左对齐的灰色提示文案。 */
@Composable
private fun InsightLoadingState(colors: InsightColors, type: InsightTypography) {
    Row(
        Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Start,
    ) {
        InsightLoadingSpinner(colors)
        Spacer(Modifier.width(8.dp))
        BasicText("正在生成 AI 增强观察…", style = type.actionStatus)
    }
}

/** WebView `.insight-action-loading .spinner` 的 14px / 2px / 0.8s 视觉等价实现。 */
@Composable
private fun InsightLoadingSpinner(colors: InsightColors) {
    val transition = rememberInfiniteTransition(label = "insight-action-loading")
    val rotation by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(durationMillis = 800, easing = LinearEasing)),
        label = "insight-action-loading-rotation",
    )
    Canvas(Modifier.size(14.dp)) {
        drawArc(
            color = colors.accent,
            startAngle = rotation,
            sweepAngle = 270f,
            useCenter = false,
            style = Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round),
        )
    }
}

@Composable
private fun InsightPillButton(label: String, colors: InsightColors, onClick: () -> Unit) {
    val type = insightTypography(colors)
    val source = remember { MutableInteractionSource() }
    Box(
        Modifier.fillMaxWidth().height(46.dp).clip(RoundedCornerShape(999.dp)).background(colors.accent)
            .clickable(interactionSource = source, indication = null, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        BasicText(label, style = type.button)
    }
}

@Composable
private fun InsightAskSection(ask: JSONObject, colors: InsightColors, onAskQuestion: (String) -> Unit) {
    val type = insightTypography(colors)
    val presets = listOf("我的频率算高吗？", "深夜容易受成人内容影响，怎么办？", "压力大时怎么办？")
    val status = ask.optString("status", "idle")
    val question = ask.optString("question", "")
    val answer = ask.optString("answer", "")
    Column(
        modifier = Modifier.fillMaxWidth().padding(top = 2.dp, bottom = 8.dp),
        horizontalAlignment = Alignment.Start,
    ) {
        BasicText("想再聊聊什么？", style = type.askTitle)
        Spacer(Modifier.height(12.dp))
        Column(
            modifier = Modifier.wrapContentWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            horizontalAlignment = Alignment.Start,
        ) {
            presets.forEach { preset ->
                val shape = RoundedCornerShape(999.dp)
                Box(
                    Modifier
                        .wrapContentWidth()
                        .heightIn(min = 38.dp)
                        .clip(shape)
                        .background(colors.card)
                        .border(1.dp, colors.line, shape)
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                            onClick = { onAskQuestion(preset) },
                        )
                        .padding(horizontal = 15.dp, vertical = 9.dp),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    BasicText(preset, style = type.askChip)
                }
            }
        }
        if (question.isNotBlank() && (status == "loading" || answer.isNotBlank())) {
            Spacer(Modifier.height(14.dp))
            Column(
                Modifier
                    .fillMaxWidth()
                    .shadow(2.dp, RoundedCornerShape(16.dp), clip = false)
                    .clip(RoundedCornerShape(16.dp))
                    .background(colors.card)
                    .padding(20.dp),
            ) {
                BasicText(question, style = type.askQuestion)
                Spacer(Modifier.height(10.dp))
                BasicText(if (status == "loading") "正在思考…" else answer, style = type.askAnswer)
            }
        }
    }
}

private fun localOverview(insight: JSONObject): String {
    val days = insight.optInt("days", 7)
    val count = insight.optInt("recordCount", 0)
    val coverage = insight.optInt("coverageDays", 0)
    val clarity = insight.optJSONObject("clarity")?.optString("label", "") ?: ""
    return "近 $days 天共 $count 条记录、覆盖 $coverage 天${if (clarity.isNotBlank()) "，数据清晰度呈“$clarity”" else "。"}"
}

private fun localTime(insight: JSONObject): String {
    val buckets = insight.optJSONObject("timeBuckets") ?: return "还没有足够的时段记录可供比较。"
    val entries = listOf("清晨", "上午", "下午", "傍晚", "深夜").map { it to buckets.optInt(it, 0) }.sortedByDescending { it.second }
    val top = entries.firstOrNull { it.second > 0 } ?: return "还没有足够的时段记录可供比较。"
    return "记录主要出现在${top.first}（${top.second} 次），可以继续观察自己的时间分布。"
}

private fun localLabels(insight: JSONObject): String {
    val label = insight.optJSONArray("labels")?.optJSONObject(0) ?: return "还没有足够的发生前状况可供比较。"
    return "“${label.optString("label", label.optString("key", ""))}”是目前出现较多的发生前状况。"
}

private fun localPairs(insight: JSONObject): String {
    val pairs = insight.optJSONArray("cooccurrence")
    if (pairs == null || pairs.length() == 0) return "记录更多后，这里会显示常见的共同出现组合。"
    return "近 7 天记录到 ${pairs.length()} 组共同出现的状况组合。"
}

private fun localChange(insight: JSONObject): String {
    val previous = insight.optJSONObject("previous")?.optInt("recordCount", 0) ?: 0
    val current = insight.optInt("recordCount", 0)
    return if (previous == 0) "前 7 天还没有记录，先积累一些数据再比较。" else "近 7 天与前 7 天的记录数量对比如下。"
}

private fun localSuggestions(insight: JSONObject): List<String> {
    val list = mutableListOf<String>()
    val topTime = insight.optJSONObject("changes")?.optJSONObject("currentTopTime")?.optString("key", "")
    val topLabel = insight.optJSONArray("labels")?.optJSONObject(0)?.optString("label", "")
    if (!topTime.isNullOrBlank()) list += "在${topTime}前，给自己留一小段缓冲时间。"
    if (!topLabel.isNullOrBlank()) list += "下次记录时继续标记“$topLabel”是否同时出现。"
    list += "只选择一个最容易做到的小调整，观察几天再决定是否继续。"
    return list
}

private fun aiText(report: JSONObject?, key: String): String {
    if (report == null) return ""
    val value = report.opt(key)
    return when (value) {
        is JSONObject -> value.keys().asSequence().mapNotNull { value.optString(it).takeIf(String::isNotBlank) }.take(2).joinToString(" ")
        is JSONArray -> (0 until value.length()).mapNotNull { value.optString(it).takeIf(String::isNotBlank) }.take(2).joinToString(" ")
        else -> value?.toString()?.takeIf { it.isNotBlank() } ?: ""
    }
}

private fun jsonStrings(value: Any?): List<String> = when (value) {
    is JSONArray -> (0 until value.length()).mapNotNull { value.optString(it).takeIf(String::isNotBlank) }
    is JSONObject -> value.keys().asSequence().mapNotNull { value.optString(it).takeIf(String::isNotBlank) }.toList()
    else -> listOfNotNull(value?.toString()?.takeIf { it.isNotBlank() })
}
