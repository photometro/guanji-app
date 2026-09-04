package com.guanji.app;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * #211 N10：原生首页最小垂直切片。
 * 只缓存经过聚合的 StatsSnapshot，不读取或复制 WebView 原始记录；WebView
 * 仍是主数据源，缓存只用于原生桥接验证和冷启动时的同一快照回显。
 */
@CapacitorPlugin(name = "NativeHomeSnapshot")
public class NativeHomeSnapshotPlugin extends Plugin {
    static final String PREFS = "guanji_native_home";
    static final String KEY_SNAPSHOT = "stats_snapshot";

    @PluginMethod
    public void writeSnapshot(PluginCall call) {
        String snapshot = call.getString("snapshot");
        if (snapshot == null || snapshot.trim().isEmpty()) {
            call.reject("snapshot required");
            return;
        }
        boolean committed = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(KEY_SNAPSHOT, snapshot).commit();
        call.resolve(new JSObject().put("ok", committed).put("accepted", committed));
    }

    @PluginMethod
    public void readSnapshot(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String snapshot = prefs.getString(KEY_SNAPSHOT, null);
        JSObject result = new JSObject().put("ok", snapshot != null && !snapshot.isEmpty());
        if (snapshot != null && !snapshot.isEmpty()) result.put("snapshot", snapshot);
        call.resolve(result);
    }
}
