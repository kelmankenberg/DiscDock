import { app, BrowserWindow, ipcMain } from 'electron'
import type { IpcResult, WindowState } from '../../shared/types'
import { isTrustedRendererEvent } from './validation'

// Window-control channels only ever act on the given BrowserWindow instance —
// no renderer-supplied window handle is ever accepted.
export function registerWindowControlIpc(win: BrowserWindow): void {
  ipcMain.handle('window:minimize', (event): IpcResult<null> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    win.minimize()
    return { ok: true, data: null }
  })

  ipcMain.handle('window:maximize', (event): IpcResult<null> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
    return { ok: true, data: null }
  })

  ipcMain.handle('window:close', (event): IpcResult<null> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    win.close()
    return { ok: true, data: null }
  })

  ipcMain.handle('window:isMaximized', (event): IpcResult<WindowState> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    return { ok: true, data: { maximized: win.isMaximized() } }
  })

  ipcMain.handle('app:restart', (event): IpcResult<null> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    app.relaunch()
    app.exit(0)
    return { ok: true, data: null }
  })

  ipcMain.handle('app:toggleDevTools', (event): IpcResult<null> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    win.webContents.toggleDevTools()
    return { ok: true, data: null }
  })

  const sendState = (): void => {
    win.webContents.send('window:stateChanged', { maximized: win.isMaximized() } satisfies WindowState)
  }
  win.on('maximize', sendState)
  win.on('unmaximize', sendState)
}
