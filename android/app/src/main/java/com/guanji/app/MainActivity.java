package com.guanji.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.app.TimePickerDialog;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.View;
import android.webkit.WebView;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.util.Log;
import java.lang.ref.WeakReference;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

import androidx.activity.EdgeToEdge;
import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.splashscreen.SplashScreenViewProvider;

public class MainActivity extends BridgeActivity {

    private volatile boolean startupReady = false;
    private volatile long startupStartedAt;
    private SplashScreen splashScreen;
    private NativeRoot nativeRoot;
    /** #280：设置页交给 WebView 弹层时的恢复轮询。只负责宿主所有权，不读业务数据。 */
    private final Handler settingsOverlayHandler = new Handler(Looper.getMainLooper());
    private int settingsOverlayToken = 0;
    /** #279：一次性数据维护请求；只保存 requestId -> 动作类型，不保存业务数据。 */
    private final Map<String, String> nativeMaintenanceRequests = new HashMap<>();
    /** #280：所有迁移期领域先通过各自 Gateway，再进入对应 JS/Capacitor owner。 */
    private final GatewayRevisionGate gatewayRevisionGate = new GatewayRevisionGate();
    private long settingsRevision = 0L;
    private long backupRevision = 0L;
    private final SettingsGateway settingsGateway = new LegacyJsSettingsGateway();
    private final BackupGateway backupGateway = new LegacyJsBackupGateway();
    private final RecordFlowGateway recordFlowGateway = new LegacyJsRecordFlowGateway();
    private final InsightGateway insightGateway = new LegacyJsInsightGateway();
    private volatile long activeBackupRevision = 0L;
    /** #279：迁移期先由 JS/Capacitor 适配器实现统一 Gateway。 */
    private final DataMaintenanceGateway dataMaintenanceGateway = new LegacyJsDataMaintenanceAdapter();
    /** #279：Native secure confirmation has one in-flight command at a time. */
    private boolean nativeSecureModeInFlight = false;
    /** #279 follow-up: plain -> encrypted has its own Native confirmation and request state. */
    private boolean nativeSecureEnableInFlight = false;
    /** #280 P0: encrypted password change is a Native route; JS remains the data owner. */
    private boolean nativeSecureChangeInFlight = false;
    private String nativeRestoreRequestId;
    /** #279 follow-up: row feedback is a short-lived acknowledgement, not a setting. */
    private int nativeClearFeedbackToken = 0;
    private int nativeRestoreFeedbackToken = 0;

    /** 桌面小组件点击标记：打开 App 后弹出记录面板 */
    public static final String EXTRA_GUANJI_RECORD = "guanji_record";
    /** 桌面小组件点击标记：打开 App 后自动保存一条「就现在」默认记录 */
    public static final String EXTRA_GUANJI_QUICK_RECORD = "guanji_quick_record";
    /** #57：实况通知「结束并记录」按钮（结束计时 → 直达详情） */
    public static final String EXTRA_GUANJI_TIMER_FINISH = "guanji_timer_finish";
    /** #57：实况通知「取消」按钮（取消计时） */
    public static final String EXTRA_GUANJI_TIMER_CANCEL = "guanji_timer_cancel";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        /* #201：必须在 super.onCreate 前安装兼容 API 的原生首帧。 */
        splashScreen = SplashScreen.installSplashScreen(this);
        /* #280 global window contract: API 35+ devices already enforce
           edge-to-edge, while Android 13/Flyme still reports an app area
           clipped by the status/navigation bars unless the app opts in.
           AndroidX owns the complete compatibility setup (decor fitting,
           transparent bars and cutout policy) once at the single Activity.
           NativeRoot then distributes insets to the concrete screen/sheet
           that needs them; no page may recreate this window policy. */
        EdgeToEdge.enable(this);
        /* #206：系统层只做首帧保护；WebView 首帧信号优先，1200ms watchdog 防止异常加载阻塞启动。 */
        startupStartedAt = SystemClock.uptimeMillis();
        splashScreen.setKeepOnScreenCondition(() ->
                !startupReady && SystemClock.uptimeMillis() - startupStartedAt < 1200L);
        /* #206：保护层退出后由真实首页问候文案承担唯一产品层微转场。 */
        splashScreen.setOnExitAnimationListener(this::removeSplashImmediately);
        super.onCreate(savedInstanceState);
        /* #273：在同一 MainActivity 中安装唯一 NativeRoot；原生区域默认隐藏，
           因此 v4.1.5 WebView 页面仍是用户可见内容。不得为页面新增 Activity。 */
        nativeRoot = NativeRootHost.install(this);
        /* #276：ComponentActivity 的 OnBackInvokedDispatcher 优先于旧
           onBackPressed()；在统一 dispatcher 上拦截原生记录返回，避免返回键
           直接退出 Activity 或回到 WebView 的错误页面。 */
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (NativeRootHost.hasNativeRecordContext(MainActivity.this)) {
                    handleNativeRecordAction("record-close", null);
                } else if (NativeRootHost.hasNativeDataMaintenanceTask(MainActivity.this)) {
                    NativeRootHost.clearNativeDataMaintenance(MainActivity.this);
                } else if (NativeRootHost.hasNativeSecureMode(MainActivity.this)) {
                    nativeSecureModeInFlight = false;
                    NativeRootHost.clearNativeSecureMode(MainActivity.this);
                } else if (NativeRootHost.hasNativeSecureEnable(MainActivity.this)) {
                    nativeSecureEnableInFlight = false;
                    NativeRootHost.clearNativeSecureEnable(MainActivity.this);
                } else if (NativeRootHost.hasNativeSecureChange(MainActivity.this)) {
                    nativeSecureChangeInFlight = false;
                    NativeRootHost.clearNativeSecureChange(MainActivity.this);
                } else if (NativeRootHost.hasNativeDataScope(MainActivity.this)) {
                    NativeRootHost.clearNativeDataScope(MainActivity.this);
                } else if (NativeRootHost.hasNativeBackupContext(MainActivity.this)) {
                    NativeRootHost.clearNativeBackupContext(MainActivity.this);
                } else if (NativeRootHost.hasNativeCalendarContext(MainActivity.this)) {
                    NativeRootHost.setNativeCalendarVisible(MainActivity.this, false);
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                    setEnabled(true);
                }
            }
        });
        /* #275：调试构建默认沿用已保存的 NativeRoute 开关；公开构建保持 WebView。 */
        NativeRootHost.setNativeRouteDebugEnabled(this, NativeRootHost.isNativeRouteDebugEnabled(this));
        NativeRootHost.setNativeHomeActionListener(this, (action, value) -> handleNativeHomeAction(action, value));
        NativeRootHost.setNativeRecordActionListener(this, (action, value) -> handleNativeRecordAction(action, value));
        /* #274：同一宿主接管 WebView Tab；正文仍留在 WebView。 */
        bindNativeTabBridge();
        /* #274 修复：原生 Tab 等待 WebView 完成主题/材质同步后再显示，
           不在宿主侧写死浅色状态，避免深色模式出现白色承载层。 */
        runWhenReady("window.__guanjiSetNativeTabEnabled ? (window.__guanjiSetNativeTabEnabled(true), 'ok') : 'pending'");
        refreshNativeHomeSnapshot();
        refreshNativeSettingsSnapshot();
        restoreNativeTimerIfNeeded();
        /* #205：WebView 首次绘制前也使用同源背景，避免系统启动层退出后回落纯白。 */
        final WebView contentView = bridge != null ? bridge.getWebView() : null;
        if (contentView != null) contentView.setBackgroundColor(getColor(R.color.splash_background));
        handleWidgetIntent(getIntent());
        handleTimerIntent(getIntent());
        handleTimerDismissFlag();
    }

    /* 自定义插件注册必须在 bridge 创建（super.load）之前 */
    @Override
    public void load() {
        /*
         * Kotlin 插件与 Java 主 Activity 位于同一 app module。AGP/Kotlin 2.x
         * 在干净构建中不会把同模块 Kotlin 输出稳定地暴露给 Java 编译快照，
         * 因此这里按插件全限定名运行时注册，保持现有 Capacitor 插件入口，
         * 同时避免为单个节点注入一套脆弱的 JavaCompile classpath 规则。
         */
        registerPluginByName("com.guanji.app.WidgetStatsPlugin");
        registerPluginByName("com.guanji.app.TimerLiveUpdatePlugin");
        registerPluginByName("com.guanji.app.SaveToDownloadsPlugin");
        registerPluginByName("com.guanji.app.GuanjiDavPlugin");
        registerPluginByName("com.guanji.app.StartupReadyPlugin");
            registerPluginByName("com.guanji.app.NativeHomeSnapshotPlugin");
            registerPluginByName("com.guanji.app.BehaviorSnapshotPlugin");
            registerPluginByName("com.guanji.app.RoomShadowPlugin");
        super.load();
        final WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView != null) {
            webView.addJavascriptInterface(new NativeTabBridge(this), "GuanjiNativeTab");
            // Async JS snapshots cannot be returned through evaluateJavascript:
            // WebView serializes the pending Promise as {}.  Use a one-way,
            // read-only callback for the backup snapshot instead.
            webView.addJavascriptInterface(new NativeBackupBridge(this), "GuanjiNativeBackup");
            webView.addJavascriptInterface(new NativeDataMaintenanceBridge(this), "GuanjiNativeDataMaintenance");
            webView.addJavascriptInterface(new NativeSecureModeBridge(this), "GuanjiNativeSecureMode");
            webView.addJavascriptInterface(new NativeSecureEnableBridge(this), "GuanjiNativeSecureEnable");
            webView.addJavascriptInterface(new NativeSecureChangeBridge(this), "GuanjiNativeSecureChange");
        }
    }

    @SuppressWarnings("unchecked")
    private void registerPluginByName(String className) {
        try {
            Class<?> pluginType = Class.forName(className);
            if (!Plugin.class.isAssignableFrom(pluginType)) {
                throw new IllegalStateException(className + " is not a Capacitor Plugin");
            }
            registerPlugin((Class<? extends Plugin>) pluginType);
        } catch (ClassNotFoundException error) {
            throw new IllegalStateException("Required Capacitor plugin missing: " + className, error);
        }
    }

    /** #201/#206：WebView 首帧信号只结束有上限的系统保护层，不等待业务、AI 或网络。 */
    public void markStartupReady() {
        if (startupReady) return;
        startupReady = true;
    }

    private void removeSplashImmediately(SplashScreenViewProvider provider) {
        /* 背景已与首页同源，先隐藏再移除，避免系统层与首页显现叠加第二段淡出。 */
        final View splash = provider.getView();
        splash.setAlpha(0f);
        provider.remove();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleWidgetIntent(intent);
        handleTimerIntent(intent);
        handleTimerDismissFlag();
    }

    /** #276：原生记录 Surface 由同一宿主接管返回；不让系统返回键误退出 Activity。 */
    @Override
    public void onBackPressed() {
        if (NativeRootHost.hasNativeRecordContext(this)) {
            handleNativeRecordAction("record-close", null);
        } else if (NativeRootHost.hasNativeDataMaintenanceTask(this)) {
            NativeRootHost.clearNativeDataMaintenance(this);
            return;
        } else if (NativeRootHost.hasNativeSecureMode(this)) {
            nativeSecureModeInFlight = false;
            NativeRootHost.clearNativeSecureMode(this);
            return;
        } else if (NativeRootHost.hasNativeSecureEnable(this)) {
            nativeSecureEnableInFlight = false;
            NativeRootHost.clearNativeSecureEnable(this);
            return;
        } else if (NativeRootHost.hasNativeSecureChange(this)) {
            nativeSecureChangeInFlight = false;
            NativeRootHost.clearNativeSecureChange(this);
            return;
        } else if (NativeRootHost.hasNativeDataScope(this)) {
            NativeRootHost.clearNativeDataScope(this);
            return;
        } else if (NativeRootHost.hasNativeOpenSourceLicenses(this)) {
            NativeRootHost.clearNativeOpenSourceLicenses(this);
            return;
        } else if (NativeRootHost.hasNativeBackupContext(this)) {
            NativeRootHost.clearNativeBackupContext(this);
            return;
        } else if (NativeRootHost.hasNativeCalendarContext(this)) {
            NativeRootHost.setNativeCalendarVisible(this, false);
            return;
        }
        super.onBackPressed();
    }

    /* #57：实况通知操作按钮（冷启动/热启动均可，runWhenReady 等到 JS 就绪；
       冷启动场景 JS 层 restoreTimer 先恢复计时，随后 finish/cancel 自然衔接） */
    private void handleTimerIntent(Intent intent) {
        if (intent == null) return;
        if (intent.getBooleanExtra(EXTRA_GUANJI_TIMER_FINISH, false)) {
            intent.removeExtra(EXTRA_GUANJI_TIMER_FINISH);
            runWhenReady("window.__guanjiTimerFinish ? (window.__guanjiTimerFinish(), 'ok') : 'pending'");
        } else if (intent.getBooleanExtra(EXTRA_GUANJI_TIMER_CANCEL, false)) {
            intent.removeExtra(EXTRA_GUANJI_TIMER_CANCEL);
            runWhenReady("window.__guanjiTimerCancel ? (window.__guanjiTimerCancel(), 'ok') : 'pending'");
        }
    }

    /* #51：计时通知被划掉 → 读标记后清掉，通知 JS 温和提示一次 */
    private void handleTimerDismissFlag() {
        /* 与 TimerLiveUpdatePlugin.Companion 保持同一持久化键，避免 Java 编译时
           依赖同模块 Kotlin 类型；键名是跨版本数据契约，不能随意变更。 */
        final String timerPrefs = "guanji_timer_flags";
        final String dismissedKey = "notif_dismissed";
        SharedPreferences prefs = getSharedPreferences(timerPrefs, MODE_PRIVATE);
        if (prefs.getBoolean(dismissedKey, false)) {
            prefs.edit().remove(dismissedKey).apply();
            runWhenReady("window.__guanjiTimerDismissed ? (window.__guanjiTimerDismissed(), 'ok') : 'pending'");
        }
    }

    private void handleWidgetIntent(Intent intent) {
        if (intent == null) return;
        if (intent.getBooleanExtra(EXTRA_GUANJI_RECORD, false)) {
            intent.removeExtra(EXTRA_GUANJI_RECORD);
            runWhenReady("window.__guanjiOpenRecord ? (window.__guanjiOpenRecord(), 'ok') : 'pending'");
        } else if (intent.getBooleanExtra(EXTRA_GUANJI_QUICK_RECORD, false)) {
            intent.removeExtra(EXTRA_GUANJI_QUICK_RECORD);
            runWhenReady("window.__guanjiQuickRecord ? (window.__guanjiQuickRecord(), 'ok') : 'pending'");
        }
    }

    /* 等 WebView 就绪后执行 JS（冷启动/热启动均可，最多重试 40 次约 12 秒）。
       evaluateJavascript 回调值带 JSON 引号（如 "ok"），需匹配带引号形式 */
    private void runWhenReady(String jsExpr) {
        evaluateWhenReady(jsExpr, value -> { });
    }

    /** #276：需要读取 JS 兼容上下文时使用一次异步回调，仍受统一就绪重试上限保护。 */
    private void evaluateWhenReady(String jsExpr, ValueCallback<String> callback) {
        final WebView wv = bridge != null ? bridge.getWebView() : null;
        if (wv == null) return;
        wv.postDelayed(new Runnable() {
            int tries = 0;

            @Override
            public void run() {
                tries++;
                wv.evaluateJavascript(jsExpr, value -> {
                    boolean pending = value == null || value.trim().equals("null") || value.trim().equals("\"pending\"");
                    if (!pending) {
                        if (callback != null) callback.onReceiveValue(value);
                    } else if (tries < 40) wv.postDelayed(this, 300);
                });
            }
        }, 500);
    }

    /**
     * #280：设置页点击不能继承冷启动读取的 500ms 首次等待。先尝试当前
     * WebView，未就绪时用短间隔重试；Compose 已经先给出 optimistic 反馈，
     * 因此这里只负责把动作尽快交给既有 JS 所有者。
     */
    private void evaluateWhenReadyImmediate(String jsExpr, ValueCallback<String> callback) {
        final WebView wv = bridge != null ? bridge.getWebView() : null;
        if (wv == null) return;
        wv.post(new Runnable() {
            int tries = 0;

            @Override
            public void run() {
                tries++;
                wv.evaluateJavascript(jsExpr, value -> {
                    boolean pending = value == null || value.trim().equals("null") || value.trim().equals("\"pending\"");
                    if (!pending) {
                        if (callback != null) callback.onReceiveValue(value);
                    } else if (tries < 40) {
                        wv.postDelayed(this, 100);
                    }
                });
            }
        });
    }

    /** #275：Native 首页只触发既有 WebView Sheet/Room 链，不在 Compose 层复制写入逻辑。 */
    private void handleNativeHomeAction(String action, String value) {
        if (action == null) return;
        if (action.startsWith("backup-")) {
            handleNativeBackupAction(action.substring("backup-".length()), value);
            return;
        }
        if (action.startsWith("maintenance-")) {
            handleNativeDataMaintenanceAction(action.substring("maintenance-".length()), value);
            return;
        }
        if (action.startsWith("secure-mode-")) {
            handleNativeSecureModeAction(action.substring("secure-mode-".length()));
            return;
        }
        if (action.startsWith("secure-enable-")) {
            handleNativeSecureEnableAction(action.substring("secure-enable-".length()), value);
            return;
        }
        if (action.startsWith("secure-change-")) {
            handleNativeSecureChangeAction(action.substring("secure-change-".length()), value);
            return;
        }
        if (action.startsWith("settings-")) {
            if ("settings-backup".equals(action)) {
                openNativeBackupContext();
                return;
            }
            handleNativeSettingsAction(action.substring("settings-".length()), value);
            return;
        }
        if ("insight-configure".equals(action)) {
            insightGateway.dispatch(new GatewayCommand(UUID.randomUUID().toString(), "configure", null, 0L), result -> { });
            return;
        }
        if ("insight-generate".equals(action)) {
            insightGateway.dispatch(new GatewayCommand(UUID.randomUUID().toString(), "generate", null, 0L), result -> { });
            return;
        }
        if ("insight-ask".equals(action) && value != null) {
            insightGateway.dispatch(new GatewayCommand(UUID.randomUUID().toString(), "ask", value, 0L), result -> { });
            return;
        }
        if ("calendar-open".equals(action)) {
            /* 原 WebView sheet 的 z-index 高于 tabbar；NativeRoot 已在入口首帧
               锁定弹层层级，Tab 视觉保留在遮罩下方但不再接受输入。 */
            NativeRootHost.setNativeCalendarVisible(this, true);
            return;
        }
        if ("calendar-close".equals(action)) {
            NativeRootHost.setNativeCalendarVisible(this, false);
            return;
        }
        if ("record".equals(action)) {
            /* 直接记录入口不能等待 WebView 的 500ms ready 重试：首帧先用
               已缓存的轻量偏好和自定义字典创建 Native Sheet，首页保持在下层；
               记录提交仍回到既有 JS/Room 权威链。记录弹层与页面、唯一 Tab
               在同一 Compose 树中按固定顺序绘制，不切换 Tab 可见性或宿主层级。 */
            NativeRootHost.setNativeRecordContext(this, buildImmediateNativeNowContext());
            NativeRootHost.setNativeModalVisible(this, true);
        } else if ("edit".equals(action) && value != null) {
            openNativeRecordContext("edit", value);
        } else if ("backfill".equals(action)) {
            openNativeRecordContext("backfill", value == null ? "0" : value);
        } else if ("delete".equals(action) && value != null) {
            NativeRootHost.suppressNativeHome(this, true);
            runWhenReady("window.__guanjiDeleteRecord ? (window.__guanjiDeleteRecord(" + JSONObject.quote(value) + "), 'ok') : 'pending'");
            new android.os.Handler(getMainLooper()).postDelayed(() -> {
                refreshNativeHomeSnapshot();
                NativeRootHost.suppressNativeHome(this, false);
            }, 700L);
        }
    }

    /** #276 follow-up：构造可在点击回调内立即使用的记录首帧上下文。 */
    private String buildImmediateNativeNowContext() {
        try {
            JSONObject context = new JSONObject()
                    .put("kind", "now")
                    .put("preferredMode", readNativePreferredRecordMode());
            SharedPreferences prefs = getSharedPreferences(NativeHomeSnapshotPlugin.PREFS, MODE_PRIVATE);
            String raw = prefs.getString(NativeHomeSnapshotPlugin.KEY_SNAPSHOT, "");
            if (raw != null && !raw.trim().isEmpty()) {
                JSONObject snapshot = new JSONObject(raw);
                JSONArray options = snapshot.optJSONArray("customObservationOptions");
                if (options != null) context.put("customOptions", options);
            }
            return context.toString();
        } catch (Exception ignored) {
            return "{\"kind\":\"now\",\"preferredMode\":\"timer\"}";
        }
    }

    /** 快照缺失（首次启动/旧版本）时沿用 WebView 的计时记录默认值。 */
    private String readNativePreferredRecordMode() {
        try {
            SharedPreferences prefs = getSharedPreferences(NativeHomeSnapshotPlugin.PREFS, MODE_PRIVATE);
            JSONObject snapshot = new JSONObject(prefs.getString(NativeHomeSnapshotPlugin.KEY_SNAPSHOT, ""));
            return "quick".equals(snapshot.optString("preferredRecordMode", "timer")) ? "quick" : "timer";
        } catch (Exception ignored) {
            return "timer";
        }
    }

    /** #276：请求 WebView 提供一次记录上下文；只传渲染所需字段，不复制整库。 */
    private void openNativeRecordContext(String kind, String value) {
        recordFlowGateway.readContext(
                new GatewayCommand(UUID.randomUUID().toString(), kind, value, 0L),
                result -> {
                    if (!"completed".equals(result.getStatus())) return;
                    final String context = result.getMessage();
                    if (context == null || context.trim().isEmpty() || "pending".equals(context)) return;
                    runOnUiThread(() -> NativeRootHost.setNativeRecordContext(this, context));
                });
    }

    /** #276：Native 记录 Surface 的唯一动作入口。保存仍回到现有 JS/Room 提交链。 */
    private void handleNativeRecordAction(String action, String value) {
        if (action == null) return;
        Log.d("GuanjiNative276", "action=" + action);
        if ("record-close".equals(action)) {
            // 保留首页与 Sheet 宿主到退场动画完成；NativeRecordSurface 会在
            // 同一树内发送 record-exit-complete，避免瞬间切换造成白屏/跳帧。
            NativeRootHost.requestNativeRecordClose(this);
            return;
        }
        if ("record-exit-complete".equals(action)) {
            NativeRootHost.clearNativeRecordContext(this);
            refreshNativeHomeSnapshot();
            return;
        }
        if ("custom-observation-delete".equals(action) && value != null) {
            String expr = "window.__guanjiDeleteCustomObservation ? (window.__guanjiDeleteCustomObservation(" + JSONObject.quote(value) + "), 'ok') : 'pending'";
            runWhenReady(expr);
            return;
        }
        if ("record-save".equals(action) && value != null) {
            recordFlowGateway.dispatch(
                    new GatewayCommand(UUID.randomUUID().toString(), "record-save", value, 0L),
                    result -> {
                String rawResult = result.getMessage();
                Log.d("GuanjiNative276", "commitStatus=" + result.getStatus());
                try {
                    JSONObject json = rawResult == null ? new JSONObject() : new JSONObject(rawResult);
                    if (!json.optBoolean("ok", false)) return;
                    runOnUiThread(() -> {
                        NativeRootHost.requestNativeRecordClose(this);
                        new android.os.Handler(getMainLooper()).postDelayed(() -> {
                            refreshNativeHomeSnapshot();
                        }, 420L);
                    });
                } catch (Exception error) { Log.e("GuanjiNative276", "commit parse failed", error); }
            });
            return;
        }
        if ("timer-start".equals(action)) {
            long start = parseLong(value, System.currentTimeMillis());
            getSharedPreferences(NATIVE_TIMER_PREFS, MODE_PRIVATE).edit().putLong(NATIVE_TIMER_START, start).apply();
            runWhenReady("window.__guanjiNativeTimerNotifyStart ? (window.__guanjiNativeTimerNotifyStart(" + start + "), 'ok') : 'pending'");
            return;
        }
        if ("timer-finish".equals(action)) {
            getSharedPreferences(NATIVE_TIMER_PREFS, MODE_PRIVATE).edit().remove(NATIVE_TIMER_START).apply();
            runWhenReady("window.__guanjiNativeTimerNotifyStop ? (window.__guanjiNativeTimerNotifyStop(), 'ok') : 'pending'");
            return;
        }
        if ("timer-resume".equals(action)) {
            long start = parseLong(value, System.currentTimeMillis());
            getSharedPreferences(NATIVE_TIMER_PREFS, MODE_PRIVATE).edit().putLong(NATIVE_TIMER_START, start).apply();
            runWhenReady("window.__guanjiNativeTimerNotifyStart ? (window.__guanjiNativeTimerNotifyStart(" + start + "), 'ok') : 'pending'");
            return;
        }
        if ("timer-cancel".equals(action)) {
            getSharedPreferences(NATIVE_TIMER_PREFS, MODE_PRIVATE).edit().remove(NATIVE_TIMER_START).apply();
            runWhenReady("window.__guanjiNativeTimerNotifyStop ? (window.__guanjiNativeTimerNotifyStop(), 'ok') : 'pending'");
        }
    }

    private static final String NATIVE_TIMER_PREFS = "guanji_native_record_timer";
    private static final String NATIVE_TIMER_START = "start_time_ms";

    private void restoreNativeTimerIfNeeded() {
        long start = getSharedPreferences(NATIVE_TIMER_PREFS, MODE_PRIVATE).getLong(NATIVE_TIMER_START, 0L);
        if (start <= 0L || !NativeRootHost.isNativeRouteDebugEnabled(this)) return;
        try {
            String context = new JSONObject().put("kind", "now").put("preferredMode", "timer").put("timerStartMs", start).toString();
            NativeRootHost.setNativeRecordContext(this, context);
        } catch (Exception ignored) { return; }
        runWhenReady("window.__guanjiNativeTimerNotifyStart ? (window.__guanjiNativeTimerNotifyStart(" + start + "), 'ok') : 'pending'");
    }

    private static long parseLong(String value, long fallback) {
        try { return Long.parseLong(value == null ? "" : value); } catch (Exception ignored) { return fallback; }
    }

    private static String decodeJavascriptString(String raw) {
        if (raw == null) return null;
        try {
            Object decoded = new org.json.JSONTokener(raw).nextValue();
            return decoded == null ? null : String.valueOf(decoded);
        } catch (Exception ignored) {
            return raw;
        }
    }

    private void refreshNativeHomeSnapshot() {
        SharedPreferences prefs = getSharedPreferences(NativeHomeSnapshotPlugin.PREFS, MODE_PRIVATE);
        NativeRootHost.setNativeHomeSnapshot(this, prefs.getString(NativeHomeSnapshotPlugin.KEY_SNAPSHOT, ""));
    }

    /** #279：备份页面只从 WebView 读取脱敏状态快照；不复制原始记录和口令。 */
    private void openNativeBackupContext() {
        openNativeBackupContext(true);
    }

    /**
     * Read the backup snapshot without tearing down the currently visible
     * sheet.  The initial route may publish an explicit loading snapshot;
     * refreshes (upload, auto-sync, delete and retry) must keep the previous
     * content in place and replace only the returned data.
     */
    private void openNativeBackupContext(boolean showInitialLoading) {
        Log.d("GuanjiNative280", "openNativeBackupContext: request");
        // Publish an explicit loading snapshot only for the first opening.
        // During a refresh, retaining the current context prevents the whole
        // Bottom Sheet from being remeasured/re-entered while the WebView
        // bridge performs its asynchronous read.
        if (showInitialLoading || !NativeRootHost.hasNativeBackupContext(this)) {
            try {
                NativeRootHost.setNativeBackupContext(this, new JSONObject()
                        .put("dataState", "loading")
                        .put("localFilesState", "loading")
                        .put("serverFilesState", "loading")
                        .toString());
            } catch (Exception ignored) { }
        }
        // Do not return the async Promise from evaluateJavascript: Android's
        // WebView serializes that Promise as {}.  The JS side resolves the
        // snapshot and calls NativeBackupBridge.onContext exactly once.
        final long revision = ++backupRevision;
        activeBackupRevision = revision;
        backupGateway.readSnapshot(
                new GatewayCommand(UUID.randomUUID().toString(), "read-backup", null, revision),
                result -> {
                    if ("failed".equals(result.getStatus())) {
                        NativeRootHost.setNativeBackupContext(this,
                                "{\"dataState\":\"error\",\"localFilesState\":\"error\",\"serverFilesState\":\"error\"}");
                    }
                });
    }

    private void refreshNativeBackupContextSoon() {
        if (!NativeRootHost.hasNativeBackupContext(this)) return;
        new android.os.Handler(getMainLooper()).postDelayed(() -> openNativeBackupContext(false), 260L);
    }

    /** #279：Native 备份动作回到既有 JS/Capacitor 协议链。 */
    private void handleNativeBackupAction(String type, String value) {
        if (type == null) return;
        if ("close".equals(type)) {
            // Keep the modal input boundary alive until the close pointer has
            // finished dispatching; otherwise the newly exposed settings page
            // can receive the same tap and open an unrelated control.
            new Handler(getMainLooper()).postDelayed(
                    () -> NativeRootHost.clearNativeBackupContext(this), 360L);
            return;
        }
        if ("refresh".equals(type)) {
            openNativeBackupContext(false);
            return;
        }
        if ("browse-local".equals(type)) {
            /* 文件选择器仍是系统入口；恢复结果回到 Native Restore Engine。 */
            runWhenReady("document.getElementById('secImportFile')?.click(); 'ok'");
            return;
        }
        if ("restore-local".equals(type) || "restore-server".equals(type)) {
            startNativeRestore("restore-server".equals(type), value);
            return;
        }
        if ("save-config".equals(type) && value != null) {
            backupGateway.dispatch(new GatewayCommand(UUID.randomUUID().toString(), type, value, backupRevision),
                    result -> refreshNativeBackupContextSoon());
            return;
        }
        if ("auto".equals(type)) {
            backupGateway.dispatch(new GatewayCommand(UUID.randomUUID().toString(), type, value == null ? "off" : value, backupRevision),
                    result -> refreshNativeBackupContextSoon());
            return;
        }
        if ("upload".equals(type)) {
            backupGateway.dispatch(new GatewayCommand(UUID.randomUUID().toString(), type, null, backupRevision),
                    result -> refreshNativeBackupContextSoon());
            return;
        }
        if ("delete-local".equals(type) || "delete-server".equals(type)) {
            backupGateway.dispatch(new GatewayCommand(UUID.randomUUID().toString(), type, value == null ? "" : value, backupRevision),
                    result -> refreshNativeBackupContextSoon());
        }
    }

    /** #279 follow-up: local/server restore share one Native Restore Engine.
     * The request contains only the selected file name, plan and password for
     * the in-process WebView call; it is never logged or persisted by Android.
     */
    private void startNativeRestore(boolean server, String rawValue) {
        if (nativeRestoreRequestId != null) return;
        JSONObject selection;
        try { selection = rawValue == null ? new JSONObject() : new JSONObject(rawValue); }
        catch (Exception ignored) { selection = new JSONObject(); }
        String name = selection.optString("name", "");
        String password = selection.optString("password", "");
        String plan = selection.optString("plan", "merge");
        if (name.trim().isEmpty()) {
            NativeRootHost.setNativeBackupRestoreResult(this, "请先选择备份文件");
            return;
        }
        nativeRestoreRequestId = UUID.randomUUID().toString();
        NativeRootHost.setNativeBackupRestoreRunning(this, true);
        try {
            JSONObject request = new JSONObject()
                    .put("requestId", nativeRestoreRequestId)
                    .put("source", server ? "server" : "local")
                    .put("name", name)
                    .put("password", password)
                    .put("plan", plan);
            String expr = "window.__guanjiNativeRestore ? window.__guanjiNativeRestore(" + JSONObject.quote(request.toString()) + ") : 'pending'";
            evaluateWhenReadyImmediate(expr, raw -> {
                String result = decodeJavascriptString(raw);
                if ("invalid".equals(result) || "unavailable".equals(result)) {
                    runOnUiThread(() -> {
                        nativeRestoreRequestId = null;
                        NativeRootHost.setNativeBackupRestoreResult(this, "恢复暂不可用，请重试");
                    });
                }
            });
        } catch (Exception error) {
            nativeRestoreRequestId = null;
            NativeRootHost.setNativeBackupRestoreResult(this, "恢复暂不可用，请重试");
        }
    }

    private void handleNativeBackupRestoreResult(String payload) {
        if (payload == null || payload.trim().isEmpty()) return;
        try {
            JSONObject result = new JSONObject(payload);
            String requestId = result.optString("requestId", "");
            if (nativeRestoreRequestId == null || !nativeRestoreRequestId.equals(requestId)) return;
            nativeRestoreRequestId = null;
            String status = result.optString("status", "failed");
            if ("completed".equals(status)) {
                int count = result.optInt("count", 0);
                NativeRootHost.setNativeBackupRestoreResult(this, "已恢复 " + count + " 条记录");
                refreshNativeHomeSnapshot();
                refreshNativeBackupContextSoon();
            } else {
                String code = result.optString("code", "");
                String message;
                if ("NEED_PASSWORD".equals(code)) message = "请输入备份口令";
                else if ("INVALID_PASSWORD".equals(code)) message = "口令错误或备份完整性校验失败";
                else if ("CORRUPTED_BACKUP".equals(code)) message = "备份文件损坏，未修改当前数据";
                else if ("NO_DATA".equals(code)) message = "备份中没有可恢复的记录";
                else message = result.optString("message", "恢复失败，当前数据未修改");
                NativeRootHost.setNativeBackupRestoreResult(this, message);
            }
        } catch (Exception error) {
            Log.e("GuanjiNative279", "backup restore result parse failed", error);
            nativeRestoreRequestId = null;
            NativeRootHost.setNativeBackupRestoreResult(this, "恢复失败，当前数据未修改");
        }
    }

    /** #278：读取设置页的脱敏快照；API 密钥只在 WebView/SecureStorage 内部流转。 */
    private void refreshNativeSettingsSnapshot() {
        final long revision = ++settingsRevision;
        settingsGateway.readSnapshot(
                new GatewayCommand(UUID.randomUUID().toString(), "read-settings", null, revision),
                result -> {
                    if (!"completed".equals(result.getStatus())) return;
                    final String context = result.getMessage();
                    if (context == null || context.trim().isEmpty() || "pending".equals(context)) return;
                    runOnUiThread(() -> NativeRootHost.setNativeSettingsSnapshot(this, context));
                });
    }

    private void refreshNativeSettingsSnapshotSoon() {
        // Snapshot reads are already asynchronous on the WebView thread. A
        // short coalescing delay keeps rapid taps from issuing a request per
        // frame while allowing the optimistic Compose state to be replaced
        // almost immediately by the persisted result.
        new android.os.Handler(getMainLooper()).postDelayed(this::refreshNativeSettingsSnapshot, 80L);
    }

    private void refreshNativeSettingsSnapshotRepeated() {
        final android.os.Handler handler = new android.os.Handler(getMainLooper());
        long[] delays = new long[] { 500L, 1800L, 5000L, 12000L, 17000L };
        for (long delay : delays) handler.postDelayed(this::refreshNativeSettingsSnapshot, delay);
    }

    /**
     * #280：Native 设置页交给既有 WebView 弹层后，不能永久停留在
     * nativeHomeSuppressed=true。弹层关闭后恢复同一 NativeRoute，并重新读取
     * 脱敏快照；其他仍由 WebView 承担的即时动作也会在短延迟后恢复。
     * 轮询只读取“是否有可见弹层”，不把记录、口令或配置内容过桥。
     */
    private void restoreNativeSettingsAfterDelegatedAction() {
        final int token = ++settingsOverlayToken;
        final long deadline = SystemClock.uptimeMillis() + 20000L;
        final Runnable[] pollHolder = new Runnable[1];
        pollHolder[0] = () -> {
            if (token != settingsOverlayToken) return;
            final WebView wv = bridge != null ? bridge.getWebView() : null;
            if (wv == null) {
                NativeRootHost.suppressNativeHome(this, false);
                refreshNativeSettingsSnapshot();
                return;
            }
            wv.evaluateJavascript(
                    "window.__guanjiNativeSettingsOverlayState ? window.__guanjiNativeSettingsOverlayState() : 'closed'",
                    raw -> {
                        if (token != settingsOverlayToken) return;
                        final String state = decodeJavascriptString(raw);
                        if (!"open".equals(state) || SystemClock.uptimeMillis() >= deadline) {
                            runOnUiThread(() -> {
                                if (token != settingsOverlayToken) return;
                                NativeRootHost.suppressNativeHome(this, false);
                                refreshNativeSettingsSnapshot();
                            });
                        } else {
                            settingsOverlayHandler.postDelayed(pollHolder[0], 220L);
                        }
                    });
        };
        settingsOverlayHandler.postDelayed(pollHolder[0], 120L);
    }

    /**
     * #278：设置页动作统一回到已有 WebView 处理器。只有需要弹层/系统选择器的
     * 动作才暂时让出 Native 正文，避免出现 WebView 弹窗被 Native 层遮挡。
     */
    private void handleNativeSettingsAction(String type, String value) {
        if (type == null) return;
        if ("reminder-time".equals(type)) {
            showReminderTimePicker(value);
            return;
        }
        // #279：数据维护动作必须在同一 NativeRoot 中完成。它们只通过
        // DataMaintenanceBridge 调用既有 JS 实现，不再打开旧 DOM 弹层。
        if ("export".equals(type) || "clear".equals(type)) {
            pendingNativeMaintenanceTask = type;
            NativeRootHost.openNativeDataMaintenance(this, type);
            return;
        }
        if ("restore".equals(type)) {
            pendingNativeMaintenanceTask = "restore";
            // Keep restore in the same Native task Sheet as export/clear. The
            // confirmation card owns the action; the JS/Room adapter only
            // starts after the user presses its primary footer button.
            NativeRootHost.openNativeDataMaintenance(this, "restore");
            return;
        }
        // #279：encrypted -> plain must not reopen the legacy secBackdrop.
        // The Native sheet confirms first; only the existing no-UI secureDisable
        // owner is called after confirm.
        if ("secure-mode".equals(type) && "plain".equals(value)) {
            NativeRootHost.openNativeSecureMode(this);
            return;
        }
        if ("secure-mode".equals(type) && "encrypted".equals(value)) {
            NativeRootHost.openNativeSecureEnable(this);
            return;
        }
        // #280 P0: keep both route surfaces inside NativeRoot. The existing
        // JS functions remain business owners, but their legacy DOM overlays
        // must never be opened from a Native settings click.
        if ("secure-change".equals(type)) {
            NativeRootHost.openNativeSecureChange(this);
            return;
        }
        if ("data-scope".equals(type)) {
            NativeRootHost.openNativeDataScope(this);
            return;
        }
        if ("open-source-licenses".equals(type)) {
            NativeRootHost.openNativeOpenSourceLicenses(this);
            return;
        }
        final boolean delegated = "about".equals(type) ||
                "secure-mode".equals(type);
        if (delegated) {
            NativeRootHost.suppressNativeHome(this, true);
            NativeRootHost.setNativeTabEnabled(this, true, routeKey ->
                    { runWhenReady("window.__guanjiSelectTab ? (window.__guanjiSelectTab(" + JSONObject.quote(routeKey) + "), 'ok') : 'pending'"); return kotlin.Unit.INSTANCE; });
        }
        settingsGateway.dispatch(new GatewayCommand(UUID.randomUUID().toString(), type, value, 0L), result -> {
            String status = result.getMessage();
            if ("unknown".equals(status) || "invalid".equals(status)) {
                // #280：即使 WebView 没有找到旧入口，也必须释放 Native 设置页，
                // 不能让一次失效动作把原生页面永久留在 suppressed 状态。
                if (delegated) restoreNativeSettingsAfterDelegatedAction();
                return;
            }
            runOnUiThread(() -> {
                refreshNativeSettingsSnapshotSoon();
                if ("ai-test".equals(type) || "live-test".equals(type) || "reminder-time".equals(type)) refreshNativeSettingsSnapshotRepeated();
            });
            if (delegated) restoreNativeSettingsAfterDelegatedAction();
        });
    }

    /** #279：处理原生数据维护面板动作，不改变既有数据所有者。 */
    private void handleNativeDataMaintenanceAction(String action, String value) {
        if (action == null) return;
        if ("cancel".equals(action)) {
            pendingNativeMaintenanceTask = null;
            NativeRootHost.clearNativeDataMaintenance(this);
            return;
        }
        if ("confirm".equals(action)) {
            // The current panel is opened from settings and only exposes export
            // or clear; inspect the rendered task through a small, non-sensitive
            // host callback rather than guessing from the button label.
            startNativeDataMaintenanceFromPanel(value);
        }
    }

    private void handleNativeSecureModeAction(String action) {
        if (action == null) return;
        if ("cancel".equals(action)) {
            nativeSecureModeInFlight = false;
            NativeRootHost.clearNativeSecureMode(this);
            refreshNativeSettingsSnapshotSoon();
            return;
        }
        if ("confirm".equals(action)) startNativeSecureDisable();
    }

    private void handleNativeSecureEnableAction(String action, String value) {
        if (action == null) return;
        if ("cancel".equals(action)) {
            nativeSecureEnableInFlight = false;
            NativeRootHost.clearNativeSecureEnable(this);
            refreshNativeSettingsSnapshotSoon();
            return;
        }
        if ("confirm".equals(action)) {
            String password = "";
            try {
                JSONObject payload = value == null ? new JSONObject() : new JSONObject(value);
                password = payload.optString("password", "");
            } catch (Exception ignored) { }
            if (password.length() < 8 || password.matches("\\d+")) {
                NativeRootHost.setNativeSecureEnableResult(this, "口令至少 8 位且不能是纯数字");
                return;
            }
            startNativeSecureEnable(password);
        }
    }

    private void startNativeSecureEnable(String password) {
        if (nativeSecureEnableInFlight) return;
        nativeSecureEnableInFlight = true;
        NativeRootHost.setNativeSecureEnableRunning(this, true);
        // The passphrase is quoted only into the in-process WebView expression;
        // it is never logged or sent back through the JS bridge.
        evaluateWhenReadyImmediate(
                "window.__guanjiNativeSecureEnable ? window.__guanjiNativeSecureEnable(" + JSONObject.quote(password) + ") : 'pending'",
                raw -> {
                    String result = decodeJavascriptString(raw);
                    if ("invalid".equals(result)) {
                        runOnUiThread(() -> {
                            nativeSecureEnableInFlight = false;
                            NativeRootHost.setNativeSecureEnableResult(this, "口令至少 8 位且不能是纯数字");
                        });
                    } else if (!"started".equals(result) && !"running".equals(result)) {
                        runOnUiThread(() -> {
                            nativeSecureEnableInFlight = false;
                            NativeRootHost.setNativeSecureEnableResult(this, "操作暂不可用，请重试");
                        });
                    }
                });
    }

    private void handleNativeSecureEnableResult(String payload) {
        if (payload == null || payload.trim().isEmpty()) return;
        try {
            JSONObject result = new JSONObject(payload);
            String status = result.optString("status", "failed");
            nativeSecureEnableInFlight = false;
            if ("completed".equals(status)) {
                NativeRootHost.setNativeSecureEnableResult(this, "已开启");
                refreshNativeHomeSnapshot();
                refreshNativeSettingsSnapshotSoon();
                new Handler(getMainLooper()).postDelayed(() -> NativeRootHost.clearNativeSecureEnable(this), 900L);
            } else if ("cancelled".equals(status)) {
                NativeRootHost.setNativeSecureEnableResult(this, "已取消");
            } else {
                NativeRootHost.setNativeSecureEnableResult(this, "操作失败，请重试");
            }
        } catch (Exception error) {
            nativeSecureEnableInFlight = false;
            NativeRootHost.setNativeSecureEnableResult(this, "操作失败，请重试");
            Log.e("GuanjiNative279", "secure enable result parse failed", error);
        }
    }

    private void startNativeSecureDisable() {
        if (nativeSecureModeInFlight) return;
        nativeSecureModeInFlight = true;
        NativeRootHost.setNativeSecureModeRunning(this, true);
        evaluateWhenReadyImmediate(
                "window.__guanjiNativeSecureDisable ? window.__guanjiNativeSecureDisable() : 'pending'",
                raw -> {
                    String result = decodeJavascriptString(raw);
                    if (!"started".equals(result) && !"running".equals(result)) {
                        runOnUiThread(() -> {
                            nativeSecureModeInFlight = false;
                            NativeRootHost.setNativeSecureModeResult(this, "操作暂不可用，请重试");
                        });
                    }
                });
    }

    private void handleNativeSecureModeResult(String payload) {
        if (payload == null || payload.trim().isEmpty()) return;
        try {
            JSONObject result = new JSONObject(payload);
            String status = result.optString("status", "failed");
            nativeSecureModeInFlight = false;
            if ("completed".equals(status)) {
                NativeRootHost.setNativeSecureModeResult(this, "已关闭");
                refreshNativeHomeSnapshot();
                refreshNativeSettingsSnapshotSoon();
                new Handler(getMainLooper()).postDelayed(() -> NativeRootHost.clearNativeSecureMode(this), 900L);
            } else if ("cancelled".equals(status)) {
                NativeRootHost.setNativeSecureModeResult(this, "已取消");
            } else {
                NativeRootHost.setNativeSecureModeResult(this, "操作失败，请重试");
            }
        } catch (Exception error) {
            nativeSecureModeInFlight = false;
            NativeRootHost.setNativeSecureModeResult(this, "操作失败，请重试");
            Log.e("GuanjiNative279", "secure result parse failed", error);
        }
    }

    /** #280 P0: Native password-change sheet; only a terminal status crosses back. */
    private void handleNativeSecureChangeAction(String action, String value) {
        if (action == null) return;
        if ("cancel".equals(action)) {
            nativeSecureChangeInFlight = false;
            NativeRootHost.clearNativeSecureChange(this);
            return;
        }
        if (!"confirm".equals(action)) return;
        String password = "";
        try {
            JSONObject payload = value == null ? new JSONObject() : new JSONObject(value);
            password = payload.optString("password", "");
        } catch (Exception ignored) { }
        if (password.length() < 8 || password.matches("\\d+")) {
            NativeRootHost.setNativeSecureChangeResult(this, "口令至少 8 位且不能是纯数字");
            return;
        }
        startNativeSecureChange(password);
    }

    private void startNativeSecureChange(String password) {
        if (nativeSecureChangeInFlight) return;
        nativeSecureChangeInFlight = true;
        NativeRootHost.setNativeSecureChangeRunning(this, true);
        evaluateWhenReadyImmediate(
                "window.__guanjiNativeSecureChange ? window.__guanjiNativeSecureChange(" + JSONObject.quote(password) + ") : 'pending'",
                raw -> {
                    String result = decodeJavascriptString(raw);
                    if ("invalid".equals(result)) {
                        runOnUiThread(() -> {
                            nativeSecureChangeInFlight = false;
                            NativeRootHost.setNativeSecureChangeResult(this, "口令至少 8 位且不能是纯数字");
                        });
                    } else if (!"started".equals(result) && !"running".equals(result)) {
                        runOnUiThread(() -> {
                            nativeSecureChangeInFlight = false;
                            NativeRootHost.setNativeSecureChangeResult(this, "操作暂不可用，请重试");
                        });
                    }
                });
    }

    private void handleNativeSecureChangeResult(String payload) {
        if (payload == null || payload.trim().isEmpty()) return;
        try {
            JSONObject result = new JSONObject(payload);
            String status = result.optString("status", "failed");
            nativeSecureChangeInFlight = false;
            if ("completed".equals(status)) {
                NativeRootHost.setNativeSecureChangeResult(this, "已更新");
                refreshNativeSettingsSnapshotSoon();
                new Handler(getMainLooper()).postDelayed(() -> NativeRootHost.clearNativeSecureChange(this), 900L);
            } else if ("cancelled".equals(status)) {
                NativeRootHost.setNativeSecureChangeResult(this, "已取消");
            } else {
                NativeRootHost.setNativeSecureChangeResult(this, "操作失败，请重试");
            }
        } catch (Exception error) {
            nativeSecureChangeInFlight = false;
            NativeRootHost.setNativeSecureChangeResult(this, "操作失败，请重试");
            Log.e("GuanjiNative280", "secure change result parse failed", error);
        }
    }

    private void startNativeDataMaintenanceFromPanel(String value) {
        // NativeRoot keeps the task private to keep route state single-owned. The
        // bridge action is selected by the pending panel task retained here.
        String task = pendingNativeMaintenanceTask;
        if (task == null) return;
        boolean clearServer = "server".equals(value);
        startNativeDataMaintenance(task, clearServer);
    }

    private String pendingNativeMaintenanceTask;

    private void startNativeDataMaintenance(String type, boolean clearServer) {
        DataMaintenanceTask task;
        try {
            task = "export".equals(type) ? DataMaintenanceTask.EXPORT
                    : "clear".equals(type) ? DataMaintenanceTask.CLEAR_ALL
                    : DataMaintenanceTask.RESTORE_DEMO;
        } catch (Exception ignored) { return; }
        dataMaintenanceGateway.submit(new DataMaintenanceCommand(task, UUID.randomUUID().toString(), clearServer));
    }

    private void startNativeDataMaintenanceInternal(String type, boolean clearServer, String requestId) {
        if (type == null || !(type.equals("export") || type.equals("clear") || type.equals("restore"))) return;
        synchronized (nativeMaintenanceRequests) {
            nativeMaintenanceRequests.put(requestId, type);
        }
        if ("export".equals(type) || "clear".equals(type) || "restore".equals(type)) {
            NativeRootHost.setNativeDataMaintenanceRunning(this, true);
        }
        try {
            JSONObject request = new JSONObject()
                    .put("requestId", requestId)
                    .put("type", type)
                    .put("clearServer", clearServer);
            String expr = "window.__guanjiNativeDataMaintenanceAction ? window.__guanjiNativeDataMaintenanceAction(" +
                    JSONObject.quote(request.toString()) + ") : 'pending'";
            evaluateWhenReadyImmediate(expr, raw -> {
                String result = decodeJavascriptString(raw);
                if ("pending".equals(result)) {
                    NativeRootHost.setNativeDataMaintenanceResult(this, "当前 WebView 尚未就绪");
                }
            });
        } catch (Exception error) {
            NativeRootHost.setNativeDataMaintenanceResult(this, "任务启动失败");
        }
    }

    /** #280：设置领域的迁移期 JS Adapter；不把设置存储复制到 Native。 */
    private final class LegacyJsSettingsGateway implements SettingsGateway {
        @Override public void readSnapshot(GatewayCommand command, GatewayCallback callback) {
            final long revision = command.getDataRevision();
            if (!gatewayRevisionGate.claim("settings", command.getRequestId(), revision)) return;
            evaluateWhenReady("window.__guanjiNativeSettingsContext ? JSON.stringify(window.__guanjiNativeSettingsContext()) : 'pending'", raw -> {
                gatewayRevisionGate.complete("settings", revision);
                String context = decodeJavascriptString(raw);
                String status = context == null || context.trim().isEmpty() || "pending".equals(context)
                        ? "pending" : "completed";
                callback.onResult(new GatewayResult(command.getRequestId(), status, revision, null, context));
            });
        }

        @Override public void dispatch(GatewayCommand command, GatewayCallback callback) {
            final String payload;
            try {
                payload = new JSONObject().put("type", command.getAction())
                        .put("value", command.getValue() == null ? "" : command.getValue()).toString();
            } catch (Exception error) {
                callback.onResult(new GatewayResult(command.getRequestId(), "failed", command.getDataRevision(), "INVALID_COMMAND", error.getMessage()));
                return;
            }
            String expr = "window.__guanjiNativeSettingsAction ? window.__guanjiNativeSettingsAction(" + JSONObject.quote(payload) + ") : 'pending'";
            evaluateWhenReadyImmediate(expr, raw -> callback.onResult(new GatewayResult(
                    command.getRequestId(), "completed", command.getDataRevision(), null, decodeJavascriptString(raw))));
        }
    }

    /** #280：备份领域的迁移期 JS/Capacitor Adapter；仅传脱敏快照和动作元数据。 */
    private final class LegacyJsBackupGateway implements BackupGateway {
        @Override public void readSnapshot(GatewayCommand command, GatewayCallback callback) {
            final long revision = command.getDataRevision();
            if (!gatewayRevisionGate.claim("backup", command.getRequestId(), revision)) return;
            String expr = "(function(){if(!window.__guanjiNativeBackupContext||!window.GuanjiNativeBackup){return 'pending';}" +
                    "window.__guanjiNativeBackupContext().then(function(v){window.GuanjiNativeBackup.onContext(JSON.stringify(v));})" +
                    ".catch(function(){window.GuanjiNativeBackup.onContext(JSON.stringify({dataState:'error',localFilesState:'error',serverFilesState:'error'}));});" +
                    "return 'started';})()";
            runWhenReady(expr);
            callback.onResult(new GatewayResult(command.getRequestId(), "started", revision, null, null));
        }

        @Override public void dispatch(GatewayCommand command, GatewayCallback callback) {
            final String action = command.getAction();
            final String value = command.getValue() == null ? "" : command.getValue();
            final String expr;
            if ("save-config".equals(action)) {
                expr = "window.__guanjiNativeWebDavSave ? window.__guanjiNativeWebDavSave(" + JSONObject.quote(value) + ") : 'pending'";
            } else {
                expr = "window.__guanjiNativeBackupAction ? (window.__guanjiNativeBackupAction(" + JSONObject.quote(action) + ", " + JSONObject.quote(value) + "), 'ok') : 'pending'";
            }
            runWhenReady(expr);
            callback.onResult(new GatewayResult(command.getRequestId(), "started", command.getDataRevision(), null, null));
        }
    }

    /** #280：记录领域的迁移期 JS/Room Adapter；Native 只持有渲染上下文。 */
    private final class LegacyJsRecordFlowGateway implements RecordFlowGateway {
        @Override public void readContext(GatewayCommand command, GatewayCallback callback) {
            String expr = "window.__guanjiNativeRecordContext ? JSON.stringify(window.__guanjiNativeRecordContext(" +
                    JSONObject.quote(command.getAction()) + "," + JSONObject.quote(command.getValue() == null ? "" : command.getValue()) + ")) : 'pending'";
            evaluateWhenReady(expr, raw -> callback.onResult(new GatewayResult(
                    command.getRequestId(), "completed", command.getDataRevision(), null, decodeJavascriptString(raw))));
        }

        @Override public void dispatch(GatewayCommand command, GatewayCallback callback) {
            if ("record-save".equals(command.getAction())) {
                String expr = "window.__guanjiNativeCommitRecord ? window.__guanjiNativeCommitRecord(" +
                        JSONObject.quote(command.getValue() == null ? "" : command.getValue()) + ") : 'pending'";
                evaluateWhenReady(expr, raw -> callback.onResult(new GatewayResult(
                        command.getRequestId(), "completed", command.getDataRevision(), null, decodeJavascriptString(raw))));
                return;
            }
            String value = command.getValue() == null ? "" : command.getValue();
            String expr;
            if ("custom-observation-delete".equals(command.getAction())) {
                expr = "window.__guanjiDeleteCustomObservation ? (window.__guanjiDeleteCustomObservation(" + JSONObject.quote(value) + "), 'ok') : 'pending'";
            } else {
                expr = "'pending'";
            }
            runWhenReady(expr);
            callback.onResult(new GatewayResult(command.getRequestId(), "started", command.getDataRevision(), null, null));
        }
    }

    /** #280：洞悉领域的迁移期 JS AI/Provider Adapter；不复制聚合数据或密钥。 */
    private final class LegacyJsInsightGateway implements InsightGateway {
        @Override public void dispatch(GatewayCommand command, GatewayCallback callback) {
            final String expr;
            if ("configure".equals(command.getAction())) {
                expr = "window.__guanjiFocusAISettings ? (window.__guanjiFocusAISettings(), 'ok') : 'pending'";
            } else if ("generate".equals(command.getAction())) {
                expr = "window.__guanjiGenerateInsight ? (window.__guanjiGenerateInsight(), 'ok') : 'pending'";
            } else if ("ask".equals(command.getAction())) {
                expr = "window.__guanjiAskQuestion ? (window.__guanjiAskQuestion(" + JSONObject.quote(command.getValue() == null ? "" : command.getValue()) + "), 'ok') : 'pending'";
            } else {
                callback.onResult(new GatewayResult(command.getRequestId(), "failed", command.getDataRevision(), "UNKNOWN_ACTION", null));
                return;
            }
            runWhenReady(expr);
            callback.onResult(new GatewayResult(command.getRequestId(), "started", command.getDataRevision(), null, null));
        }
    }

    private final class LegacyJsDataMaintenanceAdapter implements DataMaintenanceGateway {
        @Override public void submit(DataMaintenanceCommand command) {
            String type = command.commandTask() == DataMaintenanceTask.EXPORT ? "export"
                    : command.commandTask() == DataMaintenanceTask.CLEAR_ALL ? "clear" : "restore";
            startNativeDataMaintenanceInternal(type, command.commandClearServer(), command.commandRequestId());
        }

        @Override public void cancel(String requestId) {
            synchronized (nativeMaintenanceRequests) { nativeMaintenanceRequests.remove(requestId); }
        }
    }

    private void handleNativeDataMaintenanceResult(String payload) {
        if (payload == null || payload.trim().isEmpty()) return;
        try {
            JSONObject result = new JSONObject(payload);
            String requestId = result.optString("requestId", "");
            String type;
            synchronized (nativeMaintenanceRequests) { type = nativeMaintenanceRequests.remove(requestId); }
            if (type == null) return;
            String status = result.optString("status", "failed");
            String code = result.optString("code", "");
            if ("completed".equals(status)) {
                if ("restore".equals(type)) {
                    // The restore Sheet keeps its header mounted and uses the
                    // result slot for the right-aligned status accessory.
                    NativeRootHost.setNativeDataMaintenanceResult(this, "演示数据已恢复");
                    NativeRootHost.setNativeDataMaintenanceStatus(this, "演示数据已恢复");
                    showTransientRestoreDemoFeedback();
                    refreshNativeHomeSnapshot();
                    refreshNativeSettingsSnapshotSoon();
                } else {
                    NativeRootHost.setNativeDataMaintenanceResult(this,
                            "export".equals(type) ? "数据已导出" : "已清理");
                    refreshNativeHomeSnapshot();
                    refreshNativeSettingsSnapshotSoon();
                    if ("clear".equals(type)) {
                        // Clearing is destructive and the Native confirmation
                        // sheet stays mounted so the user can see the terminal
                        // state and close it explicitly.  Never auto-dismiss.
                        showTransientClearDataFeedback();
                        pendingNativeMaintenanceTask = "clear";
                    } else {
                        pendingNativeMaintenanceTask = null;
                        new Handler(getMainLooper()).postDelayed(() -> NativeRootHost.clearNativeDataMaintenance(this), 900L);
                    }
                }
            } else if ("cancelled".equals(status)) {
                NativeRootHost.setNativeDataMaintenanceResult(this, "已取消");
            } else {
                String message = "NO_DATA".equals(code) ? "当前没有可导出的记录" : "操作失败，请稍后重试";
                if ("restore".equals(type)) {
                    NativeRootHost.setNativeDataMaintenanceResult(this, message);
                    NativeRootHost.setNativeDataMaintenanceStatus(this, null);
                } else NativeRootHost.setNativeDataMaintenanceResult(this, message);
            }
        } catch (Exception error) {
            Log.e("GuanjiNative279", "maintenance result parse failed", error);
        }
    }

    private void showTransientClearDataFeedback() {
        final int token = ++nativeClearFeedbackToken;
        NativeRootHost.setNativeClearDataFeedback(this, "已清理");
        settingsOverlayHandler.postDelayed(() -> {
            if (token == nativeClearFeedbackToken) NativeRootHost.setNativeClearDataFeedback(this, null);
        }, 4500L);
    }

    private void showTransientRestoreDemoFeedback() {
        final int token = ++nativeRestoreFeedbackToken;
        NativeRootHost.setNativeDataMaintenanceStatus(this, "演示数据已恢复");
        settingsOverlayHandler.postDelayed(() -> {
            if (token == nativeRestoreFeedbackToken) NativeRootHost.setNativeDataMaintenanceStatus(this, null);
        }, 4500L);
    }

    /** WebView 的 input[type=time] 会唤起系统时间选择器；Native 设置页复用同一
     * 平台选择器，确认后只把结果回写到既有 JS 存储链，不创建第二套提醒设置。 */
    private void showReminderTimePicker(String current) {
        int hour = 21;
        int minute = 0;
        if (current != null && current.matches("\\d{2}:\\d{2}")) {
            try {
                hour = Integer.parseInt(current.substring(0, 2));
                minute = Integer.parseInt(current.substring(3, 5));
                if (hour > 23 || minute > 59) { hour = 21; minute = 0; }
            } catch (NumberFormatException ignored) { hour = 21; minute = 0; }
        }
        TimePickerDialog dialog = new TimePickerDialog(this, (view, selectedHour, selectedMinute) -> {
            String selected = String.format(Locale.US, "%02d:%02d", selectedHour, selectedMinute);
            String payload;
            try {
                payload = new JSONObject().put("type", "reminder-time-set").put("value", selected).toString();
            } catch (Exception ignored) {
                return;
            }
            evaluateWhenReady("window.__guanjiNativeSettingsAction ? window.__guanjiNativeSettingsAction(" + JSONObject.quote(payload) + ") : 'pending'", raw -> {
                runOnUiThread(this::refreshNativeSettingsSnapshotRepeated);
            });
        }, hour, minute, true);
        dialog.show();
    }

    /** #275：恢复首页所有权时同时恢复底部 Tab 的原生宿主。 */
    private void bindNativeTabBridge() {
        NativeRootHost.bindNativeTabSelection(this, routeKey ->
                runWhenReady("window.__guanjiSelectTab ? (window.__guanjiSelectTab(" + JSONObject.quote(routeKey) + "), 'ok') : 'pending'"));
    }

    /** #274：WebView 只回传路由/主题事实，原生 Tab 不读取或重算业务数据。 */
    private static final class NativeTabBridge {
        private final WeakReference<MainActivity> activity;

        NativeTabBridge(MainActivity activity) {
            this.activity = new WeakReference<>(activity);
        }

        @JavascriptInterface
        public void onRouteChanged(String routeKey) {
            final MainActivity target = activity.get();
            if (target == null || routeKey == null) return;
            target.runOnUiThread(() -> {
                NativeRootHost.setNativeTabSelection(target, routeKey);
                if ("home".equals(routeKey)) {
                    target.refreshNativeHomeSnapshot();
                    target.bindNativeTabBridge();
                    NativeRootHost.suppressNativeHome(target, false);
                } else if ("me".equals(routeKey)) {
                    target.refreshNativeSettingsSnapshot();
                    target.bindNativeTabBridge();
                    NativeRootHost.suppressNativeHome(target, false);
                }
            });
        }

        @JavascriptInterface
        public void onThemeChanged(String theme, boolean isLiquidGlass) {
            final MainActivity target = activity.get();
            if (target == null) return;
            final boolean dark = "dark".equals(theme);
            target.runOnUiThread(() -> NativeRootHost.setNativeTabTheme(target, dark, isLiquidGlass, 3f, 2f, false));
        }

        /** #274 material follow-up：WebView 传递完整材质事实，避免原生 Tab 使用固定常量。 */
        @JavascriptInterface
        public void onMaterialChanged(String payload) {
            final MainActivity target = activity.get();
            if (target == null || payload == null) return;
            try {
                final JSONObject snapshot = new JSONObject(payload);
                final boolean dark = "dark".equals(snapshot.optString("theme", "light"));
                final boolean glass = snapshot.optBoolean("liquidGlass", false);
                final float blur = (float) snapshot.optDouble("blurPx", 3.0);
                final float saturate = (float) snapshot.optDouble("saturate", 2.0);
                final boolean reduced = snapshot.optBoolean("reducedTransparency", false);
                target.runOnUiThread(() -> NativeRootHost.setNativeTabTheme(
                        target, dark, glass, blur, saturate, reduced));
            } catch (Exception ignored) {
                // 材质同步失败时保留既有 WebView 路径，不阻塞页面交互。
            }
        }

        /** #274 material follow-up：滚动结束后刷新 Tab 下方的背景采样。 */
        @JavascriptInterface
        public void onBackdropChanged() {
            final MainActivity target = activity.get();
            if (target == null) return;
            target.runOnUiThread(() -> NativeRootHost.refreshNativeTabBackdrop(target));
        }
    }

    /** #280：只接收备份列表/状态快照，不接收原始记录、文件内容或口令。 */
    private static final class NativeBackupBridge {
        private final WeakReference<MainActivity> activity;

        NativeBackupBridge(MainActivity activity) {
            this.activity = new WeakReference<>(activity);
        }

        @JavascriptInterface
        public void onContext(String payload) {
            final MainActivity target = activity.get();
            if (target == null || payload == null || payload.trim().isEmpty()) return;
            final String context = payload.trim();
            if (!context.startsWith("{")) return;
            target.gatewayRevisionGate.complete("backup", target.activeBackupRevision);
            Log.d("GuanjiNative280", "backup bridge received=" + context.substring(0, Math.min(context.length(), 180)));
            target.runOnUiThread(() -> NativeRootHost.setNativeBackupContext(target, context));
        }

        @JavascriptInterface
        public void onRestoreResult(String payload) {
            final MainActivity target = activity.get();
            if (target == null || payload == null || payload.trim().isEmpty()) return;
            target.runOnUiThread(() -> target.handleNativeBackupRestoreResult(payload));
        }
    }

    /** #279：只接收维护任务的状态回执，不接收记录、密钥或文件内容。 */
    private static final class NativeDataMaintenanceBridge {
        private final WeakReference<MainActivity> activity;

        NativeDataMaintenanceBridge(MainActivity activity) {
            this.activity = new WeakReference<>(activity);
        }

        @JavascriptInterface
        public void onResult(String payload) {
            final MainActivity target = activity.get();
            if (target == null || payload == null || payload.trim().isEmpty()) return;
            target.runOnUiThread(() -> target.handleNativeDataMaintenanceResult(payload));
        }
    }

    /** #279：secureDisable() result only; no password, key or record data crosses the bridge. */
    private static final class NativeSecureModeBridge {
        private final WeakReference<MainActivity> activity;

        NativeSecureModeBridge(MainActivity activity) {
            this.activity = new WeakReference<>(activity);
        }

        @JavascriptInterface
        public void onResult(String payload) {
            final MainActivity target = activity.get();
            if (target == null || payload == null || payload.trim().isEmpty()) return;
            target.runOnUiThread(() -> target.handleNativeSecureModeResult(payload));
        }
    }

    /** #279 follow-up: enable result only; no password crosses back to Android. */
    private static final class NativeSecureEnableBridge {
        private final WeakReference<MainActivity> activity;

        NativeSecureEnableBridge(MainActivity activity) {
            this.activity = new WeakReference<>(activity);
        }

        @JavascriptInterface
        public void onResult(String payload) {
            final MainActivity target = activity.get();
            if (target == null || payload == null || payload.trim().isEmpty()) return;
            target.runOnUiThread(() -> target.handleNativeSecureEnableResult(payload));
        }
    }

    /** #280 P0: secureChangePassphrase result only; no password crosses back. */
    private static final class NativeSecureChangeBridge {
        private final WeakReference<MainActivity> activity;

        NativeSecureChangeBridge(MainActivity activity) {
            this.activity = new WeakReference<>(activity);
        }

        @JavascriptInterface
        public void onResult(String payload) {
            final MainActivity target = activity.get();
            if (target == null || payload == null || payload.trim().isEmpty()) return;
            target.runOnUiThread(() -> target.handleNativeSecureChangeResult(payload));
        }
    }
}
