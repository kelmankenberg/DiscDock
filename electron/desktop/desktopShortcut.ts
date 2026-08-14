import { app } from 'electron'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import type { DesktopShortcutStatus } from '../../shared/types'
import { log } from '../logging'

const execFileAsync = promisify(execFile)

const ENTRY_FILE_NAME = 'discdock.desktop'
const SYSTEM_ENTRY_PATH = `/usr/share/applications/${ENTRY_FILE_NAME}`

function shortcutPath(): string {
  return path.join(app.getPath('desktop'), ENTRY_FILE_NAME)
}

/** AppImage builds run from a temporary mount, so the launcher must point at the original file. */
function executablePath(): string {
  return process.env.APPIMAGE ?? app.getPath('exe')
}

function generateEntry(): string {
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=DiscDock',
    'Comment=Catalog and search your external/removable media collection',
    `Exec="${executablePath()}" %U`,
    'Icon=discdock',
    'Terminal=false',
    'Categories=Utility;FileTools;',
    'StartupWMClass=DiscDock',
    'MimeType=x-scheme-handler/discdock;',
    ''
  ].join('\n')
}

function entryContents(): string {
  // A packaged install already ships a correct entry; copying it keeps the icon and Exec in sync.
  try {
    return fs.readFileSync(SYSTEM_ENTRY_PATH, 'utf8')
  } catch {
    return generateEntry()
  }
}

/** Cinnamon/GNOME refuse to launch a desktop launcher unless it is executable and marked trusted. */
async function markTrusted(target: string): Promise<void> {
  try {
    await execFileAsync('gio', ['set', target, 'metadata::trusted', 'true'])
  } catch (error) {
    log.warn('Could not mark desktop shortcut as trusted', error)
  }
}

export function getDesktopShortcutStatus(): DesktopShortcutStatus {
  if (process.platform !== 'linux') return { supported: false, exists: false, path: null }
  const target = shortcutPath()
  return { supported: true, exists: fs.existsSync(target), path: target }
}

export async function createDesktopShortcut(): Promise<DesktopShortcutStatus> {
  if (process.platform !== 'linux') throw new Error('Desktop shortcuts are only supported on Linux')
  const target = shortcutPath()
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, entryContents(), { mode: 0o755 })
  fs.chmodSync(target, 0o755)
  await markTrusted(target)
  log.info('Desktop shortcut created', { path: target })
  return getDesktopShortcutStatus()
}

export function removeDesktopShortcut(): DesktopShortcutStatus {
  if (process.platform !== 'linux') throw new Error('Desktop shortcuts are only supported on Linux')
  const target = shortcutPath()
  fs.rmSync(target, { force: true })
  log.info('Desktop shortcut removed', { path: target })
  return getDesktopShortcutStatus()
}
