package com.guanji.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RenderEffect
import android.graphics.Shader
import android.os.Build
import android.view.View
import kotlin.math.max

/**
 * #274 material follow-up：给原生 Tab 提供同一 NativeRoot 内 WebView 的背景采样。
 * ComposeView 无法直接读取其下方 WebView 的 backdrop-filter，因此这里仅采样
 * Tab 胶囊对应的 WebView 区域，再交给 RenderEffect 做模糊；文本和交互仍由
 * NativeBottomTabs 绘制。API < 31 使用同主题实底作为安全降级，不阻塞页面。
 */
class NativeTabBackdropView(context: Context) : View(context) {
    var sourceView: View? = null
    var darkTheme: Boolean = false
        private set
    var liquidGlass: Boolean = false
        private set
    var blurCssPx: Float = 3f
        private set
    var saturate: Float = 2f
        private set

    private var bitmap: Bitmap? = null
    private val bitmapPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val drawBounds = Rect()

    init {
        setBackgroundColor(Color.TRANSPARENT)
        isClickable = false
        isFocusable = false
    }

    fun updateMaterial(dark: Boolean, glass: Boolean, blur: Float, saturation: Float) {
        darkTheme = dark
        liquidGlass = glass
        blurCssPx = blur.coerceIn(0f, 10f)
        saturate = saturation.coerceIn(1f, 3f)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val cssBlur = if (glass) blurCssPx else 24f
            val radiusPx = cssBlur * resources.displayMetrics.density
            setRenderEffect(
                if (radiusPx > 0.01f) {
                    RenderEffect.createBlurEffect(radiusPx, radiusPx, Shader.TileMode.CLAMP)
                } else null
            )
        }
        invalidate()
    }

    fun refreshFromSource() {
        if (!isShown || width <= 0 || height <= 0) {
            post { if (isShown) refreshFromSource() }
            return
        }
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawColor(if (darkTheme) Color.rgb(18, 18, 18) else Color.rgb(242, 242, 247))
        val source = sourceView ?: return
        if (!source.isShown || source.width <= 0 || source.height <= 0) return

        val sample = ensureBitmap(width, height)
        sample.eraseColor(Color.TRANSPARENT)
        val sourceLocation = IntArray(2)
        val targetLocation = IntArray(2)
        source.getLocationOnScreen(sourceLocation)
        getLocationOnScreen(targetLocation)
        val sampleCanvas = Canvas(sample)
        sampleCanvas.translate(
            (targetLocation[0] - sourceLocation[0]).toFloat(),
            (targetLocation[1] - sourceLocation[1]).toFloat()
        )
        try {
            source.draw(sampleCanvas)
        } catch (_: Throwable) {
            // 某些 OEM WebView 硬件层暂时不可绘制时保留同主题安全底色。
            return
        }

        bitmapPaint.reset()
        bitmapPaint.isAntiAlias = true
        bitmapPaint.isFilterBitmap = true
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (saturate != 1f) {
                val matrix = ColorMatrix().apply { setSaturation(saturate) }
                bitmapPaint.colorFilter = ColorMatrixColorFilter(matrix)
            }
        }
        drawBounds.set(0, 0, width, height)
        canvas.drawBitmap(sample, null, drawBounds, bitmapPaint)
    }

    override fun onDetachedFromWindow() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) setRenderEffect(null)
        bitmap?.recycle()
        bitmap = null
        super.onDetachedFromWindow()
    }

    private fun ensureBitmap(width: Int, height: Int): Bitmap {
        val current = bitmap
        if (current != null && !current.isRecycled && current.width == width && current.height == height) {
            return current
        }
        current?.recycle()
        return Bitmap.createBitmap(max(1, width), max(1, height), Bitmap.Config.ARGB_8888).also {
            bitmap = it
        }
    }
}
