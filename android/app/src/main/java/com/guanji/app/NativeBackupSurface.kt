package com.guanji.app

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.ContentTransform
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.tween
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.Image
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.BasicText
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import org.json.JSONArray
import org.json.JSONObject

/**
 * #279：备份与恢复经典模式 Surface。
 *
 * 它只负责把 WebView 的已冻结结构渲染成 Compose：真正的文件读写、
 * BackupEnvelope、WebDAV 和恢复协议仍由现有 JS/Capacitor 链执行。
 * 玻璃模式不会进入这里，NativeRoot 会继续让 WebView 唯一承接玻璃面板。
 */
private enum class NativeBackupView(val key: String, val title: String, val subtitle: String) {
    HOME("home", "备份与恢复", ""),
    SOURCE("source", "恢复数据", "选择要恢复的数据来源"),
    LOCAL("local", "从本机文件恢复", "从下载目录或其他位置导入数据"),
    SERVER("server", "从服务器恢复", "选择一份备份恢复到本机"),
    LOCAL_MANAGE("localManage", "本机文件管理", "下载目录中的备份与导出文件"),
    SERVER_MANAGE("serverManage", "服务器备份", "管理服务器上的加密备份"),
    WEBDAV_CONFIG("webdavConfig", "服务器备份", "配置 WebDAV 服务器")
}

private data class NativeBackupFile(
    val name: String,
    val date: String = "",
    val label: String = "加密备份",
    val size: String = ""
)

private data class NativeBackupData(
    val secureMode: String = "plain",
    val webDavConfigured: Boolean = false,
    val autoSync: Boolean = false,
    val syncSummary: String = "开启加密后可用",
    val lastBackup: String = "尚未备份",
    val localFiles: List<NativeBackupFile> = emptyList(),
    val serverFiles: List<NativeBackupFile> = emptyList(),
    val dataState: String = "ready",
    val localFilesState: String = "ready",
    val serverFilesState: String = "ready",
    val webDavUrl: String = "",
    val webDavUser: String = ""
) {
    companion object {
        fun parse(raw: String?): NativeBackupData {
            // The bridge is asynchronous.  A missing snapshot means the data
            // source is still loading, not that the user has no backups.
            if (raw.isNullOrBlank()) return NativeBackupData(
                dataState = "loading",
                localFilesState = "loading",
                serverFilesState = "loading",
            )
            return try {
                val json = JSONObject(raw)
                val hasLocalFiles = json.has("localFiles")
                val hasServerFiles = json.has("serverFiles")
                fun files(key: String): List<NativeBackupFile> {
                    val array = json.optJSONArray(key) ?: JSONArray()
                    return List(array.length()) { i ->
                        val item = array.optJSONObject(i) ?: JSONObject()
                        NativeBackupFile(
                            name = item.optString("name", "备份文件"),
                            date = item.optString("date", ""),
                            label = item.optString("label", "加密备份"),
                            size = item.optString("sizeLabel", "")
                        )
                    }
                }
                NativeBackupData(
                    secureMode = json.optString("secureMode", "plain"),
                    webDavConfigured = json.optBoolean("webDavConfigured", false),
                    autoSync = json.optBoolean("autoSync", false),
                    syncSummary = json.optString("syncSummary", "开启加密后可用"),
                    lastBackup = json.optString("lastBackup", "尚未备份"),
                    localFiles = files("localFiles"),
                    serverFiles = files("serverFiles"),
                    dataState = json.optString("dataState", "ready"),
                    localFilesState = json.optString("localFilesState", if (hasLocalFiles) "ready" else "legacy-unavailable"),
                    serverFilesState = json.optString("serverFilesState", if (hasServerFiles) "ready" else "legacy-unavailable"),
                    webDavUrl = json.optString("webDavUrl", ""),
                    webDavUser = json.optString("webDavUser", "")
                )
            } catch (_: Exception) {
                // Never turn a malformed/failed bridge payload into a false
                // empty state.  The UI must expose a read error and allow a
                // retry through the existing JS bridge.
                NativeBackupData(
                    dataState = "error",
                    localFilesState = "error",
                    serverFilesState = "error",
                )
            }
        }
    }
}

internal data class NativeBackupColors(
    val background: Color,
    val card: Color,
    val elevated: Color,
    val ink: Color,
    val secondary: Color,
    val line: Color,
    val accent: Color,
    val accentSoft: Color,
    val danger: Color
)

internal fun nativeBackupColors(dark: Boolean) = if (dark) NativeBackupColors(
    background = Color(0xFF121212), card = Color(0xFF1E1E1E), elevated = Color(0xFF2C2C2E),
    ink = Color.White, secondary = Color(0xFFB0B0B4), line = Color(0xFF3A3A3C),
    accent = Color(0xFF5BA7FF), accentSoft = Color(0xFF173556), danger = Color(0xFFFF6961)
) else NativeBackupColors(
    background = Color(0xFFF2F2F7), card = Color.White, elevated = Color(0xFFE5E5EA),
    ink = Color.Black, secondary = Color(0xFF6F7180), line = Color(0xFFE5E5EA),
    accent = Color(0xFF007AFF), accentSoft = Color(0xFFE8F1FF), danger = Color(0xFFFF3B30)
)

@Composable
fun NativeBackupSurface(
    contextJson: String?,
    darkTheme: Boolean,
    windowMetrics: NativeWindowMetrics = NativeWindowMetrics(),
    restoreRunning: Boolean = false,
    restoreResult: String? = null,
    onAction: (String, String?) -> Unit
) {
    val data = remember(contextJson) { NativeBackupData.parse(contextJson) }
    val colors = nativeBackupColors(darkTheme)
    // The bridge publishes a loading snapshot first and a ready snapshot
    // shortly afterwards.  Keep the current sheet route while that snapshot
    // changes; keying the route to contextJson would silently jump a user
    // back to the hub whenever a secondary page refreshes its data.
    var view by remember { mutableStateOf(NativeBackupView.HOME) }
    var selectedName by remember { mutableStateOf<String?>(null) }
    var url by remember { mutableStateOf(data.webDavUrl) }
    var user by remember { mutableStateOf(data.webDavUser) }
    var pass by remember { mutableStateOf("") }
    var restorePlan by remember { mutableStateOf("merge") }
    var uploadingBackup by remember { mutableStateOf(false) }
    // Snapshot refreshes must not replay the entrance motion or move the
    // sheet; the surface instance, not the JSON payload, owns its lifecycle.
    val motion = rememberNativeSettingsSheetMotion(Unit) {
        onAction("close", null)
    }
    val navigationBottomDp = windowMetrics.navigationBarDp
    // NativeRoot already subtracts the IME from availableHeightDp. Move the
    // sheet once as a whole instead of applying imePadding a second time.
    // The inner content remains a single vertical viewport and fields use
    // BringIntoView only to scroll within that viewport.
    val imeShiftDp = (windowMetrics.imeDp - navigationBottomDp).coerceAtLeast(0.dp)
    val sheetMaxHeight = windowMetrics.sheetMax(720.dp, floor = 300.dp)

    fun closeAnimated() {
        motion.requestClose()
    }

    LaunchedEffect(uploadingBackup) {
        if (uploadingBackup) {
            // Upload is dispatched to the existing JS/Capacitor owner.  Keep
            // the local action state bounded even if a provider callback is
            // delayed; the sheet itself must never re-enter its initial load.
            delay(1200)
            uploadingBackup = false
        }
    }
    LaunchedEffect(contextJson, view) {
        if (view == NativeBackupView.SERVER && selectedName == null && data.serverFiles.isNotEmpty()) {
            selectedName = data.serverFiles.first().name
        }
        if (view == NativeBackupView.WEBDAV_CONFIG) {
            if (url.isBlank() && data.webDavUrl.isNotBlank()) url = data.webDavUrl
            if (user.isBlank() && data.webDavUser.isNotBlank()) user = data.webDavUser
        }
    }
    fun go(next: NativeBackupView) {
        view = next
        // WebView server restore selects the newest backup by default; local
        // restore intentionally requires an explicit file selection (#176).
        selectedName = if (next == NativeBackupView.SERVER) data.serverFiles.firstOrNull()?.name else null
        // File and server lists are asynchronous WebView/Capacitor snapshots.
        // Refresh at the route boundary so a stale opening snapshot cannot be
        // rendered as an empty or legacy-unavailable list.
        if (next == NativeBackupView.LOCAL || next == NativeBackupView.SERVER ||
            next == NativeBackupView.LOCAL_MANAGE || next == NativeBackupView.SERVER_MANAGE) {
            onAction("refresh", null)
        }
    }
    fun back() {
        view = when (view) {
            NativeBackupView.HOME -> { closeAnimated(); NativeBackupView.HOME }
            NativeBackupView.SOURCE -> NativeBackupView.HOME
            NativeBackupView.LOCAL, NativeBackupView.SERVER -> NativeBackupView.SOURCE
            NativeBackupView.LOCAL_MANAGE, NativeBackupView.SERVER_MANAGE, NativeBackupView.WEBDAV_CONFIG -> NativeBackupView.HOME
        }
    }

    val overlayInteractionSource = remember { MutableInteractionSource() }
    Box(
        Modifier
            .fillMaxSize()
            // Keep the modal layer as an input boundary. Without an explicit
            // consumer, clearing the context from a close click can recompose
            // the underlying settings page during the same pointer dispatch.
            .clickable(
                interactionSource = overlayInteractionSource,
                indication = null,
                onClick = {}
            )
            .background(Color.Black.copy(alpha = NativeSettingsSheetMotion.scrimAlpha * motion.progress.coerceIn(0f, 1f)))
    ) {
        val inputRoute = view == NativeBackupView.LOCAL || view == NativeBackupView.SERVER
        Column(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .wrapContentHeight()
                .heightIn(min = 300.dp, max = sheetMaxHeight)
                // Keep the navigation-bar safe area outside the sheet.  The
                // WebView footer keeps its own button rhythm; putting the
                // inset inside the footer makes the whole sheet grow upward,
                // clips the top of dense pages and changes the button spacing.
                .padding(start = 12.dp, end = 12.dp, bottom = 12.dp + navigationBottomDp)
                .offset(y = -imeShiftDp)
                .graphicsLayer {
                    translationY = size.height * (1f - motion.progress)
                    alpha = motion.progress.coerceIn(0f, 1f)
                }
                .animateContentSize(animationSpec = tween(NativeSettingsSheetMotion.contentResizeDurationMs, easing = NativeSettingsSheetMotion.exitEasing))
                .shadow(22.dp, RoundedCornerShape(22.dp))
                .clip(RoundedCornerShape(22.dp))
                .background(colors.card)
        ) {
            NativeBackupHeader(
                view,
                if (view == NativeBackupView.HOME) data.syncSummary else view.subtitle,
                colors,
                onClose = { closeAnimated() },
            )
            Column(
                Modifier
                    // Keep the outer sheet's IME-aware clipping boundary.
                    // Only this content viewport is allowed to scroll when
                    // the keyboard reduces the available height.
                    // The home route should hug its content so the restore
                    // card does not leave an artificial blank band above the
                    // fixed footer. Input routes keep the flexible viewport.
                    .then(
                        if (view == NativeBackupView.HOME) Modifier.wrapContentHeight()
                        else Modifier.weight(1f, fill = false)
                    )
                    // Keep the footer gap inside the scroll content. If the
                    // padding is applied after verticalScroll it only shrinks
                    // the viewport and the focused field can still hug its
                    // bottom edge.
                    .padding(
                        start = 20.dp,
                        end = 20.dp,
                        top = 0.dp,
                        // The hub has a fixed footer below the restore card.  Keep
                        // only the compact WebView rhythm there; the input routes
                        // retain their larger keyboard-safe scroll tail.
                        bottom = if (inputRoute) NativeSettingsSheetMotion.inputFooterGap else 16.dp,
                    )
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                AnimatedContent(
                    targetState = view,
                    transitionSpec = {
                        // WebView toggles the view in place and animates the
                        // sheet's natural height with transitionSheetHeight;
                        // it does not push the next view horizontally.  Keep
                        // the same direction-neutral fade and let the outer
                        // sheet animateContentSize handle the height change.
                        ContentTransform(fadeIn(tween(120)), fadeOut(tween(100)))
                    },
                    label = "backup-secondary-card-transition",
                ) { currentView ->
                // AnimatedContent owns one content slot. Every backup view
                // must therefore provide one layout root; otherwise a view
                // such as NativeBackupHome emits several top-level nodes that
                // are placed at the same origin and the last node (restore)
                // covers the server/local/upload actions.
                Column(
                    Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    when (currentView) {
                        NativeBackupView.HOME -> NativeBackupHome(data, colors,
                            onServer = { go(if (data.webDavConfigured) NativeBackupView.SERVER_MANAGE else NativeBackupView.WEBDAV_CONFIG) },
                            onAuto = { onAction("auto", if (data.autoSync) "off" else "on") },
                            uploading = uploadingBackup,
                            onUpload = {
                                if (!uploadingBackup) {
                                    uploadingBackup = true
                                    onAction("upload", null)
                                }
                            },
                            onLocalManage = { go(NativeBackupView.LOCAL_MANAGE) },
                            onRestore = { go(NativeBackupView.SOURCE) },
                            onRefresh = { onAction("refresh", null) }
                        )
                        NativeBackupView.SOURCE -> NativeBackupSource(colors,
                            onLocal = { go(NativeBackupView.LOCAL) },
                            onServer = { go(if (data.webDavConfigured) NativeBackupView.SERVER else NativeBackupView.WEBDAV_CONFIG) }
                        )
                        NativeBackupView.LOCAL -> NativeBackupFilePage(data.localFiles, data.localFilesState, false, selectedName, pass, restorePlan, restoreRunning, restoreResult, colors, windowMetrics,
                            onSelect = { selectedName = it }, onBrowse = { onAction("browse-local", null) },
                            onPassword = { pass = it }, onPlan = { restorePlan = it },
                            onConfirm = { onAction("restore-local", JSONObject().put("name", selectedName ?: "").put("password", pass).put("plan", restorePlan).toString()) }
                        )
                        NativeBackupView.SERVER -> NativeBackupFilePage(data.serverFiles, data.serverFilesState, true, selectedName, pass, restorePlan, restoreRunning, restoreResult, colors, windowMetrics,
                            onSelect = { selectedName = it }, onBrowse = null,
                            onPassword = { pass = it }, onPlan = { restorePlan = it },
                            onConfirm = { onAction("restore-server", JSONObject().put("name", selectedName ?: "").put("password", pass).put("plan", restorePlan).toString()) }
                        )
                        NativeBackupView.LOCAL_MANAGE -> NativeBackupManage(data.localFiles, data.localFilesState, false, colors, windowMetrics,
                            onDelete = { onAction("delete-local", it) })
                        NativeBackupView.SERVER_MANAGE -> NativeBackupManage(data.serverFiles, data.serverFilesState, true, colors, windowMetrics,
                            onDelete = { onAction("delete-server", it) })
                        NativeBackupView.WEBDAV_CONFIG -> NativeBackupConfig(url, user, pass, colors,
                            onUrl = { url = it }, onUser = { user = it }, onPass = { pass = it },
                            onSave = { onAction("save-config", JSONObject().put("url", url).put("username", user).put("password", pass).toString()) }
                        )
                    }
                }
                }
            }
            NativeBackupFooter(
                view,
                colors,
                canConfirm = selectedName != null && !restoreRunning,
                topPadding = if (view == NativeBackupView.HOME) 16.dp else 14.dp,
                onBack = { back() },
                onConfirm = {
                    when (view) {
                        NativeBackupView.LOCAL -> onAction("restore-local", JSONObject().put("name", selectedName ?: "").put("password", pass).put("plan", restorePlan).toString())
                        NativeBackupView.SERVER -> onAction("restore-server", JSONObject().put("name", selectedName ?: "").put("password", pass).put("plan", restorePlan).toString())
                        NativeBackupView.WEBDAV_CONFIG -> onAction("save-config", JSONObject().put("url", url).put("username", user).put("password", pass).toString())
                        else -> back()
                    }
                })
        }
    }
}

@Composable
private fun NativeBackupHeader(view: NativeBackupView, subtitle: String, c: NativeBackupColors, onClose: () -> Unit) {
    // WebView .sheet__header uses padding: 20px 20px 16px.  Keep this in the
    // shared header so the hub and every secondary backup card get the same
    // top inset; do not add a handle or a secondary-page back affordance.
    Row(Modifier.fillMaxWidth().padding(20.dp, 20.dp, 20.dp, 16.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            BasicText(view.title, style = NativeTypography.style(NativeTypography.Role.BackupSheetTitle, c.ink))
            // Reserve one stable line for the status copy.  Loading/ready
            // snapshots must not change the sheet's measured header height.
            Box(Modifier.fillMaxWidth().padding(top = 6.dp).height(16.dp)) {
                if (subtitle.isNotBlank()) {
                    BasicText(
                        subtitle,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        style = NativeTypography.style(NativeTypography.Role.BackupHeaderStatus, c.secondary)
                    )
                }
            }
        }
        BackupCloseButton(c, onClose)
    }
}

@Composable
private fun NativeBackupHome(data: NativeBackupData, c: NativeBackupColors, uploading: Boolean, onServer: () -> Unit, onAuto: () -> Unit, onUpload: () -> Unit, onLocalManage: () -> Unit, onRestore: () -> Unit, onRefresh: () -> Unit) {
    BackupSection("同步到服务器", c, topPadding = 0.dp)
    BackupAction("cloud", "服务器备份", if (data.secureMode != "encrypted") "开启加密后可用" else if (data.webDavConfigured) data.syncSummary else "未配置", c, onServer)
    Row(backupModule(c).padding(12.dp, 14.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) { BasicText("自动同步", style = NativeTypography.style(NativeTypography.Role.BackupCardTitle, c.ink)); BasicText("打开或回到 App 时，数据变化后同步", Modifier.padding(top = 5.dp), NativeTypography.style(NativeTypography.Role.BackupBody, c.secondary)) }
        BackupSwitch(data.autoSync, c, onAuto)
    }
    BackupCompact(if (uploading) "上传中…" else "上传新备份", c, onUpload, enabled = !uploading && data.secureMode == "encrypted" && data.webDavConfigured)
    BackupSection("本机文件", c)
    BackupAction("file", "本机文件管理", "查看下载目录中的备份与导出文件", c, onLocalManage)
    BackupSection("恢复", c)
    BackupAction("restore", "恢复数据", "从本机文件或服务器备份恢复", c, onRestore)
    // The initial loading state is intentionally quiet.  It must not add a
    // trailing status line below the restore card or inflate the HOME sheet.
    // An actual read failure remains actionable, but is rendered only when
    // there is something the user needs to fix.
    if (data.dataState == "error") {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            BasicText("备份状态读取失败", Modifier.padding(start = 2.dp).weight(1f), NativeTypography.style(NativeTypography.Role.BackupBody, c.danger), maxLines = 1, overflow = TextOverflow.Ellipsis)
            BackupCompact("重新读取", c, onRefresh)
        }
    }
}

@Composable
private fun NativeBackupSource(c: NativeBackupColors, onLocal: () -> Unit, onServer: () -> Unit) {
    BackupSection("恢复来源", c, topPadding = 0.dp)
    BackupAction("restore", "从本机文件恢复", "下载目录中的备份或导出文件", c, onLocal)
    BackupAction("cloud", "从服务器恢复", "WebDAV 服务器上的备份", c, onServer)
    BasicText("重复的记录不会重复导入。", Modifier.padding(2.dp, 4.dp), NativeTypography.style(NativeTypography.Role.BackupBody, c.secondary))
}

@Composable
private fun NativeBackupFilePage(
    files: List<NativeBackupFile>,
    state: String,
    server: Boolean,
    selected: String?,
    password: String,
    plan: String,
    restoreRunning: Boolean,
    restoreResult: String?,
    c: NativeBackupColors,
    windowMetrics: NativeWindowMetrics,
    onSelect: (String) -> Unit,
    onBrowse: (() -> Unit)?,
    onPassword: (String) -> Unit,
    onPlan: (String) -> Unit,
    onConfirm: () -> Unit,
) {
    BackupSection(if (server) "恢复来源" else "导入文件", c, topPadding = 0.dp)
    if (state == "loading") {
        BackupCard({ Column(Modifier.fillMaxWidth().padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) { BasicText("正在读取…", style = NativeTypography.style(NativeTypography.Role.BackupCaption, c.secondary)) } }, c)
    } else if (state == "error") {
        BackupCard({ Column(Modifier.fillMaxWidth().padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) { BasicText("读取失败，请重新打开。", style = NativeTypography.style(NativeTypography.Role.BackupCaption, c.danger)) } }, c)
    } else if (state == "legacy-unavailable") {
        BackupCard({ Column(Modifier.fillMaxWidth().padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) { BasicText("旧版本数据源暂不可用，请重新打开。", style = NativeTypography.style(NativeTypography.Role.BackupCaption, c.secondary)) } }, c)
    } else if (files.isEmpty()) {
        BackupCard({ Column(Modifier.fillMaxWidth().padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) { BasicText(if (server) "服务器上没有备份" else "暂无本机备份文件", style = NativeTypography.style(NativeTypography.Role.BackupCaption, c.secondary)) } }, c)
    } else {
        val latest = files.first()
        BackupCard({ Column(Modifier.fillMaxWidth().clickable { onSelect(latest.name) }.padding(15.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) { BackupIcon(if (server) "cloud" else "file", c); Spacer(Modifier.width(9.dp)); Column(Modifier.weight(1f)) { BasicText(if (server) "当前选择备份" else "当前选择文件", style = NativeTypography.style(NativeTypography.Role.BackupCardTitle, c.ink)); BasicText("${latest.date} · ${latest.name}", Modifier.padding(top = 4.dp), NativeTypography.style(NativeTypography.Role.BackupMeta, c.secondary), maxLines = 1, overflow = TextOverflow.Ellipsis) }; BackupBadge(if (selected == latest.name) "已选择" else if (server) "可用" else "文件", c) }
            BasicText("类型  ${latest.label}", Modifier.padding(start = 38.dp, top = 12.dp), NativeTypography.style(NativeTypography.Role.BackupMeta, c.secondary))
        } }, c)
        BackupSection(if (server) "更早备份" else "本机文件", c, suffix = "共 ${files.size - 1} 个")
        Column(Modifier.fillMaxWidth().heightIn(max = windowMetrics.innerListMax(132.dp, 72.dp)).verticalScroll(rememberScrollState()).clip(RoundedCornerShape(14.dp)).background(c.elevated)) {
            files.drop(1).forEach { file ->
                Row(Modifier.fillMaxWidth().clickable { onSelect(file.name) }.padding(11.dp), verticalAlignment = Alignment.CenterVertically) { BackupIcon(if (server) "cloud" else "file", c, small = true); Spacer(Modifier.width(10.dp)); Column(Modifier.weight(1f)) { BasicText(file.name, style = NativeTypography.style(NativeTypography.Role.BackupMeta, c.ink).copy(fontWeight = FontWeight.Bold), maxLines = 1, overflow = TextOverflow.Ellipsis); BasicText("${file.date} · ${file.label}", Modifier.padding(top = 2.dp), NativeTypography.style(NativeTypography.Role.BackupSmall, c.secondary)) }; BasicText(if (selected == file.name) "已选择" else "选择", style = NativeTypography.style(if (selected == file.name) NativeTypography.Role.BackupSelectedOption else NativeTypography.Role.BackupMeta, if (selected == file.name) c.accent else c.secondary)) }
            }
        }
    }
    if (onBrowse != null) BackupCompact("浏览其他位置", c, onBrowse, enabled = !restoreRunning)
    if (server || (selected?.endsWith(".json", ignoreCase = true) == true)) {
        BackupInput("创建该备份时设置的口令", c, password, onPassword, password = true)
    }
    BackupSection("恢复方式", c, topPadding = 14.dp)
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        RestorePlanChip("合并（推荐）", "merge", plan, c, restoreRunning, onPlan)
        RestorePlanChip("新增", "new", plan, c, restoreRunning, onPlan)
        RestorePlanChip("覆盖", "overwrite", plan, c, restoreRunning, onPlan)
    }
    if (!restoreResult.isNullOrBlank()) {
        BasicText(restoreResult, Modifier.padding(top = 8.dp), NativeTypography.style(NativeTypography.Role.BackupBody, c.secondary), maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
    if (restoreRunning) {
        BasicText("正在验证并恢复…", Modifier.padding(top = 6.dp), NativeTypography.style(NativeTypography.Role.BackupBody, c.secondary))
    }
}

@Composable
private fun RowScope.RestorePlanChip(label: String, value: String, selected: String, c: NativeBackupColors, disabled: Boolean, onSelect: (String) -> Unit) {
    Box(
        Modifier.weight(1f).clip(RoundedCornerShape(10.dp))
            .background(if (selected == value) c.accentSoft else c.elevated)
            .border(1.dp, if (selected == value) c.accent.copy(alpha = .5f) else c.line, RoundedCornerShape(10.dp))
            .clickable(enabled = !disabled) { onSelect(value) }
            .padding(horizontal = 7.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) { BasicText(label, style = NativeTypography.style(if (selected == value) NativeTypography.Role.BackupSelectedOption else NativeTypography.Role.BackupMeta, if (selected == value) c.accent else c.secondary), maxLines = 1, overflow = TextOverflow.Ellipsis) }
}

@Composable
private fun NativeBackupManage(files: List<NativeBackupFile>, state: String, server: Boolean, c: NativeBackupColors, windowMetrics: NativeWindowMetrics, onDelete: (String) -> Unit) {
    BasicText(if (server) "已连接 · 最近上传" else "下载目录中的备份与导出文件", Modifier.padding(2.dp), NativeTypography.style(NativeTypography.Role.BackupBody, c.secondary))
    if (state == "loading") BackupCard({ Column(Modifier.fillMaxWidth().padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) { BasicText("正在读取…", style = NativeTypography.style(NativeTypography.Role.BackupCaption, c.secondary)) } }, c)
    else if (state == "error") BackupCard({ Column(Modifier.fillMaxWidth().padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) { BasicText("读取失败，请重新打开。", style = NativeTypography.style(NativeTypography.Role.BackupCaption, c.danger)) } }, c)
    else if (state == "legacy-unavailable") BackupCard({ Column(Modifier.fillMaxWidth().padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) { BasicText("旧版本数据源暂不可用，请重新打开。", style = NativeTypography.style(NativeTypography.Role.BackupCaption, c.secondary)) } }, c)
    else if (files.isEmpty()) BackupCard({ Column(Modifier.fillMaxWidth().padding(18.dp), horizontalAlignment = Alignment.CenterHorizontally) { BasicText(if (server) "服务器上没有备份" else "暂无本机文件", style = NativeTypography.style(NativeTypography.Role.BackupCaption, c.secondary)) } }, c)
    else {
        val latest = files.first()
        BackupCard({ Column(Modifier.fillMaxWidth().padding(15.dp)) { Row(verticalAlignment = Alignment.CenterVertically) { BackupIcon(if (server) "cloud" else "file", c); Spacer(Modifier.width(9.dp)); Column(Modifier.weight(1f)) { BasicText(if (server) "最近一次备份" else "最近本机文件", style = NativeTypography.style(NativeTypography.Role.BackupCardTitle, c.ink)); BasicText("${latest.date} · ${latest.name}", Modifier.padding(top = 4.dp), NativeTypography.style(NativeTypography.Role.BackupMeta, c.secondary), maxLines = 1, overflow = TextOverflow.Ellipsis) } }; BasicText("${if (server) "远端文件" else "本机文件"}  ${files.size} 个", Modifier.padding(start = 38.dp, top = 12.dp), NativeTypography.style(NativeTypography.Role.BackupMeta, c.secondary)) } }, c)
        BackupSection(if (server) "更早备份" else "更早文件", c, suffix = "共 ${files.size - 1} 个")
        Column(Modifier.fillMaxWidth().heightIn(max = windowMetrics.innerListMax(132.dp, 72.dp)).verticalScroll(rememberScrollState()).clip(RoundedCornerShape(14.dp)).background(c.elevated)) { files.drop(1).forEach { file -> Row(Modifier.fillMaxWidth().padding(11.dp), verticalAlignment = Alignment.CenterVertically) { BackupIcon("file", c, small = true); Spacer(Modifier.width(10.dp)); Column(Modifier.weight(1f)) { BasicText(file.name, style = NativeTypography.style(NativeTypography.Role.BackupMeta, c.ink).copy(fontWeight = FontWeight.Bold), maxLines = 1, overflow = TextOverflow.Ellipsis); BasicText("${file.date} · ${file.label}", Modifier.padding(top = 2.dp), NativeTypography.style(NativeTypography.Role.BackupSmall, c.secondary)) }; BackupTextButton("删除", c.danger, 10.sp) { onDelete(file.name) } } } }
    }
}

@Composable
private fun NativeBackupConfig(url: String, user: String, pass: String, c: NativeBackupColors, onUrl: (String) -> Unit, onUser: (String) -> Unit, onPass: (String) -> Unit, onSave: () -> Unit) {
    BackupSection("服务器地址", c)
    BackupInput("服务器地址（https://…/dav/）", c, url, onUrl)
    BackupInput("账号", c, user, onUser)
    BackupInput("应用密码（不是登录密码）", c, pass, onPass, password = true)
    BasicText("密码只保存在本机安全存储中。备份上传的是密文——没有你的口令也无法读取。", Modifier.padding(2.dp, 4.dp), NativeTypography.style(NativeTypography.Role.BackupBody, c.secondary))
}

@Composable
private fun NativeBackupFooter(
    view: NativeBackupView,
    c: NativeBackupColors,
    canConfirm: Boolean,
    topPadding: androidx.compose.ui.unit.Dp = 14.dp,
    onBack: () -> Unit,
    onConfirm: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .drawBehind { drawLine(c.line, Offset(0f, 0f), Offset(size.width, 0f), strokeWidth = 1.dp.toPx()) }
            .background(c.card)
            // Safe-area space belongs to the outer sheet, not to this row.
            // Preserve the WebView button height and vertical rhythm here.
            .padding(start = 20.dp, top = topPadding, end = 20.dp, bottom = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        BackupFooterButton(if (view == NativeBackupView.HOME) "关闭" else "返回", false, c, onBack)
        if (view == NativeBackupView.LOCAL || view == NativeBackupView.SERVER || view == NativeBackupView.WEBDAV_CONFIG) BackupFooterButton(if (view == NativeBackupView.WEBDAV_CONFIG) "保存配置" else if (view == NativeBackupView.SERVER) "恢复到本机" else "导入到本机", true, c, onConfirm, enabled = if (view == NativeBackupView.WEBDAV_CONFIG) true else canConfirm)
    }
}

internal fun backupModule(c: NativeBackupColors, radius: androidx.compose.ui.unit.Dp = 15.dp): Modifier = Modifier
    .shadow(
        elevation = 4.dp,
        shape = RoundedCornerShape(radius),
        clip = false,
        ambientColor = Color.Black.copy(alpha = if (c.card == Color.White) .045f else .38f),
        spotColor = Color.Black.copy(alpha = if (c.card == Color.White) .045f else .38f),
    )
    .border(1.dp, c.line.copy(alpha = .72f), RoundedCornerShape(radius))
    .clip(RoundedCornerShape(radius))
    .background(c.card)

@Composable private fun BackupSection(title: String, c: NativeBackupColors, suffix: String? = null, topPadding: androidx.compose.ui.unit.Dp = 14.dp) {
    Row(Modifier.fillMaxWidth().padding(start = 2.dp, top = topPadding, end = 2.dp, bottom = 9.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        BasicText(title, style = NativeTypography.style(NativeTypography.Role.BackupSectionLabel, c.secondary))
        if (suffix != null) BasicText(suffix, style = NativeTypography.style(NativeTypography.Role.BackupSectionLabel, c.secondary))
    }
}

@Composable private fun BackupAction(icon: String, title: String, subtitle: String, c: NativeBackupColors, onClick: () -> Unit) {
    Row(backupModule(c).clickable(onClick = onClick).padding(14.dp, 15.dp), verticalAlignment = Alignment.CenterVertically) {
        BackupIcon(icon, c)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            BasicText(title, style = NativeTypography.style(NativeTypography.Role.BackupCardTitle, c.ink))
            BasicText(subtitle, Modifier.padding(top = 5.dp), NativeTypography.style(NativeTypography.Role.BackupBody, c.secondary), maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        BasicText("›", style = NativeTypography.style(NativeTypography.Role.BackupClose, c.secondary).copy(fontSize = 19.sp))
    }
}

@Composable private fun BackupCompact(title: String, c: NativeBackupColors, onClick: () -> Unit, enabled: Boolean = true) {
    val tint = c.accent.copy(alpha = if (enabled) 1f else .52f)
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(c.accentSoft.copy(alpha = if (enabled) 1f else .68f))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(11.dp),
        horizontalArrangement = Arrangement.Center,
    ) { BasicText(title, style = NativeTypography.style(NativeTypography.Role.BackupPrimaryButton, tint)) }
}

@Composable private fun BackupCard(content: @Composable () -> Unit, c: NativeBackupColors) {
    Box(backupModule(c, 16.dp)) { content() }
}

@Composable
private fun BackupIcon(label: String, c: NativeBackupColors, small: Boolean = false) {
    val box = if (small) 23.dp else 30.dp
    val resource = when (label) {
        "cloud" -> R.drawable.guanji_backup_cloud
        "restore" -> R.drawable.guanji_backup_restore
        else -> R.drawable.guanji_backup_file
    }
    Box(Modifier.size(box).clip(RoundedCornerShape(if (small) 7.dp else 9.dp)).background(c.accentSoft), contentAlignment = Alignment.Center) {
        Image(
            painter = painterResource(resource),
            contentDescription = null,
            modifier = Modifier.size(if (small) 14.dp else 17.dp),
            colorFilter = ColorFilter.tint(c.accent),
        )
    }
}
@Composable private fun BackupBadge(text: String, c: NativeBackupColors) { Box(Modifier.clip(RoundedCornerShape(99.dp)).background(Color(0xFFDCF6E3)).padding(7.dp, 4.dp)) { BasicText(text, style = NativeTypography.style(NativeTypography.Role.BackupBadge, Color(0xFF219653))) } }
@Composable private fun BackupSwitch(on: Boolean, c: NativeBackupColors, onClick: () -> Unit) { Box(Modifier.size(42.dp, 26.dp).clip(RoundedCornerShape(99.dp)).background(if (on) c.accent else c.line).clickable(onClick = onClick).padding(3.dp), contentAlignment = if (on) Alignment.CenterEnd else Alignment.CenterStart) { Box(Modifier.size(20.dp).clip(RoundedCornerShape(99.dp)).background(Color.White)) } }
@Composable private fun BackupInput(placeholder: String, c: NativeBackupColors, value: String = "", onChange: (String) -> Unit = {}, password: Boolean = false) {
    // The backup sheet owns the single IME-safe outer shift. Keep the field's
    // BringIntoView pass enabled so long restore/config forms scroll the
    // focused field inside that already-safe viewport, without another inset
    // or translation being applied to the sheet itself.
    NativeSheetInput(placeholder, c, value, onChange, password = password, bringIntoViewOnFocus = true)
}
@Composable private fun BackupTextButton(text: String, color: Color, size: androidx.compose.ui.unit.TextUnit, onClick: () -> Unit) { BasicText(text, Modifier.clickable(onClick = onClick).padding(4.dp), NativeTypography.style(NativeTypography.Role.BackupButton, color).copy(fontSize = size)) }
@Composable internal fun BackupCloseButton(c: NativeBackupColors, onClick: () -> Unit) {
    Box(
        Modifier
            .size(29.dp)
            .clip(RoundedCornerShape(50))
            .background(c.elevated)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        BasicText("×", style = NativeTypography.style(NativeTypography.Role.BackupClose, c.secondary))
    }
}
@Composable internal fun RowScope.BackupFooterButton(text: String, primary: Boolean, c: NativeBackupColors, onClick: () -> Unit, enabled: Boolean = true) {
    Box(
        Modifier
            .weight(1f)
            .height(40.dp)
            .clip(RoundedCornerShape(11.dp))
            .background(if (primary && enabled) c.accent else c.elevated)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        val role = if (primary) NativeTypography.Role.BackupPrimaryButton else NativeTypography.Role.BackupFooterSecondaryButton
        BasicText(text, style = NativeTypography.style(role, if (primary && enabled) Color.White else c.ink.copy(alpha = if (enabled) 1f else .4f)))
    }
}
