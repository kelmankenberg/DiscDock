import { ipcMain } from 'electron'
import { getTagsForAllMedia, listAllTagNames, setTagsForMedia } from '../db/tagRepository'
import type { IpcResult } from '../../shared/types'
import { isPositiveInteger, isRecord, isStringArray, isTrustedRendererEvent } from './validation'

export function registerTagsIpc(): void {
  ipcMain.handle('tags:list', (event): IpcResult<string[]> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    return { ok: true, data: listAllTagNames() }
  })

  ipcMain.handle('tags:allForMedia', (event): IpcResult<Record<number, string[]>> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    return { ok: true, data: getTagsForAllMedia() }
  })

  ipcMain.handle('tags:setForMedia', (event, payload: unknown): IpcResult<string[]> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    const candidate = isRecord(payload) ? payload : {}
    const { mediaId, tagNames } = candidate
    if (!isPositiveInteger(mediaId)) {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric mediaId is required' } }
    }
    if (!isStringArray(tagNames)) return { ok: false, error: { code: 'invalid_input', message: 'tagNames must be an array of strings' } }
    return { ok: true, data: setTagsForMedia(mediaId, tagNames) }
  })
}
