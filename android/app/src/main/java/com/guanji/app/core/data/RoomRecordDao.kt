package com.guanji.app.core.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface RoomRecordDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun upsertAll(records: List<RoomRecordEntity>)

    @Query("DELETE FROM record_events")
    fun clearAll()

    @Query("DELETE FROM record_events WHERE id IN (:ids)")
    fun deleteByIds(ids: List<String>)

    @Query("SELECT COUNT(*) FROM record_events")
    fun count(): Int

    @Query("SELECT * FROM record_events ORDER BY COALESCE(occurredAtMs, 0) ASC, id ASC")
    fun all(): List<RoomRecordEntity>

    @Query("SELECT * FROM record_events WHERE id = :id LIMIT 1")
    fun findById(id: String): RoomRecordEntity?
}

@Dao
interface RoomMigrationDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    fun upsert(state: RoomMigrationStateEntity)

    @Query("SELECT * FROM migration_state WHERE scope = 'records' LIMIT 1")
    fun inspect(): RoomMigrationStateEntity?
}
