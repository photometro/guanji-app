package com.guanji.app.core.data

import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import net.zetetic.database.sqlcipher.SupportOpenHelperFactory

/** #223：加密 Room 影子库；不承担发行版数据权威。 */
@Database(
    entities = [RoomRecordEntity::class, RoomMigrationStateEntity::class],
    version = 2,
    exportSchema = false,
)
abstract class GuanjiShadowDatabase : RoomDatabase() {
    abstract fun recordDao(): RoomRecordDao
    abstract fun migrationDao(): RoomMigrationDao

    companion object {
        private const val DATABASE_NAME = "guanji_shadow.db"

        private val MIGRATION_1_2 = object : androidx.room.migration.Migration(1, 2) {
            override fun migrate(db: androidx.sqlite.db.SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE record_events ADD COLUMN localDate TEXT")
                db.execSQL("ALTER TABLE record_events ADD COLUMN backfill INTEGER NOT NULL DEFAULT 0")
            }
        }

        @Volatile private var instance: GuanjiShadowDatabase? = null

        fun open(context: android.content.Context, databaseKey: ByteArray): GuanjiShadowDatabase {
            instance?.let { return it }
            synchronized(this) {
                instance?.let { return it }
                runCatching { System.loadLibrary("sqlcipher") }
                val factory = SupportOpenHelperFactory(databaseKey)
                return Room.databaseBuilder(
                    context.applicationContext,
                    GuanjiShadowDatabase::class.java,
                    DATABASE_NAME,
                )
                    .openHelperFactory(factory)
                    .setJournalMode(RoomDatabase.JournalMode.WRITE_AHEAD_LOGGING)
                    .addMigrations(MIGRATION_1_2)
                    .build()
                    .also { instance = it }
            }
        }

        fun close() {
            synchronized(this) {
                instance?.close()
                instance = null
            }
        }
    }
}
