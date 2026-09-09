package com.guanji.app.core.migration

/**
 * #222：迁移边界只定义协议，不在本节点打开 Room 权威库。
 * #223 通过该边界实现可中断的旧 Storage → Room 影子库迁移。
 */
enum class MigrationState { NOT_STARTED, RUNNING, PAUSED, COMPLETED, FAILED }

data class MigrationCheckpoint(
    val schemaVersion: Int,
    val lastRecordId: String?,
    val importedCount: Int,
    val state: MigrationState,
)

interface LegacyRecordReader {
    fun readPage(afterRecordId: String?, pageSize: Int): List<String>
}

interface MigrationBoundary {
    fun inspect(): MigrationCheckpoint
    fun resume(): MigrationCheckpoint
}
