import { BrowserWindow, ipcMain } from 'electron'
import { DeviceWatcher } from '../devices/DeviceWatcher'
import { ejectDevice } from '../devices/deviceEject'
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

  ipcMain.handle('devices:eject', async (_event, payload: unknown): Promise<IpcResult<{ message: string }>> => {
    const { devicePath, isOptical } = (payload ?? {}) as { devicePath?: unknown; isOptical?: unknown }
    if (typeof devicePath !== 'string' || !devicePath.trim()) {
      return { ok: false, error: { code: 'invalid_input', message: 'A devicePath is required' } }
    }
    try {
      const message = await ejectDevice(devicePath, Boolean(isOptical))
      return { ok: true, data: { message } }
    } catch (err) {
      return { ok: false, error: { code: 'eject_error', message: (err as Error).message } }
    }
  })
}
