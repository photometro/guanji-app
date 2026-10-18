package com.guanji.app

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Native confirmation sheet for encrypted -> plain.
 * The existing secureDisable() remains the business owner until #281; this
 * surface owns only confirmation, cancellation and result state.
 */
@Composable
internal fun NativeSecureModeSurface(
    darkTheme: Boolean,
    running: Boolean,
    result: String?,
    windowMetrics: NativeWindowMetrics = NativeWindowMetrics(),
    onAction: (String) -> Unit,
) {
    val colors = nativeBackupColors(darkTheme)
    val safeBottomDp = windowMetrics.navigationBarDp
    val sheetMaxHeight = windowMetrics.sheetMax(520.dp, floor = 240.dp)
    val titleStatus = result.takeIf { !it.isNullOrBlank() }
    val overlayInteractionSource = remember { MutableInteractionSource() }
    val motion = rememberNativeSettingsSheetMotion(Unit) { onAction("cancel") }

    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = NativeSettingsSheetMotion.scrimAlpha * motion.progress.coerceIn(0f, 1f)))
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
                .shadow(22.dp, RoundedCornerShape(22.dp))
                .clip(RoundedCornerShape(22.dp))
                .background(colors.card),
        ) {
            NativeSettingsSheetHeader("关闭加密", titleStatus, colors) {
                if (!running) motion.requestClose()
            }
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 20.dp, end = 20.dp, bottom = 18.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                BasicText(
                    text = "数据将转为明文保存在本机——设备被他人使用或数据泄露时可读性将降低保护。确认关闭？",
                    style = NativeTypography.explicit(colors.secondary, 13.sp, lineHeight = 19.sp),
                )
                NativeSettingsSheetModule(colors, modifier = Modifier.fillMaxWidth()) {
                    BasicText(
                        text = "关闭后，记录仍保留在本机；服务器上的历史备份不会被修改。",
                        modifier = Modifier.padding(14.dp),
                        style = NativeTypography.explicit(colors.ink, 13.sp, FontWeight.Normal, lineHeight = 19.sp),
                    )
                }
            }
            NativeSettingsSheetFooter(
                colors = colors,
                onCancel = { if (!running) motion.requestClose() },
                primaryText = if (running) "正在处理…" else "确认关闭",
                primaryEnabled = !running,
                onPrimary = { if (!running) onAction("confirm") },
            )
        }
    }
}
