import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { IpcResult } from '../../shared/types'
import { isNonEmptyString, isRecord } from './validation'

export function registerDialogIpc(win: BrowserWindow): void {
  ipcMain.handle('dialog:pickFolder', async (): Promise<IpcResult<{ path: string | null }>> => {
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: true, data: { path: null } }
    }
    return { ok: true, data: { path: result.filePaths[0] } }
  })

  ipcMain.handle(
    'dialog:pickSaveFile',
    async (_event, payload: unknown): Promise<IpcResult<{ path: string | null }>> => {
      const defaultName = isRecord(payload) ? payload.defaultName : undefined
      if (defaultName !== undefined && !isNonEmptyString(defaultName)) {
        return { ok: false, error: { code: 'invalid_input', message: 'defaultName must be a non-empty string' } }
      }
      const result = await dialog.showSaveDialog(win, {
        defaultPath: defaultName
      })
      if (result.canceled || !result.filePath) {
        return { ok: true, data: { path: null } }
      }
      return { ok: true, data: { path: result.filePath } }
    }
  )

  ipcMain.handle('dialog:pickOpenFile', async (): Promise<IpcResult<{ path: string | null }>> => {
    const result = await dialog.showOpenDialog(win, { properties: ['openFile'] })
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: true, data: { path: null } }
    }
    return { ok: true, data: { path: result.filePaths[0] } }
  })
}
