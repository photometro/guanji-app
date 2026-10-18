package com.guanji.app

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.BasicText

private val TabBlue = Color(0xFF007AFF)
private val TabBlueDeep = Color(0xFF0062CC)
private val TabLightSecondary = Color(0xFFC7C7CC)
private val TabDarkSecondary = Color(0xFF6E6E73)
private val TabMotion = CubicBezierEasing(0.23f, 1f, 0.32f, 1f)

/**
 * #274：WebView .tabbar 的同源 Compose 实现（当前仅经典模式）。
 * 几何值直接来自 www/css/tabbar.css：左右 12dp、底部 18dp、58dp 高、外圆角 26dp、
 * 内容水平 padding 10dp、选中层上下 5dp；点击不使用 Material ripple 或默认弹簧。
 * 玻璃模式由 NativeRoot 保持 WebView 所有权，待后续专门迁移。
 */
@Composable
fun NativeBottomTabs(
    selectedRoute: GuanjiRoute,
    darkTheme: Boolean,
    liquidGlass: Boolean,
    blurCssPx: Float = 3f,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onSelect: (GuanjiRoute) -> Unit
) {
    val routes = listOf(GuanjiRoute.HOME, GuanjiRoute.INSIGHT, GuanjiRoute.SETTINGS)
    val selectedIndex = routes.indexOf(selectedRoute).coerceAtLeast(0)
    val animatedIndex by animateFloatAsState(
        targetValue = selectedIndex.toFloat(),
        animationSpec = tween(durationMillis = 550, easing = TabMotion),
        label = "tab-slide"
    )
    val outerShape = RoundedCornerShape(26.dp)
    // #274 当前只迁移经典模式。经典 Tab 使用不透明同主题底色，避免
    // 正文分割线透过 Compose 宿主形成中间白线；玻璃材质暂由 WebView 保持。
    val surface = when {
        darkTheme -> Color(0xFF1C1C1E)
        else -> Color.White
    }
    val unselected = if (darkTheme) TabDarkSecondary else TabLightSecondary
    val selectedColor = if (darkTheme) Color(0xFF409CFF) else TabBlueDeep
    val selectedFill = (if (darkTheme) Color(0xFF0A84FF) else TabBlue)
        .copy(alpha = if (darkTheme) 0.20f else 0.12f)

    Box(
        modifier = modifier
            .height(58.dp)
            .fillMaxWidth()
            .shadow(if (liquidGlass) 12.dp else 10.dp, outerShape, clip = false)
            .clip(outerShape)
            .background(surface)
            .then(if (enabled) Modifier else Modifier.clearAndSetSemantics { })
    ) {
        // 玻璃模式分支保留给后续迁移；当前 NativeRoot 在玻璃态会隐藏此层，
        // 因此不会与 WebView 的玻璃 Tab 同时渲染。
        if (liquidGlass) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(outerShape)
                    .background(
                        Color.White.copy(
                            alpha = if (darkTheme) 0.05f else (0.01f + blurCssPx.coerceIn(0f, 10f) * 0.002f)
                        )
                    )
            )
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(outerShape)
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                Color.White.copy(alpha = if (darkTheme) 0.06f else 0.18f),
                                Color.Transparent
                            )
                        )
                    )
            )
        }
        BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
            val cellWidth = (maxWidth - 20.dp) / 3f
            Box(
                modifier = Modifier
                    .padding(horizontal = 10.dp)
                    .offset(x = cellWidth * animatedIndex)
                    .width(cellWidth)
                    .fillMaxHeight()
                    .padding(vertical = 5.dp)
                    .clip(RoundedCornerShape(22.dp))
                    .background(selectedFill)
            )
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 10.dp),
                horizontalArrangement = Arrangement.Start,
                verticalAlignment = Alignment.CenterVertically
            ) {
                routes.forEach { route ->
                    val active = route == selectedRoute
                    val label = routeLabel(route)
                    val source = remember { MutableInteractionSource() }
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .clip(RoundedCornerShape(17.dp))
                            .clickable(
                                enabled = enabled,
                                interactionSource = source,
                                indication = null,
                                onClick = { onSelect(route) }
                            )
                            .semantics {
                                contentDescription = label
                                selected = active
                                role = Role.Tab
                            }
                            .padding(horizontal = 18.dp, vertical = 7.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        TabIcon(route, color = if (active) selectedColor else unselected)
                        BasicText(
                            text = label,
                            style = NativeTypography.style(
                                NativeTypography.Role.TabLabel,
                                if (active) selectedColor else unselected,
                            ).copy(fontWeight = if (active) FontWeight.Bold else FontWeight.Normal)
                        )
                    }
                }
            }
        }
    }
}

private fun routeLabel(route: GuanjiRoute): String = when (route) {
    GuanjiRoute.HOME -> "首页"
    GuanjiRoute.INSIGHT -> "洞察"
    GuanjiRoute.SETTINGS -> "我的"
    GuanjiRoute.RECORD -> "记录"
}

@Composable
private fun TabIcon(route: GuanjiRoute, color: Color) {
    Canvas(modifier = Modifier.size(22.dp)) {
        val stroke = 1.6.dp.toPx()
        val line = 1.8.dp.toPx()
        when (route) {
            GuanjiRoute.HOME -> {
                val path = Path().apply {
                    moveTo(3.5f / 22f * size.width, 10.2f / 22f * size.height)
                    lineTo(11f / 22f * size.width, 4f / 22f * size.height)
                    lineTo(18.5f / 22f * size.width, 10.2f / 22f * size.height)
                    lineTo(18.5f / 22f * size.width, 18f / 22f * size.height)
                    quadraticBezierTo(18.5f / 22f * size.width, 19.5f / 22f * size.height, 17f / 22f * size.width, 19.5f / 22f * size.height)
                    lineTo(13f / 22f * size.width, 19.5f / 22f * size.height)
                    lineTo(13f / 22f * size.width, 14f / 22f * size.height)
                    lineTo(9f / 22f * size.width, 14f / 22f * size.height)
                    lineTo(9f / 22f * size.width, 19.5f / 22f * size.height)
                    lineTo(5f / 22f * size.width, 19.5f / 22f * size.height)
                    quadraticBezierTo(3.5f / 22f * size.width, 19.5f / 22f * size.height, 3.5f / 22f * size.width, 18f / 22f * size.height)
                    close()
                }
                drawPath(path, color, style = Stroke(width = stroke, join = StrokeJoin.Round))
            }
            GuanjiRoute.INSIGHT -> {
                drawLine(color, Offset(4f / 22f * size.width, 18.5f / 22f * size.height), Offset(4f / 22f * size.width, 12f / 22f * size.height), strokeWidth = line, cap = StrokeCap.Round)
                drawLine(color, Offset(9.5f / 22f * size.width, 18.5f / 22f * size.height), Offset(9.5f / 22f * size.width, 5.5f / 22f * size.height), strokeWidth = line, cap = StrokeCap.Round)
                drawLine(color, Offset(15f / 22f * size.width, 18.5f / 22f * size.height), Offset(15f / 22f * size.width, 9f / 22f * size.height), strokeWidth = line, cap = StrokeCap.Round)
                drawLine(color, Offset(20f / 22f * size.width, 18.5f / 22f * size.height), Offset(2f / 22f * size.width, 18.5f / 22f * size.height), strokeWidth = line, cap = StrokeCap.Round)
            }
            GuanjiRoute.SETTINGS -> {
                drawCircle(color, radius = 3.5f / 22f * size.width, center = Offset(11f / 22f * size.width, 6.5f / 22f * size.height), style = Stroke(width = stroke))
                val path = Path().apply {
                    moveTo(4.5f / 22f * size.width, 19f / 22f * size.height)
                    cubicTo(5.3f / 22f * size.width, 15.6f / 22f * size.height, 8.4f / 22f * size.width, 14f / 22f * size.height, 11f / 22f * size.width, 14f / 22f * size.height)
                    cubicTo(14.1f / 22f * size.width, 14f / 22f * size.height, 16.7f / 22f * size.width, 15.6f / 22f * size.height, 17.5f / 22f * size.width, 19f / 22f * size.height)
                }
                drawPath(path, color, style = Stroke(width = stroke, cap = StrokeCap.Round))
            }
            GuanjiRoute.RECORD -> Unit
        }
    }
}
