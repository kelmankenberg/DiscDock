import { platformDevices } from './platform'
import type { DetectedDevice } from '../../shared/types'

/** Lists connected/mounted removable media using the current platform's implementation. */
export async function listConnectedDevices(): Promise<DetectedDevice[]> {
  return platformDevices().listConnectedDevices()
}
