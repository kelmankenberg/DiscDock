import { ipcMain } from 'electron'
import { getCustomFieldsForMedia, setCustomFieldForMedia } from '../db/customFieldRepository'
import type { CustomFieldValue, IpcResult } from '../../shared/types'

export function registerCustomFieldsIpc(): void {
  ipcMain.handle('customFields:getForMedia', (_event, payload: unknown): IpcResult<CustomFieldValue[]> => {
    const mediaId = (payload as { mediaId?: unknown })?.mediaId
    if (typeof mediaId !== 'number') {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric mediaId is required' } }
    }
    return { ok: true, data: getCustomFieldsForMedia(mediaId) }
  })

  ipcMain.handle('customFields:setForMedia', (_event, payload: unknown): IpcResult<{ ok: true }> => {
    const { mediaId, fieldName, fieldValue } = (payload ?? {}) as {
      mediaId?: unknown
      fieldName?: unknown
      fieldValue?: unknown
    }
    if (typeof mediaId !== 'number' || typeof fieldName !== 'string' || !fieldName.trim()) {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric mediaId and fieldName are required' } }
    }
    setCustomFieldForMedia(mediaId, fieldName, typeof fieldValue === 'string' ? fieldValue : null)
    return { ok: true, data: { ok: true } }
  })
}
