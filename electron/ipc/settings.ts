import { ipcMain } from 'electron'
import { getSettings, updateSettings } from '../settings/settingsStore'
import type { AppSettings, IpcResult } from '../../shared/types'
import { validateSettingsPatch } from './validation'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', (): IpcResult<AppSettings> => {
    return { ok: true, data: getSettings() }
  })

  ipcMain.handle('settings:update', (_event, payload: unknown): IpcResult<AppSettings> => {
    const patch = validateSettingsPatch(payload)
    if (!patch) return { ok: false, error: { code: 'invalid_input', message: 'Invalid settings payload' } }
    return { ok: true, data: updateSettings(patch) }
  })
}
