import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { getSettings } from '../settings/settingsStore'
import type { IpcResult, UpdateStatus } from '../../shared/types'
import { log } from '../logging'
import { isTrustedRendererEvent } from '../ipc/validation'

let win: BrowserWindow | null = null
let lastStatus: UpdateStatus = { state: 'idle' }

function publish(status: UpdateStatus): void {
  lastStatus = status
  win?.webContents.send('update:status', status)
}

/** Auto-update only works against a packaged, signed artifact with a configured publish target. */
function isSupported(): boolean {
  return app.isPackaged
}

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  win = mainWindow
  autoUpdater.autoDownload = false

  autoUpdater.on('checking-for-update', () => publish({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => publish({ state: 'available', version: info.version }))
  autoUpdater.on('update-not-available', () => publish({ state: 'up-to-date' }))
  autoUpdater.on('download-progress', (progress) =>
    publish({ state: 'downloading', percent: Math.round(progress.percent) })
  )
  autoUpdater.on('update-downloaded', (info) => publish({ state: 'downloaded', version: info.version }))
  autoUpdater.on('error', (err) => {
    log.error('Updater error', err)
    publish({ state: 'error', message: err.message })
  })

  if (isSupported() && getSettings().autoUpdateEnabled) {
    void autoUpdater.checkForUpdates().catch(() => undefined)
  }
}

export function registerUpdateIpc(): void {
  ipcMain.handle('update:status', (event): IpcResult<UpdateStatus> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    return { ok: true, data: lastStatus }
  })

  ipcMain.handle('update:check', async (event): Promise<IpcResult<UpdateStatus>> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    if (!isSupported()) {
      const status: UpdateStatus = {
        state: 'error',
        message: 'Updates are only available in an installed build.'
      }
      publish(status)
      return { ok: true, data: status }
    }
    try {
      log.info('Update check requested')
      await autoUpdater.checkForUpdates()
      return { ok: true, data: lastStatus }
    } catch (err) {
      log.error('Update check failed', err)
      return { ok: false, error: { code: 'update_error', message: (err as Error).message } }
    }
  })

  ipcMain.handle('update:download', async (event): Promise<IpcResult<{ started: true }>> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    if (!isSupported()) {
      return {
        ok: false,
        error: { code: 'update_error', message: 'Updates are only available in an installed build.' }
      }
    }
    try {
      log.info('Update download requested')
      await autoUpdater.downloadUpdate()
      return { ok: true, data: { started: true } }
    } catch (err) {
      log.error('Update download failed', err)
      return { ok: false, error: { code: 'update_error', message: (err as Error).message } }
    }
  })

  ipcMain.handle('update:install', (event): IpcResult<null> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    if (lastStatus.state !== 'downloaded') {
      return { ok: false, error: { code: 'update_error', message: 'No downloaded update to install' } }
    }
    autoUpdater.quitAndInstall()
    return { ok: true, data: null }
  })
}
