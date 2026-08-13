import { app, BrowserWindow, ipcMain } from 'electron'
import type { IpcResult, WindowState } from '../../shared/types'

// Window-control channels only ever act on the given BrowserWindow instance —
// no renderer-supplied window handle is ever accepted.
export function registerWindowControlIpc(win: BrowserWindow): void {
  ipcMain.handle('window:minimize', (): IpcResult<null> => {
    win.minimize()
    return { ok: true, data: null }
  })

  ipcMain.handle('window:maximize', (): IpcResult<null> => {
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
    return { ok: true, data: null }
  })

  ipcMain.handle('window:close', (): IpcResult<null> => {
    win.close()
    return { ok: true, data: null }
  })

  ipcMain.handle('window:isMaximized', (): IpcResult<WindowState> => {
    return { ok: true, data: { maximized: win.isMaximized() } }
  })

  ipcMain.handle('app:restart', (): IpcResult<null> => {
    app.relaunch()
    app.exit(0)
    return { ok: true, data: null }
  })

  ipcMain.handle('app:toggleDevTools', (): IpcResult<null> => {
    win.webContents.toggleDevTools()
    return { ok: true, data: null }
  })

  const sendState = (): void => {
    win.webContents.send('window:stateChanged', { maximized: win.isMaximized() } satisfies WindowState)
  }
  win.on('maximize', sendState)
  win.on('unmaximize', sendState)
}
