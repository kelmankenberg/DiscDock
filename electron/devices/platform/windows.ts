import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { DetectedDevice } from '../../../shared/types'

const execFileAsync = promisify(execFile)

// Win32_LogicalDisk DriveType values we care about.
const DRIVE_TYPE_REMOVABLE = 2
const DRIVE_TYPE_CDROM = 5

interface LogicalDisk {
  DeviceID: string
  VolumeName: string | null
  FileSystem: string | null
  Size: number | string | null
  VolumeSerialNumber: string | null
  DriveType: number
}

async function powershell(script: string): Promise<string> {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    { windowsHide: true }
  )
  return stdout
}

function toBytes(size: number | string | null): number | null {
  if (size === null) return null
  const n = Number(size)
  return Number.isFinite(n) ? n : null
}

/** Detects mounted removable and optical volumes via Win32_LogicalDisk. */
export async function listConnectedDevices(): Promise<DetectedDevice[]> {
  try {
    const stdout = await powershell(
      'Get-CimInstance Win32_LogicalDisk | ' +
        `Where-Object { $_.DriveType -eq ${DRIVE_TYPE_REMOVABLE} -or $_.DriveType -eq ${DRIVE_TYPE_CDROM} } | ` +
        'Select-Object DeviceID,VolumeName,FileSystem,Size,VolumeSerialNumber,DriveType | ' +
        'ConvertTo-Json -Compress'
    )
    if (!stdout.trim()) return []

    const parsed = JSON.parse(stdout) as LogicalDisk | LogicalDisk[]
    const disks = Array.isArray(parsed) ? parsed : [parsed]

    return disks
      // A CD-ROM drive with no disc still enumerates, but reports no filesystem.
      .filter((disk) => Boolean(disk.DeviceID) && Boolean(disk.FileSystem))
      .map((disk) => ({
        devicePath: disk.DeviceID,
        label: disk.VolumeName || null,
        fsType: disk.FileSystem || null,
        mountPoint: `${disk.DeviceID}\\`,
        sizeBytes: toBytes(disk.Size),
        uuid: disk.VolumeSerialNumber || null,
        isOptical: disk.DriveType === DRIVE_TYPE_CDROM,
        isAudioCd: false
      }))
  } catch {
    return []
  }
}

/** Uses the shell's own Eject verb, which handles both optical trays and safe USB removal. */
export async function ejectDevice(devicePath: string, _isOptical: boolean): Promise<string> {
  const driveLetter = devicePath.replace(/\\+$/, '')
  try {
    await powershell(
      `$shell = New-Object -ComObject Shell.Application; ` +
        `$drive = $shell.Namespace(17).ParseName('${driveLetter}'); ` +
        `if ($null -eq $drive) { throw 'Drive ${driveLetter} not found' }; ` +
        `$drive.InvokeVerb('Eject')`
    )
    return 'Drive ejected — safe to remove.'
  } catch (err) {
    throw new Error(`Eject failed: ${(err as Error).message}`)
  }
}
