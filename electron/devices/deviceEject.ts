import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Ejects/detaches a removable device so it's safe to disconnect.
 * Optical drives: `eject` unmounts and opens the tray in one step.
 * USB/external drives: `udisksctl unmount` then `power-off` fully detaches the block device
 * (equivalent to "Safely Remove Hardware") — neither requires root for the user's own session-mounted media.
 */
export async function ejectDevice(devicePath: string, isOptical: boolean): Promise<string> {
  if (isOptical) {
    await execFileAsync('eject', [devicePath])
    return 'Disc ejected.'
  }

  await execFileAsync('udisksctl', ['unmount', '-b', devicePath])
  try {
    await execFileAsync('udisksctl', ['power-off', '-b', devicePath])
    return 'Drive unmounted and powered off — safe to unplug.'
  } catch {
    // power-off isn't supported on all udisks2 versions/devices; unmount alone is still safe to remove.
    return 'Drive unmounted — safe to unplug.'
  }
}
