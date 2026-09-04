package com.guanji.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

import androidx.core.splashscreen.SplashScreen;
import androidx.core.splashscreen.SplashScreenViewProvider;

public class MainActivity extends BridgeActivity {

    private volatile boolean startupReady = false;
    private volatile long startupStartedAt;
    private SplashScreen splashScreen;

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
        /* #206：系统层只做首帧保护；WebView 首帧信号优先，1200ms watchdog 防止异常加载阻塞启动。 */
        startupStartedAt = SystemClock.uptimeMillis();
        splashScreen.setKeepOnScreenCondition(() ->
                !startupReady && SystemClock.uptimeMillis() - startupStartedAt < 1200L);
        /* #206：保护层退出后由真实首页问候文案承担唯一产品层微转场。 */
        splashScreen.setOnExitAnimationListener(this::removeSplashImmediately);
        super.onCreate(savedInstanceState);
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
        super.load();
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
        final WebView wv = bridge != null ? bridge.getWebView() : null;
        if (wv == null) return;
        wv.postDelayed(new Runnable() {
            int tries = 0;

            @Override
            public void run() {
                tries++;
                wv.evaluateJavascript(jsExpr, value -> {
                    boolean ok = value != null && value.trim().equals("\"ok\"");
                    if (!ok && tries < 40) wv.postDelayed(this, 300);
                });
            }
        }, 500);
    }
}
