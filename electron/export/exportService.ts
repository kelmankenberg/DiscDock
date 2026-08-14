import fs from 'node:fs'
import { getDb } from '../db/index'
import type { ExportFormat, ExportScope } from '../../shared/types'

interface ExportRow {
  media_label: string
  path: string
  name: string
  extension: string | null
  kind: string
  size_bytes: number
  modified_at_src: string | null
  hash_value: string | null
}

function fetchRows(scope: ExportScope): ExportRow[] {
  const db = getDb()
  const base = `SELECT mi.label as media_label, fr.path, fr.name, fr.extension, fr.kind, fr.size_bytes,
                       fr.modified_at_src, fr.hash_value
                FROM file_record fr JOIN media_item mi ON mi.id = fr.media_item_id
                WHERE fr.is_directory = 0`

  if (scope.type === 'media') {
    return db.prepare(`${base} AND fr.media_item_id = ? ORDER BY mi.label, fr.path`).all(scope.mediaId) as ExportRow[]
  }
  return db.prepare(`${base} ORDER BY mi.label, fr.path`).all() as ExportRow[]
}

function toCsv(rows: ExportRow[]): string {
  const headers = ['Media', 'Path', 'Name', 'Extension', 'Kind', 'Size (bytes)', 'Modified', 'Hash']
  const escape = (value: string | number | null): string => {
    const str = value === null || value === undefined ? '' : String(value)
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
  }
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(
      [row.media_label, row.path, row.name, row.extension, row.kind, row.size_bytes, row.modified_at_src, row.hash_value]
        .map(escape)
        .join(',')
    )
  }
  return lines.join('\n')
}

function toJson(rows: ExportRow[]): string {
  return JSON.stringify(
    rows.map((r) => ({
      media: r.media_label,
      path: r.path,
      name: r.name,
      extension: r.extension,
      kind: r.kind,
      sizeBytes: r.size_bytes,
      modifiedAtSrc: r.modified_at_src,
      hash: r.hash_value
    })),
    null,
    2
  )
}

export function exportCatalog(scope: ExportScope, format: ExportFormat, destinationPath: string): number {
  const rows = fetchRows(scope)
  const content = format === 'csv' ? toCsv(rows) : toJson(rows)
  fs.writeFileSync(destinationPath, content, 'utf-8')
  return rows.length
}
