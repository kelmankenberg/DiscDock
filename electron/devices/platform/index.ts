import type { DetectedDevice } from '../../../shared/types'
import * as linux from './linux'
import * as macos from './macos'
import * as windows from './windows'

interface PlatformDevices {
  listConnectedDevices: () => Promise<DetectedDevice[]>
  ejectDevice: (devicePath: string, isOptical: boolean) => Promise<string>
}

const unsupported: PlatformDevices = {
  listConnectedDevices: async () => [],
  ejectDevice: async () => {
    throw new Error(`Ejecting media is not supported on ${process.platform}`)
  }
}

export function platformDevices(): PlatformDevices {
  switch (process.platform) {
    case 'linux':
      return linux
    case 'win32':
      return windows
    case 'darwin':
      return macos
    default:
      return unsupported
  }
}
