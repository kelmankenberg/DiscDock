import { app, BrowserWindow, ipcMain } from 'electron'
import { createMainWindow } from './window/createWindow'
import { registerWindowControlIpc } from './ipc/windowControls'
import { registerDashboardIpc } from './ipc/dashboard'
import { getDb, closeDb } from './db'
import type { IpcResult } from '../shared/types'

let mainWindow: BrowserWindow | null = null

function registerAppIpc(): void {
  ipcMain.handle('app:getVersion', (): IpcResult<string> => {
    return { ok: true, data: app.getVersion() }
  })
}

app.whenReady().then(() => {
  getDb() // initialize database + run migrations before the window is shown

  mainWindow = createMainWindow()
  registerWindowControlIpc(mainWindow)
  registerDashboardIpc()
  registerAppIpc()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
      registerWindowControlIpc(mainWindow)
    }
  })
})

app.on('window-all-closed', () => {
  closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
