import { ipcMain } from 'electron'
import { getTagsForAllMedia, listAllTagNames, setTagsForMedia } from '../db/tagRepository'
import type { IpcResult } from '../../shared/types'
import { isPositiveInteger, isRecord, isStringArray } from './validation'

export function registerTagsIpc(): void {
  ipcMain.handle('tags:list', (): IpcResult<string[]> => {
    return { ok: true, data: listAllTagNames() }
  })

  ipcMain.handle('tags:allForMedia', (): IpcResult<Record<number, string[]>> => {
    return { ok: true, data: getTagsForAllMedia() }
  })

  ipcMain.handle('tags:setForMedia', (_event, payload: unknown): IpcResult<string[]> => {
    const candidate = isRecord(payload) ? payload : {}
    const { mediaId, tagNames } = candidate
    if (!isPositiveInteger(mediaId)) {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric mediaId is required' } }
    }
    if (!isStringArray(tagNames)) return { ok: false, error: { code: 'invalid_input', message: 'tagNames must be an array of strings' } }
    return { ok: true, data: setTagsForMedia(mediaId, tagNames) }
  })
}
