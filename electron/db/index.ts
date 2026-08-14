import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { log } from '../logging'

let db: Database.Database | null = null

const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY
      );

      CREATE TABLE IF NOT EXISTS media_item (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        media_type TEXT NOT NULL,
        device_fingerprint TEXT,
        capacity_bytes INTEGER,
        physical_location TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_scanned_at TEXT,
        last_verified_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_media_item_type ON media_item(media_type);
      CREATE INDEX IF NOT EXISTS idx_media_item_status ON media_item(status);
      CREATE INDEX IF NOT EXISTS idx_media_item_fingerprint ON media_item(device_fingerprint);

      CREATE TABLE IF NOT EXISTS scan_job (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        media_item_id INTEGER NOT NULL REFERENCES media_item(id),
        status TEXT NOT NULL,
        hash_mode TEXT NOT NULL DEFAULT 'none',
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT,
        files_added INTEGER NOT NULL DEFAULT 0,
        files_removed INTEGER NOT NULL DEFAULT 0,
        files_modified INTEGER NOT NULL DEFAULT 0,
        files_unchanged INTEGER NOT NULL DEFAULT 0,
        error_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_scan_job_media_item ON scan_job(media_item_id);

      CREATE TABLE IF NOT EXISTS scan_error (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scan_job_id INTEGER NOT NULL REFERENCES scan_job(id),
        path TEXT NOT NULL,
        error_type TEXT NOT NULL,
        message TEXT
      );

      CREATE TABLE IF NOT EXISTS file_record (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        media_item_id INTEGER NOT NULL REFERENCES media_item(id),
        parent_folder_id INTEGER REFERENCES file_record(id),
        path TEXT NOT NULL,
        name TEXT NOT NULL,
        extension TEXT,
        kind TEXT,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        created_at_src TEXT,
        modified_at_src TEXT,
        hash_algo TEXT,
        hash_value TEXT,
        is_directory INTEGER NOT NULL DEFAULT 0,
        last_seen_scan_id INTEGER REFERENCES scan_job(id)
      );
      CREATE INDEX IF NOT EXISTS idx_file_record_media_item ON file_record(media_item_id);
      CREATE INDEX IF NOT EXISTS idx_file_record_hash ON file_record(hash_value);
      CREATE INDEX IF NOT EXISTS idx_file_record_extension ON file_record(extension);

      CREATE VIRTUAL TABLE IF NOT EXISTS file_record_fts USING fts5(
        name, path, content='file_record', content_rowid='id'
      );

      CREATE TABLE IF NOT EXISTS tag (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS media_item_tag (
        media_item_id INTEGER NOT NULL REFERENCES media_item(id),
        tag_id INTEGER NOT NULL REFERENCES tag(id),
        PRIMARY KEY (media_item_id, tag_id)
      );

      CREATE TABLE IF NOT EXISTS collection (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS collection_media_item (
        collection_id INTEGER NOT NULL REFERENCES collection(id),
        media_item_id INTEGER NOT NULL REFERENCES media_item(id),
        PRIMARY KEY (collection_id, media_item_id)
      );
    `
  },
  {
    version: 2,
    sql: `
      -- Keep the file_record_fts external-content index in sync with file_record writes.
      CREATE TRIGGER IF NOT EXISTS file_record_ai AFTER INSERT ON file_record BEGIN
        INSERT INTO file_record_fts(rowid, name, path) VALUES (new.id, new.name, new.path);
      END;
      CREATE TRIGGER IF NOT EXISTS file_record_ad AFTER DELETE ON file_record BEGIN
        INSERT INTO file_record_fts(file_record_fts, rowid, name, path) VALUES('delete', old.id, old.name, old.path);
      END;
      CREATE TRIGGER IF NOT EXISTS file_record_au AFTER UPDATE ON file_record BEGIN
        INSERT INTO file_record_fts(file_record_fts, rowid, name, path) VALUES('delete', old.id, old.name, old.path);
        INSERT INTO file_record_fts(rowid, name, path) VALUES (new.id, new.name, new.path);
      END;
      INSERT INTO file_record_fts(file_record_fts) VALUES('rebuild');
    `
  },
  {
    version: 3,
    sql: `
      CREATE TABLE IF NOT EXISTS media_item_custom_field (
        media_item_id INTEGER NOT NULL REFERENCES media_item(id),
        field_name TEXT NOT NULL,
        field_value TEXT,
        PRIMARY KEY (media_item_id, field_name)
      );
    `
  },
  {
    version: 4,
    sql: `
      -- File annotations are keyed by (media_item_id, path) rather than file_record.id so they
      -- survive re-scans that prune and re-add rows for the same file.
      CREATE TABLE IF NOT EXISTS file_note (
        media_item_id INTEGER NOT NULL REFERENCES media_item(id),
        path TEXT NOT NULL,
        note TEXT,
        PRIMARY KEY (media_item_id, path)
      );

      CREATE TABLE IF NOT EXISTS file_tag (
        media_item_id INTEGER NOT NULL REFERENCES media_item(id),
        path TEXT NOT NULL,
        tag_id INTEGER NOT NULL REFERENCES tag(id),
        PRIMARY KEY (media_item_id, path, tag_id)
      );
      CREATE INDEX IF NOT EXISTS idx_file_tag_tag ON file_tag(tag_id);
    `
  },
  {
    version: 5,
    sql: `
      ALTER TABLE file_record ADD COLUMN duration_seconds INTEGER;
    `
  },
  {
    version: 6,
    sql: `
      ALTER TABLE media_item ADD COLUMN cover_path TEXT;
    `
  }
]

export const CURRENT_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version

function runMigrations(database: Database.Database): void {
  database.pragma('foreign_keys = ON')
  database.pragma('journal_mode = WAL')
  database.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)')

  const appliedVersions = new Set(
    (database.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(
      (row) => row.version
    )
  )

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue
    log.info('Applying database migration', { version: migration.version })
    const applyMigration = database.transaction(() => {
      database.exec(migration.sql)
      database
        .prepare('INSERT INTO schema_migrations (version) VALUES (?)')
        .run(migration.version)
    })
    applyMigration()
    log.info('Database migration applied', { version: migration.version })
  }
}

function backupBeforeMigrations(database: Database.Database, databasePath: string, userDataDir: string): void {
  const hasMigrationTable = database
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
    .get()
  if (!hasMigrationTable) return

  const applied = database.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as
    | { version: number | null }
    | undefined
  if ((applied?.version ?? 0) >= CURRENT_SCHEMA_VERSION) return

  const backupsDir = path.join(userDataDir, 'backups')
  fs.mkdirSync(backupsDir, { recursive: true })
  const backupPath = path.join(backupsDir, `pre-migration-${Date.now()}.sqlite3`)
  database.pragma('wal_checkpoint(TRUNCATE)')
  fs.copyFileSync(databasePath, backupPath)
  log.info('Pre-migration database backup created', { backupPath, fromVersion: applied?.version ?? 0, toVersion: CURRENT_SCHEMA_VERSION })
}

export function getDb(): Database.Database {
  if (db) return db

  const userDataDir = app.getPath('userData')
  fs.mkdirSync(userDataDir, { recursive: true })
  const dbPath = path.join(userDataDir, 'discdock.sqlite3')

  db = new Database(dbPath)
  backupBeforeMigrations(db, dbPath, userDataDir)
  runMigrations(db)

  return db
}

export function closeDb(): void {
  db?.close()
  db = null
}
