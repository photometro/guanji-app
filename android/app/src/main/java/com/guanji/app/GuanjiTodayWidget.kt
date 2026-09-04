package com.guanji.app

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews

/**
 * 今日卡片小组件（2x2，#36）：今日是否已记录 + 温和文案（非评判打卡）
 */
class GuanjiTodayWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        val openPending = WidgetStatsHelper.openApp(context, OpenMode.OPEN_HOME)   // #37：只进首页
        for (id in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_today).apply {
                setOnClickPendingIntent(R.id.today_root, openPending)
                bindStats(context, this)
            }
            appWidgetManager.updateAppWidget(id, views)
        }
    }

    private fun bindStats(context: Context, views: RemoteViews) {
        val stats = WidgetStatsHelper.loadStats(context)
        val stale = WidgetStatsHelper.isStaleForToday(stats)
        val today = WidgetStatsHelper.todayCountForDisplay(stats)
        if (stale) {
            views.setTextViewText(R.id.today_status, context.getString(R.string.widget_today_stale))
            views.setTextViewText(R.id.today_hint, context.getString(R.string.today_stale_hint))
        } else if (today > 0) {
            views.setTextViewText(R.id.today_status, context.getString(R.string.today_done, today))
            views.setTextViewText(R.id.today_hint, context.getString(R.string.today_done_hint))
        } else {
            views.setTextViewText(R.id.today_status, context.getString(R.string.today_pending))
            views.setTextViewText(R.id.today_hint, context.getString(R.string.today_pending_hint))
        }
    }
}
