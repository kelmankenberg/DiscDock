import { getDb } from './index'
import type { MediaItem, MediaItemInput } from '../../shared/types'

interface MediaItemRow {
  id: number
  label: string
  media_type: string
  device_fingerprint: string | null
  capacity_bytes: number | null
  physical_location: string | null
  notes: string | null
  status: string
  created_at: string
  last_scanned_at: string | null
  last_verified_at: string | null
  cover_path: string | null
}

function toMediaItem(row: MediaItemRow): MediaItem {
  return {
    id: row.id,
    label: row.label,
    mediaType: row.media_type as MediaItem['mediaType'],
    deviceFingerprint: row.device_fingerprint,
    capacityBytes: row.capacity_bytes,
    physicalLocation: row.physical_location,
    notes: row.notes,
    status: row.status as MediaItem['status'],
    createdAt: row.created_at,
    lastScannedAt: row.last_scanned_at,
    lastVerifiedAt: row.last_verified_at,
    coverPath: row.cover_path
  }
}

export function listMediaItems(): MediaItem[] {
  const rows = getDb()
    .prepare('SELECT * FROM media_item ORDER BY created_at DESC')
    .all() as MediaItemRow[]
  return rows.map(toMediaItem)
}

export function getMediaItem(id: number): MediaItem | null {
  const row = getDb().prepare('SELECT * FROM media_item WHERE id = ?').get(id) as
    | MediaItemRow
    | undefined
  return row ? toMediaItem(row) : null
}

export function createMediaItem(input: MediaItemInput): MediaItem {
  const result = getDb()
    .prepare(
      `INSERT INTO media_item (label, media_type, capacity_bytes, physical_location, notes, device_fingerprint)
       VALUES (@label, @mediaType, @capacityBytes, @physicalLocation, @notes, @deviceFingerprint)`
    )
    .run({
      label: input.label,
      mediaType: input.mediaType,
      capacityBytes: input.capacityBytes,
      physicalLocation: input.physicalLocation,
      notes: input.notes,
      deviceFingerprint: input.deviceFingerprint ?? null
    })

  const created = getMediaItem(Number(result.lastInsertRowid))
  if (!created) throw new Error('Failed to load newly created media item')
  return created
}

export function updateMediaItem(id: number, patch: Partial<MediaItemInput>): MediaItem {
  const existing = getMediaItem(id)
  if (!existing) throw new Error(`Media item ${id} not found`)

  const merged: MediaItemInput = {
    label: patch.label ?? existing.label,
    mediaType: patch.mediaType ?? existing.mediaType,
    capacityBytes: patch.capacityBytes !== undefined ? patch.capacityBytes : existing.capacityBytes,
    physicalLocation:
      patch.physicalLocation !== undefined ? patch.physicalLocation : existing.physicalLocation,
    notes: patch.notes !== undefined ? patch.notes : existing.notes
  }

  getDb()
    .prepare(
      `UPDATE media_item
       SET label = @label, media_type = @mediaType, capacity_bytes = @capacityBytes,
           physical_location = @physicalLocation, notes = @notes
       WHERE id = @id`
    )
    .run({ id, ...merged })

  const updated = getMediaItem(id)
  if (!updated) throw new Error('Failed to load updated media item')
  return updated
}

export function countMediaNeedingVerification(thresholdMonths: number): number {
  const months = Number.isFinite(thresholdMonths) ? Math.max(1, Math.trunc(thresholdMonths)) : 12
  const { count } = getDb()
    .prepare(
      `SELECT COUNT(*) as count FROM media_item
       WHERE status = 'active'
         AND COALESCE(last_verified_at, created_at) < datetime('now', ?)`
    )
    .get(`-${months} months`) as { count: number }
  return count
}

export function setMediaCoverPath(id: number, coverPath: string | null): void {
  getDb().prepare('UPDATE media_item SET cover_path = ? WHERE id = ?').run(coverPath, id)
}

export function markMediaVerified(id: number): MediaItem {
  getDb().prepare("UPDATE media_item SET last_verified_at = datetime('now') WHERE id = ?").run(id)
  const updated = getMediaItem(id)
  if (!updated) throw new Error(`Media item ${id} not found`)
  return updated
}

export function retireMediaItem(id: number): MediaItem {
  getDb().prepare("UPDATE media_item SET status = 'retired' WHERE id = ?").run(id)
  const updated = getMediaItem(id)
  if (!updated) throw new Error('Failed to load retired media item')
  return updated
}

export function deleteMediaItem(id: number): void {
  const database = getDb()
  const deleteCascade = database.transaction((mediaItemId: number) => {
    database.prepare('DELETE FROM media_item_tag WHERE media_item_id = ?').run(mediaItemId)
    database
      .prepare('DELETE FROM collection_media_item WHERE media_item_id = ?')
      .run(mediaItemId)
    database
      .prepare('DELETE FROM media_item_custom_field WHERE media_item_id = ?')
      .run(mediaItemId)
    database.prepare('DELETE FROM file_tag WHERE media_item_id = ?').run(mediaItemId)
    database.prepare('DELETE FROM file_note WHERE media_item_id = ?').run(mediaItemId)
    database.prepare('DELETE FROM file_record WHERE media_item_id = ?').run(mediaItemId)
    database
      .prepare(
        'DELETE FROM scan_error WHERE scan_job_id IN (SELECT id FROM scan_job WHERE media_item_id = ?)'
      )
      .run(mediaItemId)
    database.prepare('DELETE FROM scan_job WHERE media_item_id = ?').run(mediaItemId)
    database.prepare('DELETE FROM media_item WHERE id = ?').run(mediaItemId)
  })
  deleteCascade(id)
}
