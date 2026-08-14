import { getDb } from './index'
import type { FileAnnotation } from '../../shared/types'

/** Returns tags and notes for every annotated file under a media item, keyed by file path. */
export function getFileAnnotations(mediaItemId: number): Record<string, FileAnnotation> {
  const db = getDb()
  const annotations: Record<string, FileAnnotation> = {}

  const tagRows = db
    .prepare(
      `SELECT ft.path as path, t.name as name
       FROM file_tag ft JOIN tag t ON t.id = ft.tag_id
       WHERE ft.media_item_id = ?
       ORDER BY t.name`
    )
    .all(mediaItemId) as { path: string; name: string }[]

  for (const row of tagRows) {
    if (!annotations[row.path]) annotations[row.path] = { tags: [], note: null }
    annotations[row.path].tags.push(row.name)
  }

  const noteRows = db
    .prepare('SELECT path, note FROM file_note WHERE media_item_id = ?')
    .all(mediaItemId) as { path: string; note: string | null }[]

  for (const row of noteRows) {
    if (!annotations[row.path]) annotations[row.path] = { tags: [], note: null }
    annotations[row.path].note = row.note
  }

  return annotations
}

export function getFileAnnotation(mediaItemId: number, path: string): FileAnnotation {
  const db = getDb()
  const tags = (
    db
      .prepare(
        `SELECT t.name as name FROM file_tag ft JOIN tag t ON t.id = ft.tag_id
         WHERE ft.media_item_id = ? AND ft.path = ? ORDER BY t.name`
      )
      .all(mediaItemId, path) as { name: string }[]
  ).map((row) => row.name)

  const note = db
    .prepare('SELECT note FROM file_note WHERE media_item_id = ? AND path = ?')
    .get(mediaItemId, path) as { note: string | null } | undefined

  return { tags, note: note?.note ?? null }
}

/** Replaces the full tag set for a single file (creating tags as needed). */
export function setTagsForFile(mediaItemId: number, path: string, tagNames: string[]): FileAnnotation {
  const db = getDb()
  const normalized = Array.from(new Set(tagNames.map((name) => name.trim()).filter(Boolean)))

  const apply = db.transaction(() => {
    db.prepare('DELETE FROM file_tag WHERE media_item_id = ? AND path = ?').run(mediaItemId, path)
    for (const name of normalized) {
      db.prepare('INSERT OR IGNORE INTO tag (name) VALUES (?)').run(name)
      const tag = db.prepare('SELECT id FROM tag WHERE name = ?').get(name) as { id: number }
      db.prepare(
        'INSERT OR IGNORE INTO file_tag (media_item_id, path, tag_id) VALUES (?, ?, ?)'
      ).run(mediaItemId, path, tag.id)
    }
  })
  apply()

  return getFileAnnotation(mediaItemId, path)
}

export function setNoteForFile(mediaItemId: number, path: string, note: string | null): FileAnnotation {
  const db = getDb()
  const trimmed = note && note.trim() ? note.trim() : null

  if (trimmed === null) {
    db.prepare('DELETE FROM file_note WHERE media_item_id = ? AND path = ?').run(mediaItemId, path)
  } else {
    db.prepare(
      `INSERT INTO file_note (media_item_id, path, note) VALUES (?, ?, ?)
       ON CONFLICT(media_item_id, path) DO UPDATE SET note = excluded.note`
    ).run(mediaItemId, path, trimmed)
  }

  return getFileAnnotation(mediaItemId, path)
}
