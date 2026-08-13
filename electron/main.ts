import { app, BrowserWindow, ipcMain } from 'electron'
import { createMainWindow } from './window/createWindow'
import { registerWindowControlIpc } from './ipc/windowControls'
import { registerDashboardIpc } from './ipc/dashboard'
import { registerMediaIpc } from './ipc/media'
import { registerDeviceIpc, startDeviceWatcher, stopDeviceWatcher } from './ipc/devices'
import { registerScanIpc } from './ipc/scan'
import { registerDialogIpc } from './ipc/dialogs'
import { registerSearchIpc } from './ipc/search'
import { initScanManager } from './scanning/scanManager'
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
  registerMediaIpc()
  registerDeviceIpc()
  registerAppIpc()
  registerScanIpc()
  registerDialogIpc(mainWindow)
  registerSearchIpc()
  initScanManager(mainWindow)
  startDeviceWatcher(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
      registerWindowControlIpc(mainWindow)
    }
  })
})

app.on('window-all-closed', () => {
  stopDeviceWatcher()
  closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
