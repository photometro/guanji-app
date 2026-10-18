package com.guanji.app

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * #280 P1：NativeRoot 的唯一窗口度量契约。
 *
 * 所有数值已经由 Root 从物理 px 转换为 dp；Surface 不再自行解释
 * bottomInset、density 或 IME 的原始整数。保留 px 仅供 View 层更新 Tab
 * 的 layoutParams，Compose 页面只消费对应的 Dp 字段。
 */
data class NativeWindowMetrics(
    val widthDp: Dp = 360.dp,
    val heightDp: Dp = 800.dp,
    val availableHeightDp: Dp = 800.dp,
    val statusBarDp: Dp = 0.dp,
    val navigationBarDp: Dp = 0.dp,
    val imeDp: Dp = 0.dp,
    val widthPx: Int = 0,
    val heightPx: Int = 0,
    val statusBarPx: Int = 0,
    val navigationBarPx: Int = 0,
    val imePx: Int = 0,
    val fontScale: Float = 1f,
) {
    val imeVisible: Boolean get() = imeDp > 0.dp

    /**
     * A bounded max height for a sheet, based on the current usable window.
     *
     * `floatingVerticalGap` is the visual gap outside a floating sheet (the
     * WebView sheet uses 12dp above and below, therefore 24dp in total). It is
     * intentionally optional so existing sheets keep their frozen geometry;
     * only routes whose baseline declares the floating gap should consume it.
     */
    fun sheetMax(
        cap: Dp,
        floor: Dp = 0.dp,
        floatingVerticalGap: Dp = 0.dp,
    ): Dp =
        (availableHeightDp - floatingVerticalGap).coerceAtLeast(floor).coerceAtMost(cap)

    /** A bounded inner scroll viewport that still follows the usable window. */
    fun innerListMax(cap: Dp, floor: Dp): Dp =
        availableHeightDp.coerceAtLeast(floor).coerceAtMost(cap)

}
