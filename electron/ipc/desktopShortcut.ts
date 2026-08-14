import { ipcMain } from 'electron'
import {
  createDesktopShortcut,
  getDesktopShortcutStatus,
  removeDesktopShortcut
} from '../desktop/desktopShortcut'
import type { DesktopShortcutStatus, IpcResult } from '../../shared/types'
import { isTrustedRendererEvent } from './validation'

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}

export function registerDesktopShortcutIpc(): void {
  ipcMain.handle('desktopShortcut:status', (event): IpcResult<DesktopShortcutStatus> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    return { ok: true, data: getDesktopShortcutStatus() }
  })

  ipcMain.handle('desktopShortcut:create', async (event): Promise<IpcResult<DesktopShortcutStatus>> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    try {
      return { ok: true, data: await createDesktopShortcut() }
    } catch (error) {
      return { ok: false, error: { code: 'internal', message: toMessage(error) } }
    }
  })

  ipcMain.handle('desktopShortcut:remove', (event): IpcResult<DesktopShortcutStatus> => {
    if (!isTrustedRendererEvent(event)) return { ok: false, error: { code: 'forbidden', message: 'Untrusted renderer' } }
    try {
      return { ok: true, data: removeDesktopShortcut() }
    } catch (error) {
      return { ok: false, error: { code: 'internal', message: toMessage(error) } }
    }
  })
}
