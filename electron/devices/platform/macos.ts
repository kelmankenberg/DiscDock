import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { DetectedDevice } from '../../../shared/types'

const execFileAsync = promisify(execFile)

/** Parses `diskutil info` output, which is a flat list of "  Key:   Value" lines. */
function parseDiskutilInfo(stdout: string): Record<string, string> {
  const info: Record<string, string> = {}
  for (const line of stdout.split('\n')) {
    const separator = line.indexOf(':')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (key) info[key] = value
  }
  return info
}

function isYes(value: string | undefined): boolean {
  return value?.toLowerCase().startsWith('yes') ?? false
}

function parseBytes(value: string | undefined): number | null {
  // e.g. "Disk Size: 15.9 GB (15931539456 Bytes) (exactly 31116288 512-Byte-Units)"
  const match = value?.match(/\((\d+) Bytes\)/)
  return match ? Number(match[1]) : null
}

/** Mount lines look like: `/dev/disk2s1 on /Volumes/USB (msdos, local, nodev, noowners)` */
function parseMounts(stdout: string): { devicePath: string; mountPoint: string }[] {
  const mounts: { devicePath: string; mountPoint: string }[] = []
  for (const line of stdout.split('\n')) {
    const match = line.match(/^(\/dev\/\S+) on (\/Volumes\/[^(]+?)\s+\(/)
    if (match) mounts.push({ devicePath: match[1], mountPoint: match[2] })
  }
  return mounts
}

/** Detects mounted removable/optical volumes under /Volumes via `mount` + `diskutil info`. */
export async function listConnectedDevices(): Promise<DetectedDevice[]> {
  try {
    const { stdout } = await execFileAsync('mount')
    const mounts = parseMounts(stdout)

    const devices = await Promise.all(
      mounts.map(async ({ devicePath, mountPoint }) => {
        try {
          const { stdout: infoOut } = await execFileAsync('diskutil', ['info', devicePath])
          const info = parseDiskutilInfo(infoOut)

          const isOptical = isYes(info['Optical Media Type']) || info['Protocol'] === 'ATAPI'
          const removable = isYes(info['Removable Media']) || isYes(info['Ejectable']) || isOptical
          if (!removable) return null

          return {
            devicePath,
            label: info['Volume Name'] || null,
            fsType: info['Type (Bundle)'] || info['File System Personality'] || null,
            mountPoint,
            sizeBytes: parseBytes(info['Volume Total Space'] ?? info['Disk Size']),
            uuid: info['Volume UUID'] || null,
            isOptical
          } satisfies DetectedDevice
        } catch {
          return null
        }
      })
    )

    return devices.filter((device): device is DetectedDevice => device !== null)
  } catch {
    return []
  }
}

export async function ejectDevice(devicePath: string, _isOptical: boolean): Promise<string> {
  try {
    await execFileAsync('diskutil', ['eject', devicePath])
    return 'Drive ejected — safe to remove.'
  } catch (err) {
    const detail = (err as Error & { stderr?: string }).stderr?.trim() || (err as Error).message
    if (/busy|in use/i.test(detail)) {
      throw new Error(`Eject failed: ${detail} — close any apps using this media and try again.`)
    }
    throw new Error(`Eject failed: ${detail}`)
  }
}
