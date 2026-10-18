package com.guanji.app

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONObject
import kotlin.math.roundToInt

/**
 * #278：经典/普通模式的“我的”原生页面。
 *
 * 视觉参数取自 v4.1.5 WebView `screens.css`，动作仍通过 JS 既有存储链处理。
 * 这里不保存 API 密钥，也不会把密钥放进 NativeSettingsData 或日志。
 */
@Composable
fun NativeSettingsSurface(
    snapshotJson: String?,
    darkTheme: Boolean,
    windowMetrics: NativeWindowMetrics = NativeWindowMetrics(),
    clearFeedback: String? = null,
    maintenanceStatus: String? = null,
    onAction: (String, String?) -> Unit,
) {
    val data = remember(snapshotJson) { NativeSettingsData.parse(snapshotJson) }
    // Optimistic state keeps switches/segments responsive while the existing
    // WebView owner persists the setting asynchronously. A later snapshot is
    // still authoritative and replaces this value without a second store.
    var visibleData by remember(snapshotJson) { mutableStateOf(data) }
    var aiEditing by remember(data.aiEditing) { mutableStateOf(data.aiEditing) }
    var baseUrl by remember(data.baseUrl, aiEditing) { mutableStateOf(data.baseUrl) }
    var model by remember(data.model, aiEditing) { mutableStateOf(data.model) }
    var apiKey by remember { mutableStateOf("") }
    val colors = settingsColors(darkTheme)
    val scroll = rememberScrollState()
    val statusTopDp = windowMetrics.statusBarDp

    fun dispatch(type: String, value: String? = null) {
        // Encryption is a transactional setting. Selecting “已加密” opens the
        // existing password flow; until it succeeds, the authoritative
        // snapshot must keep driving the selector. This prevents a cancelled
        // dialog from leaving a false encrypted UI state.
        if (type == "secure-mode") {
            onAction(type, value)
            return
        }
        visibleData = visibleData.optimistic(type, value)
        if (type == "ai-edit") aiEditing = true
        if (type == "ai-save") aiEditing = false
        onAction(type, value)
    }

    Box(Modifier.fillMaxSize().background(colors.background)) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scroll)
                // WebView `.screen` uses `4px + safe-top`; consume the same
                // status-bar inset here so the title never renders beneath
                // Flyme/Android status icons.
                .padding(start = SettingsMetrics.pageHorizontal, end = SettingsMetrics.pageHorizontal, top = 4.dp + statusTopDp, bottom = SettingsMetrics.pageBottom + windowMetrics.navigationBarDp),
            verticalArrangement = Arrangement.spacedBy(SettingsMetrics.cardGap),
        ) {
            SettingsHeader(colors)

            SettingsCard(colors, "外观") {
                SettingsSegment(
                    values = listOf("跟随系统", "浅色", "深色"),
                    selected = when (visibleData.themeMode) { "light" -> 1; "dark" -> 2; else -> 0 },
                    colors = colors,
                    contentDescription = "主题模式",
                    onSelected = { dispatch("theme", listOf("system", "light", "dark")[it]) },
                )
                // WebView places the experimental marker inline with the title;
                // do not pass it as a second row subtitle or it is rendered twice.
                // CSS margins between adjacent blocks collapse; don't add the
                // switch's 6px trailing margin to the blur row's 10px lead.
                SettingsSwitchRow("玻璃效果", null, visibleData.glassEnabled, colors, top = 14.dp, bottom = 0.dp) {
                    dispatch("glass", if (visibleData.glassEnabled) "off" else "on")
                }
                SettingsBlurRow(visibleData.blur, colors) { dispatch("blur", it.toString()) }
                // WebView disclaimer is the last block in this card: keep its
                // own 2px inset and 16px bottom margin before card padding.
                SettingsDescription(
                    "实验性视觉材质：无磨砂通透玻璃 + 玻璃边缘，随内容滚动的流动性。可随时切回经典样式。",
                    colors,
                    top = SettingsMetrics.appearanceDescriptionTop,
                    bottom = 16.dp,
                )
            }

            SettingsCard(colors, "记录设置") {
                SettingsSubtitle("记录方式", colors, first = true)
                SettingsSegment(
                    values = listOf("计时记录", "快速记录"),
                    selected = if (visibleData.recordMode == "quick") 1 else 0,
                    colors = colors,
                    contentDescription = "记录方式",
                    onSelected = { dispatch("record-mode", if (it == 1) "quick" else "timer") },
                )
                SettingsDescription("计时自动填入时长 · 快速记录直接填写", colors, top = SettingsMetrics.compactDescription, compact = true)
                SettingsSubtitle("提醒与通知", colors, groupCard = true)
                // The following picker has the same 6px CSS margin; the two
                // sibling margins collapse to one, so the row contributes no
                // extra trailing gap in Compose.
                SettingsSwitchRow("每日温和提醒", null, visibleData.reminderEnabled, colors, top = SettingsMetrics.groupRowTop, bottom = 0.dp) {
                    dispatch("reminder", if (visibleData.reminderEnabled) "off" else "on")
                }
                if (visibleData.reminderEnabled) {
                    SettingsTimeField(visibleData.reminderTime.ifBlank { "21:00" }, colors) {
                        dispatch("reminder-time", visibleData.reminderTime.ifBlank { "21:00" })
                    }
                }
                SettingsDescription("到点提醒你记录一下，只发本机通知。", colors, top = SettingsMetrics.compactDescription, compact = true)
                SettingsSwitchRow("计时通知", "计时中在锁屏和通知栏显示，可随时关闭", visibleData.timerNotificationEnabled, colors, top = SettingsMetrics.groupRowTop, bottom = 0.dp) {
                    dispatch("timer-notification", if (visibleData.timerNotificationEnabled) "off" else "on")
                }
                LiveTestBlock(visibleData, colors) { dispatch("live-test", null) }
            }

            SettingsCard(colors, "反馈设置") {
                SettingsSubtitle("反馈偏好", colors, first = true, groupCard = true)
                SettingsSwitchRow("连续记录里程碑肯定", "达到 7 / 30 天时，首页出现一句温和的肯定", visibleData.positiveEnabled, colors, top = SettingsMetrics.groupRowTop, bottom = 0.dp) {
                    dispatch("positive", if (visibleData.positiveEnabled) "off" else "on")
                }
                SettingsSwitchRow("每日话语", "AI 优先 · 未配置时使用本地话语", visibleData.dailyTipEnabled, colors, top = SettingsMetrics.feedbackSecondaryTop) {
                    dispatch("daily-tip", if (visibleData.dailyTipEnabled) "off" else "on")
                }
            }

            AiSettingsCard(
                data = visibleData,
                colors = colors,
                editing = aiEditing,
                baseUrl = baseUrl,
                model = model,
                apiKey = apiKey,
                onBaseUrlChange = { baseUrl = it },
                onModelChange = { model = it },
                onApiKeyChange = { apiKey = it },
                onProvider = { dispatch("ai-provider", it) },
                onEdit = {
                    aiEditing = true
                    dispatch("ai-edit", null)
                },
                onSave = {
                    dispatch("ai-save", JSONObject().put("baseUrl", baseUrl).put("model", model).put("apiKey", apiKey).toString())
                    apiKey = ""
                    aiEditing = false
                },
                onTest = { dispatch("ai-test", null) },
                onDataScope = { dispatch("data-scope", null) },
            )

            SettingsCard(colors, "数据与隐私") {
                SettingsSubtitle("本地数据", colors, first = true)
                SettingsSecureDescription(visibleData.secureSummary, colors, top = SettingsMetrics.compactDescription, bottom = 10.dp)
                SettingsSegment(
                    values = listOf("未加密", "已加密"),
                    selected = if (visibleData.secureMode == "encrypted") 1 else 0,
                    colors = colors,
                    contentDescription = "本地数据加密",
                    onSelected = { dispatch("secure-mode", if (it == 1) "encrypted" else "plain") },
                )
                if (visibleData.secureMode == "encrypted") {
                    SettingsControlActionRow("修改口令", colors) { dispatch("secure-change", null) }
                }
                SettingsSubtitle("备份", colors)
                SettingsRowButton("备份与恢复", "本机文件与服务器备份", colors, showDivider = true) { dispatch("backup", null) }
                SettingsRowButton("导出数据", if (visibleData.secureMode == "encrypted") "加密备份文件" else "CSV 文件", colors) { dispatch("export", null) }
            }

            SettingsCard(colors, "危险操作", titleBottom = 6.dp) {
                SettingsRowButton("清除全部数据", null, colors, danger = true, showDivider = true, status = clearFeedback) { dispatch("clear", null) }
                SettingsRowButton("恢复演示数据", null, colors, status = maintenanceStatus) { dispatch("restore", null) }
            }

            AboutCard(visibleData, colors) { onAction("open-source-licenses", null) }
        }
    }
}

private data class SettingsColors(
    val background: Color,
    val card: Color,
    val ink: Color,
    val secondary: Color,
    val tertiary: Color,
    val line: Color,
    val accent: Color,
    val accentDeep: Color,
    val soft: Color,
    val sage: Color,
)

/** WebView settings rhythm. Keep geometry in one place instead of scattering
 * guessed Spacer/padding values through each Composable. */
private object SettingsMetrics {
    // WebView #278 content edge is 20px; 21dp on the 440dpi reference phone
    // keeps the native card shadow/content edge within the same 1px tolerance.
    val pageHorizontal = 21.dp
    val pageBottom = 104.dp
    val cardRadius = 16.dp
    val cardPadding = 20.dp
    val aiCardPaddingVertical = 26.dp
    val cardGap = 16.dp
    val cardTitleBottom = 14.dp
    val sectionTop = 22.dp
    val groupSubtitleTop = 24.dp
    val sectionTopFirst = 0.dp
    val sectionBottom = 10.dp
    val rowTop = 18.dp
    val groupRowTop = 8.dp
    val rowBottom = 6.dp
    val compactDescription = 6.dp
    val description = 12.dp
    val divider = 1.dp
    val dividerTop = 12.dp
    val dividerBottom = 12.dp
    val segmentOuterPadding = 4.dp
    val segmentGap = 4.dp
    val segmentHeight = 40.dp
    val segmentTotalHeight = segmentHeight + segmentOuterPadding * 2
    val segmentShadow = 1.dp
    // `.settings-control-gap-sm` is 10px. The preceding switch's 6px
    // margin collapses with it in CSS; the native row therefore has no
    // trailing padding and this remains the single 10px lead.
    val blurRowTop = 10.dp
    // WebView range input resolves to roughly 193px on the reference card
    // after label/value/gap allocation; keep the native track from growing to
    // the value label while avoiding the previous visibly short 180dp track.
    val blurTrackWidth = 196.dp
    val blurTrackHeight = 28.dp
    val blurTrackStroke = 4.dp
    val blurThumbOuter = 11.dp
    val blurThumbInner = 9.dp
    val appearanceDescriptionTop = 14.dp
    val reminderAfterDescriptionTop = 18.dp
    val feedbackSecondaryTop = 20.dp
}

private fun settingsColors(dark: Boolean) = if (dark) SettingsColors(
    Color(0xFF121212), Color(0xFF1E1E1E), Color.White, Color(0xFFB0B0B4),
    Color(0xFF7D7D82), Color(0xFF3A3A3C), Color(0xFF0A84FF), Color(0xFF409CFF),
    Color(0xFF2C2C2E), Color(0xFF30D158)
) else SettingsColors(
    Color(0xFFF2F2F7), Color.White, Color.Black, Color(0xFF8E8E93),
    Color(0xFFC7C7CC), Color(0xFFE5E5EA), Color(0xFF007AFF), Color(0xFF0062CC),
    Color(0xFFE5E5EA), Color(0xFF34C759)
)

internal data class NativeSettingsData(
    val themeMode: String = "system",
    val glassEnabled: Boolean = false,
    val blur: Int = 3,
    val recordMode: String = "timer",
    val reminderEnabled: Boolean = false,
    val reminderTime: String = "21:00",
    val timerNotificationEnabled: Boolean = true,
    val positiveEnabled: Boolean = true,
    val dailyTipEnabled: Boolean = true,
    val secureMode: String = "plain",
    val clearStatus: String = "",
    val secureSummary: String = "正在检测…",
    val hasRecords: Boolean = false,
    val recordCount: Int = 0,
    val webDavConfigured: Boolean = false,
    val canClearServer: Boolean = false,
    val provider: String = "deepseek",
    val providerLabel: String = "DeepSeek",
    val baseUrl: String = "https://api.deepseek.com",
    val model: String = "deepseek-v4-flash",
    val hasApiKey: Boolean = false,
    val aiConfigured: Boolean = false,
    val aiEditing: Boolean = false,
    val aiTestStatus: String = "尚未测试连接",
    val aiStatus: String = "idle",
    val liveTested: Boolean = false,
    val liveBadgeText: String = "未测试",
    val liveBadgeState: String = "idle",
    val liveResultText: String = "",
    val liveSystem: String = "",
    val livePermission: String = "",
    val liveDisplay: String = "",
    val version: String = "4.2.7",
) {
    companion object {
        fun parse(raw: String?): NativeSettingsData {
            if (raw.isNullOrBlank()) return NativeSettingsData()
            return runCatching {
                val j = JSONObject(raw)
                NativeSettingsData(
                    themeMode = j.optString("themeMode", "system"),
                    glassEnabled = j.optBoolean("glassEnabled", false),
                    blur = j.optInt("blur", 3).coerceIn(0, 10),
                    recordMode = j.optString("recordMode", "timer"),
                    reminderEnabled = j.optBoolean("reminderEnabled", false),
                    reminderTime = j.optString("reminderTime", "21:00"),
                    timerNotificationEnabled = j.optBoolean("timerNotificationEnabled", true),
                    positiveEnabled = j.optBoolean("positiveEnabled", true),
                    dailyTipEnabled = j.optBoolean("dailyTipEnabled", true),
                    secureMode = j.optString("secureMode", "plain"),
                    clearStatus = j.optString("clearStatus", ""),
                    secureSummary = j.optString("secureSummary", "正在检测…"),
                    hasRecords = j.optBoolean("hasRecords", false),
                    recordCount = j.optInt("recordCount", 0).coerceAtLeast(0),
                    webDavConfigured = j.optBoolean("webDavConfigured", false),
                    canClearServer = j.optBoolean("canClearServer", false),
                    provider = j.optString("provider", "deepseek"),
                    providerLabel = j.optString("providerLabel", "DeepSeek"),
                    baseUrl = j.optString("baseUrl", ""),
                    model = j.optString("model", ""),
                    hasApiKey = j.optBoolean("hasApiKey", false),
                    aiConfigured = j.optBoolean("aiConfigured", false),
                    aiEditing = j.optBoolean("aiEditing", false),
                    aiTestStatus = j.optString("aiTestStatus", "尚未测试连接"),
                    aiStatus = j.optString("aiStatus", "idle"),
                    liveTested = j.optBoolean("liveTested", false),
                    liveBadgeText = j.optString("liveBadgeText", if (j.optBoolean("liveTested", false)) "已测试" else "未测试"),
                    liveBadgeState = j.optString("liveBadgeState", "idle"),
                    liveResultText = j.optString("liveResultText", ""),
                    liveSystem = j.optString("liveSystem", ""),
                    livePermission = j.optString("livePermission", ""),
                    liveDisplay = j.optString("liveDisplay", ""),
                    version = j.optString("version", "4.2.7"),
                )
            }.getOrDefault(NativeSettingsData())
        }
    }
}

private fun NativeSettingsData.optimistic(type: String, value: String?): NativeSettingsData {
    return when (type) {
        "theme" -> copy(themeMode = value ?: themeMode)
        "glass" -> copy(glassEnabled = value == "on")
        "blur" -> copy(blur = (value?.toIntOrNull() ?: blur).coerceIn(0, 10))
        "record-mode" -> copy(recordMode = if (value == "quick") "quick" else "timer")
        "reminder" -> copy(reminderEnabled = !reminderEnabled)
        "timer-notification" -> copy(timerNotificationEnabled = !timerNotificationEnabled)
        "positive" -> copy(positiveEnabled = !positiveEnabled)
        "daily-tip" -> copy(dailyTipEnabled = !dailyTipEnabled)
        // Loading belongs inside the confirmation sheet; the settings row
        // only receives a short success acknowledgement from NativeRoot.
        "clear" -> this
        "secure-mode" -> copy(secureMode = value ?: secureMode)
        "ai-provider" -> copy(provider = value ?: provider, providerLabel = when (value) {
            "openai" -> "OpenAI"
            "custom" -> "自定义"
            else -> "DeepSeek"
        })
        "ai-edit" -> copy(aiEditing = true)
        "ai-save" -> copy(aiEditing = false, hasApiKey = true, aiConfigured = true)
        "ai-test" -> copy(aiTestStatus = "正在测试连接…")
        "live-test" -> copy(liveBadgeText = "测试中…", liveBadgeState = "loading", liveTested = false)
        else -> this
    }
}

private val SettingsBody = NativeTypography.style(NativeTypography.Role.SettingsBody, Color.Unspecified)
private val SettingsRowTitle = NativeTypography.style(NativeTypography.Role.SettingsRowTitle, Color.Unspecified)
private val SettingsCaption = NativeTypography.style(NativeTypography.Role.SettingsCaption, Color.Unspecified)
private val SettingsSecondary = NativeTypography.style(NativeTypography.Role.SettingsSecondary, Color.Unspecified)

@Composable
private fun SettingsHeader(colors: SettingsColors) {
    Column(Modifier.padding(top = 15.dp, bottom = 3.dp)) {
        BasicText("设置", style = NativeTypography.style(NativeTypography.Role.SettingsEyebrow, colors.secondary))
        Spacer(Modifier.height(6.dp))
        BasicText("我的", style = NativeTypography.style(NativeTypography.Role.SettingsPageTitle, colors.ink))
    }
}

@Composable
private fun SettingsCard(
    colors: SettingsColors,
    title: String,
    titleBottom: androidx.compose.ui.unit.Dp = SettingsMetrics.cardTitleBottom,
    content: @Composable () -> Unit,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .shadow(2.dp, RoundedCornerShape(SettingsMetrics.cardRadius), clip = false)
            .clip(RoundedCornerShape(SettingsMetrics.cardRadius))
            .background(colors.card)
            .padding(SettingsMetrics.cardPadding),
    ) {
        BasicText(title, style = NativeTypography.style(NativeTypography.Role.SettingsCardTitle, colors.ink))
        Spacer(Modifier.height(titleBottom))
        content()
    }
}

@Composable
private fun SettingsSubtitle(
    text: String,
    colors: SettingsColors,
    first: Boolean = false,
    groupCard: Boolean = false,
) {
    // `.settings-group-card .settings-subtitle:not(:first-child)` uses 24px
    // rather than the ordinary 22px section rhythm.
    val top = when {
        first -> SettingsMetrics.sectionTopFirst
        groupCard -> SettingsMetrics.groupSubtitleTop
        else -> SettingsMetrics.sectionTop
    }
    Spacer(Modifier.height(top))
    BasicText(text, style = NativeTypography.style(NativeTypography.Role.SettingsSecondary, colors.secondary).copy(fontSize = 12.sp, lineHeight = 17.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.24.sp))
    Spacer(Modifier.height(SettingsMetrics.sectionBottom))
}

@Composable
private fun SettingsDescription(
    text: String,
    colors: SettingsColors,
    top: androidx.compose.ui.unit.Dp = SettingsMetrics.compactDescription,
    // `.settings-description-compact` has no own bottom margin. A nullable
    // override lets the regular appearance disclaimer retain the WebView
    // `.disclaimer` 16px margin without adding it to compact blocks.
    bottom: androidx.compose.ui.unit.Dp? = null,
    compact: Boolean = false,
) {
    BasicText(
        text,
        style = NativeTypography.style(NativeTypography.Role.SettingsCaption, colors.tertiary).copy(lineHeight = if (compact) 17.sp else 20.sp, letterSpacing = 0.22.sp),
        // `.disclaimer` has a 2px vertical / 4px horizontal inset. `top`
        // models the CSS margin-top; callers provide the CSS margin-bottom
        // where the description terminates a card.
        modifier = Modifier.padding(
            start = 4.dp,
            end = 4.dp,
            top = top + 2.dp,
            bottom = (bottom ?: if (compact) 0.dp else 16.dp) + 2.dp,
        ),
    )
}

@Composable
private fun SettingsSecureDescription(
    text: String,
    colors: SettingsColors,
    top: androidx.compose.ui.unit.Dp = SettingsMetrics.compactDescription,
    bottom: androidx.compose.ui.unit.Dp = 10.dp,
) {
    // WebView secureStatus prepends the state dot inside the same disclaimer
    // line; keeping it in the text row preserves the original baseline and
    // avoids a separate block that would alter card rhythm.
    Row(
        Modifier.padding(start = 4.dp, end = 4.dp, top = top + 2.dp, bottom = bottom + 2.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            Modifier
                .padding(top = 7.dp)
                .size(7.dp)
                .clip(RoundedCornerShape(50))
                .background(if (text.contains("已开启") || text.contains("已加密")) colors.sage else colors.tertiary),
        )
        BasicText(
            text,
            style = NativeTypography.style(NativeTypography.Role.SettingsCaption, if (text.contains("已开启") || text.contains("已加密")) colors.sage else colors.tertiary).copy(lineHeight = 17.sp, letterSpacing = 0.22.sp),
            modifier = Modifier.padding(start = 8.dp),
        )
    }
}

@Composable
private fun SettingsSegment(values: List<String>, selected: Int, colors: SettingsColors, contentDescription: String, onSelected: (Int) -> Unit) {
    val outer = RoundedCornerShape(999.dp)
    BoxWithConstraints(
        Modifier
            .fillMaxWidth()
            .height(SettingsMetrics.segmentTotalHeight)
            .background(colors.soft, outer)
            .padding(SettingsMetrics.segmentOuterPadding),
    ) {
        val gap = SettingsMetrics.segmentGap
        val segmentWidth = ((maxWidth - gap * (values.size - 1)) / values.size).coerceAtLeast(1.dp)
        val targetOffset = (segmentWidth + gap) * selected.coerceIn(0, values.lastIndex).toFloat()
        val animatedOffset by animateDpAsState(
            targetValue = targetOffset,
            animationSpec = tween(durationMillis = 400, easing = CubicBezierEasing(0.23f, 1f, 0.32f, 1.05f)),
            label = "webview-segment-slide",
        )
        Box(
            Modifier
                .offset(x = animatedOffset)
                .width(segmentWidth)
                .height(SettingsMetrics.segmentHeight)
                // WebView `.seg-slide` has its own shadow layer. Keep the
                // shadow outside the clip so it is not cut off at the pill edge.
                .shadow(SettingsMetrics.segmentShadow, outer, clip = false)
                .clip(outer)
                .background(colors.card),
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(gap)) {
            values.forEachIndexed { index, value ->
                val active = index == selected
                val source = remember { MutableInteractionSource() }
                Box(
                    Modifier
                        .weight(1f)
                        .height(SettingsMetrics.segmentHeight)
                        .clip(RoundedCornerShape(999.dp))
                        .clickable(interactionSource = source, indication = null) { onSelected(index) }
                        .semantics {
                            this.contentDescription = "$contentDescription：$value"
                            this.selected = active
                            role = Role.RadioButton
                        },
                    contentAlignment = Alignment.Center,
                ) {
                    BasicText(value, style = NativeTypography.style(NativeTypography.Role.SettingsBody, if (active) colors.accentDeep else colors.secondary).copy(fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.SemiBold), maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

@Composable
private fun SettingsSwitchRow(
    title: String,
    subtitle: String?,
    enabled: Boolean,
    colors: SettingsColors,
    top: androidx.compose.ui.unit.Dp = SettingsMetrics.rowTop,
    bottom: androidx.compose.ui.unit.Dp = SettingsMetrics.rowBottom,
    onClick: () -> Unit,
) {
        Row(
        Modifier.fillMaxWidth().padding(top = top, bottom = bottom).clickable(interactionSource = MutableInteractionSource(), indication = null, onClick = onClick),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(Modifier.weight(1f).padding(end = 14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                BasicText(title, style = SettingsRowTitle.copy(color = colors.ink, fontWeight = FontWeight.Normal))
                if (title == "玻璃效果") BasicText("实验性", style = SettingsCaption.copy(color = colors.tertiary), modifier = Modifier.padding(start = 6.dp))
            }
            if (!subtitle.isNullOrBlank()) BasicText(subtitle, style = SettingsCaption.copy(color = colors.tertiary), modifier = Modifier.padding(top = 3.dp), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        NativeSwitch(enabled, colors)
    }
}

@Composable
private fun NativeSwitch(enabled: Boolean, colors: SettingsColors) {
    Box(Modifier.size(width = 46.dp, height = 27.dp).clip(RoundedCornerShape(999.dp)).background(if (enabled) colors.accent else colors.soft).padding(3.dp), contentAlignment = if (enabled) Alignment.CenterEnd else Alignment.CenterStart) {
        Box(Modifier.size(21.dp).shadow(1.dp, RoundedCornerShape(50)).clip(RoundedCornerShape(50)).background(Color.White))
    }
}

@Composable
private fun SettingsBlurRow(value: Int, colors: SettingsColors, onValueChange: (Int) -> Unit) {
    var widthPx by remember { mutableStateOf(1f) }
    var localValue by remember(value) { mutableStateOf(value.coerceIn(0, 10)) }
    val density = LocalDensity.current
    val updateFromX: (Float) -> Unit = { x ->
        val thumb = with(density) { SettingsMetrics.blurThumbOuter.toPx() }
        val thumbTravel = (widthPx - thumb * 2f).coerceAtLeast(1f)
        localValue = (((x - thumb).coerceIn(0f, thumbTravel) / thumbTravel) * 10f).roundToInt().coerceIn(0, 10)
        onValueChange(localValue)
    }
    Row(Modifier.fillMaxWidth().padding(top = SettingsMetrics.blurRowTop), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        BasicText("磨砂强度", style = SettingsBody.copy(color = colors.secondary))
        Box(
            Modifier
                .weight(1f)
                .widthIn(max = SettingsMetrics.blurTrackWidth)
                .height(SettingsMetrics.blurTrackHeight)
                .onSizeChanged { widthPx = it.width.toFloat().coerceAtLeast(1f) }
                .pointerInput(Unit) {
                    detectDragGestures(
                        onDragStart = { updateFromX(it.x) },
                        onDrag = { change, amount -> change.consume(); updateFromX(change.position.x) },
                        onDragEnd = {},
                        onDragCancel = {},
                    )
                },
            contentAlignment = Alignment.CenterStart,
        ) {
            androidx.compose.foundation.Canvas(Modifier.fillMaxSize()) {
                val y = size.height / 2f
                val thumb = SettingsMetrics.blurThumbOuter.toPx()
                // WebView's range track reaches the control's right edge,
                // while the thumb is inset only on the left. Keep the same
                // asymmetric end caps instead of shortening the track by a
                // full thumb diameter on both sides.
                val lineStart = thumb + 3.dp.toPx()
                val lineEnd = (size.width - 2.dp.toPx()).coerceAtLeast(lineStart)
                val travel = (lineEnd - lineStart).coerceAtLeast(1f)
                val progressX = lineStart + travel * (localValue / 10f)
                val thumbTravel = (size.width - thumb * 2f).coerceAtLeast(1f)
                val x = thumb + thumbTravel * (localValue / 10f)
                // CSS thumb: 22px white border, blue 18px interior, subtle
                // shadow. Drawing the white outer ring first mirrors that
                // geometry instead of the previous incorrect white dot.
                drawLine(colors.line, androidx.compose.ui.geometry.Offset(lineStart, y), androidx.compose.ui.geometry.Offset(lineEnd, y), strokeWidth = SettingsMetrics.blurTrackStroke.toPx(), cap = StrokeCap.Round)
                drawLine(colors.accent, androidx.compose.ui.geometry.Offset(lineStart, y), androidx.compose.ui.geometry.Offset(progressX, y), strokeWidth = SettingsMetrics.blurTrackStroke.toPx(), cap = StrokeCap.Round)
                drawCircle(Color.Black.copy(alpha = 0.16f), radius = SettingsMetrics.blurThumbOuter.toPx(), center = androidx.compose.ui.geometry.Offset(x, y + 1.dp.toPx()))
                drawCircle(Color.White, radius = SettingsMetrics.blurThumbOuter.toPx(), center = androidx.compose.ui.geometry.Offset(x, y))
                drawCircle(colors.accent, radius = SettingsMetrics.blurThumbInner.toPx(), center = androidx.compose.ui.geometry.Offset(x, y))
            }
        }
        BasicText("$localValue px", style = SettingsBody.copy(color = colors.ink, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.End), modifier = Modifier.width(38.dp))
    }
}

@Composable
private fun SettingsTimeField(value: String, colors: SettingsColors, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val pressAlpha by animateFloatAsState(if (pressed) 0.78f else 1f, tween(90), label = "settings-time-press")
    Row(
        Modifier
            .fillMaxWidth()
            .padding(top = 6.dp)
            .clip(RoundedCornerShape(12.dp))
            .border(1.dp, colors.line, RoundedCornerShape(12.dp))
            .background(colors.card)
            .graphicsLayer { alpha = pressAlpha }
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BasicText(value, style = SettingsBody.copy(color = colors.ink), modifier = Modifier.weight(1f))
        SettingsDownChevron(colors)
    }
}

@Composable
private fun SettingsDownChevron(colors: SettingsColors) {
    androidx.compose.foundation.Canvas(Modifier.size(16.dp)) {
        val path = androidx.compose.ui.graphics.Path().apply {
            moveTo(3.5.dp.toPx(), 6.dp.toPx())
            lineTo(8.dp.toPx(), 10.5.dp.toPx())
            lineTo(12.5.dp.toPx(), 6.dp.toPx())
        }
        drawPath(
            path = path,
            color = colors.ink,
            style = androidx.compose.ui.graphics.drawscope.Stroke(width = 1.6.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round),
        )
    }
}

@Composable
private fun SettingsDivider(colors: SettingsColors, top: androidx.compose.ui.unit.Dp = SettingsMetrics.dividerTop, bottom: androidx.compose.ui.unit.Dp = SettingsMetrics.dividerBottom) {
    Spacer(Modifier.height(top))
    Box(Modifier.fillMaxWidth().height(SettingsMetrics.divider).background(colors.line))
    Spacer(Modifier.height(bottom))
}

@Composable
private fun SettingsRowButton(title: String, subtitle: String?, colors: SettingsColors, danger: Boolean = false, showDivider: Boolean = false, status: String? = null, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val pressAlpha by animateFloatAsState(if (pressed) 0.78f else 1f, tween(90), label = "settings-row-press")
    Row(Modifier.fillMaxWidth().graphicsLayer { alpha = pressAlpha }.clickable(interactionSource = interaction, indication = null, onClick = onClick).padding(horizontal = 2.dp, vertical = 15.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        // `.row-btn .row-sub` is inline in the WebView (only switch-row
        // subtitles are block-level). Keeping this as one baseline prevents
        // the backup/export rows from becoming taller than the source.
        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
            // The original WebView danger rows do not use a destructive color;
            // they remain the same ink as other navigation rows.
            BasicText(title, style = SettingsRowTitle.copy(color = colors.ink))
            if (!subtitle.isNullOrBlank()) BasicText(subtitle, style = SettingsCaption.copy(color = colors.tertiary), modifier = Modifier.padding(start = 8.dp), maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (!status.isNullOrBlank()) BasicText(status, style = SettingsCaption.copy(color = colors.secondary), modifier = Modifier.padding(start = 8.dp), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        SettingsChevron(colors, modifier = Modifier.padding(start = 10.dp))
    }
    if (showDivider) SettingsDivider(colors, top = 0.dp, bottom = 0.dp)
}

@Composable
private fun SettingsControlActionRow(title: String, colors: SettingsColors, onClick: () -> Unit) {
    // Mirrors `.settings-control-action`: a separated, compact action only
    // appears after encryption is enabled; it is not a second data card.
    SettingsDivider(colors, top = 14.dp, bottom = 0.dp)
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val pressAlpha by animateFloatAsState(if (pressed) 0.78f else 1f, tween(90), label = "settings-control-press")
    Row(
        Modifier
            .fillMaxWidth()
            .graphicsLayer { alpha = pressAlpha }
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .padding(start = 2.dp, top = 12.dp, end = 2.dp, bottom = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // WebView .row-btn uses the shared 14px row title.  Using the body
        // token here made “修改口令” visibly smaller than the other setting
        // action titles in the same card.
        BasicText(title, style = SettingsRowTitle.copy(color = colors.ink))
        SettingsChevron(colors)
    }
}

@Composable
private fun LiveTestBlock(data: NativeSettingsData, colors: SettingsColors, onTest: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(top = 22.dp)) {
        SettingsDivider(colors, top = 0.dp, bottom = 16.dp)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
            Column(Modifier.weight(1f)) {
                BasicText("测试通知", style = NativeTypography.style(NativeTypography.Role.SettingsSectionTitle, colors.secondary))
                BasicText("支持的设备会显示为实况通知，其他设备使用普通通知。", style = SettingsCaption.copy(color = colors.tertiary), modifier = Modifier.padding(top = 5.dp))
            }
            val badgeColor = when (data.liveBadgeState) {
                "ready" -> colors.sage
                "warn", "loading" -> colors.accentDeep
                else -> colors.tertiary
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(
                    Modifier
                        .size(6.dp)
                        .clip(RoundedCornerShape(50))
                        .background(badgeColor),
                )
                BasicText(data.liveBadgeText, style = SettingsCaption.copy(color = badgeColor, fontWeight = FontWeight.SemiBold))
            }
        }
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 42.dp)
                .padding(top = 14.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(colors.soft)
                .border(1.dp, colors.line, RoundedCornerShape(999.dp))
                .clickable(interactionSource = MutableInteractionSource(), indication = null, onClick = onTest)
                .padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            BasicText("测试通知", style = NativeTypography.style(NativeTypography.Role.SettingsSectionTitle, colors.ink))
        }
        val hasStructuredResult = data.liveSystem.isNotBlank() || data.livePermission.isNotBlank() || data.liveDisplay.isNotBlank()
        if (data.liveResultText.isNotBlank() || hasStructuredResult) {
            SettingsDivider(colors, top = 12.dp, bottom = 0.dp)
            Column(Modifier.fillMaxWidth().padding(top = 10.dp)) {
                if (hasStructuredResult) {
                    LiveResultRow("系统", data.liveSystem, colors)
                    LiveResultRow("通知权限", data.livePermission, colors)
                    LiveResultRow("显示方式", data.liveDisplay, colors)
                } else {
                    // Older snapshots only had the combined WebView status text.
                    // Keep it readable without inventing empty structured rows.
                    LiveResultRow("系统", data.liveResultText, colors)
                }
            }
        }
    }
}

@Composable
private fun LiveResultRow(label: String, value: String, colors: SettingsColors) {
    Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        val resultStyle = NativeTypography.style(NativeTypography.Role.SettingsSecondary, Color.Unspecified).copy(fontSize = 12.sp, lineHeight = 18.sp)
        BasicText(label, style = resultStyle.copy(color = colors.tertiary))
        val shown = value.ifBlank { "—" }
        val isOk = shown.contains("支持") || shown.contains("允许") || shown.contains("成功")
        val isWarn = shown.contains("不支持") || shown.contains("失败") || shown.contains("拒绝") || shown.contains("未授权")
        BasicText(
            shown,
            style = resultStyle.copy(
                color = when {
                    isOk -> colors.sage
                    isWarn -> colors.accentDeep
                    else -> colors.secondary
                },
                fontWeight = if (isOk || isWarn) FontWeight.SemiBold else FontWeight.Normal,
            ),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun AiSettingsCard(
    data: NativeSettingsData,
    colors: SettingsColors,
    editing: Boolean,
    baseUrl: String,
    model: String,
    apiKey: String,
    onBaseUrlChange: (String) -> Unit,
    onModelChange: (String) -> Unit,
    onApiKeyChange: (String) -> Unit,
    onProvider: (String) -> Unit,
    onEdit: () -> Unit,
    onSave: () -> Unit,
    onTest: () -> Unit,
    onDataScope: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .shadow(2.dp, RoundedCornerShape(SettingsMetrics.cardRadius), clip = false)
            .clip(RoundedCornerShape(SettingsMetrics.cardRadius))
            .background(colors.card)
            .padding(horizontal = SettingsMetrics.cardPadding, vertical = SettingsMetrics.aiCardPaddingVertical),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            BasicText("AI 设置", style = NativeTypography.style(NativeTypography.Role.SettingsCardTitle, colors.ink).copy(lineHeight = 22.sp))
            Box(Modifier.padding(start = 8.dp).size(6.dp).clip(RoundedCornerShape(50)).background(if (data.aiConfigured) colors.sage else colors.tertiary))
            BasicText(if (data.aiConfigured) "已配置" else "未配置", style = SettingsCaption.copy(color = if (data.aiConfigured) colors.sage else colors.tertiary, fontWeight = FontWeight.Medium), modifier = Modifier.padding(start = 6.dp))
        }

        BasicText("AI 可选增强 · 不影响本地洞察", style = SettingsSecondary.copy(color = colors.secondary), modifier = Modifier.padding(top = 7.dp))
        BasicText("提供商", style = NativeTypography.style(NativeTypography.Role.SettingsSectionTitle, colors.ink), modifier = Modifier.padding(top = 24.dp, bottom = 11.dp))
        SettingsSegment(listOf("DeepSeek", "OpenAI", "自定义"), when (data.provider) { "openai" -> 1; "custom" -> 2; else -> 0 }, colors, "AI 提供商") { onProvider(listOf("deepseek", "openai", "custom")[it]) }
        if (editing || !data.hasApiKey) {
            SettingsField("Base URL", baseUrl, colors, false, onBaseUrlChange)
            SettingsField("模型", model, colors, false, onModelChange)
            SettingsApiKeyField(apiKey, colors, onApiKeyChange, onSave)
        } else {
            Row(Modifier.fillMaxWidth().padding(top = 18.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                    // The WebView saved row uses a plain summary; the only
                    // status dot belongs beside the card title above.
                    BasicText("${data.providerLabel} · ${data.model.ifBlank { "未设置模型" }}", style = SettingsBody.copy(color = colors.secondary, fontWeight = FontWeight.SemiBold), maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Spacer(Modifier.width(12.dp))
                Row(Modifier.clip(RoundedCornerShape(12.dp)).border(1.dp, colors.line, RoundedCornerShape(12.dp)).clickable(interactionSource = MutableInteractionSource(), indication = null, onClick = onEdit).padding(horizontal = 14.dp, vertical = 10.dp)) { BasicText("编辑", style = SettingsCaption.copy(color = colors.secondary, fontWeight = FontWeight.SemiBold)) }
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 24.dp).clip(RoundedCornerShape(999.dp)).background(colors.accent).clickable(interactionSource = MutableInteractionSource(), indication = null, onClick = onTest).padding(vertical = 14.dp), horizontalArrangement = Arrangement.Center) {
            BasicText("测试连接", style = NativeTypography.style(NativeTypography.Role.SettingsButton, Color.White))
        }
        BasicText(data.aiTestStatus, style = SettingsCaption.copy(color = colors.tertiary), modifier = Modifier.padding(top = 10.dp))
        SettingsDivider(colors, top = 24.dp, bottom = 0.dp)
        SettingsInlineRowButton("数据范围", "仅发送脱敏聚合统计", colors, onClick = onDataScope)
    }
}

@Composable
private fun SettingsApiKeyField(value: String, colors: SettingsColors, onValueChange: (String) -> Unit, onSave: () -> Unit) {
    BasicText("API 密钥", style = NativeTypography.style(NativeTypography.Role.SettingsSectionTitle, colors.ink), modifier = Modifier.padding(top = 24.dp, bottom = 11.dp))
    Row(Modifier.fillMaxWidth().padding(top = 0.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            textStyle = NativeTypography.style(NativeTypography.Role.SettingsInput, colors.ink),
            visualTransformation = PasswordVisualTransformation(),
            decorationBox = { inner ->
                Box(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 9.dp)) {
                    if (value.isBlank()) BasicText("已保存的密钥（留空保持不变）", style = SettingsSecondary.copy(color = colors.tertiary), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    inner()
                }
            },
            modifier = Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).border(1.dp, colors.line, RoundedCornerShape(12.dp)).background(colors.card),
        )
        Row(Modifier.clip(RoundedCornerShape(12.dp)).border(1.dp, colors.line, RoundedCornerShape(12.dp)).clickable(interactionSource = MutableInteractionSource(), indication = null, onClick = onSave).padding(horizontal = 20.dp, vertical = 9.dp)) {
            BasicText("保存", style = SettingsBody.copy(color = colors.secondary, fontWeight = FontWeight.SemiBold))
        }
    }
}

@Composable
private fun SettingsInlineRowButton(title: String, subtitle: String, colors: SettingsColors, onClick: () -> Unit) {
    val interaction = remember { MutableInteractionSource() }
    val pressed by interaction.collectIsPressedAsState()
    val pressAlpha by animateFloatAsState(if (pressed) 0.78f else 1f, tween(90), label = "settings-inline-press")
    Row(Modifier.fillMaxWidth().graphicsLayer { alpha = pressAlpha }.clickable(interactionSource = interaction, indication = null, onClick = onClick).padding(horizontal = 2.dp, vertical = 15.dp), verticalAlignment = Alignment.CenterVertically) {
        Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
            BasicText(title, style = SettingsBody.copy(color = colors.ink))
            BasicText(subtitle, style = SettingsCaption.copy(color = colors.tertiary), modifier = Modifier.padding(start = 8.dp), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        SettingsChevron(colors, modifier = Modifier.padding(start = 10.dp))
    }
}

@Composable
private fun SettingsChevron(colors: SettingsColors, modifier: Modifier = Modifier, tint: Color = colors.ink) {
    androidx.compose.foundation.Canvas(modifier.size(16.dp)) {
        rotate(-90f) {
            val path = androidx.compose.ui.graphics.Path().apply {
                moveTo(4.dp.toPx(), 6.dp.toPx())
                lineTo(8.dp.toPx(), 10.dp.toPx())
                lineTo(12.dp.toPx(), 6.dp.toPx())
            }
            drawPath(
                path = path,
                color = tint,
                style = androidx.compose.ui.graphics.drawscope.Stroke(width = 1.6.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round),
            )
        }
    }
}

@Composable
private fun SettingsField(label: String, value: String, colors: SettingsColors, password: Boolean, onValueChange: (String) -> Unit) {
    BasicText(label, style = NativeTypography.style(NativeTypography.Role.SettingsSectionTitle, colors.ink), modifier = Modifier.padding(top = 24.dp, bottom = 11.dp))
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        singleLine = true,
        textStyle = NativeTypography.style(NativeTypography.Role.SettingsInput, colors.ink),
        visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).border(1.dp, colors.line, RoundedCornerShape(12.dp)).background(colors.card).padding(horizontal = 12.dp, vertical = 11.dp),
    )
}

@Composable
private fun AboutCard(data: NativeSettingsData, colors: SettingsColors, onOpenLicenses: () -> Unit) {
    val logoInteraction = remember { MutableInteractionSource() }
    Column(Modifier.fillMaxWidth().shadow(2.dp, RoundedCornerShape(SettingsMetrics.cardRadius), clip = false).clip(RoundedCornerShape(SettingsMetrics.cardRadius)).background(colors.card).padding(horizontal = 18.dp, vertical = 28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier
                .size(52.dp)
                .shadow(4.dp, RoundedCornerShape(14.dp), clip = false)
                .clip(RoundedCornerShape(14.dp))
                .clickable(
                    interactionSource = logoInteraction,
                    indication = null,
                    role = Role.Button,
                    onClick = onOpenLicenses,
                )
                .semantics {
                    contentDescription = "观己应用图标，点击查看开源软件许可"
                    role = Role.Button
                },
            contentAlignment = Alignment.Center,
        ) {
            NativeBrandIcon()
        }
        BasicText("观己", style = NativeTypography.style(NativeTypography.Role.SettingsAboutTitle, colors.ink), modifier = Modifier.padding(top = 12.dp))
        BasicText(
            "v${data.version} · 点击图标查看开源许可",
            modifier = Modifier.fillMaxWidth().padding(top = 5.dp),
            style = SettingsCaption.copy(color = colors.tertiary, textAlign = TextAlign.Center),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        SettingsPrivacyItem("记录默认只保存在这台设备上；WebDAV 备份由你自选，上传的是密文（仅你的口令可解）", colors, top = 18.dp)
        SettingsPrivacyItem("AI 分析时，仅上传聚合后的统计特征（每周次数、时段分布等），不会上传单条记录", colors, top = 14.dp)
    }
}

/**
 * #278 follow-up：关于卡片必须复用项目当前 01-C 图标资源，不能在 Compose
 * 中凭印象重画第二套几何。这里使用由 WebView `guanji-icon-01c.svg` 转录的
 * `guanji_icon_01c` vector drawable，和启动器的白色圆角外壳/交叉玻璃切片
 * 保持同一构图；不直接解码 API 26 AdaptiveIconDrawable，避免设备差异。
 */
@Composable
private fun NativeBrandIcon() {
    Image(
        painter = painterResource(id = R.drawable.guanji_icon_01c),
        contentDescription = null,
        contentScale = ContentScale.FillBounds,
        modifier = Modifier.size(52.dp),
    )
}

@Composable
private fun SettingsPrivacyItem(text: String, colors: SettingsColors, top: androidx.compose.ui.unit.Dp) {
    Row(Modifier.fillMaxWidth().padding(top = top), horizontalArrangement = Arrangement.Start, verticalAlignment = Alignment.Top) {
        Box(Modifier.padding(top = 7.dp).size(7.dp).clip(RoundedCornerShape(50)).background(colors.sage))
        BasicText(text, style = NativeTypography.style(NativeTypography.Role.SettingsAboutBody, colors.secondary), modifier = Modifier.padding(start = 10.dp))
    }
}
