package com.guanji.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.concurrent.TimeUnit;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/**
 * #115：WebDAV 原生通道（okhttp——支持任意方法 PROPFIND/MKCOL/PUT/DELETE + Basic Auth）
 * —— Android WebView fetch 受 CORS 限制无法直连 WebDAV；HttpURLConnection 的 setRequestMethod
 *    白名单不认 WebDAV 方法且 Android 实现为 okhttp 桥（反射基类字段无效），故直接依赖 okhttp3。
 *    供 webdav.js 调用：request(method, url, username, password, body, depth)
 */
@CapacitorPlugin(name = "GuanjiDav")
public class GuanjiDavPlugin extends Plugin {

    private static final OkHttpClient CLIENT = new OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .build();

    @PluginMethod
    public void request(PluginCall call) {
        String method = call.getString("method", "GET");
        String url = call.getString("url");
        String username = call.getString("username", "");
        String password = call.getString("password", "");
        String body = call.getString("body");          // null = 无请求体
        Integer depth = call.getInt("depth");           // PROPFIND 用

        if (url == null || url.isEmpty()) { call.reject("url required"); return; }

        new Thread(() -> {
            try {
                Request.Builder rb = new Request.Builder().url(url)
                        .header("Authorization",
                                "Basic " + Base64.getEncoder().encodeToString((username + ":" + password).getBytes(StandardCharsets.UTF_8)))
                        .header("User-Agent", "GuanjiApp/3.10 (WebDAV)");
                if (depth != null) rb.header("Depth", String.valueOf(depth));
                RequestBody rqBody = null;
                if (body != null) {
                    rqBody = RequestBody.create(body, MediaType.parse("application/octet-stream"));
                }
                Request req = rb.method(method, rqBody).build();
                try (Response resp = CLIENT.newCall(req).execute()) {
                    String data = resp.body() != null ? resp.body().string() : "";
                    JSObject ret = new JSObject();
                    ret.put("status", resp.code());
                    ret.put("data", data);
                    call.resolve(ret);
                }
            } catch (Exception e) {
                call.reject("request failed: " + e.getMessage());
            }
        }).start();
    }
}
