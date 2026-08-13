import { listConnectedDevices } from './deviceDetection'
import type { DetectedDevice } from '../../shared/types'

const POLL_INTERVAL_MS = 3000

export class DeviceWatcher {
  private timer: NodeJS.Timeout | null = null
  private known = new Map<string, DetectedDevice>()

  constructor(
    private readonly onConnected: (device: DetectedDevice) => void,
    private readonly onDisconnected: (devicePath: string) => void
  ) {}

  async start(): Promise<void> {
    await this.poll()
    this.timer = setInterval(() => void this.poll(), POLL_INTERVAL_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  getKnownDevices(): DetectedDevice[] {
    return Array.from(this.known.values())
  }

  private async poll(): Promise<void> {
    const current = await listConnectedDevices()
    const currentPaths = new Set(current.map((d) => d.devicePath))

    for (const device of current) {
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
