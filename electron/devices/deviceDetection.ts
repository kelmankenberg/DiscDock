import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { DetectedDevice } from '../../shared/types'

const execFileAsync = promisify(execFile)

interface LsblkDevice {
  name: string
  label: string | null
  fstype: string | null
  mountpoint: string | null
  size: string | null
  rm: string | boolean
  type: string
  uuid: string | null
  children?: LsblkDevice[]
}

function toBytes(sizeStr: string | null): number | null {
  if (!sizeStr) return null
  const n = Number(sizeStr)
  return Number.isFinite(n) ? n : null
}

function flatten(devices: LsblkDevice[]): LsblkDevice[] {
  const result: LsblkDevice[] = []
  for (const device of devices) {
    result.push(device)
    if (device.children) result.push(...flatten(device.children))
  }
  return result
}

function isRemovable(device: LsblkDevice): boolean {
  return device.rm === true || device.rm === '1'
}

/**
 * Detect currently connected/mounted removable media via `lsblk`.
 * This is the documented fallback strategy (no udisks2 D-Bus dependency for v0.1.0).
 */
export async function listConnectedDevices(): Promise<DetectedDevice[]> {
  try {
    const { stdout } = await execFileAsync('lsblk', [
      '-J',
      '-b',
      '-o',
      'NAME,LABEL,FSTYPE,MOUNTPOINT,SIZE,RM,TYPE,UUID'
    ])
    const parsed = JSON.parse(stdout) as { blockdevices: LsblkDevice[] }
    const flat = flatten(parsed.blockdevices)

    return flat
      .filter((d) => isRemovable(d) && d.mountpoint && (d.type === 'part' || d.type === 'rom'))
      .map((d) => ({
        devicePath: `/dev/${d.name}`,
        label: d.label ?? null,
        fsType: d.fstype ?? null,
        mountPoint: d.mountpoint as string,
        sizeBytes: toBytes(d.size),
        uuid: d.uuid ?? null,
        isOptical: d.type === 'rom'
      }))
  } catch {
    // lsblk unavailable or failed — degrade gracefully to no auto-detected devices (FR-1.2/NFR-3.4).
    return []
  }
}
