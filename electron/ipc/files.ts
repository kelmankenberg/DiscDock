import { ipcMain } from 'electron'
import { listFolderContents } from '../db/fileRepository'
import type { FileEntry, IpcResult } from '../../shared/types'

export function registerFilesIpc(): void {
  ipcMain.handle('files:list', (_event, payload: unknown): IpcResult<FileEntry[]> => {
    const { mediaId, folderPath } = (payload ?? {}) as { mediaId?: unknown; folderPath?: unknown }
    if (typeof mediaId !== 'number') {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric mediaId is required' } }
    }
    const path = typeof folderPath === 'string' ? folderPath : ''
    try {
      return { ok: true, data: listFolderContents(mediaId, path) }
    } catch (err) {
      return { ok: false, error: { code: 'files_error', message: (err as Error).message } }
    }
  })
}
