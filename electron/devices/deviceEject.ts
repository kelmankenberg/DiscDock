import { platformDevices } from './platform'

/**
 * Ejects/detaches a removable device so it's safe to disconnect, using the current platform's
 * implementation.
 */
export async function ejectDevice(devicePath: string, isOptical: boolean): Promise<string> {
  return platformDevices().ejectDevice(devicePath, isOptical)
}
