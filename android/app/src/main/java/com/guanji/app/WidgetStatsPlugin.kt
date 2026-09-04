package com.guanji.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * 小组件统计同步：#32-#36 共用
 * WebView 在记录变化后调用 syncStats，把聚合统计（管道分隔字符串）写入 SharedPreferences，
 * 并广播 APPWIDGET_UPDATE 让所有已添加的小组件刷新显示。
 */
@CapacitorPlugin(name = "WidgetStats")
class WidgetStatsPlugin : Plugin() {

    @PluginMethod
    fun syncStats(call: PluginCall) {
        val raw = call.getString("stats") ?: ""
        val incoming = WidgetStats.parse(raw)
        if (incoming == null) {
            call.resolve(JSObject().put("ok", false).put("accepted", false).put("reason", "invalid"))
            return
        }
        val prefs = context.getSharedPreferences(WidgetStatsHelper.PREFS, Context.MODE_PRIVATE)
        val current = WidgetStatsHelper.loadStats(context)
        if (current != null && incoming.revision > 0L && current.revision > incoming.revision) {
            call.resolve(JSObject().put("ok", true).put("accepted", false).put("reason", "stale"))
            return
        }
        val canonical = incoming.toJson().toString()
        /* 两阶段 commit：先写临时快照，再提交正式键；失败时保留 last-known-good。 */
        val staged = prefs.edit().putString(WidgetStatsHelper.KEY_STATS_TMP, canonical).commit()
        if (!staged) {
            call.resolve(JSObject().put("ok", false).put("accepted", false).put("reason", "stage_failed"))
            return
        }
        val committed = prefs.edit()
            .putString(WidgetStatsHelper.KEY_STATS, canonical)
            .remove(WidgetStatsHelper.KEY_STATS_TMP)
            .commit()
        if (!committed) {
            call.resolve(JSObject().put("ok", false).put("accepted", false).put("reason", "commit_failed"))
            return
        }
        refreshAllWidgets()
        call.resolve(JSObject().put("ok", true).put("accepted", true).put("revision", incoming.revision))
    }

    private fun refreshAllWidgets() {
        val appContext = context.applicationContext
        val manager = AppWidgetManager.getInstance(appContext)
        val providers = listOf(
            GuanjiWidget::class.java,
            GuanjiStatsWidget::class.java,
            GuanjiWeekWidget::class.java,
            GuanjiStreakWidget::class.java,
            GuanjiTodayWidget::class.java,
        )
        providers.forEach { cls ->
            val ids = manager.getAppWidgetIds(ComponentName(appContext, cls))
            if (ids.isNotEmpty()) {
                val intent = Intent(appContext, cls).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                }
                appContext.sendBroadcast(intent)
            }
        }
    }
}

/** 小组件统计数据（v2 JSON；兼容旧管道协议） */
data class WidgetStats(
    val protocolVersion: Int,
    val schemaVersion: Int,
    val statsRuleVersion: String,
    val generationId: String,
    val revision: Long,
    val generatedAtMs: Long,
    val timezone: String,
    val todayKey: String,
    val weekStartKey: String,
    val todayCount: Int,
    val weekCount: Int,
    val streak: Int,
    val weekDelta: Int?,
    val week: IntArray,
    val weekDayIndex: Int,
    val monthCount: Int,
    val monthDelta: Int?,
    val freshness: String,
    val excludedInvalidRecords: Int,
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("protocolVersion", protocolVersion)
        put("schemaVersion", schemaVersion)
        put("statsRuleVersion", statsRuleVersion)
        put("generationId", generationId)
        put("revision", revision)
        put("generatedAtMs", generatedAtMs)
        put("timezone", timezone)
        put("todayKey", todayKey)
        put("weekStartKey", weekStartKey)
        put("todayCount", todayCount)
        put("weekCount", weekCount)
        put("streak", streak)
        if (weekDelta == null) put("weekDelta", JSONObject.NULL) else put("weekDelta", weekDelta)
        put("week", JSONArray(week.toList()))
        put("weekDayIndex", weekDayIndex)
        put("monthCount", monthCount)
        if (monthDelta == null) put("monthDelta", JSONObject.NULL) else put("monthDelta", monthDelta)
        put("freshness", freshness)
        put("excludedInvalidRecords", excludedInvalidRecords)
    }

    companion object {
        private fun safeCount(value: Int): Int? = if (value in 0..1_000_000) value else null

        private fun nullableInt(obj: JSONObject, key: String): Int? {
            if (!obj.has(key) || obj.isNull(key)) return null
            return obj.optInt(key, Int.MIN_VALUE).takeUnless { it == Int.MIN_VALUE }
        }

        private fun parseJson(raw: String): WidgetStats? {
            val obj = JSONObject(raw)
            val protocol = obj.optInt("protocolVersion", 0)
            if (protocol < 2) return null
            val arr = obj.optJSONArray("week") ?: return null
            if (arr.length() != 7) return null
            val week = IntArray(7)
            for (i in 0 until 7) week[i] = safeCount(arr.optInt(i, -1)) ?: return null
            val today = safeCount(obj.optInt("todayCount", -1)) ?: return null
            val weekCount = safeCount(obj.optInt("weekCount", -1)) ?: return null
            val streak = safeCount(obj.optInt("streak", -1)) ?: return null
            val month = safeCount(obj.optInt("monthCount", -1)) ?: return null
            val delta = nullableInt(obj, "weekDelta")
            val monthDelta = nullableInt(obj, "monthDelta")
            /*
             * 变化率是传输数据，不是 UI 文案。自然月基数较小时，合法值可能远超
             * 1000（例如 +5600%）；这里只由 nullableInt 保证 JSON 能表示为 Int，
             * 不再套用展示层的范围限制，避免整份快照被拒绝。
             */
            return WidgetStats(
                protocolVersion = protocol,
                schemaVersion = obj.optInt("schemaVersion", 2),
                statsRuleVersion = obj.optString("statsRuleVersion", ""),
                generationId = obj.optString("generationId", ""),
                revision = obj.optLong("revision", 0L),
                generatedAtMs = obj.optLong("generatedAtMs", 0L),
                timezone = obj.optString("timezone", "local"),
                todayKey = obj.optString("todayKey", ""),
                weekStartKey = obj.optString("weekStartKey", ""),
                todayCount = today,
                weekCount = weekCount,
                streak = streak,
                weekDelta = delta,
                week = week,
                weekDayIndex = obj.optInt("weekDayIndex", 6).coerceIn(0, 6),
                monthCount = month,
                monthDelta = monthDelta,
                freshness = obj.optString("freshness", "fresh"),
                excludedInvalidRecords = safeCount(obj.optInt("excludedInvalidRecords", 0)) ?: 0,
            )
        }

        /** 解析旧版 "today|week|streak|delta|w0,w1,...|month|mDelta"。 */
        private fun parseLegacy(raw: String): WidgetStats? {
            val parts = raw.split('|')
            if (parts.size < 6) return null
            return try {
                val weekValues = parts[4].split(',').map { it.toInt() }
                if (weekValues.size != 7 || weekValues.any { it !in 0..1_000_000 }) return null
                WidgetStats(
                    protocolVersion = 1,
                    schemaVersion = 1,
                    statsRuleVersion = "legacy",
                    generationId = "legacy",
                    revision = 0L,
                    generatedAtMs = 0L,
                    timezone = "local",
                    todayKey = "",
                    weekStartKey = "",
                    todayCount = parts[0].toInt().coerceAtLeast(0),
                    weekCount = parts[1].toInt().coerceAtLeast(0),
                    streak = parts[2].toInt().coerceAtLeast(0),
                    weekDelta = parts[3].ifBlank { null }?.toInt(),
                    week = weekValues.toIntArray(),
                    weekDayIndex = 6,
                    monthCount = parts[5].toInt().coerceAtLeast(0),
                    monthDelta = if (parts.size > 6) parts[6].ifBlank { null }?.toInt() else null,
                    freshness = "legacy",
                    excludedInvalidRecords = 0,
                )
            } catch (_: Exception) {
                null
            }
        }

        fun parse(raw: String): WidgetStats? {
            val value = raw.trim()
            if (value.isEmpty()) return null
            return try {
                if (value.startsWith("{")) parseJson(value) else parseLegacy(value)
            } catch (_: Exception) {
                null
            }
        }
    }
}

/** 打开 App 的模式（#37：requestCode 区分，避免 PendingIntent 互相覆盖） */
enum class OpenMode {
    /** 正常进首页，不弹面板、不自动记录（统计类小组件点击） */
    OPEN_HOME,
    /** 打开记录面板（预留） */
    OPEN_RECORD,
    /** 一键快速记录（快速记录小组件整卡点击） */
    QUICK_RECORD,
}

/** 小组件公共工具：读统计 / 构造打开 App 的 PendingIntent */
object WidgetStatsHelper {
    const val PREFS = "guanji_widget_stats"
    const val KEY_STATS = "stats"
    const val KEY_STATS_TMP = "stats.tmp"

    fun loadStats(context: Context): WidgetStats? {
        val prefs: SharedPreferences = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_STATS, null)
        val parsed = raw?.let { WidgetStats.parse(it) }
        if (parsed != null) return parsed
        /* 正式键损坏时只接受完整的临时快照，避免把半写入内容当成全零。 */
        val staged = prefs.getString(KEY_STATS_TMP, null) ?: return null
        return WidgetStats.parse(staged)
    }

    /**
     * v2 快照带有生成时区和日期。旧 v1 管道没有 todayKey，因此按兼容规则视为
     * 可展示；只有带日期的快照在当前时区日期不一致时才标记为过期。
     */
    fun isStaleForToday(stats: WidgetStats?): Boolean {
        if (stats == null || stats.todayKey.isBlank()) return false
        val formatter = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val timezoneId = stats.timezone
            .takeUnless { it.isBlank() || it == "local" }
            ?: TimeZone.getDefault().id
        formatter.timeZone = TimeZone.getTimeZone(timezoneId)
        return stats.todayKey != formatter.format(Date())
    }

    fun todayCountForDisplay(stats: WidgetStats?): Int {
        return if (isStaleForToday(stats)) 0 else stats?.todayCount ?: 0
    }

    fun openApp(context: Context, mode: OpenMode): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            when (mode) {
                OpenMode.QUICK_RECORD -> putExtra(MainActivity.EXTRA_GUANJI_QUICK_RECORD, true)
                OpenMode.OPEN_RECORD -> putExtra(MainActivity.EXTRA_GUANJI_RECORD, true)
                OpenMode.OPEN_HOME -> { /* 无 extra：正常进首页 */ }
            }
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val requestCode = when (mode) {
            OpenMode.OPEN_HOME -> 2
            OpenMode.OPEN_RECORD -> 0
            OpenMode.QUICK_RECORD -> 1
        }
        // 不同 requestCode 避免 PendingIntent 冲突
        return PendingIntent.getActivity(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
