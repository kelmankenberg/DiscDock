import { getDb } from './index'
import type { FileEntry } from '../../shared/types'

interface FileRow {
  path: string
  name: string
  kind: string
  is_directory: number
  size_bytes: number
  modified_at_src: string | null
}

/**
 * Returns the immediate children of folderPath ('' for the media root) for the catalogued tree.
 * Note: folderPath is matched as a literal prefix; paths containing SQL LIKE wildcards (% or _)
 * are a known v0.1.0 edge case limitation.
 */
export function listFolderContents(mediaItemId: number, folderPath: string): FileEntry[] {
  const prefix = folderPath ? `${folderPath}/` : ''

  const rows = getDb()
    .prepare(
      `SELECT path, name, kind, is_directory, size_bytes, modified_at_src
       FROM file_record
       WHERE media_item_id = @mediaItemId
         AND path LIKE @likePrefix
         AND path != @folderPath
         AND instr(substr(path, length(@prefix) + 1), '/') = 0
       ORDER BY is_directory DESC, name COLLATE NOCASE`
    )
    .all({
      mediaItemId,
      prefix,
      likePrefix: `${prefix}%`,
      folderPath
    }) as FileRow[]

  return rows.map((row) => ({
    path: row.path,
    name: row.name,
    kind: row.kind,
    isDirectory: row.is_directory === 1,
    sizeBytes: row.size_bytes,
    modifiedAtSrc: row.modified_at_src
  }))
}
