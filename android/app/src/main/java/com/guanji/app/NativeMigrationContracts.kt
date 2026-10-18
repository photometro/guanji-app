package com.guanji.app

/**
 * #273：迁移期的非渲染契约。
 *
 * 这些对象只负责约束“单一宿主、单一路由栈、单一 Tab 和单一 SheetHost”的
 * 所有权；它们不创建页面、不持有业务数据，也不替代 WebView 的现有路由。
 * 后续页面迁移必须把已验收的 NativeRoute 接入这里，而不是新建 Activity。
 */
enum class GuanjiRoute(val key: String) {
    HOME("home"),
    RECORD("record"),
    INSIGHT("analysis"),
    SETTINGS("me")
}

class RouteHost {
    private val backStack = mutableListOf<GuanjiRoute>()

    val current: GuanjiRoute?
        get() = backStack.lastOrNull()

    fun replace(route: GuanjiRoute) {
        backStack.clear()
        backStack += route
    }

    fun push(route: GuanjiRoute) {
        if (current != route) backStack += route
    }

    fun pop(): GuanjiRoute? {
        if (backStack.size <= 1) return null
        backStack.removeAt(backStack.lastIndex)
        return current
    }
}

class GuanjiBottomTabs(private val routeHost: RouteHost) {
    /** #274：与 WebView #tabbar 的 data-screen 一一对应，当前产品实际为三项。 */
    val routes: List<GuanjiRoute> = listOf(
        GuanjiRoute.HOME,
        GuanjiRoute.INSIGHT,
        GuanjiRoute.SETTINGS
    )

    fun select(index: Int) {
        routes.getOrNull(index)?.let(routeHost::replace)
    }
}

class SheetHost {
    var activeSheetKey: String? = null
        private set

    fun open(key: String) {
        activeSheetKey = key
    }

    fun close() {
        activeSheetKey = null
    }
}

/**
 * #279：数据维护边界。Compose 只依赖这个领域命令/结果形状；当前实现由
 * MainActivity 的 LegacyJsDataMaintenanceAdapter（JS bridge）承载，#281
 * 再替换为 Kotlin/Room/Filesystem 实现。原始记录、密钥和文件正文不进入
 * 这个协议。
 */
enum class DataMaintenanceTask { EXPORT, CLEAR_ALL, RESTORE_DEMO }

enum class DataMaintenanceStatus { STARTED, COMPLETED, CANCELLED, FAILED }

data class DataMaintenanceCommand(
    val task: DataMaintenanceTask,
    val requestId: String,
    val clearServer: Boolean = false,
) {
    @JvmName("commandTask") fun commandTask(): DataMaintenanceTask = task
    @JvmName("commandRequestId") fun commandRequestId(): String = requestId
    @JvmName("commandClearServer") fun commandClearServer(): Boolean = clearServer
}

data class DataMaintenanceResult(
    val requestId: String,
    val task: DataMaintenanceTask,
    val status: DataMaintenanceStatus,
    val dataRevision: Long? = null,
    val code: String? = null,
)

interface DataMaintenanceGateway {
    fun submit(command: DataMaintenanceCommand)
    fun cancel(requestId: String)
}

/**
 * #280：跨领域 Gateway 的公共命令形状。
 *
 * 这不是一个“万能 Bridge”：每个领域只接受自己的 action 集合，并由自己的
 * Adapter 决定如何把命令交给迁移期 JS owner。payload 只能是渲染/动作所需的
 * 脱敏值；记录正文、口令、API Key 和文件内容不得放入这里。
 */
data class GatewayCommand(
    val requestId: String,
    val action: String,
    val value: String? = null,
    val dataRevision: Long = 0L,
)

data class GatewayResult(
    val requestId: String,
    val status: String,
    val dataRevision: Long = 0L,
    val errorCode: String? = null,
    val message: String? = null,
)

fun interface GatewayCallback {
    fun onResult(result: GatewayResult)
}

/** #280：设置快照与设置动作的 owner 边界。 */
interface SettingsGateway {
    fun readSnapshot(command: GatewayCommand, callback: GatewayCallback)
    fun dispatch(command: GatewayCommand, callback: GatewayCallback)
}

/** #280：备份状态读取、WebDAV/上传/删除动作和恢复入口的 owner 边界。 */
interface BackupGateway {
    fun readSnapshot(command: GatewayCommand, callback: GatewayCallback)
    fun dispatch(command: GatewayCommand, callback: GatewayCallback)
}

/** #280：记录上下文、提交与计时通知的 owner 边界。 */
interface RecordFlowGateway {
    fun readContext(command: GatewayCommand, callback: GatewayCallback)
    fun dispatch(command: GatewayCommand, callback: GatewayCallback)
}

/** #280：洞悉配置、生成、追问与快照刷新入口的 owner 边界。 */
interface InsightGateway {
    fun dispatch(command: GatewayCommand, callback: GatewayCallback)
}

/**
 * #280：同一领域的读取防抖。相同 dataRevision 只允许一个 in-flight 请求；
 * 旧回调不能覆盖更新 revision。它只保存协议元数据，不保存业务内容。
 */
class GatewayRevisionGate {
    private val inFlight = mutableMapOf<String, Long>()
    private val completed = mutableMapOf<String, Long>()

    @Synchronized
    fun claim(domain: String, requestId: String, dataRevision: Long): Boolean {
        val running = inFlight[domain]
        if (running != null && running == dataRevision) return false
        val done = completed[domain]
        if (done != null && done == dataRevision) return false
        inFlight[domain] = dataRevision
        return true
    }

    @Synchronized
    fun complete(domain: String, dataRevision: Long): Boolean {
        val running = inFlight[domain] ?: return false
        if (running != dataRevision) return false
        inFlight.remove(domain)
        completed[domain] = dataRevision
        return true
    }

    @Synchronized
    fun invalidate(domain: String) {
        inFlight.remove(domain)
        completed.remove(domain)
    }
}
