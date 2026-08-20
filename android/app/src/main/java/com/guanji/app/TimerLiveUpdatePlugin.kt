package com.guanji.app

import android.Manifest
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import androidx.core.app.NotificationManagerCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * 「就现在」计时通知（#51/#52/#57/#58/#59/#60）：
 * - startTimer：启动计时前台服务（#60 TimerService 保活——OEM 息屏冻结进程导致动态刷新停摆的根治），
 *   通知构建/胶囊/快捷操作/短文本/60s 动态 contentText 全部在 TimerService
 * - Android 16+（API 36）请求提升为实况通知（setRequestPromotedOngoing，androidx.core 1.17.0）
 * - 魅族（Flyme）私有胶囊：仅魅族附加（is_live extras + contentView）
 * - deleteIntent 广播标记：划掉通知不强行拉起 App，下次打开 App 时温和提示
 */
@CapacitorPlugin(
    name = "TimerLiveUpdate",
    permissions = [
        Permission(alias = "notifications", strings = [Manifest.permission.POST_NOTIFICATIONS])
    ]
)
class TimerLiveUpdatePlugin : Plugin() {

    companion object {
        const val CHANNEL_ID = "guanji_timer"
        const val NOTIF_ID = 4101          // 计时通知
        const val TEST_NOTIF_ID = 4102     // 测试通知（15s 后自动取消）
        const val PREFS = "guanji_timer_flags"
        const val KEY_DISMISSED = "notif_dismissed"
    }

    @PluginMethod
    fun startTimer(call: PluginCall) {
        val startTimeMs = call.getLong("startTimeMs", System.currentTimeMillis()) ?: System.currentTimeMillis()
        // #60：前台服务保活（服务内 startForeground + 60s 动态 contentText 更新）
        TimerService.start(context, startTimeMs)
        call.resolve(JSObject().put("ok", true))
    }

    @PluginMethod
    fun stopTimer(call: PluginCall) {
        // #60：停止前台服务（onDestroy 清除更新循环）+ 移除通知
        TimerService.stop(context)
        notifyCompat()?.cancel(NOTIF_ID)
        call.resolve(JSObject().put("ok", true))
    }

    /** 实况通知测试：发一条示例计时通知，seconds 秒后自动取消（不走前台服务） */
    @PluginMethod
    fun testLiveUpdate(call: PluginCall) {
        val seconds = (call.getInt("seconds", 15) ?: 15).toLong()
        val startTimeMs = System.currentTimeMillis()
        notifyCompat()?.notify(TEST_NOTIF_ID, TimerService.buildTestNotification(context, startTimeMs))
        Handler(Looper.getMainLooper()).postDelayed({
            NotificationManagerCompat.from(context).cancel(TEST_NOTIF_ID)
        }, seconds * 1000L)
        call.resolve(JSObject().put("ok", true))
    }

    /** 设备状态（设置页「实况通知」测试用）：双路径能力 / 系统版本 / 通知权限。 */
    @PluginMethod
    fun getLiveUpdateStatus(call: PluginCall) {
        val out = JSObject()
        out.put("sdkInt", Build.VERSION.SDK_INT)
        val permissionGranted = hasNotificationPermission()
        out.put("permissionGranted", permissionGranted)
        var canPromote = false
        if (Build.VERSION.SDK_INT >= 36) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            canPromote = nm.canPostPromotedNotifications()
        }
        // 魅族 Flyme 使用私有实况通知扩展（TimerService.flymeLiveBundle），不依赖
        // Android 16 的 promoted ongoing 能力；通知权限仍是两条路径的共同前提。
        val flymeSupported = TimerService.isFlyme() && permissionGranted
        val androidLiveUpdateSupported = Build.VERSION.SDK_INT >= 36 && permissionGranted && canPromote
        out.put("canPostPromoted", canPromote)
        out.put("flymeSupported", flymeSupported)
        out.put("androidLiveUpdateSupported", androidLiveUpdateSupported)
        // 前端只消费统一能力结果：任一路径可用即视为支持实况通知。
        out.put("supported", flymeSupported || androidLiveUpdateSupported)
        call.resolve(out)
    }

    @PluginMethod
    fun checkNotificationPermission(call: PluginCall) {
        call.resolve(JSObject().put("granted", hasNotificationPermission()))
    }

    @PluginMethod
    fun requestNotificationPermission(call: PluginCall) {
        if (Build.VERSION.SDK_INT < 33) {
            call.resolve(JSObject().put("granted", true))
            return
        }
        if (hasNotificationPermission()) {
            call.resolve(JSObject().put("granted", true))
            return
        }
        requestPermissionForAlias("notifications", call, "notificationPermsCallback")
    }

    @PermissionCallback
    private fun notificationPermsCallback(call: PluginCall) {
        call.resolve(JSObject().put("granted", hasNotificationPermission()))
    }

    private fun hasNotificationPermission(): Boolean {
        return Build.VERSION.SDK_INT < 33 || NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    private fun notifyCompat(): NotificationManagerCompat? {
        return try {
            val nmc = NotificationManagerCompat.from(context)
            if (!nmc.areNotificationsEnabled()) return null
            nmc
        } catch (e: Exception) {
            null
        }
    }
}
