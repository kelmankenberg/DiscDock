import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { IpcResult } from '../../shared/types'

export function registerDialogIpc(win: BrowserWindow): void {
  ipcMain.handle('dialog:pickFolder', async (): Promise<IpcResult<{ path: string | null }>> => {
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: true, data: { path: null } }
    }
    return { ok: true, data: { path: result.filePaths[0] } }
  })
}
