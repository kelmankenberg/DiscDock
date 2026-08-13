import { getDb } from './index'
import type { DuplicateGroup, DuplicateOccurrence, DuplicateReport, DuplicateReportFilters } from '../../shared/types'

interface HashGroupRow {
  hash_value: string
  size_bytes: number
  occurrence_count: number
}

interface OccurrenceRow {
  media_item_id: number
  media_label: string
  path: string
}

export function getDuplicateReport(filters: DuplicateReportFilters): DuplicateReport {
  const db = getDb()
  const minGroupSize = filters.minGroupSize ?? 2

  const conditions = ['fr.hash_value IS NOT NULL', 'fr.is_directory = 0']
  const params: Record<string, unknown> = { minGroupSize }

  if (filters.mediaType !== undefined) {
    conditions.push('mi.media_type = @mediaType')
    params.mediaType = filters.mediaType
  }
  if (filters.kind !== undefined) {
    conditions.push('fr.kind = @kind')
    params.kind = filters.kind
  }

  const whereClause = conditions.join(' AND ')

  const groupRows = db
    .prepare(
      `SELECT fr.hash_value, fr.size_bytes, COUNT(*) as occurrence_count
       FROM file_record fr
       JOIN media_item mi ON mi.id = fr.media_item_id
       WHERE ${whereClause}
       GROUP BY fr.hash_value
       HAVING COUNT(*) >= @minGroupSize
       ORDER BY fr.size_bytes DESC`
    )
    .all(params) as HashGroupRow[]

  const occurrenceStmt = db.prepare(
    `SELECT fr.media_item_id, mi.label as media_label, fr.path
     FROM file_record fr
     JOIN media_item mi ON mi.id = fr.media_item_id
     WHERE fr.hash_value = ?`
  )

  const groups: DuplicateGroup[] = groupRows.map((row) => {
    const occurrences = (occurrenceStmt.all(row.hash_value) as OccurrenceRow[]).map(
      (o): DuplicateOccurrence => ({
        mediaItemId: o.media_item_id,
        mediaLabel: o.media_label,
        path: o.path
      })
    )
    return { hashValue: row.hash_value, sizeBytes: row.size_bytes, occurrences }
  })

  const totalFiles = groupRows.reduce((sum, row) => sum + row.occurrence_count, 0)
  const reclaimableBytes = groupRows.reduce(
    (sum, row) => sum + (row.occurrence_count - 1) * row.size_bytes,
    0
  )

  return { groups, totalGroups: groups.length, totalFiles, reclaimableBytes }
}
