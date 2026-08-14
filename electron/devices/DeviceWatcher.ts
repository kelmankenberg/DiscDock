import { listConnectedDevices } from './deviceDetection'
import type { DetectedDevice } from '../../shared/types'
import { log } from '../logging'

const POLL_INTERVAL_MS = 3000

export class DeviceWatcher {
  private timer: NodeJS.Timeout | null = null
  private known = new Map<string, DetectedDevice>()

  constructor(
    private readonly onConnected: (device: DetectedDevice) => void,
    private readonly onDisconnected: (devicePath: string) => void
  ) {}

  async start(): Promise<void> {
    log.info('Device watcher starting')
    await this.poll()
    this.timer = setInterval(() => void this.poll(), POLL_INTERVAL_MS)
  }

  stop(): void {
    log.info('Device watcher stopping')
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  getKnownDevices(): DetectedDevice[] {
    return Array.from(this.known.values())
  }

  private async poll(): Promise<void> {
    const current = await listConnectedDevices()
    log.debug('Device watcher poll completed', { deviceCount: current.length })
    const currentPaths = new Set(current.map((d) => d.devicePath))

    for (const device of current) {
      const known = this.known.get(device.devicePath)
      // Swapping discs keeps the same drive path, so treat a changed fingerprint as a new device.
      if (known && known.uuid !== device.uuid) {
        this.known.delete(device.devicePath)
        this.onDisconnected(device.devicePath)
      }
      if (!this.known.has(device.devicePath)) {
        this.known.set(device.devicePath, device)
        this.onConnected(device)
      }
    }

    for (const devicePath of this.known.keys()) {
      if (!currentPaths.has(devicePath)) {
        this.known.delete(devicePath)
        this.onDisconnected(devicePath)
      }
    }
  }
}
