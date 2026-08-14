import { ipcMain } from 'electron'
import { getTagsForAllMedia, listAllTagNames, setTagsForMedia } from '../db/tagRepository'
import type { IpcResult } from '../../shared/types'

export function registerTagsIpc(): void {
  ipcMain.handle('tags:list', (): IpcResult<string[]> => {
    return { ok: true, data: listAllTagNames() }
  })

  ipcMain.handle('tags:allForMedia', (): IpcResult<Record<number, string[]>> => {
    return { ok: true, data: getTagsForAllMedia() }
  })

  ipcMain.handle('tags:setForMedia', (_event, payload: unknown): IpcResult<string[]> => {
    const { mediaId, tagNames } = (payload ?? {}) as { mediaId?: unknown; tagNames?: unknown }
    if (typeof mediaId !== 'number') {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric mediaId is required' } }
    }
    const names = Array.isArray(tagNames) ? tagNames.filter((n): n is string => typeof n === 'string') : []
    return { ok: true, data: setTagsForMedia(mediaId, names) }
  })
}
