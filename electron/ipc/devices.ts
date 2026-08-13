import { BrowserWindow, ipcMain } from 'electron'
import { DeviceWatcher } from '../devices/DeviceWatcher'
import type { DetectedDevice, IpcResult } from '../../shared/types'

let watcher: DeviceWatcher | null = null

export function startDeviceWatcher(win: BrowserWindow): DeviceWatcher {
  watcher = new DeviceWatcher(
    (device) => win.webContents.send('devices:connected', device),
    (devicePath) => win.webContents.send('devices:disconnected', { devicePath })
  )
  void watcher.start()
  return watcher
}

export function stopDeviceWatcher(): void {
  watcher?.stop()
  watcher = null
}

export function registerDeviceIpc(): void {
  ipcMain.handle('devices:list', (): IpcResult<DetectedDevice[]> => {
    return { ok: true, data: watcher?.getKnownDevices() ?? [] }
  })
}
