package com.guanji.app

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.util.TypedValue
import android.widget.RemoteViews

/**
 * 本周节奏小组件（2x2，#34/#196）：自然周周一~周日 7 根柱状图
 * 柱数据与首页统一，当前周未到日期显示为 0，今天位置由快照标记
 */
class GuanjiWeekWidget : AppWidgetProvider() {

    // 直接用 R.id 常量（getIdentifier 在部分设备上可能返回 0，导致 RemoteViews 加载失败）
    private val BAR_IDS = intArrayOf(
        R.id.bar_0, R.id.bar_1, R.id.bar_2, R.id.bar_3,
        R.id.bar_4, R.id.bar_5, R.id.bar_6,
    )
    private val LABEL_IDS = intArrayOf(
        R.id.label_0, R.id.label_1, R.id.label_2, R.id.label_3,
        R.id.label_4, R.id.label_5, R.id.label_6,
    )

    // 周一=0 的星期文案资源
    private val DAY_RES = intArrayOf(
        R.string.week_day_mon, R.string.week_day_tue, R.string.week_day_wed,
        R.string.week_day_thu, R.string.week_day_fri, R.string.week_day_sat,
        R.string.week_day_sun,
    )

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        val openPending = WidgetStatsHelper.openApp(context, OpenMode.OPEN_HOME)   // #37：只进首页
        for (id in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_week).apply {
                setOnClickPendingIntent(R.id.week_root, openPending)
                bindStats(context, this)
            }
            appWidgetManager.updateAppWidget(id, views)
        }
    }

    private fun bindStats(context: Context, views: RemoteViews) {
        val stats = WidgetStatsHelper.loadStats(context)
        val week = stats?.week ?: IntArray(7)
        val maxBar = 44f
        val minBar = 4f
        val px = { dp: Float ->
            TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, dp, context.resources.displayMetrics).toInt()
        }

        var max = 0
        for (c in week) max = maxOf(max, c)
        if (max == 0) max = 1
        val todayIndex = stats?.weekDayIndex?.coerceIn(0, 6) ?: 6

        for (i in 0 until 7) {
            val count = if (i < week.size) week[i] else 0
            val heightDp = if (count > 0) minBar + (count.toFloat() / max) * (maxBar - minBar) else 0f
            // RemoteViews 不能动态设置 layout_height（反射限制），用 setMinimumHeight + wrap_content
            views.setInt(BAR_IDS[i], "setMinimumHeight", px(heightDp))
            // 自然周中今天所在位置用强调色，其余用浅色
            val color = if (i == todayIndex) R.color.widget_accent else R.color.widget_bar
            views.setInt(BAR_IDS[i], "setBackgroundResource", color)
        }

        // 星期标签固定为自然周：周一→周日
        for (i in 0 until 7) {
            views.setTextViewText(LABEL_IDS[i], context.getString(DAY_RES[i]))
        }
        for (i in 0 until 7) views.setTextColor(LABEL_IDS[i], context.getColor(if (i == todayIndex) R.color.widget_accent else R.color.widget_ink2))
    }
}
