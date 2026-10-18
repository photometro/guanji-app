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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
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
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONObject

/**
 * Native plain -> encrypted confirmation.  The JS secureEnable owner is
 * invoked only after both values validate; cancelling never changes the
 * authoritative selector.
 */
@Composable
internal fun NativeSecureEnableSurface(
    darkTheme: Boolean,
    running: Boolean,
    result: String?,
    windowMetrics: NativeWindowMetrics = NativeWindowMetrics(),
    onAction: (String, String?) -> Unit,
) {
    val colors = nativeBackupColors(darkTheme)
    val safeBottomDp = windowMetrics.navigationBarDp
    // This compact sheet moves as a whole above the keyboard. Unlike the
    // restore sheets, it does not need an IME-shrunken content viewport.
    // Subtract the navigation inset because the sheet already reserves it in
    // its bottom padding.
    val imeShiftDp = (windowMetrics.imeDp - windowMetrics.navigationBarDp).coerceAtLeast(0.dp)
    val sheetMaxHeight = windowMetrics.sheetMax(560.dp, floor = 300.dp)
    val overlayInteractionSource = remember { MutableInteractionSource() }
    val motion = rememberNativeSettingsSheetMotion(Unit) { onAction("cancel", null) }
    var password by remember { mutableStateOf("") }
    var confirmation by remember { mutableStateOf("") }
    var validation by remember { mutableStateOf<String?>(null) }

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
                .heightIn(min = 300.dp, max = sheetMaxHeight)
                .padding(start = 12.dp, end = 12.dp, bottom = 12.dp + safeBottomDp)
                .offset(y = -imeShiftDp)
                .graphicsLayer {
                    translationY = size.height * (1f - motion.progress)
                    alpha = motion.progress.coerceIn(0f, 1f)
                }
                .shadow(22.dp, RoundedCornerShape(22.dp))
                .clip(RoundedCornerShape(22.dp))
                .background(colors.card),
        ) {
            NativeSettingsSheetHeader("开启加密", result, colors) {
                if (!running) motion.requestClose()
            }
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    // The outer sheet keeps the keyboard-safe clipping
                    // boundary. Only this form viewport contracts and
                    // scrolls when IME reduces the available height.
                    .weight(1f, fill = false)
                    // Keep the footer gap inside the scroll content so
                    // bring-into-view never aligns the field against the
                    // footer's clipping edge.
                    .padding(start = 20.dp, end = 20.dp, bottom = NativeSettingsSheetMotion.inputFooterGap)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                BasicText(
                    "设置一个至少 8 位且不为纯数字的口令。口令只保存在你的记忆中，观己无法找回。",
                    style = NativeTypography.explicit(colors.secondary, 13.sp, lineHeight = 19.sp),
                )
                NativeSettingsSheetModule(colors, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        SecureEnableField("设置口令", password, colors, running) { password = it; validation = null }
                        SecureEnableField("再次输入口令", confirmation, colors, running) { confirmation = it; validation = null }
                    }
                }
                if (!validation.isNullOrBlank()) {
                    BasicText(validation!!, style = NativeTypography.explicit(colors.danger, 11.sp, lineHeight = 16.sp))
                }
                BasicText(
                    "开启后，新写入的数据会以密文保存；关闭加密前需要再次确认。",
                    style = NativeTypography.explicit(colors.secondary, 11.sp, lineHeight = 16.sp),
                )
            }
            NativeSettingsSheetFooter(
                colors = colors,
                onCancel = { if (!running) motion.requestClose() },
                primaryText = if (running) "正在处理…" else "确认开启",
                primaryEnabled = !running,
                onPrimary = {
                    if (running) return@NativeSettingsSheetFooter
                    val error = when {
                        password.length < 8 -> "口令至少 8 位"
                        password.matches(Regex("\\d+")) -> "口令不能是纯数字"
                        password != confirmation -> "两次输入的口令不一致"
                        else -> null
                    }
                    if (error != null) validation = error
                    else onAction("confirm", JSONObject().put("password", password).toString())
                },
            )
        }
    }
}

@Composable
private fun SecureEnableField(
    label: String,
    value: String,
    colors: NativeBackupColors,
    disabled: Boolean,
    onValueChange: (String) -> Unit,
) {
    BasicText(label, style = NativeTypography.explicit(colors.ink, 11.sp, FontWeight.SemiBold))
    NativeSheetInput(
        placeholder = "",
        colors = colors,
        value = value,
        onChange = onValueChange,
        password = true,
        enabled = !disabled,
        bringIntoViewOnFocus = false,
    )
}
