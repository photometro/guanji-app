package com.guanji.app

import android.graphics.Paint
import android.view.HapticFeedbackConstants
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import kotlin.math.roundToInt

private val NativeBg = Color(0xFFF2F2F7)
private val NativeCard = Color.White
private val NativeInk = Color.Black
private val NativeSecondary = Color(0xFF8E8E93)
private val NativeTertiary = Color(0xFFC7C7CC)
private val NativeLine = Color(0xFFE5E5EA)
private val NativeBlue = Color(0xFF007AFF)
private val NativeBlueDeep = Color(0xFF0062CC)
private val NativeBlueSoft = Color(0xFFE8F1FF)
private val NativeGreen = Color(0xFF34C759)
private val NativeDarkBg = Color(0xFF121212)
private val NativeDarkCard = Color(0xFF1E1E1E)
private val NativeDarkInk = Color.White
private val NativeDarkSecondary = Color(0xFFB0B0B4)
private val NativeDarkLine = Color(0xFF3A3A3C)

data class NativeRecentItem(
    val id: String,
    val dateKey: String,
    val time: String,
    val tags: String,
    val duration: String?
)

data class NativeHomeData(
    val todayCount: Int = 0,
    val weekCount: Int = 0,
    val weekDelta: Int? = null,
    val streak: Int = 0,
    val monthCount: Int = 0,
    val monthDelta: Int? = null,
    val rolling14: List<Int> = emptyList(),
    val rolling30: List<Int> = emptyList(),
    val timeBuckets: List<Pair<String, Int>> = emptyList(),
    val dayCounts: Map<String, Int> = emptyMap(),
    val recent: List<NativeRecentItem> = emptyList(),
    /** 日历按日期查看所需的轻量展示索引；不包含备注或原始记录字段。 */
    val calendarRecords: List<NativeRecentItem> = emptyList(),
    val todayKey: String = "",
    val greetingTitle: String = "今天，感觉如何？",
    val greetingTip: String = ""
) {
    companion object {
        fun parse(raw: String?): NativeHomeData {
            if (raw.isNullOrBlank()) return NativeHomeData()
            return try {
                val json = JSONObject(raw)
                val recent = mutableListOf<NativeRecentItem>()
                val recentArray = json.optJSONArray("recent") ?: JSONArray()
                for (i in 0 until recentArray.length()) {
                    val item = recentArray.optJSONObject(i) ?: continue
                    recent += NativeRecentItem(
                        id = item.optString("id"),
                        dateKey = item.optString("dateKey"),
                        time = item.optString("time"),
                        tags = item.optString("tags"),
                        duration = item.optString("duration").takeIf { it.isNotBlank() }
                    )
                }
                val calendarRecords = mutableListOf<NativeRecentItem>()
                val calendarArray = json.optJSONArray("calendarRecords") ?: JSONArray()
                for (i in 0 until calendarArray.length()) {
                    val item = calendarArray.optJSONObject(i) ?: continue
                    calendarRecords += NativeRecentItem(
                        id = item.optString("id"),
                        dateKey = item.optString("dateKey"),
                        time = item.optString("time"),
                        tags = item.optString("tags"),
                        duration = item.optString("duration").takeIf { it.isNotBlank() }
                    )
                }
                val buckets = mutableListOf<Pair<String, Int>>()
                val bucketJson = json.optJSONObject("timeBuckets")
                listOf("清晨", "上午", "下午", "傍晚", "深夜").forEach { key ->
                    buckets += key to (bucketJson?.optInt(key, 0) ?: 0)
                }
                val days = mutableMapOf<String, Int>()
                val dayJson = json.optJSONObject("dayCounts")
                if (dayJson != null) dayJson.keys().forEach { key -> days[key] = dayJson.optInt(key, 0) }
                NativeHomeData(
                    todayCount = json.optInt("todayCount", 0),
                    weekCount = json.optInt("weekCount", 0),
                    weekDelta = if (json.has("weekDelta") && !json.isNull("weekDelta")) json.optInt("weekDelta") else null,
                    streak = json.optInt("streak", 0),
                    monthCount = json.optInt("monthCount", 0),
                    monthDelta = if (json.has("monthDelta") && !json.isNull("monthDelta")) json.optInt("monthDelta") else null,
                    rolling14 = json.optIntArray("rolling14"),
                    rolling30 = json.optIntArray("rolling30"),
                    timeBuckets = buckets,
                    dayCounts = days,
                    recent = recent,
                    calendarRecords = calendarRecords.ifEmpty { recent },
                    todayKey = json.optString("todayKey"),
                    greetingTitle = json.optString("greetingTitle", "今天，感觉如何？"),
                    greetingTip = json.optString("greetingTip")
                )
            } catch (_: Exception) { NativeHomeData() }
        }

        private fun JSONObject.optIntArray(key: String): List<Int> {
            val array = optJSONArray(key) ?: return emptyList()
            return List(array.length()) { index -> array.optInt(index, 0) }
        }
    }
}

/**
 * #275：首页 NativeRoute。它只消费 WebView 写入的聚合快照，不复制原始记录库；
 * 记录编辑、删除和新增仍通过现有 JS/Room 权威链完成。所有颜色和间距来自
 * v4.1.5 经典 CSS token，玻璃模式不会进入此 Surface。
 */
@Composable
fun NativeHomeSurface(
    snapshotJson: String?,
    darkTheme: Boolean,
    windowMetrics: NativeWindowMetrics = NativeWindowMetrics(),
    onCalendar: () -> Unit,
    onRecord: () -> Unit,
    onEdit: (String) -> Unit,
    onDelete: (String) -> Unit,
    onCalendarEdit: (String) -> Unit = onEdit,
    onCalendarDelete: (String) -> Unit = onDelete,
    onCalendarAdd: (Int) -> Unit = {},
    onCalendarClose: () -> Unit = {}
) {
    val data = remember(snapshotJson) { NativeHomeData.parse(snapshotJson) }
    val colors = nativeColors(darkTheme)

    // The surface must paint the same background as the WebView theme itself.
    // Relying on the Activity/Compose host background leaves a light canvas
    // behind dark cards when the CSS theme changes without an Android uiMode
    // recreation (the common path on existing installs).
    Box(modifier = Modifier.fillMaxSize().background(colors.background)) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(start = 22.dp, end = 22.dp, top = 36.dp, bottom = 104.dp + windowMetrics.navigationBarDp),
            verticalArrangement = Arrangement.spacedBy(0.dp)
        ) {
            // 先通知宿主提升遮罩层级，再切换本地 Sheet 状态，避免首帧 Tab
            // 仍处于可交互前景层。
            NativeHomeHeader(data.todayKey, data.greetingTitle, data.greetingTip, colors, onCalendar = onCalendar)
            NativeFocus(data, colors, onRecord)
            NativeDivider(colors)
            NativeStats(data, colors)
            NativeTrendCard(data, colors)
            NativeTimeCard(data, colors)
            NativeRecentCard(data, colors, onEdit, onDelete)
            BasicText(
                "数据默认仅存本地；WebDAV 备份由你自选——上传的是密文",
                style = NativeTypography.explicit(colors.tertiary, 11.sp, lineHeight = 20.sp, textAlign = TextAlign.Center),
                modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 2.dp)
            )
        }
    }
}

private data class NativeColors(
    val background: Color,
    val card: Color,
    val ink: Color,
    val secondary: Color,
    val tertiary: Color,
    val line: Color,
    val blue: Color,
    val blueDeep: Color,
    val blueSoft: Color,
    val green: Color,
    val rings: List<Color>
)

private fun nativeColors(dark: Boolean) = if (dark) NativeColors(
    NativeDarkBg, NativeDarkCard, NativeDarkInk, NativeDarkSecondary, Color(0xFF6E6E73), NativeDarkLine,
    Color(0xFF0A84FF), Color(0xFF409CFF), Color(0x332A8BFF), Color(0xFF32D74B),
    listOf(Color(0xFFFFD60A), Color(0xFFFF9F0A), Color(0xFF30D158), Color(0xFF64D2FF), Color(0xFF0A84FF))
) else NativeColors(
    NativeBg, NativeCard, NativeInk, NativeSecondary, NativeTertiary, NativeLine, NativeBlue, NativeBlueDeep, NativeBlueSoft, NativeGreen,
    listOf(Color(0xFFFFCC00), Color(0xFFFF9500), Color(0xFF34C759), Color(0xFF32ADE6), Color(0xFF007AFF))
)

@Composable
private fun NativeHomeHeader(
    todayKey: String,
    greetingTitle: String,
    greetingTip: String,
    colors: NativeColors,
    onCalendar: () -> Unit
) {
    val label = remember(todayKey) {
        val date = Calendar.getInstance()
        if (todayKey.length == 10) {
            runCatching {
                val parsed = SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(todayKey)
                if (parsed != null) date.time = parsed
            }
        }
        val weekdays = listOf("日", "一", "二", "三", "四", "五", "六")
        "${date.get(Calendar.MONTH) + 1}月${date.get(Calendar.DAY_OF_MONTH)}日 · 周${weekdays[date.get(Calendar.DAY_OF_WEEK) - 1]}"
    }
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 20.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top
    ) {
        Column(modifier = Modifier.weight(1f)) {
            BasicText("$label", style = NativeTypography.style(NativeTypography.Role.HomeCardSubtitle, colors.secondary), modifier = Modifier.padding(bottom = 6.dp))
            BasicText(greetingTitle.ifBlank { "今天，感觉如何？" }, style = NativeTypography.style(NativeTypography.Role.HomeGreeting, colors.ink))
            if (greetingTip.isNotBlank()) {
                BasicText(
                    greetingTip,
                    style = NativeTypography.style(NativeTypography.Role.HomeBody, colors.secondary).copy(fontSize = 14.sp, lineHeight = 21.sp),
                    modifier = Modifier.padding(top = 8.dp)
                )
            }
        }
        NativeIconButton("补记", colors, onCalendar) { CalendarIcon(it) }
    }
}

@Composable
private fun NativeFocus(data: NativeHomeData, colors: NativeColors, onRecord: () -> Unit) {
    Row(modifier = Modifier.fillMaxWidth().padding(bottom = 14.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.SpaceBetween) {
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            BasicText(data.todayCount.toString(), style = NativeTypography.style(NativeTypography.Role.HomeMetricValue, colors.blue))
            BasicText("次", style = NativeTypography.style(NativeTypography.Role.HomeMetricUnit, colors.secondary), modifier = Modifier.padding(bottom = 3.dp))
        }
        NativePillButton("＋  记录", colors, onRecord)
    }
    Column(horizontalAlignment = Alignment.End, modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp)) {
        BasicText(if (data.todayCount > 0) "今天 · 已记录 ${data.todayCount} 次" else "今天 · 尚未记录", style = NativeTypography.style(NativeTypography.Role.HomeBodyStrong, colors.ink))
        BasicText(if (data.todayCount > 0) "记录本身就是觉察" else "一切如常，无需评判", style = NativeTypography.style(NativeTypography.Role.HomeBody, colors.secondary), modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable private fun NativeDivider(colors: NativeColors) {
    Column {
        Spacer(Modifier.fillMaxWidth().height(1.dp).background(colors.line))
        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun NativeStats(data: NativeHomeData, colors: NativeColors) {
    Row(modifier = Modifier.fillMaxWidth().padding(top = 0.dp, bottom = 24.dp), verticalAlignment = Alignment.CenterVertically) {
        NativeStat(data.weekCount.toString(), "本周", colors, modifier = Modifier.weight(1f))
        Spacer(Modifier.width(1.dp).height(64.dp).background(colors.line))
        NativeStat(data.weekDelta?.let { if (it > 0) "+$it%" else "$it%" } ?: "—", "较上周", colors, data.weekDelta?.let { if (it < 0) colors.green else colors.ink }, modifier = Modifier.weight(1f))
        Spacer(Modifier.width(1.dp).height(64.dp).background(colors.line))
        NativeStat(data.streak.toString(), "连续记录", colors, modifier = Modifier.weight(1f))
    }
}

@Composable private fun NativeStat(value: String, label: String, colors: NativeColors, valueColor: Color? = null, modifier: Modifier = Modifier) {
    // WebView `.stat-cell` has no horizontal padding; keeping the weighted cell
    // width intact prevents the weekly percentage from wrapping on narrower viewports.
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = modifier) {
        BasicText(value, style = NativeTypography.style(NativeTypography.Role.HomeMetricValue, valueColor ?: colors.ink).copy(fontSize = 26.sp, lineHeight = 29.sp))
        BasicText(label, style = NativeTypography.style(NativeTypography.Role.HomeMetricLabel, colors.secondary), modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
private fun NativeCard(colors: NativeColors, content: @Composable () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp).shadow(2.dp, RoundedCornerShape(16.dp)).clip(RoundedCornerShape(16.dp)).background(colors.card).padding(20.dp)) { content() }
}

@Composable
private fun NativeTrendCard(data: NativeHomeData, colors: NativeColors) {
    var view by remember { mutableStateOf("curve") }
    var days by remember { mutableIntStateOf(14) }
    NativeCard(colors) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
            Column(modifier = Modifier.weight(1f)) {
                BasicText("次数趋势", style = NativeTypography.style(NativeTypography.Role.HomeCardTitle, colors.ink))
                BasicText("每天次数", style = NativeTypography.style(NativeTypography.Role.HomeCardSubtitle, colors.secondary), modifier = Modifier.padding(top = 4.dp))
            }
            NativeSegmented(listOf("曲线", "热力图"), if (view == "curve") 0 else 1, colors) { view = if (it == 0) "curve" else "heat" }
        }
        Spacer(Modifier.height(16.dp))
        if (view == "curve") NativeAreaChart(if (days == 14) data.rolling14 else data.rolling30, colors)
        else NativeHeatmap(if (days == 14) data.rolling14 else data.rolling30, colors)
        Spacer(Modifier.fillMaxWidth().height(1.dp).background(colors.line).padding(top = 8.dp))
        Row(modifier = Modifier.fillMaxWidth().padding(top = 14.dp).padding(top = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.weight(1f)) {
                BasicText("本月 ${data.monthCount} 次", style = NativeTypography.style(NativeTypography.Role.HomeBody, colors.secondary), maxLines = 1)
                data.monthDelta?.let { delta -> BasicText(if (delta == 0) "持平" else (if (delta > 0) "↑" else "↓") + kotlin.math.abs(delta) + "%", style = NativeTypography.style(NativeTypography.Role.HomeDelta, if (delta < 0) colors.green else colors.ink)) }
            }
            NativeSegmented(listOf("14 天", "30 天"), if (days == 14) 0 else 1, colors, compact = true) { days = if (it == 0) 14 else 30 }
        }
    }
}

@Composable
private fun NativeAreaChart(values: List<Int>, colors: NativeColors) {
    /* WebView renderAreaChart: viewBox 336×128, y origin -16, TOP14, BOT16,
       x inset 4.  Native uses the same coordinate space rather than a second
       chart scale, so line thickness and label baselines remain equivalent. */
    Canvas(modifier = Modifier.fillMaxWidth().height(128.dp)) {
        val safe = if (values.isEmpty()) List(14) { 0 } else values
        val max = (safe.maxOrNull() ?: 0).coerceAtLeast(1)
        val topPad = 16.dp.toPx()
        val top = 14.dp.toPx()
        val bottom = 16.dp.toPx()
        val chartHeight = 112.dp.toPx()
        val left = 4.dp.toPx()
        val right = size.width - 4.dp.toPx()
        val step = (right - left) / (safe.size - 1).coerceAtLeast(1)
        val points = safe.mapIndexed { index, value ->
            val chartY = if (value > 0) top + (1f - value.toFloat() / max) * (chartHeight - top - bottom) else chartHeight - bottom
            Offset(left + index * step, topPad + chartY)
        }
        val line = smoothNativePath(points)
        val area = Path().apply {
            addPath(line)
            lineTo(points.last().x, topPad + chartHeight - bottom)
            lineTo(points.first().x, topPad + chartHeight - bottom)
            close()
        }
        drawPath(area, Brush.verticalGradient(listOf(colors.blue.copy(alpha = 0.14f), colors.blue.copy(alpha = 0.015f))))
        drawPath(line, colors.blue, style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textAlign = Paint.Align.CENTER
            textSize = 9.5f * density
            typeface = android.graphics.Typeface.create(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD)
            color = colors.secondary.toArgb()
        }
        val datePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textAlign = Paint.Align.CENTER
            textSize = 9.5f * density
            color = colors.tertiary.toArgb()
        }
        points.forEachIndexed { index, point ->
            if (safe[index] > 0) {
                /* WebView curve has value labels but no point markers. */
                // WebView places value labels 12 units above the curve point;
                // keep the same baseline so labels do not crowd the stroke.
                drawContext.canvas.nativeCanvas.drawText(safe[index].toString(), point.x, (point.y - 12.dp.toPx()).coerceAtLeast(9.dp.toPx()), paint)
            }
            val labelEvery = if (safe.size >= 30) 6 else 4
            val showDate = index == safe.lastIndex || index % labelEvery == 0
            if (showDate) {
                val cal = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, index - safe.lastIndex) }
                val label = if (index == safe.lastIndex) "今" else "${cal.get(Calendar.MONTH) + 1}/${cal.get(Calendar.DAY_OF_MONTH)}"
                drawContext.canvas.nativeCanvas.drawText(label, point.x, topPad + chartHeight - 2.dp.toPx(), datePaint)
            }
        }
    }
}

private fun smoothNativePath(points: List<Offset>): Path = Path().apply {
    if (points.isEmpty()) return@apply
    moveTo(points.first().x, points.first().y)
    for (i in 0 until points.lastIndex) {
        val p0 = points[(i - 1).coerceAtLeast(0)]
        val p1 = points[i]
        val p2 = points[i + 1]
        val p3 = points[(i + 2).coerceAtMost(points.lastIndex)]
        val c1 = Offset(p1.x + (p2.x - p0.x) / 8f, p1.y + (p2.y - p0.y) / 8f)
        val c2 = Offset(p2.x - (p3.x - p1.x) / 8f, p2.y - (p3.y - p1.y) / 8f)
        cubicTo(c1.x, c1.y, c2.x, c2.y, p2.x, p2.y)
    }
}

@Composable
private fun NativeHeatmap(values: List<Int>, colors: NativeColors) {
    val cells = if (values.isEmpty()) List(14) { 0 } else values
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        cells.chunked(7).forEach { row -> Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) { row.forEach { value -> Box(Modifier.weight(1f).aspectRatio(1f).clip(RoundedCornerShape(8.dp)).background(heatColor(value, colors))) } } }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) { BasicText("少", style = NativeTypography.style(NativeTypography.Role.HomeMetricLabel, colors.secondary).copy(fontSize = 10.sp)); listOf(0, 1, 2, 5).forEach { Box(Modifier.padding(start = 5.dp).size(10.dp).clip(RoundedCornerShape(3.dp)).background(heatColor(it, colors))) }; BasicText("多", style = NativeTypography.style(NativeTypography.Role.HomeMetricLabel, colors.secondary).copy(fontSize = 10.sp), modifier = Modifier.padding(start = 5.dp)) }
    }
}

private fun heatColor(value: Int, colors: NativeColors) = when { value <= 0 -> colors.secondary.copy(alpha = 0.12f); value <= 2 -> colors.blue.copy(alpha = 0.22f); value <= 5 -> colors.blue.copy(alpha = 0.52f); else -> colors.blue.copy(alpha = 0.88f) }

@Composable
private fun NativeTimeCard(data: NativeHomeData, colors: NativeColors) {
    NativeCard(colors) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
            BasicText("时段分布", style = NativeTypography.style(NativeTypography.Role.HomeCardTitle, colors.ink))
            BasicText("哪段时间最常出现", style = NativeTypography.style(NativeTypography.Role.HomeCardSubtitle, colors.secondary))
        }
        Row(modifier = Modifier.fillMaxWidth().padding(top = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(18.dp)) {
            val total = data.timeBuckets.sumOf { it.second }
            val hot = data.timeBuckets.maxByOrNull { it.second }
            Box(modifier = Modifier.size(112.dp), contentAlignment = Alignment.Center) {
                Canvas(Modifier.fillMaxSize()) {
                    /* WebView uses an SVG viewBox of 120, circle r=45,
                       stroke=12 and a 4-unit dash gap. All three values must
                       be scaled by the same viewBox-to-canvas factor. The
                       previous code scaled the radius but left stroke/gap at
                       12dp/4dp, making the native ring about 0.8dp wider and
                       its segment gaps about 7% larger than WebView. */
                    val viewBoxScale = size.minDimension / 120f
                    val ringRadius = 45f * viewBoxScale
                    val ringStrokeWidth = 12f * viewBoxScale
                    val ringGapLength = 4f * viewBoxScale
                    val ringGapAngle = ringGapLength / ringRadius * (180f / Math.PI.toFloat())
                    var start = -90f
                    data.timeBuckets.forEachIndexed { index, bucket ->
                        val sweep = if (total == 0) 0f else bucket.second.toFloat() / total * 360f
                        drawArc(
                            colors.rings[index.coerceIn(0, colors.rings.lastIndex)],
                            start,
                            (sweep - ringGapAngle).coerceAtLeast(0f),
                            false,
                            topLeft = Offset((size.width - ringRadius * 2f) / 2f, (size.height - ringRadius * 2f) / 2f),
                            size = Size(ringRadius * 2f, ringRadius * 2f),
                            style = Stroke(width = ringStrokeWidth, cap = StrokeCap.Butt)
                        )
                        start += sweep
                    }
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) { BasicText(if (total == 0) "—" else "${((hot?.second ?: 0) * 100 / total)}%", style = NativeTypography.style(NativeTypography.Role.HomeMetricValue, colors.ink).copy(fontSize = 24.sp, lineHeight = TextUnit.Unspecified)); BasicText(hot?.first ?: "暂无记录", style = NativeTypography.style(NativeTypography.Role.HomeMetricLabel, colors.secondary).copy(fontSize = 10.sp, lineHeight = TextUnit.Unspecified), modifier = Modifier.padding(top = 4.dp)) }
            }
            Column(modifier = Modifier.weight(1f)) {
                data.timeBuckets.forEachIndexed { index, bucket ->
                    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 7.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(8.dp).clip(RoundedCornerShape(4.dp)).background(if (total == 0) colors.line else colors.rings[index.coerceIn(0, colors.rings.lastIndex)]))
                            BasicText(bucket.first, style = NativeTypography.style(NativeTypography.Role.HomeBody, if (bucket == data.timeBuckets.maxByOrNull { it.second } && total > 0) colors.blueDeep else colors.ink, active = bucket == data.timeBuckets.maxByOrNull { it.second } && total > 0).copy(fontSize = 13.sp, fontWeight = if (bucket == data.timeBuckets.maxByOrNull { it.second } && total > 0) FontWeight.Bold else FontWeight.Medium), modifier = Modifier.padding(start = 8.dp))
                        }
                        BasicText("${bucket.second} 次 · ${if (total == 0) 0 else bucket.second * 100 / total}%", style = NativeTypography.style(NativeTypography.Role.HomeBody, colors.secondary))
                    }
                    if (index < data.timeBuckets.lastIndex) Spacer(Modifier.fillMaxWidth().height(1.dp).background(colors.line))
                }
            }
        }
    }
}

@Composable
private fun NativeRecentCard(data: NativeHomeData, colors: NativeColors, onEdit: (String) -> Unit, onDelete: (String) -> Unit) {
    NativeCard(colors) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) { BasicText("最近记录", style = NativeTypography.style(NativeTypography.Role.HomeCardTitle, colors.ink)); BasicText("最近 7 条", style = NativeTypography.style(NativeTypography.Role.HomeCardSubtitle, colors.secondary)) }
        if (data.recent.isEmpty()) BasicText("还没有记录。点「记录」记下第一次，\n或去「我的 → 恢复演示数据」看看效果。", style = NativeTypography.style(NativeTypography.Role.HomeEmpty, colors.secondary), modifier = Modifier.padding(top = 8.dp))
        else data.recent.take(7).forEachIndexed { index, item -> NativeRecentRow(item, colors, onEdit, onDelete, index == data.recent.take(7).lastIndex) }
    }
}

@Composable
private fun NativeRecentRow(item: NativeRecentItem, colors: NativeColors, onEdit: (String) -> Unit, onDelete: (String) -> Unit, last: Boolean) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 11.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        // Keep the Native home row aligned with WebView ui-home.js: recent
        // records show both month and day, not only the day portion.
        val dateParts = item.dateKey.split('-')
        val dateLabel = if (dateParts.size == 3) {
            "${dateParts[1].toIntOrNull() ?: dateParts[1]}月${dateParts[2].toIntOrNull() ?: dateParts[2]}日"
        } else {
            "${item.dateKey.substringAfterLast('-').trimStart('0')}日"
        }
        Column(modifier = Modifier.weight(1f)) { BasicText("$dateLabel ${item.time}", style = NativeTypography.style(NativeTypography.Role.HomeRecentPrimary, colors.ink)); BasicText(listOfNotNull(item.tags.takeIf { it.isNotBlank() }, item.duration?.let { "$it 分钟" }).joinToString(" · "), style = NativeTypography.style(NativeTypography.Role.HomeRecentMeta, colors.secondary), modifier = Modifier.padding(top = 3.dp), maxLines = 1) }
        NativeSmallIconButton("编辑", colors, { onEdit(item.id) }) { EditIcon(it) }
        NativeSmallIconButton("删除", colors, { onDelete(item.id) }) { DeleteIcon(it) }
    }
    if (!last) Spacer(Modifier.fillMaxWidth().height(1.dp).background(colors.line))
}

@Composable
private fun NativeSegmented(labels: List<String>, selectedIndex: Int, colors: NativeColors, compact: Boolean = false, onSelected: (Int) -> Unit) {
    /* WebView .seg-row.mini: outer padding/gap=3, active segment is a
       full-radius pill with the shared shadow, and both chart groups use
       the same 12px type scale. */
    val outerShape = RoundedCornerShape(999.dp)
    val outer = if (colors.card == NativeDarkCard) Color(0xFF2C2C2E) else Color(0xFFE5E5EA)
    Row(modifier = Modifier.clip(outerShape).background(outer).padding(3.dp), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        labels.forEachIndexed { index, label ->
            val active = index == selectedIndex
            val innerShape = RoundedCornerShape(999.dp)
            Box(
                modifier = Modifier
                    .then(if (active) Modifier.shadow(1.dp, innerShape, clip = false) else Modifier)
                    .clip(innerShape)
                    .background(if (active) colors.card else Color.Transparent)
                    .clickableNoRipple { onSelected(index) }
                    .semantics { role = Role.Tab; this.selected = active }
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                contentAlignment = Alignment.Center
            ) {
                BasicText(label, style = NativeTypography.style(NativeTypography.Role.HomeCardSubtitle, if (active) colors.blueDeep else colors.secondary, active = active).copy(lineHeight = 16.sp, fontWeight = FontWeight.SemiBold))
            }
        }
    }
}

@Composable
private fun NativePillButton(text: String, colors: NativeColors, onClick: () -> Unit) { Box(modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(colors.blue).clickableNoRipple { onClick() }.padding(horizontal = 22.dp, vertical = 13.dp), contentAlignment = Alignment.Center) { BasicText(text, style = NativeTypography.style(NativeTypography.Role.HomePillButton, Color.White)) } }

@Composable
private fun NativeIconButton(label: String, colors: NativeColors, onClick: () -> Unit, icon: @Composable (Color) -> Unit) { Box(modifier = Modifier.size(42.dp).clip(RoundedCornerShape(21.dp)).background(colors.card).clickableNoRipple { onClick() }.semantics { role = Role.Button }, contentAlignment = Alignment.Center) { icon(colors.ink) } }
@Composable
private fun NativeSmallIconButton(label: String, colors: NativeColors, onClick: () -> Unit, icon: @Composable (Color) -> Unit) {
    Box(
        modifier = Modifier
            .size(30.dp)
            .clip(RoundedCornerShape(15.dp))
            .background(if (colors.card == NativeDarkCard) Color(0xFF2C2C2E) else Color(0xFFE5E5EA))
            .clickableNoRipple { onClick() }
            .semantics { role = Role.Button },
        contentAlignment = Alignment.Center
    ) {
        // 固定绘制盒，避免 Canvas 的笔画边界影响视觉中心（尤其是编辑图标的斜笔画）。
        Box(Modifier.size(16.dp), contentAlignment = Alignment.Center) { icon(colors.secondary) }
    }
}

private fun Modifier.clickableNoRipple(onClick: () -> Unit): Modifier = clickable(indication = null, interactionSource = MutableInteractionSource(), onClick = onClick)

private fun calendarDayStart(source: Calendar): Calendar = (source.clone() as Calendar).apply {
    set(Calendar.HOUR_OF_DAY, 12)
    set(Calendar.MINUTE, 0)
    set(Calendar.SECOND, 0)
    set(Calendar.MILLISECOND, 0)
}

/** Exact local-calendar difference; unlike a month*30 approximation this
 * remains correct across 28/29/30/31-day months and year boundaries. */
private fun dayOffset(date: Calendar, today: Calendar): Int {
    val delta = calendarDayStart(date).timeInMillis - calendarDayStart(today).timeInMillis
    return (delta.toDouble() / 86_400_000.0).roundToInt()
}

@Composable
fun NativeCalendarSheet(data: NativeHomeData, darkTheme: Boolean, windowMetrics: NativeWindowMetrics = NativeWindowMetrics(), onClose: () -> Unit, onEdit: (String) -> Unit, onDelete: (String) -> Unit, onAdd: (Int) -> Unit) {
    val colors = nativeColors(darkTheme)
    // #216/#278：复用 WebView playSheetOpen 的日历专用无回弹入场。
    // 初始帧从面板自身高度下方进入，使用 320ms cubic-bezier(0.22,1,0.36,1)，
    // 不改变遮罩时序、不增加缩放或弹簧超调。
    var sheetEntered by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { sheetEntered = true }
    val sheetEnterProgress by animateFloatAsState(
        targetValue = if (sheetEntered) 1f else 0f,
        animationSpec = tween(320, easing = CubicBezierEasing(0.22f, 1f, 0.36f, 1f)),
        label = "calendar-sheet-enter"
    )
    // 复用 WebView initSheetDrag 的交互契约：从顶部拖拽热区向下拖动，达到 90dp 关闭，未达到则回弹。
    var dragOffset by remember { mutableStateOf(0f) }
    var settlingDrag by remember { mutableStateOf(false) }
    val settledOffset by animateFloatAsState(
        targetValue = if (settlingDrag) 0f else dragOffset,
        animationSpec = spring(dampingRatio = 0.88f, stiffness = 520f),
        label = "calendar-sheet-drag-return",
        finishedListener = { if (settlingDrag) { dragOffset = 0f; settlingDrag = false } }
    )
    val renderedSheetOffset = if (settlingDrag) settledOffset else dragOffset
    val dismissThresholdPx = 90f * androidx.compose.ui.platform.LocalDensity.current.density
    val now = remember { Calendar.getInstance() }
    var monthOffset by remember { mutableIntStateOf(0) }
    var selectedOffset by remember { mutableIntStateOf(0) }
    val target = remember(monthOffset) { Calendar.getInstance().apply { add(Calendar.MONTH, monthOffset); set(Calendar.DAY_OF_MONTH, 1) } }
    val days = target.getActualMaximum(Calendar.DAY_OF_MONTH)
    val first = (target.get(Calendar.DAY_OF_WEEK) + 5) % 7
    val selectedDate = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, selectedOffset) }
    val effectiveSelectedOffset = if (selectedDate.get(Calendar.YEAR) == target.get(Calendar.YEAR) && selectedDate.get(Calendar.MONTH) == target.get(Calendar.MONTH)) {
        selectedOffset
    } else {
        dayOffset(target, now)
    }
    val effectiveSelectedDate = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, effectiveSelectedOffset) }
    BoxWithConstraints(Modifier.fillMaxSize()) {
        // P1：Sheet 上限来自 Root 的可用窗口，不再使用经验比例。
        // 内容不足时仍然自然收缩，超出时由内部滚动区承载。
        val sheetMaxHeight = minOf(maxHeight, windowMetrics.sheetMax(maxHeight, floor = 320.dp))
        Box(Modifier.fillMaxSize()) {
            Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.4f)).clickableNoRipple { onClose() })
            Box(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    // Keep the entrance transform outside the shadow/clip/background
                    // modifiers so the entire sheet (including its elevation) follows
                    // the WebView translateY animation as one layer.  Applying this
                    // after padding only moved the content and made the card appear
                    // static, which is why the entrance motion was not perceptible.
                    .graphicsLayer {
                        // 与 WebView translateY(100% → 0%) 等价；不对内容做 scale。
                        translationY = (1f - sheetEnterProgress) * size.height
                    }
                    .offset { IntOffset(0, renderedSheetOffset.roundToInt()) }
                    .heightIn(max = sheetMaxHeight)
                    .shadow(16.dp, RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                    .clip(RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp))
                    .background(colors.card)
                    .padding(start = 22.dp, end = 22.dp, top = 10.dp, bottom = 24.dp),
                contentAlignment = Alignment.TopCenter
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(bottom = windowMetrics.navigationBarDp)
                ) {
                    // 对齐 WebView .sheet-grab + .sheet-handle 的完整垂直占位。
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .padding(top = 10.dp, bottom = 2.dp)
                            .pointerInput(onClose) {
                                detectVerticalDragGestures(
                                    onVerticalDrag = { change, dragAmount ->
                                        // 与 WebView 一样只接受向下位移，向上拖动不会把面板拖出顶部。
                                        val next = (dragOffset + dragAmount).coerceAtLeast(0f)
                                        change.consume()
                                        settlingDrag = false
                                        dragOffset = next
                                    },
                                    onDragEnd = {
                                        if (dragOffset >= dismissThresholdPx) {
                                            onClose()
                                        } else {
                                            settlingDrag = true
                                        }
                                    },
                                    onDragCancel = {
                                        settlingDrag = true
                                    }
                                )
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            Modifier
                                .padding(top = 4.dp, bottom = 10.dp)
                                .size(width = 36.dp, height = 4.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(colors.tertiary)
                        )
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 6.dp, bottom = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        NativeSmallTextButton("‹", colors) { monthOffset -= 1 }
                        Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                            BasicText("${target.get(Calendar.YEAR)}年${target.get(Calendar.MONTH) + 1}月", style = NativeTypography.style(NativeTypography.Role.CalendarTitle, colors.ink))
                        }
                        NativeSmallTextButton("›", colors) { monthOffset += 1 }
                        NativeSmallTextButton("回今天", colors) { monthOffset = 0; selectedOffset = 0 }
                    }
                    Row(Modifier.fillMaxWidth()) {
                        listOf("一", "二", "三", "四", "五", "六", "日").forEach {
                            BasicText(
                                it,
                                style = NativeTypography.explicit(colors.tertiary, 11.sp, textAlign = TextAlign.Center),
                                modifier = Modifier.weight(1f).padding(vertical = 4.dp)
                            )
                        }
                    }
                    Column(modifier = Modifier.padding(top = 6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        val cellDays = List(first) { null } + List(days) { it + 1 }
                        // CSS Grid 会为最后一行保留 7 列；不能让不足 7 个日期的 Row 重新均分宽度。
                        cellDays.chunked(7).forEach { row ->
                            val paddedRow = row + List(7 - row.size) { null }
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                paddedRow.forEach { day ->
                                    NativeCalendarCell(day, target, now, data, colors, Modifier.weight(1f), effectiveSelectedOffset) { selectedOffset = it }
                                }
                            }
                        }
                    }
                    // CSS margin: 14px 0 10px；不能把 padding 加在 1dp Spacer 上。
                    Spacer(Modifier.fillMaxWidth().height(14.dp))
                    Spacer(Modifier.fillMaxWidth().height(1.dp).background(colors.line))
                    Spacer(Modifier.fillMaxWidth().height(10.dp))
                    val selectedKey = "%04d-%02d-%02d".format(effectiveSelectedDate.get(Calendar.YEAR), effectiveSelectedDate.get(Calendar.MONTH) + 1, effectiveSelectedDate.get(Calendar.DAY_OF_MONTH))
                    val dayRecords = data.calendarRecords.filter { it.dateKey == selectedKey }.sortedByDescending { it.time }
                    BasicText(if (dayRecords.isEmpty()) "${effectiveSelectedDate.get(Calendar.MONTH) + 1}月${effectiveSelectedDate.get(Calendar.DAY_OF_MONTH)}日 · 这一天没有记录" else "${effectiveSelectedDate.get(Calendar.MONTH) + 1}月${effectiveSelectedDate.get(Calendar.DAY_OF_MONTH)}日 · ${dayRecords.size} 条记录", style = NativeTypography.style(NativeTypography.Role.HomeBodyStrong, colors.ink).copy(fontWeight = FontWeight.Bold), modifier = Modifier.padding(bottom = 4.dp))
                    if (dayRecords.isEmpty()) {
                        BasicText("还没有记录，可以补记这一天的。", style = NativeTypography.explicit(colors.secondary, 13.sp, lineHeight = 24.sp))
                    } else {
                        // 与 WebView .cal-detail-list 一致：两条以内自然高度，更多记录只在这里滚动。
                        Column(
                            modifier = Modifier.fillMaxWidth().heightIn(max = windowMetrics.innerListMax(128.dp, 64.dp)).verticalScroll(rememberScrollState())
                        ) {
                            dayRecords.forEachIndexed { i, item -> NativeRecentRow(item, colors, onEdit, onDelete, i == dayRecords.lastIndex) }
                        }
                    }
                    Row(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        val primaryShape = RoundedCornerShape(999.dp)
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .shadow(2.dp, primaryShape)
                                .clip(primaryShape)
                                .background(colors.blue)
                                .clickableNoRipple { onAdd(effectiveSelectedOffset) }
                                .padding(horizontal = 26.dp, vertical = 14.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                CalendarPlusIcon(Color.White)
                                BasicText("补记这一天", style = NativeTypography.style(NativeTypography.Role.CalendarAction, Color.White))
                            }
                        }
                        val ghostShape = RoundedCornerShape(999.dp)
                        Box(
                            modifier = Modifier
                                .clip(ghostShape)
                                .background(if (colors.card == NativeDarkCard) Color(0xFF2C2C2E) else Color(0xFFE5E5EA))
                                .border(1.dp, colors.line, ghostShape)
                                .clickableNoRipple { onClose() }
                                .padding(horizontal = 26.dp, vertical = 14.dp),
                            contentAlignment = Alignment.Center
                        ) { BasicText("完成", style = NativeTypography.style(NativeTypography.Role.CalendarAction, colors.ink)) }
                    }
                }
            }
        }
    }
}

@Composable
private fun NativeCalendarCell(day: Int?, month: Calendar, now: Calendar, data: NativeHomeData, colors: NativeColors, cell: Modifier, selectedOffset: Int, onSelected: (Int) -> Unit) {
    val cellModifier = cell.aspectRatio(1f)
    if (day == null) { Spacer(cellModifier); return }
    val date = (month.clone() as Calendar).apply { set(Calendar.DAY_OF_MONTH, day) }
    val offset = dayOffset(date, now)
    val dateKey = "%04d-%02d-%02d".format(month.get(Calendar.YEAR), month.get(Calendar.MONTH) + 1, day)
    val count = data.dayCounts[dateKey] ?: 0
    val selected = offset == selectedOffset
    Box(modifier = cellModifier.clip(RoundedCornerShape(12.dp)).background(if (selected) colors.blueSoft else Color.Transparent).clickableNoRipple { if (offset <= 0) onSelected(offset) }.semantics { role = Role.Button }, contentAlignment = Alignment.Center) {
        BasicText(day.toString(), style = NativeTypography.style(NativeTypography.Role.CalendarDay, when { offset > 0 -> colors.tertiary; selected -> colors.blueDeep; else -> colors.ink }, active = offset == 0 || selected))
        if (count > 0) Box(Modifier.align(Alignment.TopEnd).padding(top = 5.dp, end = 6.dp).widthIn(min = 15.dp).height(15.dp).clip(RoundedCornerShape(99.dp)).background(colors.blue).padding(horizontal = 3.dp), contentAlignment = Alignment.Center) { BasicText(count.toString(), style = NativeTypography.style(NativeTypography.Role.CalendarBadge, Color.White, textAlign = TextAlign.Center)) }
    }
}

@Composable private fun NativeSmallTextButton(text: String, colors: NativeColors, onClick: () -> Unit) {
    val arrow = text == "‹" || text == "›"
    val shape = RoundedCornerShape(999.dp)
    Box(
        modifier = (if (arrow) Modifier.size(34.dp) else Modifier)
            .clip(shape)
            .background(if (text == "回今天") colors.blueSoft else if (colors.card == NativeDarkCard) Color(0xFF2C2C2E) else Color(0xFFE5E5EA))
            .clickableNoRipple(onClick)
            .then(if (arrow) Modifier else Modifier.padding(horizontal = 12.dp, vertical = 7.dp)),
        contentAlignment = Alignment.Center
    ) {
        if (arrow) CalendarChevron(if (text == "‹") -1 else 1, colors.ink) else BasicText(text, style = NativeTypography.style(NativeTypography.Role.CalendarAction, if (text == "回今天") colors.blueDeep else colors.ink).copy(fontSize = 12.sp, lineHeight = 16.sp))
    }
}

@Composable private fun CalendarChevron(direction: Int, color: Color) {
    Canvas(Modifier.size(18.dp)) {
        val x = if (direction < 0) listOf(11f, 6f, 11f) else listOf(7f, 12f, 7f)
        val path = Path().apply { moveTo(x[0].dp.toPx(), 4.dp.toPx()); lineTo(x[1].dp.toPx(), 9.dp.toPx()); lineTo(x[2].dp.toPx(), 14.dp.toPx()) }
        drawPath(path, color, style = Stroke(width = 1.8.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
    }
}

@Composable private fun CalendarPlusIcon(color: Color) {
    Canvas(Modifier.size(16.dp)) {
        drawLine(color, Offset(size.width / 2f, 2.dp.toPx()), Offset(size.width / 2f, size.height - 2.dp.toPx()), strokeWidth = 1.8.dp.toPx(), cap = StrokeCap.Round)
        drawLine(color, Offset(2.dp.toPx(), size.height / 2f), Offset(size.width - 2.dp.toPx(), size.height / 2f), strokeWidth = 1.8.dp.toPx(), cap = StrokeCap.Round)
    }
}

@Composable private fun CalendarIcon(color: Color) { Canvas(Modifier.size(19.dp)) { drawRoundRect(color, topLeft = Offset(2.dp.toPx(), 3.5.dp.toPx()), size = Size(16.dp.toPx(), 14.dp.toPx()), cornerRadius = androidx.compose.ui.geometry.CornerRadius(3.dp.toPx()), style = Stroke(1.5.dp.toPx())); drawLine(color, Offset(2.dp.toPx(), 8.dp.toPx()), Offset(18.dp.toPx(), 8.dp.toPx()), strokeWidth = 1.5.dp.toPx()); drawLine(color, Offset(6.5.dp.toPx(), 1.8.dp.toPx()), Offset(6.5.dp.toPx(), 5.2.dp.toPx()), strokeWidth = 1.5.dp.toPx(), cap = StrokeCap.Round); drawLine(color, Offset(13.5.dp.toPx(), 1.8.dp.toPx()), Offset(13.5.dp.toPx(), 5.2.dp.toPx()), strokeWidth = 1.5.dp.toPx(), cap = StrokeCap.Round) } }
@Composable private fun EditIcon(color: Color) {
    // 14dp 画布内留出对称边距，避免原 13dp 路径越界后看起来偏右、偏下。
    Canvas(Modifier.size(14.dp)) {
        val p = Path().apply {
            moveTo(2.1.dp.toPx(), 11.6.dp.toPx())
            lineTo(2.8.dp.toPx(), 9.1.dp.toPx())
            lineTo(8.9.dp.toPx(), 3.0.dp.toPx())
            quadraticBezierTo(10.2.dp.toPx(), 1.7.dp.toPx(), 11.6.dp.toPx(), 3.0.dp.toPx())
            quadraticBezierTo(12.9.dp.toPx(), 4.3.dp.toPx(), 11.6.dp.toPx(), 5.6.dp.toPx())
            lineTo(5.6.dp.toPx(), 11.6.dp.toPx())
            close()
        }
        drawPath(p, color, style = Stroke(1.5.dp.toPx(), join = StrokeJoin.Round))
    }
}

@Composable private fun DeleteIcon(color: Color) {
    Canvas(Modifier.size(14.dp)) {
        drawLine(color, Offset(2.2.dp.toPx(), 2.2.dp.toPx()), Offset(11.8.dp.toPx(), 11.8.dp.toPx()), strokeWidth = 1.6.dp.toPx(), cap = StrokeCap.Round)
        drawLine(color, Offset(11.8.dp.toPx(), 2.2.dp.toPx()), Offset(2.2.dp.toPx(), 11.8.dp.toPx()), strokeWidth = 1.6.dp.toPx(), cap = StrokeCap.Round)
    }
}
