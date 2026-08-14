import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { app } from 'electron'
import { CURRENT_SCHEMA_VERSION, getDb, closeDb } from '../db'
import { log } from '../logging'

function dbPath(): string {
  return path.join(app.getPath('userData'), 'discdock.sqlite3')
}

export async function backupNow(destinationPath: string): Promise<void> {
  log.info('Backup started', { destinationPath })
  await getDb().backup(destinationPath)
  log.info('Backup completed', { destinationPath })
}

function validateBackup(sourcePath: string): void {
  const candidate = new Database(sourcePath, { readonly: true })
  try {
    const integrity = candidate.pragma('integrity_check', { simple: true }) as string
    if (integrity !== 'ok') throw new Error(`Database integrity check failed: ${integrity}`)

    const hasMigrations = candidate
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
      .get()
    if (!hasMigrations) throw new Error('The selected file is not a DiscDock database')

    const latest = candidate.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as
      | { version: number | null }
      | undefined
    if (!latest?.version || latest.version > CURRENT_SCHEMA_VERSION) {
      throw new Error('The selected database was created by a newer version of DiscDock')
    }
  } finally {
    candidate.close()
  }
}

/**
 * Restores the database from a backup file. Takes a safety backup of the current database
 * first (FR-7.2) so a bad/incompatible restore file can't destroy existing data.
 */
export async function restoreFromBackup(sourcePath: string): Promise<{ safetyBackupPath: string }> {
  log.info('Restore started', { sourcePath })
  const current = dbPath()
  const temporary = `${current}.restore-${process.pid}-${Date.now()}`
  const displaced = `${current}.previous-${process.pid}-${Date.now()}`
  const backupsDir = path.join(app.getPath('userData'), 'backups')
  fs.mkdirSync(backupsDir, { recursive: true })
  const safetyBackupPath = path.join(backupsDir, `pre-restore-${Date.now()}.sqlite3`)

  await getDb().backup(safetyBackupPath)
  fs.copyFileSync(sourcePath, temporary)
  try {
    validateBackup(temporary)
  } catch (error) {
    fs.rmSync(temporary, { force: true })
    log.error('Restore validation failed', { sourcePath, error })
    throw error
  }

  closeDb()
  for (const ext of ['-wal', '-shm']) {
    const sidecar = current + ext
    if (fs.existsSync(sidecar)) fs.rmSync(sidecar)
  }

  try {
    fs.renameSync(current, displaced)
    fs.renameSync(temporary, current)
    getDb()
    fs.rmSync(displaced, { force: true })
  } catch (error) {
    closeDb()
    fs.rmSync(current, { force: true })
    fs.rmSync(temporary, { force: true })
    if (fs.existsSync(displaced)) fs.renameSync(displaced, current)
    getDb()
    log.error('Restore failed and was rolled back', { sourcePath, error })
    throw error
  }

  log.info('Restore completed', { sourcePath, safetyBackupPath })
  return { safetyBackupPath }
}
