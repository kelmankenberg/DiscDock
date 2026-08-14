import { ipcMain } from 'electron'
import { getCustomFieldsForMedia, setCustomFieldForMedia } from '../db/customFieldRepository'
import type { CustomFieldValue, IpcResult } from '../../shared/types'
import { isNonEmptyString, isPositiveInteger, isRecord, isTrustedRendererEvent } from './validation'

export function registerCustomFieldsIpc(): void {
  ipcMain.handle('customFields:getForMedia', (event, payload: unknown): IpcResult<CustomFieldValue[]> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    const mediaId = isRecord(payload) ? payload.mediaId : undefined
    if (!isPositiveInteger(mediaId)) {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric mediaId is required' } }
    }
    return { ok: true, data: getCustomFieldsForMedia(mediaId) }
  })

  ipcMain.handle('customFields:setForMedia', (event, payload: unknown): IpcResult<{ ok: true }> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    const candidate = isRecord(payload) ? payload : {}
    const { mediaId, fieldName, fieldValue } = candidate
    if (!isPositiveInteger(mediaId) || !isNonEmptyString(fieldName)) {
      return { ok: false, error: { code: 'invalid_input', message: 'A numeric mediaId and fieldName are required' } }
    }
    if (fieldValue !== undefined && fieldValue !== null && typeof fieldValue !== 'string') return { ok: false, error: { code: 'invalid_input', message: 'fieldValue must be a string or null' } }
    setCustomFieldForMedia(mediaId, fieldName.trim(), typeof fieldValue === 'string' ? fieldValue : null)
    return { ok: true, data: { ok: true } }
  })
}
