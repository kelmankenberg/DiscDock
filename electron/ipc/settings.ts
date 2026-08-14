import { ipcMain } from 'electron'
import { getSettings, updateSettings } from '../settings/settingsStore'
import type { AppSettings, IpcResult } from '../../shared/types'
import { isTrustedRendererEvent, validateSettingsPatch } from './validation'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', (event): IpcResult<AppSettings> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    return { ok: true, data: getSettings() }
  })

  ipcMain.handle('settings:update', (event, payload: unknown): IpcResult<AppSettings> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    const patch = validateSettingsPatch(payload)
    if (!patch) return { ok: false, error: { code: 'invalid_input', message: 'Invalid settings payload' } }
    return { ok: true, data: updateSettings(patch) }
  })
}
