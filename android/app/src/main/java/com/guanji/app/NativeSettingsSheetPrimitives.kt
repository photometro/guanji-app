package com.guanji.app

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.background
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.collectLatest
import androidx.compose.runtime.snapshotFlow

/**
 * Shared text input for every settings/backup Sheet. The parent owns one
 * vertical scroll container and this field brings itself into that viewport
 * after focus; callers must not add a second offset or ime padding.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun NativeSheetInput(
    placeholder: String,
    colors: NativeBackupColors,
    value: String,
    onChange: (String) -> Unit,
    password: Boolean = false,
    enabled: Boolean = true,
    bringIntoViewOnFocus: Boolean = true,
) {
    val bringIntoView = remember { BringIntoViewRequester() }
    val density = LocalDensity.current
    val imeInsets = WindowInsets.ime
    var focused by remember { mutableStateOf(false) }
    LaunchedEffect(focused, bringIntoViewOnFocus) {
        if (!focused || !bringIntoViewOnFocus) return@LaunchedEffect
        // The sheet's safe clipping boundary is intentional.  Re-run the
        // request after the IME inset settles so the field is scrolled inside
        // that boundary instead of being left half-clipped at its edge.
        snapshotFlow { imeInsets.getBottom(density) }
            .distinctUntilChanged()
            .filter { it > 0 }
            .collectLatest {
                delay(90L)
                runCatching { bringIntoView.bringIntoView() }
                delay(120L)
                runCatching { bringIntoView.bringIntoView() }
            }
    }
    Box(
        Modifier
            .fillMaxWidth()
            // Attach the requester to the complete field container, not only
            // the BasicTextField text node. This prevents the field chrome
            // from remaining outside the visible sheet viewport.
            .bringIntoViewRequester(bringIntoView)
    ) {
        BasicTextField(
            value = value,
            onValueChange = onChange,
            enabled = enabled,
            singleLine = true,
            visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
            textStyle = NativeTypography.style(NativeTypography.Role.SettingsInput, colors.ink).copy(fontSize = 11.sp, lineHeight = 17.sp),
            modifier = Modifier
                .fillMaxWidth()
                .onFocusChanged { focused = it.isFocused }
                .clip(RoundedCornerShape(9.dp))
                .background(colors.elevated)
                .padding(12.dp),
            decorationBox = { inner ->
                Box(Modifier.fillMaxWidth()) {
                    if (value.isBlank() && placeholder.isNotBlank()) BasicText(placeholder, style = NativeTypography.style(NativeTypography.Role.SettingsCaption, colors.secondary).copy(lineHeight = 17.sp))
                    inner()
                }
            },
        )
    }
}

internal object NativeSettingsSheetMotion {
    const val enterDurationMs = 550
    const val exitDurationMs = 300
    const val closeDelayMs = 320L
    val enterEasing = CubicBezierEasing(.34f, 1.56f, .64f, 1f)
    val exitEasing = CubicBezierEasing(.33f, 1f, .68f, 1f)
    val contentResizeDurationMs = 220
    // Stable breathing room between the last input/module and the fixed
    // footer. This belongs inside the scroll viewport so the footer remains
    // fixed while the field never visually hugs the sheet edge.
    val inputFooterGap = 28.dp
    const val scrimAlpha = .40f
}

internal class NativeSettingsSheetMotionState(
    val progress: Float,
    val closing: Boolean,
    val requestClose: () -> Unit,
)

/**
 * One motion contract for backup/recovery and the three maintenance sheets.
 * The owner remains mounted during exit so the underlying Tab never toggles
 * visibility and the sheet can reveal it continuously after the scrim fades.
 */
@Composable
internal fun rememberNativeSettingsSheetMotion(
    instanceKey: Any?,
    onClosed: () -> Unit,
): NativeSettingsSheetMotionState {
    var appeared by androidx.compose.runtime.remember(instanceKey) { androidx.compose.runtime.mutableStateOf(false) }
    var closing by androidx.compose.runtime.remember(instanceKey) { androidx.compose.runtime.mutableStateOf(false) }
    val progress by animateFloatAsState(
        targetValue = if (closing) 0f else if (appeared) 1f else 0f,
        animationSpec = if (closing) {
            tween(NativeSettingsSheetMotion.exitDurationMs, easing = NativeSettingsSheetMotion.exitEasing)
        } else {
            tween(NativeSettingsSheetMotion.enterDurationMs, easing = NativeSettingsSheetMotion.enterEasing)
        },
        label = "settings-sheet-motion",
    )
    LaunchedEffect(instanceKey) {
        appeared = true
    }
    LaunchedEffect(closing) {
        if (closing) {
            delay(NativeSettingsSheetMotion.closeDelayMs)
            onClosed()
        }
    }
    return NativeSettingsSheetMotionState(
        progress = progress,
        closing = closing,
        requestClose = { if (!closing) closing = true },
    )
}

/**
 * Shared visual primitives for the classic Native settings sheets.
 *
 * The values intentionally come from the already-verified backup sheet. New
 * task cards must consume these primitives instead of introducing a second
 * Material/Dialog visual language.
 */
@Composable
internal fun NativeSettingsSheetHeader(
    title: String,
    status: String? = null,
    colors: NativeBackupColors,
    onClose: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(20.dp, 20.dp, 20.dp, 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            modifier = Modifier.weight(1f),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Start,
        ) {
            BasicText(
                text = title,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                style = NativeTypography.style(NativeTypography.Role.BackupSheetTitle, colors.ink),
            )
            if (!status.isNullOrBlank()) {
                BasicText(
                    text = status,
                    modifier = Modifier.padding(start = 8.dp),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    style = NativeTypography.style(NativeTypography.Role.BackupHeaderStatus, colors.secondary),
                )
            }
        }
        BackupCloseButton(colors, onClose)
    }
}

@Composable
internal fun NativeSettingsSheetModule(
    colors: NativeBackupColors,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(modifier.then(backupModule(colors, 15.dp))) { content() }
}

@Composable
internal fun NativeSettingsSheetFooter(
    colors: NativeBackupColors,
    onCancel: () -> Unit,
    primaryText: String,
    primaryEnabled: Boolean,
    onPrimary: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .drawBehind { drawLine(colors.line, Offset(0f, 0f), Offset(size.width, 0f), strokeWidth = 1.dp.toPx()) }
            .background(colors.card)
            .padding(start = 20.dp, top = 14.dp, end = 20.dp, bottom = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        BackupFooterButton("取消", false, colors, onCancel)
        BackupFooterButton(primaryText, true, colors, onPrimary, enabled = primaryEnabled)
    }
}
