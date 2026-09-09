package com.guanji.app

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.guanji.app.core.data.GuanjiShadowDatabase
import com.guanji.app.core.data.RoomMigrationStateEntity
import com.guanji.app.core.data.RoomRecordEntity
import com.guanji.app.core.migration.RoomShadowKeyDerivation
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * #223/#236：WebView → Room 的记录仓库边界。
 * v4.1.3 起 Room 是原生环境记录权威；旧 WebView Storage 仅作为兼容镜像/一次性迁移输入。
 */
@CapacitorPlugin(name = "RoomShadow")
class RoomShadowPlugin : Plugin() {
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()

    @Volatile private var database: GuanjiShadowDatabase? = null
    @Volatile private var keyFingerprint: String? = null

    /** #236：Room 权威读取；只返回公共 RecordEvent，不返回 rawRecordJson 或密钥。 */
    @PluginMethod
    fun loadRecords(call: PluginCall) = submit(call) {
        val db = openDatabase(call)
        val persisted = db.migrationDao().inspect()
        val records = JSONArray()
        db.recordDao().all().forEach { records.put(it.toJson()) }
        JSObject()
            .put("ok", true)
            .put("authority", "room")
            .put("trusted", persisted?.state == "COMPLETED")
            .put("records", records.toString())
            .put("recordCount", records.length())
            .put("schemaVersion", persisted?.schemaVersion ?: 2)
            .put("sourceRevision", persisted?.sourceRevision ?: 0L)
            .put("state", persisted?.state ?: "NOT_STARTED")
            .put("encrypted", true)
    }

    /** #236：恢复/演示/清空的原子替换入口；事务内先清除再写入，未知字段由 rawRecordJson 保留。 */
    @PluginMethod
    fun replaceRecords(call: PluginCall) = submit(call) {
        val db = openDatabase(call)
        val payload = call.data
        val encryptedState = payload.optString("encryptedState", "unknown")
        val sourceRevision = payload.optLong("sourceRevision", 0L)
        val now = System.currentTimeMillis()
        val entities = entities(call.getArray("records") ?: JSONArray(), encryptedState, now)
        db.runInTransaction {
            db.recordDao().clearAll()
            if (entities.isNotEmpty()) db.recordDao().upsertAll(entities)
            db.migrationDao().upsert(
                RoomMigrationStateEntity(
                    schemaVersion = 2,
                    lastRecordId = entities.lastOrNull()?.id,
                    importedCount = entities.size,
                    sourceRevision = sourceRevision,
                    state = "COMPLETED",
                    updatedAtMs = now,
                )
            )
        }
        JSObject()
            .put("ok", true)
            .put("authority", "room")
            .put("trusted", true)
            .put("state", "COMPLETED")
            .put("recordCount", entities.size)
            .put("encrypted", true)
    }

    @PluginMethod
    fun inspect(call: PluginCall) = submit(call) {
        val db = openDatabase(call)
        val checkpoint = com.guanji.app.core.migration.RoomShadowMigrationBoundary(db).inspect()
        val persisted = db.migrationDao().inspect()
        JSObject()
            .put("ok", true)
            .put("schemaVersion", checkpoint.schemaVersion)
            .put("lastRecordId", checkpoint.lastRecordId)
            .put("importedCount", checkpoint.importedCount)
            .put("state", checkpoint.state.name)
            .put("sourceRevision", persisted?.sourceRevision ?: 0L)
            .put("recordCount", db.recordDao().count())
            .put("encrypted", true)
    }

    @PluginMethod
    fun migrateRecordBatch(call: PluginCall) = submit(call) {
        val db = openDatabase(call)
        val payload = call.data
        val records = call.getArray("records") ?: JSONArray()
        val encryptedState = payload.optString("encryptedState", "unknown")
        val sourceRevision = payload.optLong("sourceRevision", 0L)
        val cursor = payload.optString("cursor", "").takeIf { it.isNotBlank() }
        val reset = payload.optBoolean("reset", false)
        val hasMore = payload.optBoolean("hasMore", false)
        val importedAtMs = System.currentTimeMillis()
        val entities = entities(records, encryptedState, importedAtMs)
        val lastRecordId = entities.lastOrNull()?.id ?: cursor
        val state = if (hasMore) "RUNNING" else "COMPLETED"

        db.runInTransaction {
            if (reset) db.recordDao().clearAll()
            if (entities.isNotEmpty()) db.recordDao().upsertAll(entities)
            db.migrationDao().upsert(
                RoomMigrationStateEntity(
                    schemaVersion = 2,
                    lastRecordId = lastRecordId,
                    importedCount = db.recordDao().count(),
                    sourceRevision = sourceRevision,
                    state = state,
                    updatedAtMs = importedAtMs,
                )
            )
        }
        JSObject()
            .put("ok", true)
            .put("state", state)
            .put("lastRecordId", lastRecordId)
            .put("importedCount", db.recordDao().count())
            .put("batchCount", entities.size)
            .put("encrypted", true)
    }

    @PluginMethod
    fun applyDelta(call: PluginCall) = submit(call) {
        val db = openDatabase(call)
        val payload = call.data
        val encryptedState = payload.optString("encryptedState", "unknown")
        val sourceRevision = payload.optLong("sourceRevision", 0L)
        val importedAtMs = System.currentTimeMillis()
        val upserts = entities(call.getArray("upserts") ?: JSONArray(), encryptedState, importedAtMs)
        val deletes = stringList(call.getArray("deletes") ?: JSONArray())

        db.runInTransaction {
            if (upserts.isNotEmpty()) db.recordDao().upsertAll(upserts)
            if (deletes.isNotEmpty()) db.recordDao().deleteByIds(deletes)
            db.migrationDao().upsert(
                RoomMigrationStateEntity(
                    schemaVersion = 2,
                    lastRecordId = upserts.lastOrNull()?.id,
                    importedCount = db.recordDao().count(),
                    sourceRevision = sourceRevision,
                    state = "COMPLETED",
                    updatedAtMs = importedAtMs,
                )
            )
        }
        JSObject()
            .put("ok", true)
            .put("upserted", upserts.size)
            .put("deleted", deletes.size)
            .put("recordCount", db.recordDao().count())
            .put("encrypted", true)
    }

    @PluginMethod
    fun close(call: PluginCall) = submit(call) {
        GuanjiShadowDatabase.close()
        database = null
        keyFingerprint = null
        JSObject().put("ok", true)
    }

    private fun openDatabase(call: PluginCall): GuanjiShadowDatabase {
        val dekB64 = call.getString("dekB64") ?: throw IllegalArgumentException("dekB64 required")
        val key = RoomShadowKeyDerivation.deriveFromBase64(dekB64)
        val fingerprint = sha256(key)
        val previous = keyFingerprint
        if (previous != null && previous != fingerprint) {
            throw IllegalStateException("room shadow key changed; close database before reopening")
        }
        return database ?: GuanjiShadowDatabase.open(context, key).also {
            database = it
            keyFingerprint = fingerprint
        }
    }

    private fun entities(array: JSONArray, encryptedState: String, importedAtMs: Long): List<RoomRecordEntity> {
        val out = ArrayList<RoomRecordEntity>(array.length())
        for (index in 0 until array.length()) {
            val value = array.opt(index)
            require(value is JSONObject) { "record[$index] must be an object" }
            /* 解析失败必须让整个事务失败，不能静默丢行后提交“看似成功”的空库。 */
            out += RoomRecordEntity.fromJson(value, encryptedState, importedAtMs)
        }
        return out
    }

    private fun stringList(array: JSONArray): List<String> {
        val out = ArrayList<String>(array.length())
        for (index in 0 until array.length()) {
            val id = array.optString(index, "").trim()
            if (id.isNotEmpty()) out += id
        }
        return out
    }

    private fun sha256(value: ByteArray): String =
        MessageDigest.getInstance("SHA-256").digest(value).joinToString("") { "%02x".format(it) }

    private fun submit(call: PluginCall, action: () -> JSObject) {
        executor.execute {
            try {
                call.resolve(action())
            } catch (error: Throwable) {
                val exception = error as? Exception ?: Exception(error)
                call.reject(exception.message ?: "room shadow operation failed", exception)
            }
        }
    }
}
