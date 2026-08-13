import { ipcMain } from 'electron'
import { getSettings, updateSettings } from '../settings/settingsStore'
import type { AppSettings, IpcResult } from '../../shared/types'

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:get', (): IpcResult<AppSettings> => {
    return { ok: true, data: getSettings() }
  })

  ipcMain.handle('settings:update', (_event, payload: unknown): IpcResult<AppSettings> => {
    const patch = (payload && typeof payload === 'object' ? payload : {}) as Partial<AppSettings>
    return { ok: true, data: updateSettings(patch) }
  })
}
