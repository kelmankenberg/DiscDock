import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { getDb, closeDb } from '../db'

function dbPath(): string {
  return path.join(app.getPath('userData'), 'discdock.sqlite3')
}

export async function backupNow(destinationPath: string): Promise<void> {
  await getDb().backup(destinationPath)
}

/**
 * Restores the database from a backup file. Takes a safety backup of the current database
 * first (FR-7.2) so a bad/incompatible restore file can't destroy existing data.
 */
export async function restoreFromBackup(sourcePath: string): Promise<{ safetyBackupPath: string }> {
  const current = dbPath()
  const backupsDir = path.join(app.getPath('userData'), 'backups')
  fs.mkdirSync(backupsDir, { recursive: true })
  const safetyBackupPath = path.join(backupsDir, `pre-restore-${Date.now()}.sqlite3`)

  await getDb().backup(safetyBackupPath)
  closeDb()

  fs.copyFileSync(sourcePath, current)
  for (const ext of ['-wal', '-shm']) {
    const sidecar = current + ext
    if (fs.existsSync(sidecar)) fs.rmSync(sidecar)
  }

  getDb() // reopen and re-run (idempotent) migrations against the restored file

  return { safetyBackupPath }
}
