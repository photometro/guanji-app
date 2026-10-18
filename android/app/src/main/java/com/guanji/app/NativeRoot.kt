package com.guanji.app

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.os.Build
import android.view.View
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import android.widget.FrameLayout
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.compose.ui.unit.dp
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import kotlin.math.roundToInt

/**
 * #273：唯一的 Compose 根宿主。
 *
 * 迁移期允许把尚未迁移的 WebView 放在 legacyRegion，把已验收的原生区域
 * 放在 nativeRegion；两个区域不能在同一职责范围内重叠拥有内容。默认隐藏
 * nativeRegion，保证 v4.1.5 的 WebView 首屏和交互完全不变。
 */
class NativeRoot(context: Context) : FrameLayout(context) {
    companion object {
        const val TAG_VALUE = "guanji-native-root-v2"
    }

    val legacyRegion: FrameLayout = FrameLayout(context).apply {
        tag = "guanji-legacy-webview-region"
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
    }

    /** 迁移期每个职责只允许一个控制器实例；这些控制器不渲染 UI。 */
    val routeHost = RouteHost()
    val bottomTabs = GuanjiBottomTabs(routeHost)
    val sheetHost = SheetHost()

    val nativeRegion: ComposeView = ComposeView(context).apply {
        tag = "guanji-native-region"
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        visibility = View.GONE
        // The Compose surface owns the actual theme background.  Keeping the
        // host transparent prevents the fixed splash/window background from
        // leaking through when a native route switches to dark mode.
        setBackgroundColor(android.graphics.Color.TRANSPARENT)
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
        setContent { NativeRegionSurface() }
    }

    /** #274：同一 NativeRoot 内的原生 Tab 区域。正文仍由 legacyRegion 的 WebView 所有。 */
    val nativeTabBackdropRegion: NativeTabBackdropView = NativeTabBackdropView(context).apply {
        tag = "guanji-native-tab-backdrop-region"
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, dp(58)).apply {
            gravity = android.view.Gravity.BOTTOM
            leftMargin = dp(12)
            rightMargin = dp(12)
            bottomMargin = dp(18)
        }
        visibility = View.GONE
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        clipToOutline = true
        outlineProvider = object : ViewOutlineProvider() {
            override fun getOutline(view: View, outline: android.graphics.Outline) {
                outline.setRoundRect(0, 0, view.width, view.height, dp(26).toFloat())
            }
        }
    }

    val nativeTabRegion: ComposeView = ComposeView(context).apply {
        tag = "guanji-native-tab-region"
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, dp(58)).apply {
            gravity = android.view.Gravity.BOTTOM
            leftMargin = dp(12)
            rightMargin = dp(12)
            bottomMargin = dp(18)
        }
        visibility = View.GONE
        // ComposeView 只承载内部圆角 Tab，宿主本身不得绘制矩形底色。
        setBackgroundColor(android.graphics.Color.TRANSPARENT)
        // Android View 层也要裁剪到同一胶囊轮廓。Compose 的 clip 只约束
        // Compose 内容，无法阻止宿主/硬件层在圆角外留下矩形背景。
        clipToOutline = true
        // Compose 的 shadow 会被宿主边界裁掉；用同一胶囊 outline 提供
        // Android View 层阴影，确保经典 Tab 与正文有稳定层级。
        elevation = dp(10).toFloat()
        outlineProvider = object : ViewOutlineProvider() {
            override fun getOutline(view: View, outline: android.graphics.Outline) {
                outline.setRoundRect(0, 0, view.width, view.height, dp(26).toFloat())
            }
        }
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
    }

    private val selectedTab = mutableStateOf(GuanjiRoute.HOME)
    private val darkTheme = mutableStateOf(false)
    private val liquidGlass = mutableStateOf(false)
    private val blurPx = mutableStateOf(3f)
    private val saturate = mutableStateOf(2f)
    private val nativeHomeSnapshot = mutableStateOf("")
    /** #278：设置页只接收脱敏的 UI 状态快照；不包含 API 密钥或口令。 */
    private val nativeSettingsSnapshot = mutableStateOf("")
    /** #279：备份/恢复只接收可渲染的文件与连接状态；协议仍由 WebView 持有。 */
    private val nativeBackupContext = mutableStateOf<String?>(null)
    /** #279：三个数据维护动作共用一个原生任务面板；数据执行仍回到 JS 适配器。 */
    private val nativeDataMaintenanceTask = mutableStateOf<String?>(null)
    private val nativeDataMaintenanceRunning = mutableStateOf(false)
    private val nativeDataMaintenanceResult = mutableStateOf<String?>(null)
    private val nativeDataMaintenanceSettings = mutableStateOf<String?>(null)
    private val nativeDataMaintenanceStatus = mutableStateOf<String?>(null)
    /** #279 follow-up: row-level operation feedback is transient, not persisted. */
    private val nativeClearDataFeedback = mutableStateOf<String?>(null)
    /** #279 follow-up: restore engine status stays inside the backup sheet. */
    private val nativeBackupRestoreRunning = mutableStateOf(false)
    private val nativeBackupRestoreResult = mutableStateOf<String?>(null)
    /** #279：encrypted -> plain confirmation remains Native; JS only executes the existing owner. */
    private val nativeSecureModeVisible = mutableStateOf(false)
    private val nativeSecureModeRunning = mutableStateOf(false)
    private val nativeSecureModeResult = mutableStateOf<String?>(null)
    private val nativeSecureEnableVisible = mutableStateOf(false)
    private val nativeSecureEnableRunning = mutableStateOf(false)
    private val nativeSecureEnableResult = mutableStateOf<String?>(null)
    /** #280 P0: secure-change is a Native sheet; JS only owns the key rotation. */
    private val nativeSecureChangeVisible = mutableStateOf(false)
    private val nativeSecureChangeRunning = mutableStateOf(false)
    private val nativeSecureChangeResult = mutableStateOf<String?>(null)
    /** #280 P0: AI data-scope explanation stays in the NativeRoot. */
    private val nativeDataScopeVisible = mutableStateOf(false)
    /** #280 VC3 closeout: packaged OSS license texts are readable from My > App intro. */
    private val nativeOpenSourceLicensesVisible = mutableStateOf(false)
    /** #280 P1：所有 Native Surface 只消费这一份窗口度量。 */
    private val windowMetrics = mutableStateOf(NativeWindowMetrics())
    /** #276：记录/补记/编辑/计时统一由 NativeRoot 承载，避免新增 Activity 或第二套 Sheet。 */
    private val nativeRecordContext = mutableStateOf<String?>(null)
    /**
     * 弹层所有权门禁：记录 Sheet、日历 Sheet 或沉浸式计时打开时，底部
     * Tab 不能重新获得交互所有权。视觉节点仍保留在同一宿主中；记录/日历
     * 的经典 WebView 基线由 Sheet 覆盖 Tab 的重叠区域，因此 Native 只切断输入，
     * 不把 Tab 设为 GONE，也不让异步主题/路由回调改变它的视觉位置。
     */
    /**
     * 弹层所有权按来源拆分：日历可以作为记录 Sheet 的来源页继续留在
     * NativeRoot 下方。不能用一个“最后关闭的弹层”布尔值推断全部关闭，
     * 否则从日历进入补记后记录退出会错误地恢复底部 Tab。
     */
    private val nativeCalendarVisible = mutableStateOf(false)
    private val nativeModalVisible = mutableStateOf(false)
    /** NativeRoute 可见时，唯一 Tab 与页面、遮罩和 Sheet 在同一 Compose 树中。 */
    private val nativeInlineTabVisible = mutableStateOf(false)
    /** 记录 Sheet 退场期间保留宿主和首页，动画结束后再提交关闭。 */
    private val nativeRecordClosing = mutableStateOf(false)
    /** #274 修复：首次收到 WebView 主题/材质事实前不显示原生 Tab，避免错误浅色层闪现。 */
    private var nativeTabThemeReady = false
    private var nativeTabRequestedVisible = false
    private var nativeRouteRequested = false
    private var nativeHomeSuppressed = false
    private var onNativeHomeAction: NativeHomeActionListener? = null
    private var onNativeRecordAction: NativeHomeActionListener? = null

    /**
     * #278：迁移探针宿主。记录/日历不再在此全屏 ComposeView 绘制，
     * 而是在 nativeRegion 的同一渲染树中合成；这样 Tab 保持常驻，
     * 关闭弹层时不会触发 Tab 宿主的显示/隐藏动画。
     */
    val nativeModalRegion: ComposeView = ComposeView(context).apply {
        tag = "guanji-native-modal-region"
        layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        visibility = View.GONE
        setBackgroundColor(android.graphics.Color.TRANSPARENT)
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        isClickable = false
        isFocusable = false
        // 必须高于 Tab，但不能改变基础页面宿主的层级。
        // Child order already places this host after the Tab host. Avoid an
        // elevated full-screen RenderNode: on some Android GPU paths it can
        // become an opaque surface and erase the page underneath the scrim.
        elevation = 0f
        // Compose's hardware canvas may clear a full-screen transparent host on
        // a few OEM GPU paths. A software layer preserves SRC-over alpha so
        // the page underneath the modal remains visible.
        setLayerType(View.LAYER_TYPE_SOFTWARE, null)
        translationZ = 0f
        setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
    }

    init {
        tag = TAG_VALUE
        clipChildren = false
        clipToPadding = false
        setBackgroundColor(android.graphics.Color.TRANSPARENT)
        addView(legacyRegion)
        addView(nativeRegion)
        addView(nativeTabRegion)
        nativeTabRegion.setContent {
            if (!nativeInlineTabVisible.value) {
                NativeBottomTabs(
                    selectedRoute = selectedTab.value,
                    darkTheme = darkTheme.value,
                    liquidGlass = liquidGlass.value,
                    blurCssPx = blurPx.value,
                    enabled = !nativeModalVisible.value,
                    onSelect = ::selectNativeTab
                )
            }
        }
        nativeRegion.setContent {
            // NativeRoute 的固定绘制顺序：页面 → 唯一 Tab → 遮罩/Sheet。
            // 弹层生命周期只改变最后一层，不改变 Tab 的宿主、visibility 或 Z。
            Box(Modifier.fillMaxSize()) {
                NativeRegionSurface()
                if (nativeInlineTabVisible.value) {
                    val metrics = windowMetrics.value
                    Box(
                        Modifier
                            .align(Alignment.BottomCenter)
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp)
                            .padding(bottom = 18.dp + metrics.navigationBarDp)
                    ) {
                        NativeBottomTabs(
                            selectedRoute = selectedTab.value,
                            darkTheme = darkTheme.value,
                            liquidGlass = liquidGlass.value,
                            blurCssPx = blurPx.value,
                            enabled = !nativeModalVisible.value,
                            onSelect = ::selectNativeTab
                        )
                    }
                }
                if (nativeModalVisible.value) NativeModalSurface()
            }
        }
        addView(nativeModalRegion)
        // 保留 #278 的标签作为迁移探针，但不再让它承担渲染职责。
        // 弹层内容由 nativeRegion 同树绘制，避免第二个全屏 ComposeView 遮挡首页。
        nativeModalRegion.setContent { }
        // setContent installs the AndroidComposeView implementation; clear any
        // theme-provided drawable again afterwards so this full-screen host is
        // a true transparent overlay rather than an opaque F2F2F7 canvas.
        nativeModalRegion.background = null
        nativeModalRegion.setBackgroundColor(android.graphics.Color.TRANSPARENT)
        ViewCompat.setImportantForAccessibility(this, ViewCompat.IMPORTANT_FOR_ACCESSIBILITY_YES)
        ViewCompat.setOnApplyWindowInsetsListener(this) { _, insets ->
            updateNativeWindowMetrics(insets)
            val navigationBottom = windowMetrics.value.navigationBarPx
            val lp = nativeTabRegion.layoutParams as LayoutParams
            val desiredBottom = dp(18) + navigationBottom
            if (lp.bottomMargin != desiredBottom) {
                lp.bottomMargin = desiredBottom
                nativeTabRegion.layoutParams = lp
            }
            val backdropLp = nativeTabBackdropRegion.layoutParams as LayoutParams
            if (backdropLp.bottomMargin != desiredBottom) {
                backdropLp.bottomMargin = desiredBottom
                nativeTabBackdropRegion.layoutParams = backdropLp
            }
            insets
        }
        ViewCompat.requestApplyInsets(this)
        nativeTabBackdropRegion.sourceView = legacyRegion
        addView(nativeTabBackdropRegion, 2)
    }

    /** Convert all system/window values once at the single Root owner. */
    private fun updateNativeWindowMetrics(insets: androidx.core.view.WindowInsetsCompat) {
        val density = resources.displayMetrics.density.coerceAtLeast(0.1f)
        val nav = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom
        val status = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
        val ime = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
        val widthPx = width.takeIf { it > 0 } ?: resources.displayMetrics.widthPixels
        val heightPx = height.takeIf { it > 0 } ?: resources.displayMetrics.heightPixels
        val usableHeightPx = (heightPx - status - maxOf(nav, ime)).coerceAtLeast(0)
        val next = NativeWindowMetrics(
            widthDp = (widthPx / density).dp,
            heightDp = (heightPx / density).dp,
            availableHeightDp = (usableHeightPx / density).dp,
            statusBarDp = (status / density).dp,
            navigationBarDp = (nav / density).dp,
            imeDp = (ime / density).dp,
            widthPx = widthPx,
            heightPx = heightPx,
            statusBarPx = status,
            navigationBarPx = nav,
            imePx = ime,
            fontScale = resources.configuration.fontScale,
        )
        if (windowMetrics.value != next) windowMetrics.value = next
    }

    fun attachLegacyContent(view: View) {
        (view.parent as? ViewGroup)?.removeView(view)
        if (view.parent !== legacyRegion) {
            legacyRegion.addView(view, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
        }
    }

    /** #275：调试构建下请求首页 NativeRoute；玻璃模式和其他 Tab 会自动回到 WebView。 */
    fun setNativeRegionVisible(visible: Boolean) {
        nativeRouteRequested = visible
        applyNativeContentVisibility()
    }

    fun setNativeHomeSnapshot(snapshot: String?) {
        nativeHomeSnapshot.value = snapshot.orEmpty()
    }

    fun setNativeSettingsSnapshot(snapshot: String?) {
        nativeSettingsSnapshot.value = snapshot.orEmpty()
        nativeDataMaintenanceSettings.value = snapshot.orEmpty()
    }

    fun openNativeDataMaintenance(task: String) {
        if (task !in listOf("export", "clear", "restore")) return
        // A new visit consumes the previous row-level acknowledgement. The
        // feedback is not a persisted setting and must not reappear forever.
        if (task == "clear") nativeClearDataFeedback.value = null
        if (task == "restore") nativeDataMaintenanceStatus.value = null
        nativeDataMaintenanceTask.value = task
        nativeDataMaintenanceResult.value = null
        nativeDataMaintenanceRunning.value = false
        nativeDataMaintenanceSettings.value = nativeSettingsSnapshot.value
        refreshNativeModalVisibility()
        applyNativeContentVisibility()
    }

    fun openNativeSecureMode() {
        nativeSecureModeVisible.value = true
        nativeSecureModeRunning.value = false
        nativeSecureModeResult.value = null
        refreshNativeModalVisibility()
        applyNativeContentVisibility()
    }

    fun openNativeSecureEnable() {
        nativeSecureEnableVisible.value = true
        nativeSecureEnableRunning.value = false
        nativeSecureEnableResult.value = null
        refreshNativeModalVisibility()
        applyNativeContentVisibility()
    }

    fun openNativeSecureChange() {
        nativeSecureChangeVisible.value = true
        nativeSecureChangeRunning.value = false
        nativeSecureChangeResult.value = null
        refreshNativeModalVisibility()
        applyNativeContentVisibility()
    }

    fun setNativeSecureChangeRunning(running: Boolean) {
        nativeSecureChangeRunning.value = running
        refreshNativeModalVisibility()
    }

    fun setNativeSecureChangeResult(result: String?) {
        nativeSecureChangeResult.value = result
        nativeSecureChangeRunning.value = false
        refreshNativeModalVisibility()
    }

    fun clearNativeSecureChange() {
        nativeSecureChangeVisible.value = false
        nativeSecureChangeRunning.value = false
        nativeSecureChangeResult.value = null
        refreshNativeModalVisibility()
        applyNativeContentVisibility()
    }

    fun hasNativeSecureChange(): Boolean = nativeSecureChangeVisible.value

    fun openNativeDataScope() {
        nativeDataScopeVisible.value = true
        refreshNativeModalVisibility()
        applyNativeContentVisibility()
    }

    fun clearNativeDataScope() {
        nativeDataScopeVisible.value = false
        refreshNativeModalVisibility()
        applyNativeContentVisibility()
    }

    fun hasNativeDataScope(): Boolean = nativeDataScopeVisible.value

    fun openNativeOpenSourceLicenses() {
        nativeOpenSourceLicensesVisible.value = true
        refreshNativeModalVisibility()
        applyNativeContentVisibility()
    }

    fun clearNativeOpenSourceLicenses() {
        nativeOpenSourceLicensesVisible.value = false
        refreshNativeModalVisibility()
        applyNativeContentVisibility()
    }

    fun hasNativeOpenSourceLicenses(): Boolean = nativeOpenSourceLicensesVisible.value

    fun setNativeSecureEnableRunning(running: Boolean) {
        nativeSecureEnableRunning.value = running
        refreshNativeModalVisibility()
    }

    fun setNativeSecureEnableResult(result: String?) {
        nativeSecureEnableResult.value = result
        nativeSecureEnableRunning.value = false
        refreshNativeModalVisibility()
    }

    fun clearNativeSecureEnable() {
        nativeSecureEnableVisible.value = false
        nativeSecureEnableRunning.value = false
        nativeSecureEnableResult.value = null
        refreshNativeModalVisibility()
        applyNativeContentVisibility()
    }

    fun hasNativeSecureEnable(): Boolean = nativeSecureEnableVisible.value

    fun setNativeSecureModeRunning(running: Boolean) {
        nativeSecureModeRunning.value = running
        refreshNativeModalVisibility()
    }

    fun setNativeSecureModeResult(result: String?) {
        nativeSecureModeResult.value = result
        nativeSecureModeRunning.value = false
        refreshNativeModalVisibility()
    }

    fun clearNativeSecureMode() {
        nativeSecureModeVisible.value = false
        nativeSecureModeRunning.value = false
        nativeSecureModeResult.value = null
        refreshNativeModalVisibility()
        applyNativeContentVisibility()
    }

    fun hasNativeSecureMode(): Boolean = nativeSecureModeVisible.value

    fun setNativeDataMaintenanceRunning(running: Boolean) {
        nativeDataMaintenanceRunning.value = running
        refreshNativeModalVisibility()
    }

    fun setNativeDataMaintenanceResult(result: String?) {
        nativeDataMaintenanceResult.value = result
        nativeDataMaintenanceRunning.value = false
        refreshNativeModalVisibility()
    }

    fun setNativeBackupRestoreRunning(running: Boolean) {
        nativeBackupRestoreRunning.value = running
    }

    fun setNativeBackupRestoreResult(result: String?) {
        nativeBackupRestoreResult.value = result
        nativeBackupRestoreRunning.value = false
    }

    fun setNativeDataMaintenanceStatus(status: String?) {
        nativeDataMaintenanceStatus.value = status
    }

    fun setNativeClearDataFeedback(status: String?) {
        nativeClearDataFeedback.value = status
    }

    fun clearNativeDataMaintenance() {
        nativeDataMaintenanceTask.value = null
        nativeDataMaintenanceRunning.value = false
        nativeDataMaintenanceResult.value = null
        refreshNativeModalVisibility()
        applyNativeContentVisibility()
    }

    fun hasNativeDataMaintenanceTask(): Boolean = nativeDataMaintenanceTask.value != null

    fun setNativeBackupContext(contextJson: String?) {
        nativeBackupContext.value = contextJson
        if (contextJson == null) {
            nativeBackupRestoreRunning.value = false
            nativeBackupRestoreResult.value = null
        }
        refreshNativeModalVisibility()
        applyNativeContentVisibility()
    }

    fun clearNativeBackupContext() {
        nativeBackupContext.value = null
        refreshNativeModalVisibility()
        applyNativeContentVisibility()
    }

    fun hasNativeBackupContext(): Boolean = nativeBackupContext.value != null

    fun setNativeHomeActionListener(listener: NativeHomeActionListener?) {
        onNativeHomeAction = listener
    }

    fun setNativeRecordActionListener(listener: NativeHomeActionListener?) {
        onNativeRecordAction = listener
    }

    fun setNativeRecordContext(contextJson: String?) {
        nativeRecordClosing.value = false
        nativeRecordContext.value = contextJson
        refreshNativeModalVisibility()
        nativeHomeSuppressed = false
        applyNativeContentVisibility()
    }

    fun clearNativeRecordContext() {
        nativeRecordClosing.value = false
        nativeRecordContext.value = null
        refreshNativeModalVisibility()
        applyNativeContentVisibility()
    }

    fun hasNativeRecordContext(): Boolean = nativeRecordContext.value != null

    fun hasNativeCalendarContext(): Boolean = nativeCalendarVisible.value

    fun requestNativeRecordClose() {
        if (nativeRecordContext.value != null) nativeRecordClosing.value = true
    }

    /** 打开记录/编辑等 WebView Sheet 前暂时让出正文所有权，避免双层点击。 */
    fun setNativeHomeSuppressed(suppressed: Boolean) {
        nativeHomeSuppressed = suppressed
        applyNativeContentVisibility()
    }

    /**
     * 设置首页内 Sheet 的宿主层级。该状态独立于 Tab 的“请求可见”状态，
     * 用于在日历/记录弹层期间保留 Tab 的可见节点并切断其交互。
     */
    fun setNativeModalVisible(visible: Boolean) {
        // 兼容旧调用方；新的日历入口应使用 setNativeCalendarVisible，
        // 记录入口由 setNativeRecordContext 自动持有所有权。
        nativeModalVisible.value = visible || nativeCalendarVisible.value || nativeRecordContext.value != null || nativeDataMaintenanceTask.value != null || nativeSecureModeVisible.value || nativeSecureEnableVisible.value || nativeSecureChangeVisible.value || nativeDataScopeVisible.value || nativeOpenSourceLicensesVisible.value
        // Native modal backdrop is drawn across the full edge-to-edge root. Keep
        // the system bars transparent while it is active so the scrim also
        // covers the status/navigation regions instead of leaving opaque bands.
        syncSystemBars(darkTheme.value)
        applyNativeTabVisibility()
    }

    fun setNativeCalendarVisible(visible: Boolean) {
        nativeCalendarVisible.value = visible
        refreshNativeModalVisibility()
    }

    private fun refreshNativeModalVisibility() {
        nativeModalVisible.value = nativeCalendarVisible.value || nativeRecordContext.value != null || nativeBackupContext.value != null || nativeDataMaintenanceTask.value != null || nativeSecureModeVisible.value || nativeSecureEnableVisible.value || nativeSecureChangeVisible.value || nativeDataScopeVisible.value || nativeOpenSourceLicensesVisible.value
        // Re-apply bar transparency whenever a modal owner is added/removed;
        // otherwise OEMs with gesture navigation retain the previous opaque
        // top/bottom surface color until the next theme update.
        syncSystemBars(darkTheme.value)
        applyNativeTabVisibility()
    }

    private var onNativeTabSelected: ((String) -> Unit)? = null

    fun setNativeTabSelection(routeKey: String) {
        val route = bottomTabs.routes.firstOrNull { it.key == routeKey } ?: return
        selectNativeTab(route, notifyWebView = false)
        if (route == GuanjiRoute.HOME) nativeHomeSuppressed = false
        applyNativeContentVisibility()
        nativeTabBackdropRegion.refreshFromSource()
    }

    private fun selectNativeTab(route: GuanjiRoute, notifyWebView: Boolean = true) {
        selectedTab.value = route
        bottomTabs.select(bottomTabs.routes.indexOf(route))
        if (notifyWebView) onNativeTabSelected?.invoke(route.key)
    }

    fun setNativeTabTheme(
        isDark: Boolean,
        isLiquidGlass: Boolean,
        blurCssPx: Float = 3f,
        saturation: Float = 2f,
        reducedTransparency: Boolean = false
    ) {
        // WebView 的 data-theme 不会触发 Android 的 uiMode 重建，因此不能依赖
        // values-night：透明的原生 Tab 宿主必须显式跟随同一主题背景，否则深色
        // 页面会在底部透出浅色矩形。
        legacyRegion.setBackgroundColor(
            if (isDark) android.graphics.Color.rgb(18, 18, 18)
            else android.graphics.Color.rgb(242, 242, 247)
        )
        setBackgroundColor(
            if (isDark) android.graphics.Color.rgb(18, 18, 18)
            else android.graphics.Color.rgb(242, 242, 247)
        )
        syncSystemBars(isDark)
        darkTheme.value = isDark
        liquidGlass.value = isLiquidGlass
        blurPx.value = if (reducedTransparency) 0f else blurCssPx.coerceIn(0f, 10f)
        saturate.value = if (reducedTransparency) 1f else saturation.coerceIn(1f, 3f)
        nativeTabBackdropRegion.updateMaterial(
            dark = isDark,
            glass = isLiquidGlass,
            blur = blurPx.value,
            saturation = saturate.value
        )
        nativeTabThemeReady = true
        applyNativeTabVisibility()
        applyNativeContentVisibility()
        nativeTabBackdropRegion.refreshFromSource()
    }

    /**
     * WebView themes are CSS state, not Android uiMode state.  Consequently
     * the system bars do not receive a values-night update automatically.  The
     * native surfaces and both system bars must be switched from the same
     * `onMaterialChanged` fact, otherwise a dark page is framed by a light
     * status/navigation band (especially visible on gesture-navigation OEMs).
     *
     * MainActivity owns one edge-to-edge window on every supported API/OEM.
     * NativeRoot only synchronizes icon contrast here.  The bars stay
     * transparent so the actual page/scrim surface reaches the physical
     * display edges instead of being replaced by two opaque color bands.
     */
    private fun syncSystemBars(isDark: Boolean) {
        val activity = resolveActivity(context) ?: return
        activity.window.statusBarColor = android.graphics.Color.TRANSPARENT
        activity.window.navigationBarColor = android.graphics.Color.TRANSPARENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            activity.window.navigationBarDividerColor = android.graphics.Color.TRANSPARENT
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Do not let the platform add a contrasting light scrim over the
            // dark navigation surface on gesture-navigation devices.
            activity.window.isNavigationBarContrastEnforced = false
        }
        WindowInsetsControllerCompat(activity.window, activity.window.decorView).apply {
            isAppearanceLightStatusBars = !isDark
            isAppearanceLightNavigationBars = !isDark
        }
    }

    private fun resolveActivity(source: Context): Activity? {
        var current: Context = source
        while (current is ContextWrapper) {
            if (current is Activity) return current
            val base = current.baseContext
            if (base === current) break
            current = base
        }
        return current as? Activity
    }

    fun setNativeTabVisible(visible: Boolean, onSelect: ((String) -> Unit)? = null) {
        // #278：弹层期间的旧 false 请求只代表“暂时不要交互”，不能改写
        // NativeRoute 的常驻 Tab 所有权。否则记录/日历关闭后会遗留隐藏状态。
        if (visible || !nativeModalVisible.value) {
            nativeTabRequestedVisible = visible
        }
        if (onSelect != null) onNativeTabSelected = onSelect
        applyNativeTabVisibility()
    }

    private fun applyNativeTabVisibility() {
        // #274 scope boundary: only the classic/native tab is migrated in this
        // phase. Glass remains owned by the WebView until its later migration.
        // #278 收尾：Native 弹层不再把 Tab 从视觉树移除。记录/日历 Sheet
        // 通过更高 Z 覆盖 Tab 的重叠区域，因此这里只把输入/无障碍所有权
        // 让给前景弹层。
        // 记录入口不再发送 setNativeTabVisible(false)；即使其他旧调用方仍发送，
        // modalActive 也只负责保留节点，不改变 Sheet 高于 Tab 的绘制层级。
        val modalActive = nativeModalVisible.value
        // NativeRoute 接管经典页面后，Tab 的“存在”由路由所有权决定；
        // requestedVisible 只作为迁移期兼容请求，不能让旧的 false 回调
        // 在弹层关闭后把唯一 Tab 留在 GONE。
        val visible = nativeTabThemeReady && !liquidGlass.value &&
            (nativeRouteRequested || nativeTabRequestedVisible || modalActive)
        // 背景采样层只为后续玻璃迁移保留；经典模式使用不透明 Tab，
        // 不额外叠加采样层，避免出现白色接缝或正文分割线透出。
        nativeTabBackdropRegion.visibility = if (visible && liquidGlass.value) View.VISIBLE else View.GONE
        nativeTabBackdropRegion.importantForAccessibility =
            IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        nativeTabRegion.importantForAccessibility =
            if (visible && !modalActive) IMPORTANT_FOR_ACCESSIBILITY_YES
            else IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        // NativeRoute 中 Tab 已经位于 nativeRegion 的同一 Compose 树；独立
        // Android Tab 宿主只服务仍由 WebView 承载的迁移状态。二者不会同时显示。
        val inline = visible && nativeRegion.visibility == View.VISIBLE
        nativeInlineTabVisible.value = inline
        nativeTabRegion.visibility = if (visible && !inline) View.VISIBLE else View.GONE
        nativeTabRegion.isClickable = visible && !inline && !modalActive
        nativeTabRegion.isFocusable = visible && !inline && !modalActive
        // 页面宿主层级在弹层打开、关闭全过程保持不变；同树中的绘制顺序
        // 自然保证 Sheet 覆盖 Tab，并在退场时连续露出底层 Tab。
        nativeRegion.elevation = 0f
        nativeRegion.translationZ = 0f
        nativeTabRegion.elevation = dp(10).toFloat()
        nativeTabRegion.translationZ = 0f
        applyNativeModalVisibility()
    }

    private fun applyNativeModalVisibility() {
        val active = nativeModalVisible.value
        // #278：弹层已并入 nativeRegion 的同一 Compose 树；这个旧宿主只
        // 保留为不可见迁移探针，避免第二个全屏 ComposeView 清除底层页面。
        nativeModalRegion.visibility = View.GONE
        nativeModalRegion.importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        nativeModalRegion.isClickable = false
        nativeModalRegion.isFocusable = false
        nativeModalRegion.elevation = 0f
        nativeModalRegion.translationZ = 0f
    }

    fun refreshNativeTabBackdrop() {
        nativeTabBackdropRegion.refreshFromSource()
    }

    private fun applyNativeContentVisibility() {
        // #275：同一职责只保留一个可见 owner。经典首页由 NativeRoute 接管，
        // 玻璃/其他 Tab/未启用时 WebView 继续可见；WebView 同时从点击和无障碍树退出。
        val showNativeRoute = nativeRouteRequested && nativeTabThemeReady &&
            !liquidGlass.value && selectedTab.value in setOf(GuanjiRoute.HOME, GuanjiRoute.INSIGHT, GuanjiRoute.SETTINGS) && !nativeHomeSuppressed
        nativeRegion.visibility = if (showNativeRoute) View.VISIBLE else View.GONE
        nativeRegion.importantForAccessibility = if (showNativeRoute) IMPORTANT_FOR_ACCESSIBILITY_YES else IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        legacyRegion.visibility = if (showNativeRoute) View.GONE else View.VISIBLE
        legacyRegion.importantForAccessibility = if (showNativeRoute) IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS else IMPORTANT_FOR_ACCESSIBILITY_YES
        applyNativeTabVisibility()
    }

    private fun dispatchNativeHomeAction(action: String, value: String? = null) {
        onNativeHomeAction?.onAction(action, value)
    }

    private fun dispatchNativeRecordAction(action: String, value: String? = null) {
        onNativeRecordAction?.onAction(action, value)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).roundToInt()

    @Composable
    private fun NativeRegionSurface() {
        // 这里渲染路由页面；记录/日历弹层在 nativeRegion 的同一 Compose
        // 树中由调用方紧随其后绘制，保证遮罩直接覆盖当前页面而不是清空底层。
        // The route surface is deliberately full-display.  Home/Insight keep
        // their measured WebView top spacing; Settings and full-screen record
        // states consume the shared status inset where their own contracts
        // require it.  A global top padding would double-consume the bar only
        // on older non-enforced OEM windows (the Meizu 18s regression).
        Box(Modifier.fillMaxSize()) {
            when (selectedTab.value) {
                GuanjiRoute.INSIGHT -> NativeInsightSurface(
                    snapshotJson = nativeHomeSnapshot.value,
                    darkTheme = darkTheme.value,
                    windowMetrics = windowMetrics.value,
                    onConfigureAI = { dispatchNativeHomeAction("insight-configure") },
                    onGenerateAI = { dispatchNativeHomeAction("insight-generate") },
                    onAskQuestion = { question -> dispatchNativeHomeAction("insight-ask", question) },
                )
                GuanjiRoute.SETTINGS -> NativeSettingsSurface(
                    snapshotJson = nativeSettingsSnapshot.value,
                    darkTheme = darkTheme.value,
                    windowMetrics = windowMetrics.value,
                    clearFeedback = nativeClearDataFeedback.value,
                    maintenanceStatus = nativeDataMaintenanceStatus.value,
                    onAction = { action, value -> dispatchNativeHomeAction("settings-$action", value) },
                )
                else -> NativeHomeSurface(
                    snapshotJson = nativeHomeSnapshot.value,
                    darkTheme = darkTheme.value,
                    windowMetrics = windowMetrics.value,
                    // 先锁定弹层宿主，再让 Surface 切换局部状态，避免首帧
                    // 仍把 Tab 当成可交互前景层。
                    onCalendar = {
                        setNativeCalendarVisible(true)
                        dispatchNativeHomeAction("calendar-open")
                    },
                    onRecord = {
                        setNativeModalVisible(true)
                        dispatchNativeHomeAction("record")
                    },
                    onEdit = { dispatchNativeHomeAction("edit", it) },
                    onDelete = { dispatchNativeHomeAction("delete", it) },
                    onCalendarEdit = { dispatchNativeHomeAction("edit", it) },
                    onCalendarDelete = { dispatchNativeHomeAction("delete", it) },
                    onCalendarAdd = { dispatchNativeHomeAction("backfill", it.toString()) },
                    onCalendarClose = { dispatchNativeHomeAction("calendar-close") }
                )
            }
        }
    }

    @Composable
    private fun NativeModalSurface() {
        val recordContext = nativeRecordContext.value
        val calendarVisible = nativeCalendarVisible.value
        val data = remember(nativeHomeSnapshot.value) {
            NativeHomeData.parse(nativeHomeSnapshot.value)
        }
        Box(Modifier.fillMaxSize().background(androidx.compose.ui.graphics.Color.Transparent)) {
            if (calendarVisible) {
                NativeCalendarSheet(
                    data = data,
                    darkTheme = darkTheme.value,
                    windowMetrics = windowMetrics.value,
                    onClose = {
                        setNativeCalendarVisible(false)
                        dispatchNativeHomeAction("calendar-close")
                    },
                    onEdit = { dispatchNativeHomeAction("edit", it) },
                    onDelete = { dispatchNativeHomeAction("delete", it) },
                    onAdd = { dispatchNativeHomeAction("backfill", it.toString()) }
                )
            }
            if (recordContext != null) {
                NativeRecordSurface(
                    contextJson = recordContext,
                    darkTheme = darkTheme.value,
                    closing = nativeRecordClosing.value,
                    windowMetrics = windowMetrics.value,
                    onAction = { action, value -> dispatchNativeRecordAction(action, value) }
                )
            }
            val backupContext = nativeBackupContext.value
            if (backupContext != null) {
                NativeBackupSurface(
                    contextJson = backupContext,
                    darkTheme = darkTheme.value,
                    windowMetrics = windowMetrics.value,
                    restoreRunning = nativeBackupRestoreRunning.value,
                    restoreResult = nativeBackupRestoreResult.value,
                    onAction = { action, value -> dispatchNativeHomeAction("backup-$action", value) }
                )
            }
            val maintenanceTask = nativeDataMaintenanceTask.value
            if (maintenanceTask != null) {
                NativeDataMaintenanceSurface(
                    task = maintenanceTask,
                    settingsJson = nativeDataMaintenanceSettings.value,
                    darkTheme = darkTheme.value,
                    running = nativeDataMaintenanceRunning.value,
                    result = nativeDataMaintenanceResult.value,
                    windowMetrics = windowMetrics.value,
                    onAction = { action, value -> dispatchNativeHomeAction("maintenance-$action", value) },
                )
            }
            if (nativeSecureModeVisible.value) {
                NativeSecureModeSurface(
                    darkTheme = darkTheme.value,
                    running = nativeSecureModeRunning.value,
                    result = nativeSecureModeResult.value,
                    windowMetrics = windowMetrics.value,
                    onAction = { action -> dispatchNativeHomeAction("secure-mode-$action", null) },
                )
            }
            if (nativeSecureEnableVisible.value) {
                NativeSecureEnableSurface(
                    darkTheme = darkTheme.value,
                    running = nativeSecureEnableRunning.value,
                    result = nativeSecureEnableResult.value,
                    windowMetrics = windowMetrics.value,
                    onAction = { action, value -> dispatchNativeHomeAction("secure-enable-$action", value) },
                )
            }
            if (nativeSecureChangeVisible.value) {
                NativeSecureChangeSurface(
                    darkTheme = darkTheme.value,
                    running = nativeSecureChangeRunning.value,
                    result = nativeSecureChangeResult.value,
                    windowMetrics = windowMetrics.value,
                    onAction = { action, value -> dispatchNativeHomeAction("secure-change-$action", value) },
                )
            }
            if (nativeDataScopeVisible.value) {
                NativeDataScopeSurface(
                    darkTheme = darkTheme.value,
                    windowMetrics = windowMetrics.value,
                    onClose = { clearNativeDataScope() },
                )
            }
            if (nativeOpenSourceLicensesVisible.value) {
                NativeOpenSourceLicensesSurface(
                    darkTheme = darkTheme.value,
                    windowMetrics = windowMetrics.value,
                    onClose = { clearNativeOpenSourceLicenses() },
                )
            }
        }
    }
}

fun interface NativeHomeActionListener {
    fun onAction(action: String, value: String?)
}

fun interface NativeTabSelectionListener {
    fun onSelected(routeKey: String)
}
