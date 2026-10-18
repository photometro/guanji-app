package com.guanji.app

import android.app.Activity
import android.content.pm.ApplicationInfo
import android.view.View
import android.view.ViewGroup

/** #273：在 MainActivity 内安装唯一 NativeRoot，不创建新的 Activity。 */
object NativeRootHost {
    private const val DEBUG_PREFS = "guanji_native_ui_v2_debug"
    private const val DEBUG_NATIVE_ROUTE = "native_route_enabled"

    @JvmStatic
    fun install(activity: Activity): NativeRoot? {
        val content = activity.findViewById<ViewGroup>(android.R.id.content) ?: return null
        for (index in 0 until content.childCount) {
            val child = content.getChildAt(index)
            if (child is NativeRoot) return child
        }

        val existing = ArrayList<View>(content.childCount)
        while (content.childCount > 0) existing += content.getChildAt(0).also(content::removeView)

        val host = NativeRoot(activity)
        existing.forEach { host.attachLegacyContent(it) }
        content.addView(host, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        return host
    }

    /**
     * 仅调试构建可切换 NativeRegion；公开构建永远保持 WebView 路径。
     * #273 不提供产品 UI 开关，后续自动化/调试入口可调用此方法。
     */
    @JvmStatic
    fun setNativeRouteDebugEnabled(activity: Activity, enabled: Boolean) {
        if (!isDebuggable(activity)) return
        activity.getSharedPreferences(DEBUG_PREFS, Activity.MODE_PRIVATE)
            .edit()
            .putBoolean(DEBUG_NATIVE_ROUTE, enabled)
            .apply()
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        val root = content?.getChildAt(0) as? NativeRoot
        root?.setNativeRegionVisible(enabled)
    }

    @JvmStatic
    fun setNativeHomeSnapshot(activity: Activity, snapshot: String?) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeHomeSnapshot(snapshot)
    }

    @JvmStatic
    fun setNativeSettingsSnapshot(activity: Activity, snapshot: String?) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeSettingsSnapshot(snapshot)
    }

    @JvmStatic
    fun setNativeBackupContext(activity: Activity, contextJson: String?) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeBackupContext(contextJson)
    }

    @JvmStatic
    fun clearNativeBackupContext(activity: Activity) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.clearNativeBackupContext()
    }

    @JvmStatic
    fun hasNativeBackupContext(activity: Activity): Boolean {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        return (content?.getChildAt(0) as? NativeRoot)?.hasNativeBackupContext() == true
    }

    @JvmStatic
    fun openNativeDataMaintenance(activity: Activity, task: String) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.openNativeDataMaintenance(task)
    }

    @JvmStatic
    fun setNativeDataMaintenanceRunning(activity: Activity, running: Boolean) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeDataMaintenanceRunning(running)
    }

    @JvmStatic
    fun setNativeDataMaintenanceResult(activity: Activity, result: String?) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeDataMaintenanceResult(result)
    }

    @JvmStatic
    fun setNativeDataMaintenanceStatus(activity: Activity, status: String?) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeDataMaintenanceStatus(status)
    }

    @JvmStatic
    fun setNativeClearDataFeedback(activity: Activity, status: String?) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeClearDataFeedback(status)
    }

    @JvmStatic
    fun clearNativeDataMaintenance(activity: Activity) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.clearNativeDataMaintenance()
    }

    @JvmStatic
    fun hasNativeDataMaintenanceTask(activity: Activity): Boolean {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        return (content?.getChildAt(0) as? NativeRoot)?.hasNativeDataMaintenanceTask() == true
    }

    @JvmStatic
    fun setNativeBackupRestoreRunning(activity: Activity, running: Boolean) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeBackupRestoreRunning(running)
    }

    @JvmStatic
    fun setNativeBackupRestoreResult(activity: Activity, result: String?) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeBackupRestoreResult(result)
    }

    @JvmStatic
    fun openNativeSecureMode(activity: Activity) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.openNativeSecureMode()
    }

    @JvmStatic
    fun setNativeSecureModeRunning(activity: Activity, running: Boolean) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeSecureModeRunning(running)
    }

    @JvmStatic
    fun setNativeSecureModeResult(activity: Activity, result: String?) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeSecureModeResult(result)
    }

    @JvmStatic
    fun clearNativeSecureMode(activity: Activity) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.clearNativeSecureMode()
    }

    @JvmStatic
    fun hasNativeSecureMode(activity: Activity): Boolean {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        return (content?.getChildAt(0) as? NativeRoot)?.hasNativeSecureMode() == true
    }

    @JvmStatic
    fun openNativeSecureEnable(activity: Activity) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.openNativeSecureEnable()
    }

    @JvmStatic
    fun setNativeSecureEnableRunning(activity: Activity, running: Boolean) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeSecureEnableRunning(running)
    }

    @JvmStatic
    fun setNativeSecureEnableResult(activity: Activity, result: String?) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeSecureEnableResult(result)
    }

    @JvmStatic
    fun clearNativeSecureEnable(activity: Activity) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.clearNativeSecureEnable()
    }

    @JvmStatic
    fun hasNativeSecureEnable(activity: Activity): Boolean {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        return (content?.getChildAt(0) as? NativeRoot)?.hasNativeSecureEnable() == true
    }

    @JvmStatic
    fun openNativeSecureChange(activity: Activity) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.openNativeSecureChange()
    }

    @JvmStatic
    fun setNativeSecureChangeRunning(activity: Activity, running: Boolean) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeSecureChangeRunning(running)
    }

    @JvmStatic
    fun setNativeSecureChangeResult(activity: Activity, result: String?) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeSecureChangeResult(result)
    }

    @JvmStatic
    fun clearNativeSecureChange(activity: Activity) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.clearNativeSecureChange()
    }

    @JvmStatic
    fun hasNativeSecureChange(activity: Activity): Boolean {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        return (content?.getChildAt(0) as? NativeRoot)?.hasNativeSecureChange() == true
    }

    @JvmStatic
    fun openNativeDataScope(activity: Activity) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.openNativeDataScope()
    }

    @JvmStatic
    fun clearNativeDataScope(activity: Activity) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.clearNativeDataScope()
    }

    @JvmStatic
    fun hasNativeDataScope(activity: Activity): Boolean {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        return (content?.getChildAt(0) as? NativeRoot)?.hasNativeDataScope() == true
    }

    @JvmStatic
    fun openNativeOpenSourceLicenses(activity: Activity) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.openNativeOpenSourceLicenses()
    }

    @JvmStatic
    fun clearNativeOpenSourceLicenses(activity: Activity) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.clearNativeOpenSourceLicenses()
    }

    @JvmStatic
    fun hasNativeOpenSourceLicenses(activity: Activity): Boolean {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        return (content?.getChildAt(0) as? NativeRoot)?.hasNativeOpenSourceLicenses() == true
    }

    @JvmStatic
    fun setNativeHomeActionListener(activity: Activity, listener: NativeHomeActionListener?) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeHomeActionListener(listener)
    }

    @JvmStatic
    fun setNativeRecordActionListener(activity: Activity, listener: NativeHomeActionListener?) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeRecordActionListener(listener)
    }

    @JvmStatic
    fun setNativeRecordContext(activity: Activity, contextJson: String?) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeRecordContext(contextJson)
    }

    @JvmStatic
    fun clearNativeRecordContext(activity: Activity) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.clearNativeRecordContext()
    }

    @JvmStatic
    fun requestNativeRecordClose(activity: Activity) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.requestNativeRecordClose()
    }

    @JvmStatic
    fun hasNativeRecordContext(activity: Activity): Boolean {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        return (content?.getChildAt(0) as? NativeRoot)?.hasNativeRecordContext() == true
    }

    @JvmStatic
    fun hasNativeCalendarContext(activity: Activity): Boolean {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        return (content?.getChildAt(0) as? NativeRoot)?.hasNativeCalendarContext() == true
    }

    @JvmStatic
    fun suppressNativeHome(activity: Activity, suppressed: Boolean) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeHomeSuppressed(suppressed)
    }

    @JvmStatic
    fun isNativeRouteDebugEnabled(activity: Activity): Boolean {
        return isDebuggable(activity) && activity
            .getSharedPreferences(DEBUG_PREFS, Activity.MODE_PRIVATE)
            // #275：调试包进入首页 NativeRoute，公开构建仍由 isDebuggable 门禁拦截。
            .getBoolean(DEBUG_NATIVE_ROUTE, true)
    }

    @JvmStatic
    fun setNativeTabEnabled(activity: Activity, enabled: Boolean, onSelect: ((String) -> Unit)? = null) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        val root = content?.getChildAt(0) as? NativeRoot ?: return
        root.setNativeTabVisible(enabled, onSelect)
    }

    @JvmStatic
    fun setNativeModalVisible(activity: Activity, visible: Boolean) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeModalVisible(visible)
    }

    @JvmStatic
    fun setNativeCalendarVisible(activity: Activity, visible: Boolean) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeCalendarVisible(visible)
    }

    @JvmStatic
    fun bindNativeTabSelection(activity: Activity, listener: NativeTabSelectionListener?) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        val root = content?.getChildAt(0) as? NativeRoot ?: return
        root.setNativeTabVisible(true) { key -> listener?.onSelected(key) }
    }

    @JvmStatic
    fun setNativeTabSelection(activity: Activity, routeKey: String) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.setNativeTabSelection(routeKey)
    }

    @JvmStatic
    fun setNativeTabTheme(activity: Activity, dark: Boolean, liquidGlass: Boolean) {
        setNativeTabTheme(activity, dark, liquidGlass, 3f, 2f, false)
    }

    @JvmStatic
    fun setNativeTabTheme(
        activity: Activity,
        dark: Boolean,
        liquidGlass: Boolean,
        blurCssPx: Float,
        saturate: Float,
        reducedTransparency: Boolean
    ) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        val root = content?.getChildAt(0) as? NativeRoot
        root?.setNativeTabTheme(dark, liquidGlass, blurCssPx, saturate, reducedTransparency)
    }

    @JvmStatic
    fun refreshNativeTabBackdrop(activity: Activity) {
        val content = activity.findViewById<ViewGroup>(android.R.id.content)
        (content?.getChildAt(0) as? NativeRoot)?.refreshNativeTabBackdrop()
    }

    private fun isDebuggable(activity: Activity): Boolean {
        return activity.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
    }
}
