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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** #280 P0: Native replacement for the WebView AI data-scope explanation sheet. */
@Composable
internal fun NativeDataScopeSurface(
    darkTheme: Boolean,
    windowMetrics: NativeWindowMetrics = NativeWindowMetrics(),
    onClose: () -> Unit,
) {
    val colors = nativeBackupColors(darkTheme)
    val overlayInteractionSource = remember { MutableInteractionSource() }
    val motion = rememberNativeSettingsSheetMotion(Unit, onClose)
    Box(
        Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = NativeSettingsSheetMotion.scrimAlpha * motion.progress.coerceIn(0f, 1f)))
            .clickable(interactionSource = overlayInteractionSource, indication = null, onClick = {}),
    ) {
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .wrapContentHeight()
                .heightIn(min = 240.dp, max = windowMetrics.sheetMax(460.dp, floor = 240.dp))
                .padding(start = 12.dp, end = 12.dp, bottom = 12.dp + windowMetrics.navigationBarDp)
                .graphicsLayer {
                    translationY = size.height * (1f - motion.progress)
                    alpha = motion.progress.coerceIn(0f, 1f)
                }
                .shadow(22.dp, RoundedCornerShape(22.dp))
                .clip(RoundedCornerShape(22.dp))
                .background(colors.card),
        ) {
            NativeSettingsSheetHeader("AI 数据范围", null, colors) { motion.requestClose() }
            Column(
                modifier = Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, bottom = 18.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                BasicText(
                    "配置 AI 后，观己只发送必要的脱敏聚合统计，用于生成个人洞察。",
                    style = NativeTypography.explicit(colors.secondary, 13.sp, lineHeight = 19.sp),
                )
                NativeSettingsSheetModule(colors, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        NativePrivacyBullet("发送次数、时间段、标签比例和趋势变化等统计信息", colors)
                        NativePrivacyBullet("不发送单条记录、备注、附件或自定义标签原文", colors)
                        NativePrivacyBullet("AI 服务由你选择，费用和服务条款由服务商决定", colors)
                    }
                }
            }
            NativeSettingsSheetFooter(
                colors = colors,
                onCancel = { motion.requestClose() },
                primaryText = "知道了",
                primaryEnabled = true,
                onPrimary = { motion.requestClose() },
            )
        }
    }
}

@Composable
private fun NativePrivacyBullet(text: String, colors: NativeBackupColors) {
    BasicText(text, style = NativeTypography.explicit(colors.ink, 13.sp, lineHeight = 19.sp))
}
