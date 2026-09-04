package com.guanji.app

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews

/**
 * 数据看板小组件（2x2，#33/#196）：自然周次数（大数字）+ 同周期环比 + 今日 + 连续记录
 */
class GuanjiStatsWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        val openPending = WidgetStatsHelper.openApp(context, OpenMode.OPEN_HOME)   // #37：只进首页
        for (id in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_stats).apply {
                setOnClickPendingIntent(R.id.stats_root, openPending)
                bindStats(context, this)
            }
            appWidgetManager.updateAppWidget(id, views)
        }
    }

    private fun bindStats(context: Context, views: RemoteViews) {
        val stats = WidgetStatsHelper.loadStats(context)
        val weekCount = stats?.weekCount ?: 0
        val stale = WidgetStatsHelper.isStaleForToday(stats)
        val today = WidgetStatsHelper.todayCountForDisplay(stats)
        val streak = stats?.streak ?: 0
        val delta = stats?.weekDelta

        views.setTextViewText(R.id.stats_week_num, weekCount.toString())
        views.setTextViewText(
            R.id.stats_today,
            if (stale) context.getString(R.string.widget_today_stale)
            else context.getString(R.string.stats_today, today)
        )
        views.setTextViewText(R.id.stats_streak, context.getString(R.string.stats_streak, streak))
        views.setTextViewText(
            R.id.stats_delta,
            if (delta == null) context.getString(R.string.stats_delta_na)
            else context.getString(R.string.stats_delta, if (delta < 0) delta.toString() else "+$delta")
        )
    }
}
