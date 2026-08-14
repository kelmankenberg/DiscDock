import { BrowserWindow, ipcMain } from 'electron'
import { DeviceWatcher } from '../devices/DeviceWatcher'
import { ejectDevice } from '../devices/deviceEject'
import type { DetectedDevice, IpcResult } from '../../shared/types'
import { isNonEmptyString, isRecord } from './validation'
import { log } from '../logging'

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
    const candidate = isRecord(payload) ? payload : {}
    const { devicePath, isOptical } = candidate
    if (!isNonEmptyString(devicePath)) {
      return { ok: false, error: { code: 'invalid_input', message: 'A devicePath is required' } }
    }
    if (typeof isOptical !== 'boolean') return { ok: false, error: { code: 'invalid_input', message: 'isOptical must be a boolean' } }
    try {
      log.info('Device removal requested', { devicePath, isOptical })
      const message = await ejectDevice(devicePath, isOptical)
      log.info('Device removal completed', { devicePath, isOptical })
      return { ok: true, data: { message } }
    } catch (err) {
      log.error('Device removal failed', { devicePath, isOptical, error: err })
      return { ok: false, error: { code: 'eject_error', message: (err as Error).message } }
    }
  })
}
