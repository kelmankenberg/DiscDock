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
    lastVerifiedAt: row.last_verified_at
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
      `INSERT INTO media_item (label, media_type, capacity_bytes, physical_location, notes)
       VALUES (@label, @mediaType, @capacityBytes, @physicalLocation, @notes)`
    )
    .run({
      label: input.label,
      mediaType: input.mediaType,
      capacityBytes: input.capacityBytes,
      physicalLocation: input.physicalLocation,
      notes: input.notes
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

export function retireMediaItem(id: number): MediaItem {
  getDb().prepare("UPDATE media_item SET status = 'retired' WHERE id = ?").run(id)
  const updated = getMediaItem(id)
  if (!updated) throw new Error('Failed to load retired media item')
  return updated
}

export function deleteMediaItem(id: number): void {
  getDb().prepare('DELETE FROM media_item WHERE id = ?').run(id)
}
