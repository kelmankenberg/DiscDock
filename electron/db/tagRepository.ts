import { getDb } from './index'

export function listAllTagNames(): string[] {
  const rows = getDb().prepare('SELECT name FROM tag ORDER BY name').all() as { name: string }[]
  return rows.map((r) => r.name)
}

export function getTagsForAllMedia(): Record<number, string[]> {
  const rows = getDb()
    .prepare(
      `SELECT mit.media_item_id as mediaItemId, t.name as name
       FROM media_item_tag mit JOIN tag t ON t.id = mit.tag_id
       ORDER BY t.name`
    )
    .all() as { mediaItemId: number; name: string }[]

  const map: Record<number, string[]> = {}
  for (const row of rows) {
    if (!map[row.mediaItemId]) map[row.mediaItemId] = []
    map[row.mediaItemId].push(row.name)
  }
  return map
}

export function getTagsForMedia(mediaItemId: number): string[] {
  const rows = getDb()
    .prepare(
      `SELECT t.name as name FROM tag t
       JOIN media_item_tag mit ON mit.tag_id = t.id
       WHERE mit.media_item_id = ? ORDER BY t.name`
    )
    .all(mediaItemId) as { name: string }[]
  return rows.map((r) => r.name)
}

/** Replaces the full set of tags for a media item with the given list (creating new tags as needed). */
export function setTagsForMedia(mediaItemId: number, tagNames: string[]): string[] {
  const db = getDb()
  const normalized = Array.from(new Set(tagNames.map((n) => n.trim()).filter(Boolean)))

  const apply = db.transaction(() => {
    db.prepare('DELETE FROM media_item_tag WHERE media_item_id = ?').run(mediaItemId)
    for (const name of normalized) {
      db.prepare('INSERT OR IGNORE INTO tag (name) VALUES (?)').run(name)
      const tag = db.prepare('SELECT id FROM tag WHERE name = ?').get(name) as { id: number }
      db.prepare('INSERT OR IGNORE INTO media_item_tag (media_item_id, tag_id) VALUES (?, ?)').run(
        mediaItemId,
        tag.id
      )
    }
  })
  apply()

  return getTagsForMedia(mediaItemId)
}
