import { getDb } from './index'
import type { FileSearchResult, SearchFilters, SearchResultPage } from '../../shared/types'

interface FileSearchRow {
  id: number
  media_item_id: number
  media_label: string
  path: string
  name: string
  size_bytes: number
  modified_at_src: string | null
  kind: string
}

function toResult(row: FileSearchRow): FileSearchResult {
  return {
    id: row.id,
    mediaItemId: row.media_item_id,
    mediaLabel: row.media_label,
    path: row.path,
    name: row.name,
    sizeBytes: row.size_bytes,
    modifiedAtSrc: row.modified_at_src,
    kind: row.kind
  }
}

/** Builds an FTS5 MATCH expression doing a prefix match per term (FR-3.2: partial/substring search). */
function buildMatchQuery(text: string): string | null {
  const terms = text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => term.replace(/["*]/g, ''))
    .filter(Boolean)
  if (terms.length === 0) return null
  return terms.map((term) => `"${term}"*`).join(' AND ')
}

export function searchFiles(text: string, filters: SearchFilters, page: number, pageSize: number): SearchResultPage {
  const db = getDb()
  const matchQuery = buildMatchQuery(text)

  const conditions: string[] = ['fr.is_directory = 0']
  const params: Record<string, unknown> = {}

  if (filters.mediaItemId !== undefined) {
    conditions.push('fr.media_item_id = @mediaItemId')
    params.mediaItemId = filters.mediaItemId
  }
  if (filters.mediaType !== undefined) {
    conditions.push('mi.media_type = @mediaType')
    params.mediaType = filters.mediaType
  }
  if (filters.kind !== undefined) {
    conditions.push('fr.kind = @kind')
    params.kind = filters.kind
  }
  if (filters.minSizeBytes !== undefined) {
    conditions.push('fr.size_bytes >= @minSizeBytes')
    params.minSizeBytes = filters.minSizeBytes
  }
  if (filters.maxSizeBytes !== undefined) {
    conditions.push('fr.size_bytes <= @maxSizeBytes')
    params.maxSizeBytes = filters.maxSizeBytes
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const offset = Math.max(0, page) * pageSize

  const fromClause = matchQuery
    ? `FROM file_record_fts fts
       JOIN file_record fr ON fr.id = fts.rowid
       JOIN media_item mi ON mi.id = fr.media_item_id`
    : `FROM file_record fr
       JOIN media_item mi ON mi.id = fr.media_item_id`

  const matchClause = matchQuery
    ? conditions.length > 0
      ? 'AND file_record_fts MATCH @matchQuery'
      : 'WHERE file_record_fts MATCH @matchQuery'
    : ''
  if (matchQuery) params.matchQuery = matchQuery

  const baseQuery = `${fromClause} ${whereClause} ${matchClause}`.trim()

  const total = (
    db.prepare(`SELECT COUNT(*) as count ${baseQuery}`).get(params) as { count: number }
  ).count

  const results = (
    db
      .prepare(
        `SELECT fr.id, fr.media_item_id, mi.label as media_label, fr.path, fr.name, fr.size_bytes,
                fr.modified_at_src, fr.kind
         ${baseQuery}
         ORDER BY fr.name
         LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit: pageSize, offset }) as FileSearchRow[]
  ).map(toResult)

  return { results, total }
}
