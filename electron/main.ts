import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import { createMainWindow } from './window/createWindow'
import { registerWindowControlIpc } from './ipc/windowControls'
import { registerDashboardIpc } from './ipc/dashboard'
import { registerMediaIpc } from './ipc/media'
import { registerDeviceIpc, startDeviceWatcher, stopDeviceWatcher } from './ipc/devices'
import { registerScanIpc } from './ipc/scan'
import { registerDialogIpc } from './ipc/dialogs'
import { registerSearchIpc } from './ipc/search'
import { registerDuplicatesIpc } from './ipc/duplicates'
import { registerFilesIpc } from './ipc/files'
import { registerSettingsIpc } from './ipc/settings'
import { registerBackupIpc } from './ipc/backup'
import { registerTagsIpc } from './ipc/tags'
import { registerCollectionsIpc } from './ipc/collections'
import { registerExportIpc } from './ipc/export'
import { registerCustomFieldsIpc } from './ipc/customFields'
import { initScanManager } from './scanning/scanManager'
import { countMediaNeedingVerification } from './db/mediaRepository'
import { getSettings } from './settings/settingsStore'
import { getDb, closeDb } from './db'
import type { IpcResult } from '../shared/types'

let mainWindow: BrowserWindow | null = null

function showVerificationReminder(): void {
  const settings = getSettings()
  if (!settings.notifications.verificationReminders) return
  const count = countMediaNeedingVerification(settings.verificationThresholdMonths)
  if (count === 0) return
  new Notification({
    title: 'DiscDock',
    body: `${count} media item${count === 1 ? '' : 's'} ${count === 1 ? 'has' : 'have'} not been verified in the last ${settings.verificationThresholdMonths} months.`
  }).show()
}

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
  registerDuplicatesIpc()
  registerFilesIpc()
  registerSettingsIpc()
  registerBackupIpc()
  registerTagsIpc()
  registerCollectionsIpc()
  registerExportIpc()
  registerCustomFieldsIpc()
  initScanManager(mainWindow)
  startDeviceWatcher(mainWindow)

  showVerificationReminder()

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
