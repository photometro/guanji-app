package com.guanji.app

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.animation.animateContentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.animation.core.tween

/**
 * #279：导出、清除和演示数据恢复的原生任务面板。
 *
 * 这三个任务只负责确认与状态反馈；实际数据读写仍由
 * `__guanjiNativeDataMaintenanceAction` 复用 WebView 的既有实现。
 * Sheet 的视觉基座直接复用备份与恢复的 Native 颜色、圆角、Header、
 * module、footer、safe-bottom 和遮罩规则，避免出现第二套 Material/Dialog 风格。
 */
@Composable
fun NativeDataMaintenanceSurface(
    task: String,
    settingsJson: String?,
    darkTheme: Boolean,
    running: Boolean,
    result: String?,
    windowMetrics: NativeWindowMetrics = NativeWindowMetrics(),
    onAction: (String, String?) -> Unit,
) {
    val settings = remember(settingsJson) { NativeSettingsData.parse(settingsJson) }
    val colors = nativeBackupColors(darkTheme)
    var clearServer by remember(task, settings.canClearServer) { mutableStateOf(false) }
    val safeBottomDp = windowMetrics.navigationBarDp
    val sheetMaxHeight = windowMetrics.sheetMax(720.dp, floor = 240.dp)
    val title = when (task) {
        "export" -> "导出数据"
        "clear" -> "清除全部数据"
        else -> "恢复演示数据"
    }
    // Restore status is a title accessory, not a second content line. This
    // keeps the header height stable while the action state changes.
    val titleStatus = when (task) {
        "restore" -> result.takeIf { !it.isNullOrBlank() }
        // The dangerous-operation row and header are quiet by default. Only
        // a completed action may add a short-lived success acknowledgement.
        "clear" -> result?.takeIf { it == "已清理" }
        else -> null
    }
    val overlayInteractionSource = remember { MutableInteractionSource() }
    val motion = rememberNativeSettingsSheetMotion(task) {
        onAction("cancel", null)
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = NativeSettingsSheetMotion.scrimAlpha * motion.progress.coerceIn(0f, 1f)))
            // Consume taps at the Native modal boundary. Disabling clickable
            // would let touches fall through to the WebView behind the sheet.
            .clickable(
                interactionSource = overlayInteractionSource,
                indication = null,
                onClick = {},
            ),
    ) {
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .wrapContentHeight()
                .heightIn(min = 240.dp, max = sheetMaxHeight)
                .padding(start = 12.dp, end = 12.dp, bottom = 12.dp + safeBottomDp)
                .graphicsLayer {
                    translationY = size.height * (1f - motion.progress)
                    alpha = motion.progress.coerceIn(0f, 1f)
                }
                .animateContentSize(animationSpec = tween(NativeSettingsSheetMotion.contentResizeDurationMs, easing = NativeSettingsSheetMotion.exitEasing))
                .shadow(22.dp, RoundedCornerShape(22.dp))
                .clip(RoundedCornerShape(22.dp))
                .background(colors.card),
        ) {
            NativeSettingsSheetHeader(title, titleStatus, colors) {
                motion.requestClose()
            }
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 20.dp, end = 20.dp, bottom = 18.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                when (task) {
                    "export" -> ExportBody(settings, colors)
                    "clear" -> ClearBody(
                        settings = settings,
                        colors = colors,
                        clearServer = clearServer,
                        onToggleServer = { clearServer = !clearServer },
                    )
                    else -> RestoreBody(colors)
                }
                if (!result.isNullOrBlank() && task == "export") {
                    BasicText(
                        text = result,
                        style = NativeTypography.explicit(colors.secondary, 11.sp, lineHeight = 16.sp),
                    )
                }
            }
            NativeSettingsSheetFooter(
                colors = colors,
                onCancel = { if (!running) motion.requestClose() },
                primaryText = if (running) "正在处理…" else when (task) {
                    "export" -> if (settings.secureMode == "encrypted") "导出加密备份" else "导出 CSV"
                    "clear" -> "清除全部数据"
                    else -> "恢复演示数据"
                },
                primaryEnabled = !running,
                onPrimary = {
                    if (!running) onAction("confirm", if (task == "clear" && clearServer) "server" else "local")
                },
            )
        }
    }
}

@Composable
private fun ExportBody(settings: NativeSettingsData, colors: NativeBackupColors) {
    BasicText(
        text = if (settings.secureMode == "encrypted") "创建一份受当前口令保护、可用于恢复的本机副本。"
        else "创建一份可在表格中查看的 CSV 数据副本。",
        style = NativeTypography.explicit(colors.secondary, 13.sp, lineHeight = 19.sp),
    )
    NativeSettingsSheetModule(colors, modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                Modifier.size(30.dp).clip(RoundedCornerShape(9.dp)).background(colors.accentSoft),
                contentAlignment = Alignment.Center,
            ) { BasicText("▣", style = NativeTypography.explicit(colors.accent, 17.sp)) }
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                BasicText(
                    text = if (settings.secureMode == "encrypted") "加密备份文件" else "CSV 数据副本",
                    style = NativeTypography.explicit(colors.ink, 13.sp, FontWeight.Bold),
                )
                BasicText(
                    text = if (settings.secureMode == "encrypted") "本机文件 · 可从本机恢复" else "本机文件 · 可在表格中查看",
                    modifier = Modifier.padding(top = 5.dp),
                    style = NativeTypography.explicit(colors.secondary, 11.sp, FontWeight.Medium, lineHeight = 16.sp),
                )
            }
        }
    }
}

@Composable
private fun ClearBody(
    settings: NativeSettingsData,
    colors: NativeBackupColors,
    clearServer: Boolean,
    onToggleServer: () -> Unit,
) {
    BasicText(
        text = if (settings.canClearServer) "本机记录将永久删除，且无法找回。服务器备份可选择同时删除。"
        else "所有记录将永久删除，且无法找回。数据只在本机，清除后无法恢复。",
        style = NativeTypography.explicit(colors.secondary, 13.sp, lineHeight = 19.sp),
    )
    if (settings.canClearServer) {
        NativeSettingsSheetModule(colors, modifier = Modifier.fillMaxWidth()) {
            Row(
                modifier = Modifier.fillMaxWidth().clickable(onClick = onToggleServer).padding(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    BasicText("同时删除服务器备份", style = NativeTypography.explicit(colors.ink, 13.sp, FontWeight.Bold))
                    BasicText(
                        "仅在已配置 WebDAV 且处于加密模式时可用",
                        modifier = Modifier.padding(top = 5.dp),
                        style = NativeTypography.explicit(colors.secondary, 11.sp, lineHeight = 16.sp),
                    )
                }
                BasicText(
                    text = if (clearServer) "●" else "○",
                    style = NativeTypography.explicit(
                        if (clearServer) colors.accent else colors.secondary,
                        20.sp,
                        textAlign = TextAlign.Center,
                    ),
                )
            }
        }
    }
}

@Composable
private fun RestoreBody(colors: NativeBackupColors) {
    BasicText(
        text = "将当前记录替换为一组演示数据，用于查看统计、日历和洞悉页面。",
        style = NativeTypography.explicit(colors.secondary, 13.sp, lineHeight = 19.sp),
    )
}
