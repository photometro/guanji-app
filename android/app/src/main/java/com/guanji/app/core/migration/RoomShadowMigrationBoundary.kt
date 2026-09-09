package com.guanji.app.core.migration

import com.guanji.app.core.data.GuanjiShadowDatabase

/** #223：将可中断迁移检查点映射到 Room。 */
class RoomShadowMigrationBoundary(
    private val database: GuanjiShadowDatabase,
) : MigrationBoundary {
    override fun inspect(): MigrationCheckpoint {
        val state = database.migrationDao().inspect()
        return if (state == null) {
            MigrationCheckpoint(2, null, 0, MigrationState.NOT_STARTED)
        } else {
            MigrationCheckpoint(
                schemaVersion = state.schemaVersion,
                lastRecordId = state.lastRecordId,
                importedCount = state.importedCount,
                state = runCatching { MigrationState.valueOf(state.state) }.getOrDefault(MigrationState.FAILED),
            )
        }
    }

    override fun resume(): MigrationCheckpoint = inspect()
}
