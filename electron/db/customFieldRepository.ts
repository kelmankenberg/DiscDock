import { getDb } from './index'
import type { CustomFieldValue } from '../../shared/types'

export function getCustomFieldsForMedia(mediaItemId: number): CustomFieldValue[] {
  const rows = getDb()
    .prepare('SELECT field_name as fieldName, field_value as fieldValue FROM media_item_custom_field WHERE media_item_id = ?')
    .all(mediaItemId) as CustomFieldValue[]
  return rows
}

export function setCustomFieldForMedia(mediaItemId: number, fieldName: string, fieldValue: string | null): void {
  const db = getDb()
  if (fieldValue === null || fieldValue.trim() === '') {
    db.prepare('DELETE FROM media_item_custom_field WHERE media_item_id = ? AND field_name = ?').run(
      mediaItemId,
      fieldName
    )
    return
  }
  db.prepare(
    `INSERT INTO media_item_custom_field (media_item_id, field_name, field_value)
     VALUES (@mediaItemId, @fieldName, @fieldValue)
     ON CONFLICT(media_item_id, field_name) DO UPDATE SET field_value = excluded.field_value`
  ).run({ mediaItemId, fieldName, fieldValue })
}
