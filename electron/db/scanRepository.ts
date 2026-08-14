import { getDb } from './index'
import type { HashMode, ScanErrorEntry, ScanJob, ScanStatus } from '../../shared/types'

interface ScanJobRow {
  id: number
  media_item_id: number
  status: string
  hash_mode: string
  started_at: string
  completed_at: string | null
  files_added: number
  files_removed: number
  files_modified: number
  files_unchanged: number
  error_count: number
}

function toScanJob(row: ScanJobRow): ScanJob {
  return {
    id: row.id,
    mediaItemId: row.media_item_id,
    status: row.status as ScanStatus,
    hashMode: row.hash_mode as HashMode,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    filesAdded: row.files_added,
    filesRemoved: row.files_removed,
    filesModified: row.files_modified,
    filesUnchanged: row.files_unchanged,
    errorCount: row.error_count
  }
}

export function createScanJob(mediaItemId: number, hashMode: HashMode): ScanJob {
  const result = getDb()
    .prepare(
      `INSERT INTO scan_job (media_item_id, status, hash_mode) VALUES (?, 'running', ?)`
    )
    .run(mediaItemId, hashMode)
  return getScanJob(Number(result.lastInsertRowid))!
}

export function getScanJob(id: number): ScanJob | null {
  const row = getDb().prepare('SELECT * FROM scan_job WHERE id = ?').get(id) as
    | ScanJobRow
    | undefined
  return row ? toScanJob(row) : null
}

export function listScanJobsForMedia(mediaItemId: number): ScanJob[] {
  const rows = getDb()
    .prepare('SELECT * FROM scan_job WHERE media_item_id = ? ORDER BY started_at DESC')
    .all(mediaItemId) as ScanJobRow[]
  return rows.map(toScanJob)
}

export function finalizeScanJob(
  id: number,
  status: ScanStatus,
  counts: {
    filesAdded: number
    filesRemoved: number
    filesModified: number
    filesUnchanged: number
    errorCount: number
  }
): void {
  getDb()
    .prepare(
      `UPDATE scan_job
       SET status = @status, completed_at = datetime('now'), files_added = @filesAdded,
           files_removed = @filesRemoved, files_modified = @filesModified,
           files_unchanged = @filesUnchanged, error_count = @errorCount
       WHERE id = @id`
    )
    .run({ id, status, ...counts })
}

export function recordScanError(scanJobId: number, path: string, errorType: string, message: string): void {
  getDb()
    .prepare('INSERT INTO scan_error (scan_job_id, path, error_type, message) VALUES (?, ?, ?, ?)')
    .run(scanJobId, path, errorType, message)
}

export function getErrorsForMedia(mediaItemId: number): ScanErrorEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT se.path as path, se.error_type as errorType, se.message as message, sj.started_at as scanStartedAt
       FROM scan_error se
       JOIN scan_job sj ON sj.id = se.scan_job_id
       WHERE sj.media_item_id = ?
       ORDER BY sj.started_at DESC`
    )
    .all(mediaItemId) as { path: string; errorType: string; message: string | null; scanStartedAt: string }[]
  return rows
}

export function markMediaScanned(mediaItemId: number, verified: boolean): void {
  const db = getDb()
  if (verified) {
    db.prepare(
      "UPDATE media_item SET last_scanned_at = datetime('now'), last_verified_at = datetime('now') WHERE id = ?"
    ).run(mediaItemId)
  } else {
    db.prepare("UPDATE media_item SET last_scanned_at = datetime('now') WHERE id = ?").run(mediaItemId)
  }
}

export interface WalkedFile {
  path: string
  name: string
  extension: string | null
  kind: string
  sizeBytes: number
  isDirectory: boolean
  createdAtSrc: string | null
  modifiedAtSrc: string | null
  hashAlgo: string | null
  hashValue: string | null
}

interface ExistingFileRow {
  id: number
  size_bytes: number
  modified_at_src: string | null
  hash_value: string | null
}

/**
 * Upserts a single walked file/folder against the prior catalog snapshot for this media item,
 * classifying it as added/modified/unchanged. Removed-file detection happens after the walk
 * completes (see pruneUnseenFiles) by comparing last_seen_scan_id.
 */
export function upsertFileRecord(
  mediaItemId: number,
  scanJobId: number,
  file: WalkedFile
): 'added' | 'modified' | 'unchanged' {
  const db = getDb()
  const existing = db
    .prepare('SELECT id, size_bytes, modified_at_src, hash_value FROM file_record WHERE media_item_id = ? AND path = ?')
    .get(mediaItemId, file.path) as ExistingFileRow | undefined

  if (!existing) {
    db.prepare(
      `INSERT INTO file_record
         (media_item_id, path, name, extension, kind, size_bytes, created_at_src, modified_at_src,
          hash_algo, hash_value, is_directory, last_seen_scan_id)
       VALUES (@mediaItemId, @path, @name, @extension, @kind, @sizeBytes, @createdAtSrc, @modifiedAtSrc,
               @hashAlgo, @hashValue, @isDirectory, @scanJobId)`
    ).run({
      mediaItemId,
      scanJobId,
      ...file,
      isDirectory: file.isDirectory ? 1 : 0
    })
    return 'added'
  }

  const changed =
    existing.size_bytes !== file.sizeBytes ||
    existing.modified_at_src !== file.modifiedAtSrc ||
    (file.hashValue !== null && existing.hash_value !== file.hashValue)

  db.prepare(
    `UPDATE file_record
     SET size_bytes = @sizeBytes, created_at_src = @createdAtSrc, modified_at_src = @modifiedAtSrc,
         hash_algo = @hashAlgo, hash_value = @hashValue, last_seen_scan_id = @scanJobId
     WHERE id = @id`
  ).run({ id: existing.id, scanJobId, ...file })

  return changed ? 'modified' : 'unchanged'
}

/** Deletes file_record rows for this media item not touched by the given scan job (i.e. removed from disk). */
export function pruneUnseenFiles(mediaItemId: number, scanJobId: number): number {
  const result = getDb()
    .prepare('DELETE FROM file_record WHERE media_item_id = ? AND (last_seen_scan_id IS NULL OR last_seen_scan_id != ?)')
    .run(mediaItemId, scanJobId)
  return result.changes
}
