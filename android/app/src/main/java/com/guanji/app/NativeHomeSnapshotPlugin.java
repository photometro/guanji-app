package com.guanji.app;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

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
        boolean allowEmpty = call.getBoolean("allowEmpty", false);
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String previous = prefs.getString(KEY_SNAPSHOT, "");
        if (!allowEmpty && calendarRecordCount(snapshot) == 0 && calendarRecordCount(previous) > 0) {
            /* #280 P5：启动/缓存异步回调不能用空聚合覆盖已有有效快照。
             * 真正的清空/空恢复由 JS 明确传 allowEmpty=true。 */
            call.resolve(new JSObject().put("ok", true)
                    .put("accepted", false)
                    .put("reason", "empty_snapshot_rejected"));
            return;
        }
        boolean committed = prefs.edit().putString(KEY_SNAPSHOT, snapshot).commit();
        /* #275：首页原生切片已经接管当前路由时，写入快照必须立即回推宿主，
         * 否则冷启动缓存会一直显示旧的问候语/每日话语，直到下次重建 Activity。 */
        if (committed && getActivity() instanceof MainActivity) {
            NativeRootHost.setNativeHomeSnapshot(getActivity(), snapshot);
        }
        call.resolve(new JSObject().put("ok", committed).put("accepted", committed));
    }

    private static int calendarRecordCount(String raw) {
        if (raw == null || raw.trim().isEmpty()) return 0;
        try {
            JSONArray records = new JSONObject(raw).optJSONArray("calendarRecords");
            return records == null ? 0 : records.length();
        } catch (Exception ignored) {
            return 0;
        }
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
