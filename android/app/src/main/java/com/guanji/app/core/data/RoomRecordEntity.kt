package com.guanji.app.core.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import org.json.JSONArray
import org.json.JSONObject

/**
 * #223：旧 WebView RecordEvent 在 Room 影子库中的可查询投影。
 * rawRecordJson 保留未知字段，避免影子迁移改变备份/导入语义；数据库本身由 SQLCipher 加密。
 */
@Entity(
    tableName = "record_events",
    indices = [Index(value = ["dateKey"]), Index(value = ["occurredAtMs"])]
)
data class RoomRecordEntity(
    @PrimaryKey val id: String,
    val dateKey: String?,
    val occurredAtMs: Long?,
    val zoneId: String?,
    val localDate: String?,
    val localDateKey: String?,
    val time: String?,
    val timePrecision: String?,
    val offset: Int?,
    val source: String?,
    val backfill: Boolean,
    val createdAtMs: Long?,
    val updatedAtMs: Long?,
    val duration: Int?,
    val observationsJson: String,
    val moodsJson: String,
    val triggersJson: String,
    val media: Boolean,
    val note: String?,
    val encryptedState: String,
    val rawRecordJson: String,
    val importedAtMs: Long,
) {
    /** #236：从 Room 返回公共 RecordEvent，未知字段继续从 rawRecordJson 原样保留。 */
    fun toJson(): JSONObject {
        val json = runCatching { JSONObject(rawRecordJson) }.getOrElse { JSONObject() }
        fun putNullable(key: String, value: Any?) {
            json.put(key, value ?: JSONObject.NULL)
        }
        putNullable("id", id)
        putNullable("dateKey", dateKey)
        putNullable("occurredAtMs", occurredAtMs)
        putNullable("zoneId", zoneId)
        putNullable("localDate", localDate)
        putNullable("localDateKey", localDateKey)
        putNullable("time", time)
        putNullable("timePrecision", timePrecision)
        putNullable("offset", offset)
        putNullable("source", source)
        putNullable("backfill", backfill)
        putNullable("createdAtMs", createdAtMs)
        putNullable("updatedAtMs", updatedAtMs)
        putNullable("duration", duration)
        /*
         * #253：保留统一状况字段的三态语义。
         *
         * 旧记录通常只有 moods/triggers（部分旧版本还会带 observation=null）。
         * 不能因为影子表内部用 [] 表示“没有数组”就把旧记录序列化成
         * observations: []，否则 WebView 会跳过旧字段回退。rawRecordJson
         * 保存了导入/写入时的原始字段存在性，正好可以作为兼容边界：
         *   - observations 数组存在（包括 []）→ 新版统一字段；
         *   - 非空 observation 单值存在 → v3.20 单值统一字段；
         *   - 两者都不存在/为空 → 旧 moods/triggers 记录。
         */
        val hasUnifiedObservations = hasUnifiedObservationField(json)
        if (hasUnifiedObservations) {
            putNullable("observations", parseArray(observationsJson))
            putNullable("observation", parseFirst(observationsJson))
        } else {
            json.remove("observations")
            json.remove("observation")
        }
        putNullable("moods", parseArray(moodsJson))
        putNullable("triggers", parseArray(triggersJson))
        putNullable("media", media)
        putNullable("note", note)
        return json
    }

    companion object {
        fun fromJson(record: JSONObject, encryptedState: String, importedAtMs: Long): RoomRecordEntity {
            val id = record.optString("id", "").trim()
            require(id.isNotEmpty()) { "record id required" }
            return RoomRecordEntity(
                id = id,
                dateKey = nullableString(record, "dateKey"),
                occurredAtMs = nullableLong(record, "occurredAtMs"),
                zoneId = nullableString(record, "zoneId"),
                localDate = nullableString(record, "localDate") ?: nullableString(record, "localDateKey"),
                localDateKey = nullableString(record, "localDateKey"),
                time = nullableString(record, "time"),
                timePrecision = nullableString(record, "timePrecision"),
                offset = nullableInt(record, "offset"),
                source = nullableString(record, "source"),
                backfill = record.optBoolean("backfill", record.optString("source", "") == "backfill"),
                createdAtMs = nullableLong(record, "createdAtMs"),
                updatedAtMs = nullableLong(record, "updatedAtMs"),
                duration = nullableInt(record, "duration"),
                observationsJson = arrayJson(record, "observations", "observation"),
                moodsJson = arrayJson(record, "moods", "mood"),
                triggersJson = arrayJson(record, "triggers", "trigger"),
                media = record.optBoolean("media", false),
                note = nullableString(record, "note"),
                encryptedState = when (encryptedState) {
                    "encrypted", "plain" -> encryptedState
                    else -> "unknown"
                },
                rawRecordJson = record.toString(),
                importedAtMs = importedAtMs,
            )
        }

        private fun nullableString(obj: JSONObject, key: String): String? =
            if (!obj.has(key) || obj.isNull(key)) null else obj.optString(key).takeIf { it.isNotEmpty() }

        private fun nullableLong(obj: JSONObject, key: String): Long? =
            if (!obj.has(key) || obj.isNull(key)) null else obj.optLong(key, Long.MIN_VALUE).takeUnless { it == Long.MIN_VALUE }

        private fun nullableInt(obj: JSONObject, key: String): Int? =
            if (!obj.has(key) || obj.isNull(key)) null else obj.optInt(key, Int.MIN_VALUE).takeUnless { it == Int.MIN_VALUE }

        private fun hasUnifiedObservationField(obj: JSONObject): Boolean {
            if (obj.has("observations") && !obj.isNull("observations")) return true
            if (!obj.has("observation") || obj.isNull("observation")) return false
            return obj.optString("observation", "").trim().isNotEmpty()
        }

        private fun arrayJson(obj: JSONObject, key: String, singularKey: String? = null): String {
            obj.optJSONArray(key)?.let { return it.toString() }
            val singular = singularKey?.let { obj.optString(it, "").trim() }.orEmpty()
            return if (singular.isEmpty()) JSONArray().toString() else JSONArray().put(singular).toString()
        }

        private fun parseArray(raw: String): JSONArray =
            runCatching { JSONArray(raw) }.getOrElse { JSONArray() }

        private fun parseFirst(raw: String): Any =
            parseArray(raw).optString(0, "").takeIf { it.isNotEmpty() } ?: JSONObject.NULL
    }
}

@Entity(tableName = "migration_state")
data class RoomMigrationStateEntity(
    @PrimaryKey val scope: String = "records",
    val schemaVersion: Int,
    val lastRecordId: String?,
    val importedCount: Int,
    val sourceRevision: Long,
    val state: String,
    val updatedAtMs: Long,
)
