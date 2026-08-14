import { getDb } from './index'
import type { Collection, CollectionInput, MediaItem } from '../../shared/types'

interface CollectionRow {
  id: number
  name: string
  description: string | null
}

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
    mediaType: row.media_type,
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

function withStats(db: ReturnType<typeof getDb>, row: CollectionRow): Collection {
  const stats = db
    .prepare(
      `SELECT COUNT(DISTINCT cmi.media_item_id) as memberCount,
              COALESCE(SUM(f.total_size), 0) as totalSize,
              COALESCE(SUM(f.total_files), 0) as totalFiles
       FROM collection_media_item cmi
       LEFT JOIN (
         SELECT media_item_id, SUM(size_bytes) as total_size, COUNT(*) as total_files
         FROM file_record WHERE is_directory = 0 GROUP BY media_item_id
       ) f ON f.media_item_id = cmi.media_item_id
       WHERE cmi.collection_id = ?`
    )
    .get(row.id) as { memberCount: number; totalSize: number; totalFiles: number }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    memberCount: stats.memberCount,
    totalSizeBytes: stats.totalSize,
    totalFiles: stats.totalFiles
  }
}

export function listCollections(): Collection[] {
  const db = getDb()
  const rows = db.prepare('SELECT id, name, description FROM collection ORDER BY name').all() as CollectionRow[]
  return rows.map((row) => withStats(db, row))
}

export function createCollection(input: CollectionInput): Collection {
  const db = getDb()
  const result = db
    .prepare('INSERT INTO collection (name, description) VALUES (?, ?)')
    .run(input.name, input.description)
  const row = db
    .prepare('SELECT id, name, description FROM collection WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as CollectionRow
  return withStats(db, row)
}

export function deleteCollection(id: number): void {
  const db = getDb()
  db.prepare('DELETE FROM collection_media_item WHERE collection_id = ?').run(id)
  db.prepare('DELETE FROM collection WHERE id = ?').run(id)
}

export function getCollectionMembers(collectionId: number): MediaItem[] {
  const rows = getDb()
    .prepare(
      `SELECT mi.* FROM media_item mi
       JOIN collection_media_item cmi ON cmi.media_item_id = mi.id
       WHERE cmi.collection_id = ?
       ORDER BY mi.label`
    )
    .all(collectionId) as MediaItemRow[]
  return rows.map(toMediaItem)
}

export function addMemberToCollection(collectionId: number, mediaItemId: number): void {
  getDb()
    .prepare('INSERT OR IGNORE INTO collection_media_item (collection_id, media_item_id) VALUES (?, ?)')
    .run(collectionId, mediaItemId)
}

export function removeMemberFromCollection(collectionId: number, mediaItemId: number): void {
  getDb()
    .prepare('DELETE FROM collection_media_item WHERE collection_id = ? AND media_item_id = ?')
    .run(collectionId, mediaItemId)
}
