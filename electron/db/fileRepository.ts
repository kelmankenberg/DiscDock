import { getDb } from './index'
import type { FileEntry } from '../../shared/types'

interface FileRow {
  path: string
  name: string
  kind: string
  is_directory: number
  size_bytes: number
  directory_file_count: number
  directory_size_bytes: number
  modified_at_src: string | null
  duration_seconds: number | null
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
      `SELECT fr.path, fr.name, fr.kind, fr.is_directory, fr.size_bytes, fr.modified_at_src, fr.duration_seconds,
              CASE WHEN fr.is_directory = 1 THEN (
                SELECT COUNT(*) FROM file_record child
                WHERE child.media_item_id = fr.media_item_id AND child.is_directory = 0
                  AND substr(child.path, 1, length(fr.path) + 1) = fr.path || '/'
              ) ELSE 0 END AS directory_file_count,
              CASE WHEN fr.is_directory = 1 THEN (
                SELECT COALESCE(SUM(child.size_bytes), 0) FROM file_record child
                WHERE child.media_item_id = fr.media_item_id AND child.is_directory = 0
                  AND substr(child.path, 1, length(fr.path) + 1) = fr.path || '/'
              ) ELSE 0 END AS directory_size_bytes
       FROM file_record fr
      WHERE fr.media_item_id = @mediaItemId
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
    directoryFileCount: row.directory_file_count,
    directorySizeBytes: row.directory_size_bytes,
    modifiedAtSrc: row.modified_at_src,
    durationSeconds: row.duration_seconds
  }))
}
