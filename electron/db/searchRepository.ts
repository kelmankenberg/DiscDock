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
  // Split on any non-alphanumeric separator (not just whitespace) so punctuation like "." or "_"
  // in a query (e.g. "report.ini") produces separate AND'd prefix terms rather than a single quoted
  // phrase — FTS5 would otherwise tokenize a quoted multi-word phrase itself and require strict
  // token adjacency, causing real matches to be missed (e.g. "c.ini" would require a literal "c"
  // token immediately followed by "ini", which most filenames don't have).
  const terms = text
    .trim()
    .split(/[^a-zA-Z0-9]+/)
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

  // FTS5 only indexes whole word tokens, so a query containing punctuation (e.g. "report.ini")
  // can miss real substring matches that span a word boundary (e.g. "5631_hwc.ini" contains
  // "c.ini" but tokenizes to "5631"/"hwc"/"ini", none of which is "c"). Fall back to a plain
  // substring LIKE search across name/path when the FTS-based query finds nothing.
  if (matchQuery && total === 0) {
    return searchByLikeFallback(text, conditions, params, page, pageSize)
  }

  return { results, total }
}

function searchByLikeFallback(
  text: string,
  baseConditions: string[],
  baseParams: Record<string, unknown>,
  page: number,
  pageSize: number
): SearchResultPage {
  const db = getDb()
  const likePattern = `%${text.trim().replace(/[%_]/g, (c) => `\\${c}`)}%`
  const conditions = [...baseConditions, '(fr.name LIKE @likePattern ESCAPE \'\\\' OR fr.path LIKE @likePattern ESCAPE \'\\\')']
  const params = { ...baseParams, likePattern }
  const offset = Math.max(0, page) * pageSize

  const fromClause = `FROM file_record fr JOIN media_item mi ON mi.id = fr.media_item_id`
  const whereClause = `WHERE ${conditions.join(' AND ')}`

  const total = (
    db.prepare(`SELECT COUNT(*) as count ${fromClause} ${whereClause}`).get(params) as { count: number }
  ).count

  const results = (
    db
      .prepare(
        `SELECT fr.id, fr.media_item_id, mi.label as media_label, fr.path, fr.name, fr.size_bytes,
                fr.modified_at_src, fr.kind
         ${fromClause} ${whereClause}
         ORDER BY fr.name
         LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit: pageSize, offset }) as FileSearchRow[]
  ).map(toResult)

  return { results, total }
}
