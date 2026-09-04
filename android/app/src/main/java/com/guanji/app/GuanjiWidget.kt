package com.guanji.app

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews

/**
 * 桌面小组件（2x2）一键快速记录：
 * 整卡 + 「＋ 快速记录」按钮 → 打开 App 自动保存一条「就现在」默认记录（#32/#37）
 * 顶部展示今日已记录状态
 */
class GuanjiWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        val quickPending = WidgetStatsHelper.openApp(context, OpenMode.QUICK_RECORD)

        for (id in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.widget_guanji).apply {
                // #37：整卡 + 大按钮均可点，语义统一为一键快速记录（已删除「打开记录面板」按钮）
                setOnClickPendingIntent(R.id.widget_root, quickPending)
                setOnClickPendingIntent(R.id.widget_quick_btn, quickPending)
                bindStats(context, this)
            }
            appWidgetManager.updateAppWidget(id, views)
        }
    }

    private fun bindStats(context: Context, views: RemoteViews) {
        val stats = WidgetStatsHelper.loadStats(context)
        val stale = WidgetStatsHelper.isStaleForToday(stats)
        val today = WidgetStatsHelper.todayCountForDisplay(stats)
        views.setTextViewText(
            R.id.widget_today_status,
            if (stale) context.getString(R.string.widget_today_stale)
            else if (today > 0) context.getString(R.string.widget_today_status, today)
            else context.getString(R.string.widget_today_default)
        )
    }
}
