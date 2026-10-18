package com.guanji.app

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.SubcomposeLayout
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import java.util.Locale
import kotlin.math.roundToInt

/** #276：记录、补记、编辑和计时汇总的单一原生 Surface。
 *
 * 这个 Surface 只管理 v4.1.5 的交互状态；数据归一化、未来日期校验、
 * 记录写入和统计刷新仍通过 NativeRecordBridge 回到既有 JS/Room 权威链。
 * 玻璃模式不会进入此 Surface。
 */
data class NativeRecordContext(
    val kind: String = "now",
    val preferredMode: String = "timer",
    val recordId: String? = null,
    val dateKey: String = "",
    val time: String = "",
    val duration: Int = 0,
    val observations: List<String> = emptyList(),
    val note: String = "",
    val timerStartMs: Long? = null,
    val customOptions: List<String> = emptyList()
) {
    companion object {
        fun parse(raw: String?): NativeRecordContext {
            if (raw.isNullOrBlank()) return NativeRecordContext()
            return runCatching {
                val json = JSONObject(raw)
                val values = mutableListOf<String>()
                val array = json.optJSONArray("observations") ?: JSONArray()
                for (index in 0 until array.length()) values += array.optString(index)
                val customValues = mutableListOf<String>()
                val customArray = json.optJSONArray("customOptions") ?: JSONArray()
                for (index in 0 until customArray.length()) {
                    val label = customArray.optString(index).trim()
                    if (label.isNotEmpty()) customValues += label
                }
                NativeRecordContext(
                    kind = json.optString("kind", "now"),
                    preferredMode = json.optString("preferredMode", "timer"),
                    recordId = json.optString("recordId").takeIf { it.isNotBlank() },
                    dateKey = json.optString("dateKey"),
                    time = json.optString("time"),
                    duration = json.optInt("duration", 0).coerceAtLeast(0),
                    observations = values,
                    note = json.optString("note"),
                    timerStartMs = if (json.has("timerStartMs") && !json.isNull("timerStartMs")) json.optLong("timerStartMs") else null,
                    customOptions = customValues.distinct()
                )
            }.getOrDefault(NativeRecordContext())
        }
    }
}

private data class NativeRecordColors(
    val background: Color,
    val card: Color,
    val ink: Color,
    val secondary: Color,
    val line: Color,
    val blue: Color,
    val blueSoft: Color,
    val field: Color,
    val danger: Color
)

private fun nativeRecordColors(dark: Boolean) = if (dark) NativeRecordColors(
    Color(0xFF121212), Color(0xFF1E1E1E), Color.White, Color(0xFFB0B0B4), Color(0xFF3A3A3C),
    Color(0xFF0A84FF), Color(0x332A8BFF), Color(0xFF2C2C2E), Color(0xFFFF453A)
) else NativeRecordColors(
    Color(0xFFF2F2F7), Color.White, Color.Black, Color(0xFF6E6E73), Color(0xFFE5E5EA),
    Color(0xFF007AFF), Color(0xFFE8F1FF), Color(0xFFF2F2F7), Color(0xFFFF3B30)
)

/**
 * #280：只保存视觉 token，不承担窗口/IME 计算。
 * 屏幕底部安全区仍由 NativeWindowMetrics 和外层 Sheet 唯一负责；
 * 这里的 20dp 是详情卡片内部唯一的 WebView 视觉留白，不作为高度猜测。
 * 详情布局自身保留这段空间，避免达到 Sheet 最大高度时被父级 padding 裁掉。
 */
private object NativeRecordLayoutTokens {
    // WebView .sheet 的内容水平内边距；详情页的时长、状况、备注与 footer
    // 共享同一条内容对齐线，不能让 FlowRow 单独贴到卡片边缘。
    val detailsContentHorizontalPadding = 22.dp
    // Keep the card bottom rhythm equal to the WebView detail flow:
    // note/input area to action row uses a 20dp cadence, so the footer-to-card
    // bottom visual gap uses the same token. The outer navigation/floating gap
    // remains owned by the sheet host and is not included here.
    val detailsFooterVisualGap = 20.dp
}

private val NativeRecordOptions = listOf(
    "boredom" to "无聊", "stress" to "压力", "anxiety" to "焦虑", "solitude" to "一个人", "bedtime_habit" to "睡前时段",
    "adult_content_effect" to "成人内容影响", "loneliness" to "缺少陪伴", "insomnia" to "睡不着", "none" to "没有明显情绪/诱因",
    "unsure" to "原因不确定", "low_mood" to "低落", "irritability" to "烦躁", "fatigue" to "疲惫", "automatic_habit" to "顺手就做了", "relief_motive" to "想放松一下"
)

private enum class NativeRecordPhase { TIME, DETAILS, TIMER_RUNNING, TIMER_SUMMARY }

@Composable
fun NativeRecordSurface(
    contextJson: String?,
    darkTheme: Boolean,
    onAction: (String, String?) -> Unit,
    closing: Boolean = false,
    windowMetrics: NativeWindowMetrics = NativeWindowMetrics()
) {
    val context = remember(contextJson) { NativeRecordContext.parse(contextJson) }
    val colors = nativeRecordColors(darkTheme)
    val isEdit = context.kind == "edit"
    val isBackfillContext = context.kind == "backfill" || isEdit
    var phase by remember(contextJson) {
        mutableStateOf(
            when {
                context.timerStartMs != null -> NativeRecordPhase.TIMER_RUNNING
                context.kind == "edit" -> NativeRecordPhase.DETAILS
                else -> NativeRecordPhase.TIME
            }
        )
    }
    var timeMode by remember(contextJson) { mutableStateOf(if (isBackfillContext) "backfill" else "now") }
    var dateKey by remember(contextJson) { mutableStateOf(context.dateKey.ifBlank { todayKey() }) }
    var time by remember(contextJson) { mutableStateOf(context.time.ifBlank { nowTime() }) }
    var duration by remember(contextJson) { mutableIntStateOf(context.duration) }
    var selected by remember(contextJson) { mutableStateOf(context.observations.toSet()) }
    var note by remember(contextJson) { mutableStateOf(context.note) }
    var timerStartMs by remember(contextJson) { mutableStateOf(context.timerStartMs) }
    var elapsedMs by remember(contextJson) { mutableStateOf(0L) }
    var customOptions by remember(contextJson) {
        mutableStateOf((context.customOptions + context.observations.filter { it.startsWith("custom:") }.map { it.removePrefix("custom:") }).filter { it.isNotBlank() }.toSet())
    }
    var showAddObservation by remember { mutableStateOf(false) }
    var addObservationText by remember { mutableStateOf("") }
    var pendingDeleteLabel by remember { mutableStateOf<String?>(null) }
    val addFocusRequester = remember { FocusRequester() }
    val keyboardController = LocalSoftwareKeyboardController.current
    var sheetAppeared by remember(contextJson) { mutableStateOf(false) }
    var dragOffsetPx by remember(contextJson) { mutableFloatStateOf(0f) }
    val density = LocalDensity.current
    val navigationBottomDp = windowMetrics.navigationBarDp
    val motionProgress by animateFloatAsState(
        targetValue = when {
            phase != NativeRecordPhase.TIME && phase != NativeRecordPhase.DETAILS -> 1f
            closing -> 0f
            sheetAppeared -> 1f
            else -> 0f
        },
        animationSpec = if (closing) {
            tween(300, easing = CubicBezierEasing(.33f, 1f, .68f, 1f))
        } else {
            tween(550, easing = CubicBezierEasing(.34f, 1.56f, .64f, 1f))
        },
        label = "record-sheet-motion"
    )
    val animatedDragOffset by animateFloatAsState(
        targetValue = dragOffsetPx,
        animationSpec = spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = Spring.StiffnessMediumLow),
        label = "record-sheet-drag"
    )

    LaunchedEffect(contextJson) { sheetAppeared = true }
    LaunchedEffect(closing) {
        if (closing) {
            delay(320)
            onAction("record-exit-complete", null)
        }
    }
    // WebView 的添加状况弹层打开后会自动聚焦输入框并拉起键盘；原生路径
    // 也在首帧完成后执行同一动作，避免用户还要额外点击一次输入框。
    LaunchedEffect(showAddObservation) {
        if (showAddObservation) {
            delay(80)
            addFocusRequester.requestFocus()
            keyboardController?.show()
        } else {
            keyboardController?.hide()
        }
    }

    // 记录流程内部优先处理返回：详情页返回时间页，时间页才关闭整个 Sheet。
    // 这与 WebView 的 prev/close 层级一致，也保证“直接填写”返回后仍恢复 00:00。
    BackHandler(enabled = !closing) {
        when (phase) {
            NativeRecordPhase.DETAILS -> {
                timeMode = "now"
                phase = NativeRecordPhase.TIME
            }
            NativeRecordPhase.TIME -> onAction("record-close", null)
            NativeRecordPhase.TIMER_RUNNING -> {
                onAction("timer-cancel", null)
                onAction("record-close", null)
            }
            NativeRecordPhase.TIMER_SUMMARY -> phase = NativeRecordPhase.TIME
        }
    }

    LaunchedEffect(phase, timerStartMs) {
        if (phase == NativeRecordPhase.TIMER_RUNNING && timerStartMs != null) {
            while (phase == NativeRecordPhase.TIMER_RUNNING) {
                elapsedMs = (System.currentTimeMillis() - (timerStartMs ?: System.currentTimeMillis())).coerceAtLeast(0L)
                delay(500)
            }
        }
    }

    fun toggleObservation(key: String) {
        val next = selected.toMutableSet()
        if (next.contains(key)) next.remove(key) else next.add(key)
        // 与 storage.js 的 normalizeObservationValues 保持同一互斥规则。
        if (key == "none") next.removeAll(NativeRecordOptions.map { it.first }.filter { it != "none" && it != "unsure" && it in next })
        else if (key in NativeRecordOptions.filter { it.first !in listOf("none", "unsure") }.map { it.first }) next.remove("none")
        selected = next
    }

    // Sheet 状态保持透明，让 NativeHomeSurface 作为当前页面背景；
    // 只有计时运行/汇总状态由其各自的蓝色全屏 Surface 接管背景。
    Box(Modifier.fillMaxSize()) {
        if (phase == NativeRecordPhase.TIME || phase == NativeRecordPhase.DETAILS) {
            // 记录/补记/编辑沿用 WebView 的悬浮底部 Sheet：四周留 12dp、
            // 22dp 圆角、半透明遮罩；只有计时运行/汇总才是全屏沉浸层。
            Box(
                Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = .40f * motionProgress))
                    .pointerInput(closing) {
                        if (!closing) detectTapGestures { onAction("record-close", null) }
                    }
            )
            // NativeRoot 统一提供窗口与 IME 度量。记录详情沿用 #279 的
            // “单一 IME 处理者”规则：卡片整体消费一次 ime - navigationBars
            // 位移，内部不再叠加 imePadding 或第二个负 offset。
            BoxWithConstraints(Modifier.fillMaxSize()) {
                // WebView 的 details-active 使用“可视视口减去底部安全区”的弹性高度，
                // 而不是和普通时间页共用 86% 的固定比例。主力机约 347dp 的窄宽度
                // 会把 86% 上限压缩约 40~60dp，导致备注栏和固定 footer 被裁切。
                // 这里仅让详情态消费一次 bottom safe area；普通时间页继续保持原 86% 基线。
                val sheetMaxHeight = minOf(
                    maxHeight,
                    windowMetrics.sheetMax(
                        maxHeight,
                        floor = 220.dp,
                        // WebView .sheet.details-active: 12dp top + 12dp bottom
                        // floating gap, in addition to the system safe areas
                        // already removed by NativeWindowMetrics.
                        floatingVerticalGap = if (phase == NativeRecordPhase.DETAILS) 24.dp else 0.dp,
                    ),
                )
                Layout(
                    modifier = Modifier
                        .fillMaxSize()
                        .semantics {
                            if (phase == NativeRecordPhase.DETAILS) {
                                contentDescription = "record-details-sheet-host"
                            }
                        },
                    content = {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            // Do not inherit the outer full-height minimum. The
                            // outer host owns the safe/floating reserve; this
                            // card must measure to its content/max height and be
                            // placed above that reserve.
                            .wrapContentHeight(unbounded = true)
                            .heightIn(max = sheetMaxHeight)
                            .graphicsLayer {
                                translationY = size.height * (1f - motionProgress) + animatedDragOffset
                                // WebView 的 close 动画同时淡出面板与遮罩；保留同一
                                // progress，避免原生关闭时只移动而不淡出的突兀感。
                                alpha = motionProgress.coerceIn(0f, 1f)
                            }
                            .shadow(18.dp, RoundedCornerShape(22.dp))
                            .clip(RoundedCornerShape(22.dp))
                            .background(colors.card)
                            .semantics {
                                contentDescription = if (phase == NativeRecordPhase.DETAILS) {
                                    "record-details-sheet"
                                } else {
                                    "record-sheet"
                                }
                            }
                    ) {
                        // WebView 的 10/22/24 padding 属于卡片本体；抓手也占据真实
                        // 的 30dp 行高。这样标题、内容与 footer 的测量顺序和原版一致。
                        Column(
                            Modifier
                                .fillMaxWidth()
                                // Let the sheet provide one finite viewport to the
                                // active step. Details subtracts its fixed 20dp
                                // sibling gap before measuring the body; no
                                // device-specific height guess is used.
                                .heightIn(max = sheetMaxHeight)
                                // The details gap is a sibling below the body;
                                // keeping parent padding at zero prevents a
                                // second owner or double safe-area reservation.
                                .padding(top = 10.dp, bottom = if (phase == NativeRecordPhase.DETAILS) 0.dp else 24.dp)
                        ) {
                    // 只在抓手热区接管下拉手势；内容滚动区必须保留自己的 verticalScroll。
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(30.dp)
                            .pointerInput(closing) {
                                if (!closing) {
                                    detectDragGestures(
                                        onDrag = { change, dragAmount ->
                                            change.consume()
                                            dragOffsetPx = (dragOffsetPx + dragAmount.y).coerceAtLeast(0f)
                                        },
                                        onDragEnd = {
                                            if (dragOffsetPx >= with(density) { 90.dp.toPx() }) {
                                                onAction("record-close", null)
                                            } else {
                                                dragOffsetPx = 0f
                                            }
                                        },
                                        onDragCancel = { dragOffsetPx = 0f }
                                    )
                                }
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            Modifier
                                .width(36.dp)
                                .height(4.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(colors.line.copy(alpha = .82f))
                        )
                    }
                    // This BoxWithConstraints is the single source of truth
                    // for the step viewport. It passes the actual remaining
                    // height to the details form after the handle row has
                    // been measured, rather than subtracting a magic value.
                    BoxWithConstraints(
                        Modifier
                            .fillMaxWidth()
                            .weight(1f, fill = false)
                    ) {
                        // The card-level bottom gap is a fixed sibling of the
                        // details body. Keeping it outside SubcomposeLayout
                        // prevents the max-height path on short/large-density
                        // devices from compressing the visual gap together
                        // with the scrollable options viewport.
                        val detailsBodyMaxHeight = (sheetMaxHeight - NativeRecordLayoutTokens.detailsFooterVisualGap)
                            .coerceAtLeast(0.dp)
                        when (phase) {
                            NativeRecordPhase.TIME -> NativeRecordTimeStep(
                                colors = colors,
                                isEdit = isEdit,
                                // 选择器切换后立即改变表单，不依赖打开时的 context.kind。
                                isBackfill = isEdit || timeMode == "backfill",
                                timeMode = timeMode,
                                dateKey = dateKey,
                                time = time,
                                preferredMode = context.preferredMode,
                                onMode = { timeMode = it },
                                onDate = { picked -> dateKey = picked },
                                onTime = { picked -> time = picked },
                                onDirectFill = { timeMode = "now"; phase = NativeRecordPhase.DETAILS },
                                onNext = {
                                    if (!isEdit && timeMode == "now" && context.preferredMode == "timer") {
                                        timerStartMs = System.currentTimeMillis()
                                        phase = NativeRecordPhase.TIMER_RUNNING
                                        onAction("timer-start", timerStartMs.toString())
                                    } else phase = NativeRecordPhase.DETAILS
                                },
                                onClose = { onAction("record-close", null) }
                            )
                            NativeRecordPhase.DETAILS -> NativeRecordDetailsStep(
                                colors = colors,
                                // Pass the already closed sheet viewport to
                                // SubcomposeLayout. Passing the full root
                                // height here lets the child reserve space the
                // outer Sheet has already removed.
                                maxHeight = detailsBodyMaxHeight,
                                duration = duration,
                                selected = selected,
                                note = note,
                                onDuration = { duration = it },
                                onToggle = ::toggleObservation,
                                customOptions = customOptions,
                                onAddObservation = { showAddObservation = true },
                                onDeleteCustom = { pendingDeleteLabel = it },
                                onNote = { note = it },
                                onBack = { phase = NativeRecordPhase.TIME },
                                onSave = { onAction("record-save", buildRecordPayload(context, timeMode, dateKey, time, duration, selected, note)) },
                                onClose = { onAction("record-close", null) }
                            )
                            else -> Unit
                        }
                    }
                    if (phase == NativeRecordPhase.DETAILS) {
                        // Single owner of the card-internal visual gap. It is
                        // outside the bounded details body, so parent height
                        // clamping can only reduce the options viewport, never
                        // the 20dp gap below the fixed Footer.
                        Spacer(Modifier.height(NativeRecordLayoutTokens.detailsFooterVisualGap))
                    }
                        }
                    }
                }
            ) { measurables, constraints ->
                // The card is positioned by one explicit measure policy. This
                // prevents a full-height minimum inherited from the host from
                // consuming the floating bottom reserve on OEMs whose app
                // window already excludes the navigation bar.
                val horizontalInset = 12.dp.roundToPx()
                val imeShiftDp = if (phase == NativeRecordPhase.DETAILS && windowMetrics.imeVisible) {
                    (windowMetrics.imeDp - navigationBottomDp).coerceAtLeast(0.dp)
                } else 0.dp
                val bottomReserve = (12.dp + navigationBottomDp).roundToPx()
                val maxCardHeight = sheetMaxHeight.roundToPx()
                val maxChildHeight = (constraints.maxHeight - bottomReserve)
                    .coerceAtLeast(0)
                    .coerceAtMost(maxCardHeight)
                val childConstraints = constraints.copy(
                    minWidth = 0,
                    maxWidth = (constraints.maxWidth - horizontalInset * 2).coerceAtLeast(0),
                    minHeight = 0,
                    maxHeight = maxChildHeight,
                )
                val card = measurables.single().measure(childConstraints)
                layout(constraints.maxWidth, constraints.maxHeight) {
                    val baseY = (constraints.maxHeight - bottomReserve - card.height).coerceAtLeast(0)
                    val y = (baseY - imeShiftDp.roundToPx()).coerceAtLeast(0)
                    card.placeRelative(horizontalInset, y)
                }
            }
            }
        } else when (phase) {
            NativeRecordPhase.TIMER_RUNNING -> NativeTimerRunningStep(
                colors = colors,
                elapsedMs = elapsedMs,
                startedAt = timerStartMs ?: 0L,
                windowMetrics = windowMetrics,
                onFinish = {
                    val start = timerStartMs ?: System.currentTimeMillis()
                    val mins = ((System.currentTimeMillis() - start) / 60000L).toInt().coerceAtLeast(1)
                    duration = mins
                    phase = NativeRecordPhase.TIMER_SUMMARY
                    onAction("timer-finish", JSONObject().put("startMs", start).put("duration", mins).toString())
                },
                onCancel = { onAction("timer-cancel", null); onAction("record-close", null) }
            )
            NativeRecordPhase.TIMER_SUMMARY -> NativeTimerSummaryStep(
                colors = colors,
                duration = duration,
                startedAt = timerStartMs ?: 0L,
                    windowMetrics = windowMetrics,
                selected = selected,
                customOptions = customOptions,
                onToggle = ::toggleObservation,
                onAddObservation = { showAddObservation = true },
                onDeleteCustom = { pendingDeleteLabel = it },
                onSave = { onAction("record-save", buildRecordPayload(context, "now", todayKey(), nowTime(), duration, selected, "")) },
                onResume = {
                    phase = NativeRecordPhase.TIMER_RUNNING
                    onAction("timer-resume", timerStartMs?.toString())
                },
                onAbandon = { onAction("timer-cancel", null); onAction("record-close", null) }
            )
            else -> Unit
        }
        if (showAddObservation) {
            // 直接在记录 Surface 内绘制二级遮罩，不使用 Compose Dialog 的系统窗口。
            // 这样不会引入额外的白色矩形、系统 dim 或独立窗口圆角，和 WebView
            // 的 .dialog-layer 保持同一层级；记录 Sheet 与首页仍留在底层。
            Box(
                Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = .40f))
                    .clickableNoRipple { showAddObservation = false },
                contentAlignment = Alignment.Center
            ) {
                NativeAddObservationDialog(
                    colors = colors,
                    value = addObservationText,
                    focusRequester = addFocusRequester,
                    onValue = { addObservationText = it },
                    onCancel = { showAddObservation = false },
                    onConfirm = {
                        val text = addObservationText.trim()
                        if (text.isNotEmpty() && text.length <= 6) {
                            customOptions = customOptions + text
                            selected = selected - "none" - "unsure" + "custom:$text"
                            addObservationText = ""
                            showAddObservation = false
                        }
                    }
                )
            }
        }
        if (pendingDeleteLabel != null) {
            val label = pendingDeleteLabel.orEmpty()
            Box(
                Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = .40f))
                    .clickableNoRipple { pendingDeleteLabel = null },
                contentAlignment = Alignment.Center
            ) {
                NativeDeleteObservationDialog(
                    colors = colors,
                    label = label,
                    onCancel = { pendingDeleteLabel = null },
                    onConfirm = {
                        customOptions = customOptions - label
                        selected = selected - "custom:$label"
                        pendingDeleteLabel = null
                        onAction("custom-observation-delete", label)
                    }
                )
            }
        }
    }
}

@Composable
private fun NativeRecordTimeStep(
    colors: NativeRecordColors,
    isEdit: Boolean,
    isBackfill: Boolean,
    timeMode: String,
    dateKey: String,
    time: String,
    preferredMode: String,
    onMode: (String) -> Unit,
    onDate: (String) -> Unit,
    onTime: (String) -> Unit,
    onDirectFill: () -> Unit,
    onNext: () -> Unit,
    onClose: () -> Unit
) {
    val context = LocalContext.current
    Column(Modifier.fillMaxWidth().wrapContentHeight()) {
        RecordHeader("记录", colors)
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 22.dp)) {
            BasicText("时间", style = NativeTypography.style(NativeTypography.Role.RecordFieldLabel, colors.ink), modifier = Modifier.padding(top = 3.dp, bottom = 9.dp))
            if (!isEdit) {
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(999.dp)).background(colors.field).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    RecordSegment("就现在", timeMode == "now", colors, Modifier.weight(1f)) { onMode("now") }
                    RecordSegment("补记", timeMode == "backfill", colors, Modifier.weight(1f)) { onMode("backfill") }
                }
            }
            if (!isBackfill && preferredMode == "timer" && timeMode == "now") {
                Column(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    BasicText("00:00", style = NativeTypography.style(NativeTypography.Role.RecordDuration, colors.ink))
                    BasicText("切到后台也没关系，通知栏会继续计时", style = NativeTypography.style(NativeTypography.Role.RecordTimerHint, colors.secondary), modifier = Modifier.padding(top = 5.dp))
                    Box(Modifier.fillMaxWidth().height(24.18.dp).clickableNoRipple(onDirectFill), contentAlignment = Alignment.Center) {
                        BasicText("不想计时？直接填写", style = NativeTypography.style(NativeTypography.Role.RecordDirectLink, colors.blue))
                    }
                }
            } else {
                BasicText(
                    if (isBackfill) formatRecordDateTime(dateKey, time) else "${todayLabel()}  现在",
                    style = NativeTypography.style(NativeTypography.Role.RecordDateDisplay, colors.ink),
                    modifier = Modifier.padding(vertical = 20.dp)
                )
            }
            if (isBackfill) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    RecordActionButton(formatRecordDateLabel(dateKey), colors, Modifier.weight(1f)) {
                        val cal = Calendar.getInstance().apply { parseDateKey(dateKey)?.let { timeInMillis = it } }
                        DatePickerDialog(context, { _, y, m, d -> onDate("%04d-%02d-%02d".format(Locale.US, y, m + 1, d)) }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH)).show()
                    }
                    RecordActionButton(time, colors, Modifier.weight(1f)) {
                        val cal = Calendar.getInstance()
                        TimePickerDialog(context, { _, h, min -> onTime("%02d:%02d".format(Locale.US, h, min)) }, cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE), true).show()
                    }
                }
            }
        }
        RecordFooter(
            colors = colors,
            primary = if (!isBackfill && timeMode == "now" && preferredMode == "timer") "开始记录" else "下一步",
            onPrimary = onNext,
            onSecondary = onClose,
            showSecondary = false,
            details = false
        )
    }
}

@Composable
@OptIn(ExperimentalFoundationApi::class)
private fun NativeRecordDetailsStep(
    colors: NativeRecordColors,
    maxHeight: androidx.compose.ui.unit.Dp,
    duration: Int,
    selected: Set<String>,
    note: String,
    onDuration: (Int) -> Unit,
    onToggle: (String) -> Unit,
    customOptions: Set<String>,
    onAddObservation: () -> Unit,
    onDeleteCustom: (String) -> Unit,
    onNote: (String) -> Unit,
    onBack: () -> Unit,
    onSave: () -> Unit,
    onClose: () -> Unit
) {
    val noteBringIntoView = remember { BringIntoViewRequester() }
    var noteFocused by remember { mutableStateOf(false) }
    val density = LocalDensity.current
    val imeInsets = WindowInsets.ime
    LaunchedEffect(noteFocused) {
        if (!noteFocused) return@LaunchedEffect
        // Reuse the shared #279 input contract: wait for the IME inset to
        // settle, then request visibility twice so OEM keyboard animations do
        // not leave the note field underneath the keyboard. The outer Sheet
        // owns the single whole-card IME shift; this is only the focus target.
        snapshotFlow { imeInsets.getBottom(density) }
            .distinctUntilChanged()
            .filter { it > 0 }
            .collectLatest {
                delay(90)
                noteBringIntoView.bringIntoView()
                delay(120)
                noteBringIntoView.bringIntoView()
            }
    }
    SubcomposeLayout(
        Modifier
            .fillMaxWidth()
            .heightIn(max = maxHeight)
            .semantics { contentDescription = "record-details-content" }
    ) { constraints ->
        // The parent Sheet owns the fixed bottom visual gap. This body only
        // measures the header/options/note/footer content; keeping the gap out
        // of this measure policy prevents max-height clamping from stealing a
        // few dp on devices such as OnePlus PLZ110.
        val contentMaxHeight = if (constraints.hasBoundedHeight) constraints.maxHeight else Constraints.Infinity
        val fixedConstraints = Constraints(
            minWidth = constraints.maxWidth,
            maxWidth = constraints.maxWidth,
            minHeight = 0,
            maxHeight = Constraints.Infinity
        )
        fun measure(slot: String, content: @Composable () -> Unit) =
            subcompose(slot, content).first().measure(fixedConstraints)

        val header = measure("record-details-header") { RecordHeader("记录", colors) }
        val top = measure("record-details-top") {
            Column(Modifier.fillMaxWidth().padding(start = 22.dp, end = 22.dp, top = 8.dp)) {
                BasicText("时长", style = NativeTypography.style(NativeTypography.Role.RecordFieldLabel, colors.ink), modifier = Modifier.padding(top = 3.dp, bottom = 9.dp))
                NativeDurationSlider(duration, colors, onDuration)
                BasicText("发生前状况", style = NativeTypography.style(NativeTypography.Role.RecordFieldLabel, colors.ink), modifier = Modifier.padding(top = 12.dp, bottom = 9.dp))
            }
        }
        val noteSlot = measure("record-details-note") {
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(start = 22.dp, end = 22.dp, top = 12.dp, bottom = 8.dp)
                    .semantics { contentDescription = "record-details-note" }
            ) {
                BasicText("备注（可选）", style = NativeTypography.style(NativeTypography.Role.RecordFieldLabel, colors.ink), modifier = Modifier.padding(bottom = 9.dp))
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(76.dp)
                        .bringIntoViewRequester(noteBringIntoView)
                ) {
                    BasicTextField(
                        value = note,
                        onValueChange = onNote,
                        textStyle = NativeTypography.style(NativeTypography.Role.RecordBody, colors.ink),
                        modifier = Modifier
                            .fillMaxSize()
                            .onFocusChanged { noteFocused = it.isFocused }
                            .clip(RoundedCornerShape(10.dp))
                            .background(colors.field)
                            .padding(12.dp),
                        decorationBox = { inner -> if (note.isBlank()) BasicText("想记点什么，就写点什么", style = NativeTypography.style(NativeTypography.Role.RecordPlaceholder, colors.secondary)); inner() }
                    )
                }
            }
        }
        val footer = measure("record-details-footer") {
            Box(
                Modifier
                    .fillMaxWidth()
                    .semantics { contentDescription = "record-details-footer" }
            ) {
                RecordFooter(colors, "存为记录", onSave, onBack, secondary = "上一步", showSecondary = true, details = true)
            }
        }
        val fixedHeight = header.height + top.height + noteSlot.height + footer.height
        val optionsMaxHeight = if (constraints.hasBoundedHeight) {
            (contentMaxHeight - fixedHeight).coerceAtLeast(0)
        } else {
            Constraints.Infinity
        }
        val options = subcompose("record-details-options") {
            Box(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = NativeRecordLayoutTokens.detailsContentHorizontalPadding)
                    .heightIn(min = 0.dp)
                    .verticalScroll(rememberScrollState())
                    .semantics { contentDescription = "record-details-options" }
            ) {
                NativeObservationGrid(selected, colors, customOptions, onToggle, onAddObservation, onDeleteCustom)
            }
        }.first().measure(
            fixedConstraints.copy(
                minHeight = 0,
                maxHeight = optionsMaxHeight
            )
        )
        val totalHeight = fixedHeight + options.height
        val contentHeight = if (constraints.hasBoundedHeight) {
            totalHeight.coerceAtMost(contentMaxHeight)
        } else {
            totalHeight
        }
        layout(constraints.maxWidth, contentHeight) {
            var y = 0
            header.placeRelative(0, y)
            y += header.height
            top.placeRelative(0, y)
            y += top.height
            options.placeRelative(0, y)
            y += options.height
            noteSlot.placeRelative(0, y)
            y += noteSlot.height
            footer.placeRelative(0, y)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun NativeObservationGrid(
    selected: Set<String>,
    colors: NativeRecordColors,
    customOptions: Set<String> = emptySet(),
    onToggle: (String) -> Unit,
    onAddObservation: () -> Unit,
    onDeleteCustom: (String) -> Unit = {}
) {
    // WebView 使用 flex-wrap + 内容宽度，而不是固定三列；FlowRow 保留同样的
    // 文字宽度和换行行为，避免长标签被压成与短标签相同的宽度。
    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        NativeRecordOptions.forEach { (key, label) ->
            RecordChip(label, key in selected, colors, Modifier.wrapContentWidth()) { onToggle(key) }
        }
        customOptions.forEach { label ->
            val key = "custom:$label"
            RecordChip(label, key in selected, colors, Modifier.wrapContentWidth(), onDelete = { onDeleteCustom(label) }) { onToggle(key) }
        }
        RecordChip("+ 添加", false, colors, Modifier.wrapContentWidth(), onClick = onAddObservation)
    }
}

@Composable
private fun NativeTimerRunningStep(colors: NativeRecordColors, elapsedMs: Long, startedAt: Long, windowMetrics: NativeWindowMetrics, onFinish: () -> Unit, onCancel: () -> Unit) {
    val gradient = Brush.verticalGradient(listOf(Color(0xFF0A84FF), Color(0xFF0040A8)))
    // WebView 的 timer-screen-inner 是一个“顶部内容 + flex spacer + 底部动作”
    // 结构，而不是把状态块和计时数字整体垂直居中。原生版之前使用
    // Arrangement.Center，导致状态块下沉到屏幕中部、底部按钮反而上移。
    // 这里直接复用 WebView 的 56px + safe-top / 32px + safe-bottom 设计值；
    // Compose 根宿主已绘制到系统栏下方，导航栏由底部 padding 一次性消费。
    Column(
        Modifier
            .fillMaxSize()
            .background(gradient)
            .padding(start = 24.dp, end = 24.dp, top = 56.dp + windowMetrics.statusBarDp, bottom = 32.dp + windowMetrics.navigationBarDp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            val transition = rememberInfiniteTransition(label = "timer-breathing")
            val pulseScale by transition.animateFloat(
                initialValue = 1f,
                targetValue = .75f,
                animationSpec = infiniteRepeatable(tween(1600), RepeatMode.Reverse),
                label = "timer-dot-scale"
            )
            val pulseAlpha by transition.animateFloat(
                initialValue = 1f,
                targetValue = .4f,
                animationSpec = infiniteRepeatable(tween(1600), RepeatMode.Reverse),
                label = "timer-dot-alpha"
            )
            Row(Modifier.clip(RoundedCornerShape(999.dp)).background(Color.White.copy(alpha = .18f)).padding(horizontal = 14.dp, vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(8.dp).graphicsLayer { scaleX = pulseScale; scaleY = pulseScale; alpha = pulseAlpha }.clip(RoundedCornerShape(999.dp)).background(Color.White))
                BasicText("进行中", style = NativeTypography.style(NativeTypography.Role.RecordTimerLabel, Color.White).copy(letterSpacing = .5.sp))
            }
            Spacer(Modifier.height(24.dp))
            // 主力机可用宽度约 299dp；“00:00”的四个 0 比后续“00:12”更宽，
            // 首帧若允许软换行会出现最后一个 0 单独掉到下一行。WebView 的计时
            // 数字始终是一个整体，因此窄屏时只按可用宽度收小字号，不改变常规设备的 96sp 基线。
            BoxWithConstraints(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                val timerFontSize = if (maxWidth < 330.dp) 88.sp else 96.sp
                BasicText(
                    formatElapsed(elapsedMs),
                    style = NativeTypography.style(NativeTypography.Role.RecordTimerValue, Color.White).copy(
                        fontSize = timerFontSize,
                        lineHeight = timerFontSize * 1.05f,
                        letterSpacing = 1.sp,
                        shadow = androidx.compose.ui.graphics.Shadow(Color.Black.copy(alpha = .18f), Offset(0f, 4.dp.value), 24.dp.value)
                    ),
                    maxLines = 1,
                    softWrap = false
                )
            }
            BasicText("开始于 ${formatClock(startedAt)}", style = NativeTypography.style(NativeTypography.Role.RecordTimerMeta, Color.White.copy(alpha = .82f)).copy(fontSize = 14.sp), modifier = Modifier.padding(top = 12.dp))
        }
        Spacer(Modifier.weight(1f))
        // WebView 的结束按钮只有文字，没有额外的“+”图标；保留同样的
        // 340px 宽、18px 垂直内边距和 14px 的取消间距。
        Box(Modifier.widthIn(max = 340.dp).fillMaxWidth().height(61.82.dp).shadow(8.dp, RoundedCornerShape(999.dp)).clip(RoundedCornerShape(999.dp)).background(Color.White).clickableNoRipple(onFinish), contentAlignment = Alignment.Center) {
            BasicText("结束记录", style = NativeTypography.style(NativeTypography.Role.RecordTimerButton, Color(0xFF0040A8)))
        }
        BasicText("取消计时", style = NativeTypography.style(NativeTypography.Role.RecordTimerSecondary, Color.White.copy(alpha = .75f)), modifier = Modifier.padding(top = 14.dp, bottom = 0.dp).clickableNoRipple(onCancel).padding(horizontal = 24.dp, vertical = 10.dp))
    }
}

@Composable
private fun NativeTimerSummaryStep(colors: NativeRecordColors, duration: Int, startedAt: Long, windowMetrics: NativeWindowMetrics, selected: Set<String>, customOptions: Set<String>, onToggle: (String) -> Unit, onAddObservation: () -> Unit, onDeleteCustom: (String) -> Unit = {}, onSave: () -> Unit, onResume: () -> Unit, onAbandon: () -> Unit) {
    val gradient = Brush.verticalGradient(listOf(Color(0xFF0A84FF), Color(0xFF0040A8)))
    Column(Modifier.fillMaxSize().background(gradient).padding(start = 24.dp, end = 24.dp, top = 56.dp + windowMetrics.statusBarDp, bottom = 32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            BasicText("本次计时", style = NativeTypography.style(NativeTypography.Role.RecordTimerLabel, Color.White.copy(alpha = .7f)), modifier = Modifier.padding(top = 10.dp))
            BasicText("已计时 $duration 分钟", style = NativeTypography.style(NativeTypography.Role.RecordTimerValue, Color.White).copy(fontSize = 42.sp, letterSpacing = -.5.sp, shadow = androidx.compose.ui.graphics.Shadow(Color.Black.copy(alpha = .18f), Offset(0f, 4.dp.value), 24.dp.value)), modifier = Modifier.padding(top = 6.dp))
            BasicText("开始于 ${formatClock(startedAt)}", style = NativeTypography.style(NativeTypography.Role.RecordTimerMeta, Color.White.copy(alpha = .6f)), modifier = Modifier.padding(top = 12.dp, bottom = 22.dp))
            BasicText("发生前状况", style = NativeTypography.style(NativeTypography.Role.RecordTimerLabel, Color.White.copy(alpha = .85f)).copy(fontWeight = FontWeight.Bold, letterSpacing = 0.sp), modifier = Modifier.fillMaxWidth().widthIn(max = 320.dp).padding(bottom = 10.dp))
            NativeObservationGrid(selected, colors.copy(card = Color.White.copy(alpha = .16f), field = Color.White.copy(alpha = .16f), secondary = Color.White.copy(alpha = .75f), blue = Color(0xFF0040A8), blueSoft = Color.White, line = Color.White.copy(alpha = .28f)), customOptions, onToggle, onAddObservation, onDeleteCustom)
        }
        Column(Modifier.widthIn(max = 320.dp).fillMaxWidth().padding(top = 16.dp, bottom = windowMetrics.navigationBarDp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.fillMaxWidth().height(60.dp).shadow(8.dp, RoundedCornerShape(999.dp)).clip(RoundedCornerShape(999.dp)).background(Color.White).clickableNoRipple(onSave), contentAlignment = Alignment.Center) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    CheckIcon(Color(0xFF0040A8))
                    BasicText("存为记录", style = NativeTypography.style(NativeTypography.Role.RecordTimerButton, Color(0xFF0040A8)).copy(fontSize = 17.sp))
                }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
                BasicText("继续计时", style = NativeTypography.style(NativeTypography.Role.RecordTimerSecondary, Color.White.copy(alpha = .75f)).copy(fontSize = 13.sp), modifier = Modifier.clickableNoRipple(onResume).padding(10.dp))
                BasicText("放弃", style = NativeTypography.style(NativeTypography.Role.RecordTimerSecondary, Color.White.copy(alpha = .75f)).copy(fontSize = 13.sp), modifier = Modifier.clickableNoRipple(onAbandon).padding(10.dp))
            }
        }
    }
}

@Composable
private fun NativeDurationSlider(value: Int, colors: NativeRecordColors, onValue: (Int) -> Unit) {
    val fraction = (value.coerceIn(0, 60) / 60f)
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        Box(Modifier.weight(1f).height(32.dp).padding(horizontal = 9.dp)
            .pointerInput(Unit) {
                detectTapGestures { position -> onValue(((position.x / size.width.coerceAtLeast(1) * 60f) / 5f).roundToInt().coerceIn(0, 12) * 5) }
            }
            .pointerInput(Unit) {
                detectDragGestures(onDrag = { change, _ ->
                    change.consume()
                    onValue(((change.position.x / size.width.coerceAtLeast(1) * 60f) / 5f).roundToInt().coerceIn(0, 12) * 5)
                })
            }) {
            Canvas(Modifier.fillMaxSize().padding(vertical = 14.dp)) {
                drawLine(colors.line, Offset(0f, size.height / 2), Offset(size.width, size.height / 2), 3.dp.toPx(), StrokeCap.Round)
                drawLine(colors.blue, Offset(0f, size.height / 2), Offset(size.width * fraction, size.height / 2), 4.dp.toPx(), StrokeCap.Round)
                drawCircle(colors.blue, 9.dp.toPx(), Offset(size.width * fraction, size.height / 2))
            }
        }
        BasicText(if (value == 0) "未记录" else "$value 分钟", style = NativeTypography.style(NativeTypography.Role.RecordTimerLabel, colors.blue).copy(fontSize = 13.sp), modifier = Modifier.width(64.dp), maxLines = 1)
    }
}

@Composable
private fun RecordHeader(title: String, colors: NativeRecordColors) {
    Box(Modifier.fillMaxWidth().padding(start = 22.dp, end = 22.dp, bottom = 18.dp), contentAlignment = Alignment.Center) {
        BasicText(title, style = NativeTypography.style(NativeTypography.Role.RecordHeader, colors.ink, textAlign = TextAlign.Center))
    }
}

@Composable
private fun RecordFooter(
    colors: NativeRecordColors,
    primary: String,
    onPrimary: () -> Unit,
    onSecondary: () -> Unit,
    secondary: String = "返回",
    showSecondary: Boolean = true,
    details: Boolean = false
) {
    // WebView 基础态 actions 只有 20dp 上边距；详情态保留 12dp top
    // rhythm，卡片底部 20dp 视觉 gap 由外层 Sheet sibling 统一提供。
    val footerModifier = if (details) {
        // Footer owns only its top rhythm; the Sheet sibling owns the single
        // 20dp visual gap below it. Keeping the owners separate prevents the
        // max-height path from compressing or duplicating the gap.
        Modifier.fillMaxWidth().padding(start = 22.dp, top = 12.dp, end = 22.dp)
    } else {
        Modifier.fillMaxWidth().padding(start = 22.dp, top = 20.dp, end = 22.dp)
    }
    Row(footerModifier, verticalAlignment = Alignment.CenterVertically) {
        if (showSecondary) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                RecordWideButton(secondary, colors.field, colors.ink, onSecondary, Modifier.weight(1f))
                RecordWideButton(primary, colors.blue, Color.White, onPrimary, Modifier.weight(1f))
            }
        } else {
            RecordWideButton(primary, colors.blue, Color.White, onPrimary)
        }
    }
}

@Composable
private fun RecordWideButton(text: String, background: Color, foreground: Color, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(52.dp).clip(RoundedCornerShape(26.dp)).background(background).clickableNoRipple(onClick), contentAlignment = Alignment.Center) {
        BasicText(text, style = NativeTypography.style(NativeTypography.Role.RecordFooterButton, foreground))
    }
}

@Composable
private fun RecordSegment(text: String, active: Boolean, colors: NativeRecordColors, modifier: Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(999.dp)
    Box(modifier.height(40.dp).then(if (active) Modifier.shadow(1.dp, shape) else Modifier).clip(shape).background(if (active) colors.card else Color.Transparent).clickableNoRipple(onClick), contentAlignment = Alignment.Center) {
        BasicText(text, style = NativeTypography.explicit(if (active) colors.blue else colors.secondary, 14.sp, fontWeight = FontWeight.SemiBold))
    }
}

@Composable
private fun RecordActionButton(text: String, colors: NativeRecordColors, modifier: Modifier, onClick: () -> Unit) {
    Box(modifier.height(48.dp).clip(RoundedCornerShape(10.dp)).background(colors.field).clickableNoRipple(onClick), contentAlignment = Alignment.Center) {
        BasicText(text, style = NativeTypography.explicit(colors.ink, 14.sp, fontWeight = FontWeight.SemiBold))
    }
}

@Composable
private fun RecordChip(text: String, active: Boolean, colors: NativeRecordColors, modifier: Modifier, onDelete: (() -> Unit)? = null, onClick: () -> Unit) {
    val shape = RoundedCornerShape(999.dp)
    Row(modifier.heightIn(min = 38.dp).then(if (!active) Modifier.border(1.dp, colors.line, shape) else Modifier).clip(shape).background(if (active) colors.blueSoft else colors.card).clickableNoRipple(onClick).padding(start = 15.dp, end = if (onDelete != null) 8.dp else 15.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        BasicText(text, style = NativeTypography.style(NativeTypography.Role.RecordChip, if (active) colors.blue else colors.secondary, active = active, textAlign = TextAlign.Center), maxLines = 2)
        if (onDelete != null) {
            BasicText("×", style = NativeTypography.explicit(if (active) colors.blue else colors.secondary, 15.sp, fontWeight = FontWeight.Bold), modifier = Modifier.clickableNoRipple(onDelete).padding(horizontal = 3.dp, vertical = 0.dp))
        }
    }
}

@Composable
private fun PlusIcon(color: Color) {
    Canvas(Modifier.size(18.dp)) {
        drawLine(color, Offset(size.width / 2f, 3.dp.toPx()), Offset(size.width / 2f, size.height - 3.dp.toPx()), 2.dp.toPx(), StrokeCap.Round)
        drawLine(color, Offset(3.dp.toPx(), size.height / 2f), Offset(size.width - 3.dp.toPx(), size.height / 2f), 2.dp.toPx(), StrokeCap.Round)
    }
}

@Composable
private fun CheckIcon(color: Color) {
    Canvas(Modifier.size(18.dp)) {
        val path = androidx.compose.ui.graphics.Path().apply {
            moveTo(3.dp.toPx(), 9.dp.toPx())
            lineTo(7.dp.toPx(), 13.dp.toPx())
            lineTo(15.dp.toPx(), 4.dp.toPx())
        }
        drawPath(path, color, style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2.dp.toPx(), cap = StrokeCap.Round, join = androidx.compose.ui.graphics.StrokeJoin.Round))
    }
}

@Composable
private fun NativeAddObservationDialog(
    colors: NativeRecordColors,
    value: String,
    focusRequester: FocusRequester,
    onValue: (String) -> Unit,
    onCancel: () -> Unit,
    onConfirm: () -> Unit
) {
    Column(
        Modifier.width(300.dp).clip(RoundedCornerShape(18.dp)).background(colors.card).padding(start = 22.dp, end = 22.dp, top = 26.dp, bottom = 18.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        BasicText("添加发生前状况", style = NativeTypography.explicit(colors.ink, 16.sp, fontWeight = FontWeight.ExtraBold), modifier = Modifier.padding(bottom = 10.dp))
        BasicTextField(
            value = value,
            onValueChange = { if (it.length <= 6) onValue(it) },
            singleLine = true,
            textStyle = NativeTypography.explicit(colors.ink, 14.sp),
            modifier = Modifier
                .fillMaxWidth()
                .focusRequester(focusRequester)
                .clip(RoundedCornerShape(9.dp))
                .background(colors.field)
                .padding(horizontal = 12.dp, vertical = 11.dp),
            decorationBox = { inner -> if (value.isBlank()) BasicText("输入名称（不超过 6 个字）", style = NativeTypography.explicit(colors.secondary, 14.sp)); inner() }
        )
        Row(Modifier.fillMaxWidth().padding(top = 22.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.weight(1f).height(44.dp).clip(RoundedCornerShape(999.dp)).background(colors.field).clickableNoRipple(onCancel), contentAlignment = Alignment.Center) {
                BasicText("取消", style = NativeTypography.explicit(colors.ink, 14.sp, fontWeight = FontWeight.SemiBold))
            }
            Box(Modifier.weight(1f).height(44.dp).clip(RoundedCornerShape(999.dp)).background(colors.blue).clickableNoRipple(onConfirm), contentAlignment = Alignment.Center) {
                BasicText("添加", style = NativeTypography.explicit(Color.White, 14.sp, fontWeight = FontWeight.SemiBold))
            }
        }
    }
}

@Composable
private fun NativeDeleteObservationDialog(
    colors: NativeRecordColors,
    label: String,
    onCancel: () -> Unit,
    onConfirm: () -> Unit
) {
    Column(
        Modifier.width(300.dp).clip(RoundedCornerShape(18.dp)).background(colors.card).padding(start = 22.dp, end = 22.dp, top = 26.dp, bottom = 18.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        BasicText("删除这个选项？", style = NativeTypography.explicit(colors.ink, 16.sp, fontWeight = FontWeight.ExtraBold), modifier = Modifier.padding(bottom = 9.dp))
        BasicText("「$label」将从选项列表中移除，已保存的记录不受影响。", style = NativeTypography.explicit(colors.secondary, 13.sp, lineHeight = 19.sp, textAlign = TextAlign.Center), modifier = Modifier.fillMaxWidth())
        Row(Modifier.fillMaxWidth().padding(top = 22.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.weight(1f).height(44.dp).clip(RoundedCornerShape(999.dp)).background(colors.field).clickableNoRipple(onCancel), contentAlignment = Alignment.Center) {
                BasicText("取消", style = NativeTypography.explicit(colors.ink, 14.sp, fontWeight = FontWeight.SemiBold))
            }
            // WebView 的删除确认是普通蓝色主按钮；危险语义由文案承担，
            // 不再引入一套与现有操作按钮不一致的红色视觉规则。
            Box(Modifier.weight(1f).height(44.dp).clip(RoundedCornerShape(999.dp)).background(colors.blue).clickableNoRipple(onConfirm), contentAlignment = Alignment.Center) {
                BasicText("删除", style = NativeTypography.explicit(Color.White, 14.sp, fontWeight = FontWeight.SemiBold))
            }
        }
    }
}

private fun Modifier.clickableNoRipple(onClick: () -> Unit): Modifier = composed {
    val source = remember { MutableInteractionSource() }
    clickable(source, indication = null, onClick = onClick)
}

private fun buildRecordPayload(context: NativeRecordContext, mode: String, dateKey: String, time: String, duration: Int, selected: Set<String>, note: String): String = JSONObject().apply {
    put("kind", if (context.kind == "edit") "edit" else "new")
    context.recordId?.let { put("recordId", it) }
    put("mode", mode)
    put("dateKey", dateKey)
    put("time", time)
    put("duration", duration.coerceAtLeast(0))
    put("observations", JSONArray(selected.toList()))
    put("note", note)
}.toString()

private fun todayKey(): String = java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Calendar.getInstance().time)
private fun nowTime(): String = java.text.SimpleDateFormat("HH:mm", Locale.US).format(Calendar.getInstance().time)
private fun todayLabel(): String = java.text.SimpleDateFormat("M月d日", Locale.CHINA).format(Calendar.getInstance().time)
private fun formatRecordDateTime(dateKey: String, time: String): String {
    val dateLabel = runCatching {
        java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { isLenient = false }.parse(dateKey)
            ?.let { java.text.SimpleDateFormat("M月d日", Locale.CHINA).format(it) }
            ?: dateKey
    }.getOrElse { dateKey }
    return "$dateLabel  $time"
}
private fun formatRecordDateLabel(dateKey: String): String = runCatching {
    java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { isLenient = false }.parse(dateKey)
        ?.let { java.text.SimpleDateFormat("M月d日", Locale.CHINA).format(it) }
        ?: dateKey
}.getOrElse { dateKey }
private fun parseDateKey(value: String): Long? = runCatching { java.text.SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { isLenient = false }.parse(value)?.time }.getOrNull()
private fun formatClock(ms: Long): String = java.text.SimpleDateFormat("HH:mm", Locale.US).format(java.util.Date(ms))
private fun formatElapsed(ms: Long): String { val total = (ms / 1000L).toInt(); return "%02d:%02d".format(Locale.US, total / 60, total % 60) }
