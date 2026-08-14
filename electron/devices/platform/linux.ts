import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { DetectedDevice } from '../../../shared/types'

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

interface ExecError extends Error {
  stdout?: string
  stderr?: string
}

const BUSY_ADVICE = 'close any file manager windows or programs browsing this media and try again.'

function describeFailure(err: unknown): string {
  const execErr = err as ExecError
  const detail = execErr.stderr?.trim() || execErr.stdout?.trim() || execErr.message

  // "eject" spins the drive down as its first step even when the final unmount/tray-open fails,
  // so a busy mount can look like "nothing happened" rather than a clear error. Common cause:
  // a file manager window (auto-opened by desktop automount-open settings) still browsing the disc.
  if (/busy|in use/i.test(detail)) {
    return `${detail} — ${BUSY_ADVICE}`
  }
  return detail
}

/** Some `eject` builds exit 0 even when the tray-open step silently failed (e.g. busy mount). */
async function isStillMounted(devicePath: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('lsblk', ['-no', 'MOUNTPOINT', devicePath])
    return stdout.trim().length > 0
  } catch {
    return false // device likely gone entirely (ejected) — lsblk failing to find it counts as success
  }
}

/**
 * Optical drives: unmount first (in case something other than a plain filesystem mount, e.g. a
 * desktop file manager's GVFS mount, is holding it), then `eject` opens the tray.
 * USB/external drives: `udisksctl unmount` then `power-off` fully detaches the block device
 * (equivalent to "Safely Remove Hardware") — neither requires root for session-mounted media.
 */
export async function ejectDevice(devicePath: string, isOptical: boolean): Promise<string> {
  if (isOptical) {
    // Best-effort pre-unmount: ignore failures here (e.g. "not mounted"), the real failure signal
    // is whether the subsequent eject actually opens the tray.
    try {
      await execFileAsync('udisksctl', ['unmount', '-b', devicePath])
    } catch {
      // ignore — device may already be unmounted, or udisksctl doesn't manage this mount
    }

    try {
      await execFileAsync('eject', ['-v', devicePath])
    } catch (err) {
      throw new Error(`Eject failed: ${describeFailure(err)}`)
    }

    if (await isStillMounted(devicePath)) {
      throw new Error(`Eject reported success but the disc is still mounted — ${BUSY_ADVICE}`)
    }
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
