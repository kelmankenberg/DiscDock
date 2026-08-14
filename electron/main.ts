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
import { initAutoUpdater, registerUpdateIpc } from './updates/autoUpdater'
import { countMediaNeedingVerification } from './db/mediaRepository'
import { getSettings } from './settings/settingsStore'
import { getDb, closeDb } from './db'
import type { IpcResult } from '../shared/types'
import { initializeLogging, log, logShutdown } from './logging'

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

/** Extracts the media id from a discdock://media/<id> deep link (as encoded on printed labels). */
function parseMediaDeepLink(url: string): number | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'discdock:') return null
    const segments = `${parsed.hostname}${parsed.pathname}`.split('/').filter(Boolean)
    if (segments[0] !== 'media') return null
    const id = Number(segments[1])
    return Number.isInteger(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

function handleDeepLink(url: string): void {
  const mediaId = parseMediaDeepLink(url)
  if (mediaId === null || !mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
  mainWindow.webContents.send('app:openMedia', { mediaId })
}

function handleDeepLinkFromArgv(argv: string[]): void {
  const url = argv.find((arg) => arg.startsWith('discdock://'))
  if (url) handleDeepLink(url)
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => handleDeepLinkFromArgv(argv))
  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleDeepLink(url)
  })
}

initializeLogging()

app.whenReady().then(() => {
  log.info('Electron ready')
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

  registerUpdateIpc()
  initAutoUpdater(mainWindow)

  app.setAsDefaultProtocolClient('discdock')
  mainWindow.webContents.once('did-finish-load', () => handleDeepLinkFromArgv(process.argv))

  showVerificationReminder()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
      registerWindowControlIpc(mainWindow)
    }
  })
})

app.on('window-all-closed', () => {
  logShutdown()
  stopDeviceWatcher()
  closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
