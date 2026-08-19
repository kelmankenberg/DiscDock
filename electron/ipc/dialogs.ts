import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { IpcResult } from '../../shared/types'
import { isNonEmptyString, isRecord, isTrustedRendererEvent } from './validation'

export function registerDialogIpc(win: BrowserWindow): void {
  ipcMain.handle('dialog:pickFolder', async (event): Promise<IpcResult<{ path: string | null }>> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    const result = await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: true, data: { path: null } }
    }
    return { ok: true, data: { path: result.filePaths[0] } }
  })

  ipcMain.handle(
    'dialog:pickSaveFile',
    async (event, payload: unknown): Promise<IpcResult<{ path: string | null }>> => {
      if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
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

  ipcMain.handle('dialog:pickOpenFile', async (event, payload: unknown): Promise<IpcResult<{ path: string | null }>> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    const candidate = isRecord(payload) ? payload : {}
    const imagesOnly = candidate.imagesOnly
    if (imagesOnly !== undefined && typeof imagesOnly !== 'boolean') {
      return { ok: false, error: { code: 'invalid_input', message: 'imagesOnly must be a boolean' } }
    }

    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters:
        imagesOnly === true
          ? [
              {
                name: 'Images',
                extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tif', 'tiff']
              }
            ]
          : undefined
    })
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: true, data: { path: null } }
    }
    return { ok: true, data: { path: result.filePaths[0] } }
  })
}
