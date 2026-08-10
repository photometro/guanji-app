package com.guanji.app;

import android.content.ContentUris;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * #102：导出保存到公共 Downloads 目录（MediaStore，Android 10+ 无需存储权限）
 * —— Flyme 分享面板无标准「保存到文件」目标（「文件管理」入口指向扫码快传），
 *    直接保存 + 返回路径，用户文件管理器直接可见。
 */
@CapacitorPlugin(name = "GuanjiSave")
public class SaveToDownloadsPlugin extends Plugin {

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String filename = call.getString("filename");
        String data = call.getString("data");
        if (filename == null || filename.isEmpty() || data == null) {
            call.reject("filename and data required");
            return;
        }
        try {
            String path = writeToDownloads(filename, data);
            JSObject ret = new JSObject();
            ret.put("path", path);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("save failed: " + e.getMessage());
        }
    }

    private String writeToDownloads(String filename, String data) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10+：MediaStore.Downloads，无需权限
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeFor(filename));
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            Uri uri = getContext().getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new Exception("MediaStore insert failed");
            OutputStream os = getContext().getContentResolver().openOutputStream(uri);
            if (os == null) throw new Exception("openOutputStream failed");
            os.write(data.getBytes(StandardCharsets.UTF_8));
            os.close();
        } else {
            // Android 9 及以下：写公共 Download 目录（manifest 已声明 WRITE_EXTERNAL_STORAGE maxSdk 28）
            File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (dir != null && !dir.exists()) dir.mkdirs();
            File f = new File(dir, filename);
            FileOutputStream fos = new FileOutputStream(f);
            fos.write(data.getBytes(StandardCharsets.UTF_8));
            fos.close();
        }
        return Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).getPath() + "/" + filename;
    }

    private String mimeFor(String filename) {
        String lower = filename.toLowerCase();
        if (lower.endsWith(".csv")) return "text/csv";
        if (lower.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    /* #104：列出下载目录中观己的备份/导出文件（MediaStore 查询，按时间倒序） */
    @PluginMethod
    public void listBackupFiles(PluginCall call) {
        List<String> names = new ArrayList<>();
        try {
            Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
            String[] projection = { MediaStore.Downloads.DISPLAY_NAME };
            String selection = MediaStore.Downloads.DISPLAY_NAME + " LIKE ? OR " + MediaStore.Downloads.DISPLAY_NAME + " LIKE ?";
            String[] selArgs = { "guanji-backup-%", "guanji-export-%" };
            try (Cursor c = getContext().getContentResolver().query(collection, projection, selection, selArgs, MediaStore.Downloads.DATE_ADDED + " DESC")) {
                while (c != null && c.moveToNext()) names.add(c.getString(0));
            }
            JSObject ret = new JSObject();
            ret.put("files", new JSArray(names));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("list failed: " + e.getMessage());
        }
    }

    /* #104：读取下载目录中的文件内容（按文件名，MediaStore） */
    @PluginMethod
    public void readDownloadedFile(PluginCall call) {
        String filename = call.getString("filename");
        if (filename == null || filename.isEmpty()) { call.reject("filename required"); return; }
        try {
            Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
            String[] projection = { MediaStore.Downloads._ID };
            String selection = MediaStore.Downloads.DISPLAY_NAME + " = ?";
            String[] selArgs = { filename };
            try (Cursor c = getContext().getContentResolver().query(collection, projection, selection, selArgs, null)) {
                if (c != null && c.moveToFirst()) {
                    long id = c.getLong(0);
                    Uri uri = ContentUris.withAppendedId(collection, id);
                    try (InputStream is = getContext().getContentResolver().openInputStream(uri)) {
                        ByteArrayOutputStream bos = new ByteArrayOutputStream();
                        byte[] buf = new byte[8192];
                        int n;
                        while ((n = is.read(buf)) != -1) bos.write(buf, 0, n);
                        JSObject ret = new JSObject();
                        ret.put("data", bos.toString("UTF-8"));
                        call.resolve(ret);
                        return;
                    }
                }
            }
            call.reject("file not found");
        } catch (Exception e) {
            call.reject("read failed: " + e.getMessage());
        }
    }
}
