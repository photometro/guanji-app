package com.guanji.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

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
        super.onCreate(savedInstanceState);
        handleWidgetIntent(getIntent());
        handleTimerIntent(getIntent());
        handleTimerDismissFlag();
    }

    /* 自定义插件注册必须在 bridge 创建（super.load）之前 */
    @Override
    public void load() {
        registerPlugin(WidgetStatsPlugin.class);   // #32-#36：小组件统计同步
        registerPlugin(TimerLiveUpdatePlugin.class);   // #51：计时实况通知
        registerPlugin(SaveToDownloadsPlugin.class);   // #102：导出保存到公共 Downloads
        registerPlugin(GuanjiDavPlugin.class);   // #115：WebDAV 原生通道（绕 WebView CORS）
        super.load();
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
        SharedPreferences prefs = getSharedPreferences(TimerLiveUpdatePlugin.PREFS, MODE_PRIVATE);
        if (prefs.getBoolean(TimerLiveUpdatePlugin.KEY_DISMISSED, false)) {
            prefs.edit().remove(TimerLiveUpdatePlugin.KEY_DISMISSED).apply();
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
